"""Ороишгоҳи AI: сурати одам + сурати либос → сурати одам дар ҳамон либос.

Провайдерҳо, бо тартиб:
  1. FASHN API (пулакӣ, тез, сифати беҳтарин) — агар FASHN_API_KEY бошад.
  2. Leffa дар Hugging Face (ройгон, бе калид) — болопӯш, поёнпӯш ва либоси пурра (арӯсӣ, атлас).
  3. IDM-VTON дар Hugging Face (ройгон, танҳо болопӯш) — захира, агар Leffa кор накунад.
  HF_TOKEN квотаи ройгони GPU-ро зиёд мекунад; ҳарду тавассути gradio_client.

Гирди провайдер: сурати одам то 3:4 пур карда мешавад (на кашида), либос дар заминаи сафед миёна мешавад,
баъд пуркунӣ бурида мешавад ва рӯю мӯйи аслӣ бо ниқоби нарм бармегарданд — AI рӯйро тағйир намедиҳад.
Pillow, numpy, OpenCV ва gradio_client танҳо ҳангоми истифода бор мешаванд, то сервер бе онҳо ҳам оғоз шавад.
"""
import base64
import io
import json
import tempfile
import threading
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import get_settings

HF_SPACE = "yisol/IDM-VTON"
LEFFA_SPACE = "franciszzj/Leffa"
# upper/lower/full → (модели Leffa, навъи либос)
LEFFA_TYPES = {"upper": ("viton_hd", "upper_body"), "lower": ("dress_code", "lower_body"), "full": ("dress_code", "dresses")}
TIMEOUT = 180  # сония барои тамоми кор, ҳамаи провайдерҳо якҷоя
SIZE = (768, 1024)  # чорчӯбаи 3:4, ки ҳарду провайдер бо он беҳтар кор мекунанд

# Категорияҳои либос → кадом қисми бадан пӯшонда мешавад (upper / lower / full).
WEARABLE = {
    "suit": "upper",
    "chapan": "upper",
    "wedding-dress": "full",
    "national-dress": "full",
}
# IDM-VTON бо тавсифи англисии либос омӯхта шудааст: "<ранг> <либос>".
GARMENTS = {
    "suit": "classic suit jacket",
    "chapan": "embroidered velvet chapan robe",
    "wedding-dress": "wedding dress",
    "national-dress": "embroidered traditional dress",
}
COLOURS = {"сиёҳ": "black", "сафед": "white", "кабуд": "blue", "сурх": "red", "тиллоӣ": "gold", "бордо": "burgundy", "сабз": "green"}
FASHN_CATEGORY = {"upper": "tops", "lower": "bottoms", "full": "one-pieces"}


def describe(title: str, category_slug: str) -> str:
    name = title.lower()
    colour = next((en for tg, en in COLOURS.items() if tg in name), "")
    return f"{colour} {GARMENTS.get(category_slug, 'clothing')}".strip()


class TryOnError(Exception):
    pass


class TryOnTimeout(TryOnError):
    pass


class TryOnQuota(TryOnError):
    """Квотаи ройгони GPU тамом шуд (бе HF_TOKEN — барои IP, бо он — барои ҳисоб)."""


# --- FASHN -----------------------------------------------------------------

def _fashn_call(method, path, body=None):
    s = get_settings()
    request = Request(
        f"{s.fashn_api_url}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": f"Bearer {s.fashn_api_key}", "Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read())
    except HTTPError as error:
        raise TryOnError(f"FASHN {error.code}") from error
    except URLError as error:
        raise TryOnError(f"FASHN unreachable: {error.reason}") from error


def _data_uri(jpeg):
    return "data:image/jpeg;base64," + base64.b64encode(jpeg).decode()


def _fashn(person, garment, category, description, deadline):
    started = _fashn_call("POST", "/v1/run", {
        "model_name": "tryon-v1.6",
        "inputs": {
            "model_image": _data_uri(person),
            "garment_image": _data_uri(garment),
            "category": FASHN_CATEGORY.get(category, "auto"),
            "seed": 42,
            "mode": "balanced",
            "output_format": "jpeg",
            "return_base64": True,
        },
    })
    if started.get("error") or not started.get("id"):
        raise TryOnError(f"FASHN: {started.get('error')}")
    while time.monotonic() < deadline:
        time.sleep(2)
        state = _fashn_call("GET", f"/v1/status/{started['id']}")
        if state.get("status") == "completed":
            return base64.b64decode(state["output"][0].split(",", 1)[-1])
        if state.get("status") == "failed":
            raise TryOnError(f"FASHN failed: {state.get('error')}")
    raise TryOnTimeout("FASHN timeout")


# --- Hugging Face IDM-VTON -------------------------------------------------

_clients: dict[str, object] = {}
_clients_lock = threading.Lock()


def _client(space):
    """Пайваст ба Space як бор сохта мешавад (~5 сония) ва барои дархостҳои баъдӣ нигоҳ дошта мешавад."""
    from gradio_client import Client

    with _clients_lock:
        if space not in _clients:
            _clients[space] = Client(space, token=get_settings().hf_token or None, verbose=False, analytics_enabled=False)
        return _clients[space]


def _forget_client(space):
    with _clients_lock:
        _clients.pop(space, None)


def _huggingface(person, garment, category, description, deadline):
    from gradio_client import handle_file

    with tempfile.TemporaryDirectory() as folder:
        person_path, garment_path = Path(folder, "person.jpg"), Path(folder, "garment.jpg")
        person_path.write_bytes(person)
        garment_path.write_bytes(garment)
        try:
            job = _client(HF_SPACE).submit(
                {"background": handle_file(str(person_path)), "layers": [], "composite": None},
                handle_file(str(garment_path)),
                description,
                True,  # ниқоби бадан худкор
                True,  # буридан ба 3:4 (сурат аллакай 3:4 аст)
                40,  # қадамҳои denoise (ҳадди аксари Space — сифати беҳтарин)
                42,  # seed-и собит: ҳамон сурат + либос ҳамон натиҷаро медиҳад
                api_name="/tryon",
            )
            output, _mask = job.result(timeout=max(5, deadline - time.monotonic()))
        except TimeoutError as error:
            raise TryOnTimeout("Hugging Face timeout") from error
        except Exception as error:  # Space метавонад хоб, бе квота ё бо хато бошад
            _forget_client(HF_SPACE)  # Space метавонад аз нав оғоз шуда бошад — дафъаи дигар пайвасти нав
            if "quota" in str(error).lower():
                raise TryOnQuota(f"Hugging Face: {error}") from error
            raise TryOnError(f"Hugging Face: {error}") from error
        data = Path(output).read_bytes()
        Path(output).unlink(missing_ok=True)  # клиенти умумӣ натиҷаро дар папкаи муваққатии худ мегузорад
        return data


def _leffa(person, garment, category, description, deadline):
    from gradio_client import handle_file

    model, garment_type = LEFFA_TYPES[category]
    with tempfile.TemporaryDirectory() as folder:
        person_path, garment_path = Path(folder, "person.jpg"), Path(folder, "garment.jpg")
        person_path.write_bytes(person)
        garment_path.write_bytes(garment)
        try:
            job = _client(LEFFA_SPACE).submit(
                handle_file(str(person_path)), handle_file(str(garment_path)),
                False,  # ref_acceleration
                30,  # қадамҳо (ҳадди ақали Leffa — 30; камтар хато медиҳад)
                2.5,  # guidance scale
                42,  # seed-и собит
                model, garment_type,
                False,  # repaint
                api_name="/leffa_predict_vt",
            )
            output, _mask, _densepose = job.result(timeout=max(5, deadline - time.monotonic()))
        except TimeoutError as error:
            raise TryOnTimeout("Leffa timeout") from error
        except Exception as error:
            _forget_client(LEFFA_SPACE)
            if "quota" in str(error).lower():
                raise TryOnQuota(f"Leffa: {error}") from error
            raise TryOnError(f"Leffa: {error}") from error
        data = Path(output).read_bytes()
        Path(output).unlink(missing_ok=True)  # клиенти умумӣ натиҷаро дар папкаи муваққатии худ мегузорад
        return data


_space_stage: dict[str, tuple[float, str]] = {}


def _space_available(space):
    """Аз Hub мепурсад, ки Space кор карда метавонад (5 дақиқа дар хотира, то status зуд бошад)."""
    cached = _space_stage.get(space)
    if cached is None or time.monotonic() - cached[0] > 300:
        try:
            with urlopen(f"https://huggingface.co/api/spaces/{space}/runtime", timeout=5) as response:
                stage = json.loads(response.read()).get("stage", "UNKNOWN")
        except (URLError, ValueError, TimeoutError):
            stage = "UNREACHABLE"
        cached = _space_stage[space] = (time.monotonic(), stage)
    # Space-и хобида бо дархости аввал бедор мешавад, бинобар ин дастрас ҳисоб мешавад.
    return cached[1] in ("RUNNING", "SLEEPING", "RUNNING_BUILDING", "APP_STARTING")


def huggingface_available():
    return _space_available(HF_SPACE)


def leffa_available():
    return _space_available(LEFFA_SPACE)


# --- Тайёр кардани сурат ва барқарор кардани рӯй ---------------------------

def _jpeg(image):
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, "JPEG", quality=92)
    return buffer.getvalue()


def pad_to_portrait(image):
    """То 3:4 бо ранги канори сурат пур мекунад (на кашида) ва ба SIZE хурд мекунад.
    Сурати пуршуда ва ҷойи сурати аслиро дар он (бо координатаҳои SIZE) бармегардонад."""
    import numpy as np
    from PIL import Image

    w, h = image.size
    if w / h > 3 / 4:
        canvas_w, canvas_h = w, round(w * 4 / 3)
    else:
        canvas_w, canvas_h = round(h * 3 / 4), h
    pixels = np.asarray(image)
    edges = np.concatenate([pixels[0], pixels[-1], pixels[:, 0], pixels[:, -1]])
    colour = tuple(int(c) for c in np.median(edges, axis=0))
    canvas = Image.new("RGB", (canvas_w, canvas_h), colour)
    left, top = (canvas_w - w) // 2, (canvas_h - h) // 2
    canvas.paste(image, (left, top))
    k = SIZE[0] / canvas_w
    return canvas.resize(SIZE, Image.LANCZOS), (round(left * k), round(top * k), round((left + w) * k), round((top + h) * k))


_rembg = None
_rembg_lock = threading.Lock()


def _remove_background(data):
    """Модели rembg як бор бор мешавад (пештар ҳар дафъа — ~30 сония)."""
    global _rembg
    from rembg import new_session, remove

    with _rembg_lock:
        if _rembg is None:
            _rembg = new_session(get_settings().rembg_model)
        return remove(data, session=_rembg)


def _main_mask(alpha):
    """Танҳо қисми калонтарини пайваста (либос) — тамғаҳои музей, кулоҳ ва ашёи хурд партофта мешаванд."""
    import cv2
    import numpy as np

    solid = (alpha > 40).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    if count <= 1:
        return None
    biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return labels == biggest


def prepare_garment(data):
    """Либос бе замина, бурида то худи либос ва дар миёнаи заминаи сафеди 3:4.
    Агар тоза кардани замина либосро «хӯрд» (масалан либоси сафед дар заминаи равшан), акси аслӣ истифода мешавад."""
    import numpy as np
    from PIL import Image

    original = Image.open(io.BytesIO(data)).convert("RGB")
    image = original.convert("RGBA")
    try:
        cut = Image.open(io.BytesIO(_remove_background(data))).convert("RGBA")
        alpha = np.asarray(cut)[..., 3]
        mask = _main_mask(alpha)
        # Ҳеҷ чиз намонд (камтар аз 1%) — rembg хато кард, акси аслӣ мемонад
        if mask is not None and mask.mean() > 0.01:
            pixels = np.asarray(cut).copy()
            pixels[..., 3] = np.where(mask, alpha, 0)
            image = Image.fromarray(pixels)
    except ImportError:
        pass
    box = image.getchannel("A").getbbox() or (0, 0, image.width, image.height)
    pad = int(0.03 * max(image.size))
    image = image.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(image.width, box[2] + pad), min(image.height, box[3] + pad)))
    image.thumbnail((int(SIZE[0] * 0.92), int(SIZE[1] * 0.92)), Image.LANCZOS)
    # Хурд бошад — калон мекунем, то либос тамоми чорчӯбаро пур кунад
    k = min(SIZE[0] * 0.92 / image.width, SIZE[1] * 0.92 / image.height)
    if k > 1:
        image = image.resize((int(image.width * k), int(image.height * k)), Image.LANCZOS)
    canvas = Image.new("RGBA", SIZE, (255, 255, 255, 255))
    canvas.alpha_composite(image, ((SIZE[0] - image.width) // 2, (SIZE[1] - image.height) // 2))
    return canvas.convert("RGB")


def garment_jpeg(cover: Path) -> bytes:
    """Акси тайёри либос (бе замина, 3:4) — як бор сохта, дар uploads/garments/ нигоҳ дошта мешавад."""
    cached = get_settings().upload_dir / "garments" / f"{cover.stem}-v3.jpg"  # v3: бурида то либос, бе ашёи хурд
    if cached.exists():
        return cached.read_bytes()
    data = _jpeg(prepare_garment(cover.read_bytes()))
    cached.parent.mkdir(exist_ok=True)
    cached.write_bytes(data)
    return data


def restore_face(original, result):
    """Рӯй, мӯй ва болои гардани аслиро бо эллипси нарм болои натиҷаи AI мегузорад.
    Ҳарду сурат як андоза доранд. Агар рӯй ёфт нашавад, натиҷа бетағйир бармегардад."""
    import cv2
    import numpy as np
    from PIL import Image

    faces_model = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    gray = cv2.cvtColor(np.asarray(original), cv2.COLOR_RGB2GRAY)
    side = min(gray.shape)
    faces = faces_model.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(side // 12, side // 12))
    if len(faces) == 0:
        return result, False
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    # ~35% гирди рӯй; болотар каме бештар барои мӯй.
    cx, cy = x + w / 2, y + h / 2 - h * 0.08
    ax, ay = w * 0.5 * 1.35, h * 0.5 * 1.55
    mask = np.zeros(gray.shape, np.float32)
    cv2.ellipse(mask, (int(cx), int(cy)), (int(ax), int(ay)), 0, 0, 360, 1.0, -1)
    feather = max(3, int(w * 0.18)) | 1
    mask = cv2.GaussianBlur(mask, (feather * 2 + 1, feather * 2 + 1), feather / 2)[..., None]
    blended = np.asarray(original, np.float32) * mask + np.asarray(result, np.float32) * (1 - mask)
    return Image.fromarray(blended.clip(0, 255).astype(np.uint8)), True


# --- API-и умумӣ -----------------------------------------------------------

# ном, ҳоло дастрас аст ё не, иҷро, кадом қисмҳои баданро мепӯшонад (IDM-VTON танҳо болоро).
# Квотаи ройгони ZeroGPU: IDM-VTON 60 с мехоҳад, Leffa 180 с — болопӯш (костюм, чапон) аввал бо IDM,
# либоси пурра (арӯсӣ, атлас) танҳо бо Leffa. Ҳамин тавр бо ҳамон квота ~3× бештар пӯшондан.
PROVIDERS = [
    ("fashn", lambda: bool(get_settings().fashn_api_key), _fashn, {"upper", "lower", "full"}),
    ("huggingface", huggingface_available, _huggingface, {"upper"}),
    ("leffa", leffa_available, _leffa, {"upper", "lower", "full"}),
]


def status():
    available = [(name, parts) for name, is_available, _, parts in PROVIDERS if is_available()]
    return {
        "active": available[0][0] if available else None,
        "providers": [name for name, _ in available],
        "supports": sorted(set().union(*(parts for _, parts in available))) if available else [],
    }


def run_tryon(person_image, garment, category, description="clothing"):
    """person_image: сурати PIL RGB (рост). garment: JPEG-и тайёр аз garment_jpeg(). category: upper/lower/full.
    (JPEG-и одам дар либос, номи провайдер, рӯй барқарор шуд ё не) бармегардонад.

    TryOnTimeout — вақт тамом шуд; TryOnError — ҳамаи провайдерҳо натавонистанд.
    """
    padded, _ = pad_to_portrait(person_image)
    person = _jpeg(padded)

    deadline = time.monotonic() + TIMEOUT
    errors = []
    quota = False
    for name, is_available, run, parts in PROVIDERS:
        if category not in parts or not is_available():
            continue
        if time.monotonic() >= deadline:
            raise TryOnTimeout("; ".join(errors) or "timeout")
        try:
            raw = run(person, garment, category, description, deadline)
        except TryOnTimeout:
            raise
        except TryOnError as error:
            quota = quota or isinstance(error, TryOnQuota)
            errors.append(str(error))
            continue
        final, face_restored = finish(person_image, raw)
        return final, name, face_restored
    raise (TryOnQuota if quota else TryOnError)("; ".join(errors) or "no provider available")


def finish(person_image, raw):
    """Натиҷаи AI (3:4, SIZE) → андозаи сурати аслӣ: пуркунӣ бурида мешавад ва рӯю мӯйи аслӣ бармегарданд.
    (JPEG, рӯй барқарор шуд ё не) бармегардонад."""
    from PIL import Image

    _, box = pad_to_portrait(person_image)
    result = Image.open(io.BytesIO(raw)).convert("RGB").resize(SIZE, Image.LANCZOS).crop(box).resize(person_image.size, Image.LANCZOS)
    final, face_restored = restore_face(person_image, result)
    return _jpeg(final), face_restored


def prepare_all():
    """Аксҳои тайёри ҳамаи либосҳои каталогро пешакӣ месозад, то пӯшондани аввал ҳам тез бошад."""
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models import Category, Listing

    with SessionLocal() as db:
        covers = [l.cover for l in db.scalars(select(Listing).join(Category).where(Category.slug.in_(list(WEARABLE)))) if l.cover]
    for cover in covers:
        garment_jpeg(get_settings().upload_dir / cover.rsplit("/", 1)[-1])
    print(f"Либосҳо тайёр: {len(covers)}")


if __name__ == "__main__":
    prepare_all()
