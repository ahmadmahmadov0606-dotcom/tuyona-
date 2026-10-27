"""Мард ё зан дар сурат — то ороишгоҳ либоси занонаро ба мард ва мардонаро ба зан напӯшонад.

Модел: CLIP ViT-B/32 (OpenAI, иҷозатномаи MIT), нусхаи ONNX-и квантонидашуда (Xenova, ~89 МБ).
Тасвир бо ду матни пешакӣ ҳисобшуда муқоиса мешавад: «акси мард» ва «акси зан» (ai/clip_gender_text.npy).
Дар CPU ~50 мс, бе GPU ва бе интернет (ғайр аз боркунии якуминаи модел ба uploads/ai_models/).
"""
import hashlib
import threading
import urllib.request
from pathlib import Path

import numpy as np

from app.core.config import get_settings

MODEL_URL = ("https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/"
             "d15189d7028b43f1d3e65039190477f6af591c2a/onnx/vision_model_quantized.onnx")
MODEL_SHA256 = "583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299"
TEXT = Path(__file__).with_name("ai") / "clip_gender_text.npy"  # [мард, зан], 512 рақам
MEAN = np.array([0.48145466, 0.4578275, 0.40821073], np.float32)
STD = np.array([0.26862954, 0.26130258, 0.27577711], np.float32)
CONFIDENT = 0.65  # камтар аз ин — «намедонам», корбар худаш интихоб мекунад

# Категорияи либос → барои кӣ
OUTFIT_GENDER = {"suit": "male", "chapan": "male", "wedding-dress": "female", "national-dress": "female"}
NAMES = {"male": "мардона", "female": "занона"}

_session = None
_lock = threading.Lock()


def _model_path() -> Path:
    path = get_settings().upload_dir / "ai_models" / "clip_vision_q.onnx"
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    with urllib.request.urlopen(MODEL_URL, timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    if hashlib.sha256(tmp.read_bytes()).hexdigest() != MODEL_SHA256:
        tmp.unlink()
        raise RuntimeError("CLIP: файли модел вайрон аст")
    tmp.rename(path)
    return path


def _get_session():
    global _session
    with _lock:
        if _session is None:
            import onnxruntime as ort

            options = ort.SessionOptions()
            options.intra_op_num_threads = 2  # сервер умумӣ аст — ҳамаи ядроҳоро намегирем
            _session = ort.InferenceSession(str(_model_path()), options, providers=["CPUExecutionProvider"])
        return _session


def _pixels(image):
    """Ҳошия то мураббаъ (тамоми қад дар тасвир мемонад), 224×224, нормализатсияи CLIP."""
    from PIL import Image

    image = image.convert("RGB")
    side = max(image.size)
    square = Image.new("RGB", (side, side), (128, 128, 128))
    square.paste(image, ((side - image.width) // 2, (side - image.height) // 2))
    array = (np.asarray(square.resize((224, 224), Image.BICUBIC), np.float32) / 255 - MEAN) / STD
    return array.transpose(2, 0, 1)[None]


def detect(image) -> dict:
    """{'gender': 'male' | 'female' | None, 'confidence': 0..1}. None — модел мутмаин нест."""
    embed = _get_session().run(None, {"pixel_values": _pixels(image)})[0][0]
    embed = embed / np.linalg.norm(embed)
    logits = 100 * np.load(TEXT) @ embed
    probs = np.exp(logits - logits.max())
    probs /= probs.sum()
    best = int(probs.argmax())
    confidence = float(probs[best])
    return {"gender": ("male", "female")[best] if confidence >= CONFIDENT else None, "confidence": round(confidence, 2)}
