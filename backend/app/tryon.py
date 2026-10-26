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

def _huggingface(person, garment, category, description, deadline):
    from gradio_client import Client, handle_file

    with tempfile.TemporaryDirectory() as folder:
        person_path, garment_path = Path(folder, "person.jpg"), Path(folder, "garment.jpg")
        person_path.write_bytes(person)
        garment_path.write_bytes(garment)
        try:
            # download_files=folder: натиҷа дар папкаи муваққатӣ мемонад ва бо он нест мешавад.
            client = Client(HF_SPACE, token=get_settings().hf_token or None, verbose=False, download_files=folder, analytics_enabled=False)
            job = client.submit(
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
            if "quota" in str(error).lower():
                raise TryOnQuota(f"Hugging Face: {error}") from error
            raise TryOnError(f"Hugging Face: {error}") from error
        return Path(output).read_bytes()


def _leffa(person, garment, category, description, deadline):
    from gradio_client import Client, handle_file

    model, garment_type = LEFFA_TYPES[category]
    with tempfile.TemporaryDirectory() as folder:
        person_path, garment_path = Path(folder, "person.jpg"), Path(folder, "garment.jpg")
        person_path.write_bytes(person)
        garment_path.write_bytes(garment)
        try:
            client = Client(LEFFA_SPACE, token=get_settings().hf_token or None, verbose=False, download_files=folder, analytics_enabled=False)
            job = client.submit(
                handle_file(str(person_path)), handle_file(str(garment_path)),
                False,  # ref_acceleration
                30,  # қадамҳо
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
            if "quota" in str(error).lower():
                raise TryOnQuota(f"Leffa: {error}") from error
            raise TryOnError(f"Leffa: {error}") from error
        return Path(output).read_bytes()


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


def prepare_garment(data):
    """Либос бе замина (агар rembg бошад), дар миёнаи заминаи сафеди 3:4."""
    from PIL import Image

    image = Image.open(io.BytesIO(data))
    try:
        from rembg import remove

        image = Image.open(io.BytesIO(remove(data)))
    except ImportError:
        pass
    image = image.convert("RGBA")
    image.thumbnail((int(SIZE[0] * 0.9), int(SIZE[1] * 0.9)), Image.LANCZOS)
    canvas = Image.new("RGBA", SIZE, (255, 255, 255, 255))
    canvas.alpha_composite(image, ((SIZE[0] - image.width) // 2, (SIZE[1] - image.height) // 2))
    return canvas.convert("RGB")


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
PROVIDERS = [
    ("fashn", lambda: bool(get_settings().fashn_api_key), _fashn, {"upper", "lower", "full"}),
    ("leffa", leffa_available, _leffa, {"upper", "lower", "full"}),
    ("huggingface", huggingface_available, _huggingface, {"upper"}),
]


def status():
    available = [(name, parts) for name, is_available, _, parts in PROVIDERS if is_available()]
    return {
        "active": available[0][0] if available else None,
        "providers": [name for name, _ in available],
        "supports": sorted(set().union(*(parts for _, parts in available))) if available else [],
    }


def run_tryon(person_image, garment_image, category, description="clothing"):
    """person_image: сурати PIL RGB (рост). garment_image: байтҳои сурат. category: upper/lower/full.
    (JPEG-и одам дар либос, номи провайдер, рӯй барқарор шуд ё не) бармегардонад.

    TryOnTimeout — вақт тамом шуд; TryOnError — ҳамаи провайдерҳо натавонистанд.
    """
    from PIL import Image

    padded, box = pad_to_portrait(person_image)
    person = _jpeg(padded)
    garment = _jpeg(prepare_garment(garment_image))

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
        # Пуркуниро бармегардонем, то натиҷа пиксел ба пиксел бо сурати аслӣ мувофиқ бошад.
        result = Image.open(io.BytesIO(raw)).convert("RGB").resize(SIZE, Image.LANCZOS).crop(box).resize(person_image.size, Image.LANCZOS)
        final, face_restored = restore_face(person_image, result)
        return _jpeg(final), name, face_restored
    raise (TryOnQuota if quota else TryOnError)("; ".join(errors) or "no provider available")
