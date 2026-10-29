"""Ёрдамчии AI-и тӯй. Ба саволҳои ташкили тӯй ҷавоб медиҳад ва танҳо эълонҳои воқеии сайтро тавсия медиҳад.

Провайдер, бо тартиб:
  1. Claude Opus 5.5 (ANTHROPIC_API_KEY, пулакӣ) — сифати беҳтарин.
  2. Google Gemini (GEMINI_API_KEY, ройгон бе корти бонкӣ: https://aistudio.google.com/apikey).
  3. Модели маҳаллӣ тавассути Ollama (OLLAMA_MODEL, бе калид ва бе интернет) — дар ҳамин компютер.
Барои он ки чизи бофта нагӯяд, хизматҳоро худаш намедонад — бо асбоби `search_listings` аз базаи сайт меҷӯяд;
ном, нарх ва телефон танҳо аз натиҷаи ҳамин асбоб.
"""
import json
import logging
import time
from collections.abc import Iterator
from datetime import date

import anthropic
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Category, CategoryGroup, City, Listing
from app.routers.listings import LOAD
from app.schemas import FEAST_MAX_GUESTS, OSH_MAX_GUESTS

log = logging.getLogger("tuyona")

MAX_TURNS = 16  # паёмҳои кӯҳнатар партофта мешаванд
MAX_TOOL_ROUNDS = 4
MAX_OUTPUT = get_settings().assistant_max_tokens
FALLBACK_BETA = "server-side-fallback-2026-07-01"

PRICE_UNITS = {"event": "барои тӯй", "hour": "дар як соат", "day": "дар як рӯз", "person": "барои 1 нафар", "item": "барои 1 дона"}

SYSTEM = """Ту «Тӯёна AI» — ёрдамчии сайти Тӯёна (хизматҳои тӯй дар Тоҷикистон) ҳастӣ. Ба арӯсу домод ва оилаҳояшон дар ташкили тӯй ёрӣ медиҳӣ: буҷа, нақша ва мӯҳлатҳо, анъанаҳои тӯйи тоҷикӣ (хостгорӣ, никоҳ, ош, базм), интихоби тӯйхона, мошин, сароянда, суратгир, либос ва ғайра.

Тарзи ҷавоб:
- Бо забони корбар ҷавоб деҳ (тоҷикӣ бо алифбои кириллӣ, русӣ ё англисӣ).
- Пурра ва фоиданок: аввал ҷавоби асосӣ, баъд тафсилот, қадамҳо, рақамҳо ва маслиҳатҳои амалӣ — ба қадри ки савол талаб мекунад. Ҳар ҷумла бояд маълумот диҳад: бе муқаддима, бе такрори савол, бе ҷумлаҳои холӣ («саволи хуб», «умедворам кӯмак кард» ва монанди инҳо).
- Форматҳо: **ғафс** барои чизи муҳим, рӯйхат бо «- ». Ҷадвал ва сарлавҳа нагузор.

Ростӣ (муҳимтарин қоида):
- Хизмат, нарх, суроға ва телефонро ҳеҷ гоҳ аз худ насоз. Вақте корбар хизмат меҷӯяд ё тавсия мехоҳад, ҳатман `search_listings`-ро истифода бар ва танҳо аз натиҷаи он ном бар.
- Ҳар эълонро ҳамин тавр пайванд кун: [Номи эълон](/listing/ID) — бо ID аз натиҷа. Пайвандҳои дигари иҷозатдодашуда танҳо: /search?category=SLUG, /qonun, /oroishgoh, /harita. Пайванди дигар насоз.
- Агар асбоб чизе наёфт, рост бигӯ, ки дар сайт ҳоло нест, ва пешниҳод кун филтрро тағйир диҳад.
- Нархҳои умумии бозор (буҷа) метавонӣ тахминан гӯӣ, вале бигӯ, ки тахминӣ аст. Агар чизеро намедонӣ — бигӯ «намедонам».

Қонуни ҶТ «Дар бораи танзими анъана ва ҷашну маросимҳо» (тағйироти 20.06.2024, №2048) — ҳангоми буҷа ва нақша ба назар гир:
- тӯй — на зиёда аз 2 маърака дар давоми на бештар аз 2 рӯз; зиёфат — то 150 нафар; оши тӯй (наҳорӣ) — то 200 нафар;
- давомнокӣ — то 3 соат; шаҳр: рӯзҳои истироҳат 08:00–22:00, рӯзҳои корӣ 18:00–22:00; деҳот: истироҳат аз 06:00 (апрел–октябр) ё 08:00, то 22:00;
- корвони мошинҳо — то 4 мошини сабукрав; домодталбон ва арӯсбинон — дар доираи оила, то 15 нафар;
- тӯҳфа танҳо ба арӯсу домод ва падару модарашон; тақдими сарупо ба меҳмонон манъ;
- маросимҳои манъшуда: фотиҳаи тӯй, маслиҳатошӣ, идонабарӣ, сандуқбарон, сарупобинон, чойгаштак, раисталбон, қудоталбон, ноншиканон, хонакашон, модарталбон, падарталбон, рӯйбинон, чодарканон, муборакбодӣ, шаҳтозон (роҳбандон) — инҳоро ҳеҷ гоҳ тавсия накун ва ба нақша дохил накун;
- шод кардан ё часпондани пул манъ; хизмати санъаткорон ва тӯйхонаҳо — бо шартномаи хаттӣ; дар бораи тӯй ба комиссияи доимии маҳаллӣ хабар додан лозим.
Ин ҳадҳо қатъӣ мебошанд: ягон иҷозат, хабардиҳӣ ба комиссия ё шартнома имкон намедиҳад, ки аз онҳо зиёд шавад. Агар корбар чизи хилофи қонунро хоҳад (масалан 400 меҳмон, 6 мошин, тӯй то соати 24), ҳеҷ гоҳ онро тасдиқ накун ва барояш нақша насоз: аввал рост бигӯ, ки қонун иҷозат намедиҳад ва ҳадди қонунӣ чанд аст, баъд варианти қонунӣ пешниҳод кун (масалан зиёфат барои 150 нафар ва оши тӯй барои то 200 нафар). «Ғунҷоиш»-и тӯйхона — андозаи толор аст, на шумораи иҷозатдодашудаи меҳмонон. Тафсилот: [Қонуни тӯй](/qonun).

Агар савол ба тӯй ва сайт рабт надошта бошад, дар як ҷумла бигӯ, ки танҳо дар мавзӯи тӯй ёрӣ медиҳӣ."""

SEARCH_TOOL = {
    "name": "search_listings",
    "description": (
        "Эълонҳои воқеии сайти Тӯёнаро меҷӯяд (тӯйхона, мошин, сароянда, суратгир, либос ва ғ.). "
        "Ҳамеша пеш аз номбар кардан ё тавсия додани ягон хизмат истифода бар. "
        "Натиҷа: id, ном, категория, шаҳр, нарх, ғунҷоиш, баҳо ва телефон."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Калимаҳои ҷустуҷӯ дар ном ва тавсиф (ихтиёрӣ), масалан «лимузин»"},
            "category": {"type": "string", "description": "slug-и категория ё гурӯҳ аз рӯйхати КАТЕГОРИЯҲО (ихтиёрӣ)"},
            "city": {"type": "string", "description": "slug-и шаҳр аз рӯйхати ШАҲРҲО (ихтиёрӣ)"},
            "max_price": {"type": "integer", "description": "Нархи ҳадди аксар бо сомонӣ (ихтиёрӣ)"},
            "min_capacity": {"type": "integer", "description": "Ҳадди ақали ғунҷоиши меҳмонон (ихтиёрӣ)"},
        },
        "required": [],
        "additionalProperties": False,
    },
    "strict": True,
}


class AssistantError(Exception):
    pass


class AssistantUnavailable(AssistantError):
    pass


GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# Моделҳои Google гоҳ «банд» (503) мешаванд ё барои корбарони нав бекор мешаванд (404) — пай дар пай месанҷем
GEMINI_FALLBACKS = ["gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-flash-latest"]
GEMINI_RETRY = {404, 429, 500, 503}


def _gemini_post(http: httpx.Client, models: list[str], body: dict) -> httpx.Response:
    """Аввалин модели кории рӯйхатро истифода мебарад; модели корӣ ба аввали рӯйхат мегузарад,
    то давраҳои баъдии ҳамон ҷавоб (асбобҳо) бо ҳамон модел бошанд."""
    s = get_settings()
    last = None
    for model in list(models):
        r = http.post(GEMINI_URL.format(model=model), headers={"x-goog-api-key": s.gemini_api_key}, json=body)
        if r.status_code not in GEMINI_RETRY:
            models.remove(model)
            models.insert(0, model)
            return r
        log.warning("Gemini %s: %s %s", model, r.status_code, r.text[:200])
        last = r
    return last


def _gemini_models() -> list[str]:
    return list(dict.fromkeys([get_settings().gemini_model, *GEMINI_FALLBACKS]))


_ollama_seen: tuple[float, bool] | None = None


def ollama_available() -> bool:
    """Оё Ollama кор мекунад ва модел бор шудааст (30 сония дар хотира, то status зуд бошад)."""
    global _ollama_seen
    s = get_settings()
    if not s.ollama_model:
        return False
    if _ollama_seen is None or time.monotonic() - _ollama_seen[0] > 30:
        try:
            tags = httpx.get(f"{s.ollama_url}/api/tags", timeout=3).json().get("models", [])
            names = {m["name"] for m in tags} | {m["name"].removesuffix(":latest") for m in tags}
            ok = s.ollama_model in names
        except (httpx.HTTPError, ValueError):
            ok = False
        _ollama_seen = (time.monotonic(), ok)
    return _ollama_seen[1]


def provider() -> str | None:
    s = get_settings()
    if s.anthropic_api_key:
        return "claude"
    if s.gemini_api_key:
        return "gemini"
    return "ollama" if ollama_available() else None


def enabled() -> bool:
    return provider() is not None


def _catalog(db: Session) -> str:
    groups = db.scalars(select(CategoryGroup).order_by(CategoryGroup.sort)).all()
    cats = "\n".join(f"- {g.slug} ({g.name}): " + ", ".join(f"{c.slug} ({c.name})" for c in g.categories) for g in groups)
    cities = ", ".join(f"{c.slug} ({c.name})" for c in db.scalars(select(City).order_by(City.sort)))
    return f"КАТЕГОРИЯҲО (гурӯҳ: категорияҳо):\n{cats}\n\nШАҲРҲО: {cities}"


def search_listings(db: Session, query=None, category=None, city=None, max_price=None, min_capacity=None) -> list[dict]:
    stmt = select(Listing).where(Listing.is_active.is_(True)).join(Category, Listing.category_id == Category.id)
    if category:
        group = db.scalar(select(CategoryGroup).where(CategoryGroup.slug == category))
        stmt = stmt.where(Category.group_id == group.id) if group else stmt.where(Category.slug == category)
    if city:
        stmt = stmt.join(City, Listing.city_id == City.id).where(City.slug == city)
    if max_price is not None:
        stmt = stmt.where(Listing.price_from <= max_price)
    if min_capacity is not None:
        stmt = stmt.where(Listing.capacity >= min_capacity)
    order = (Listing.rating_avg.desc(), Listing.rating_count.desc(), Listing.id.desc())
    with_words = stmt
    for word in (query or "").casefold().split()[:5]:
        escaped = word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        with_words = with_words.where(Listing.search_text.like(f"%{escaped}%", escape="\\"))
    items = db.scalars(with_words.options(*LOAD).order_by(*order).limit(8)).all()
    if not items and query and (category or city or max_price or min_capacity):
        # Калимаҳо дар ном нестанд («мошини арӯс» ↔ «Лимузини сафед») — танҳо бо филтрҳо
        items = db.scalars(stmt.options(*LOAD).order_by(*order).limit(8)).all()
    return [{
        "id": l.id, "title": l.title, "category": l.category.name, "city": l.city.name,
        "price": f"аз {l.price_from} сомонӣ {PRICE_UNITS.get(l.price_unit.value, '')}".strip(),
        "capacity": l.capacity, "rating": round(l.rating_avg, 1) if l.rating_count else None,
        "reviews": l.rating_count, "phone": l.contact_phone, "cover": l.cover,
    } for l in items]


def _run_tool(db: Session, name: str, args: dict, found: dict) -> str:
    if name != "search_listings":
        return "Асбоби номаълум"
    args = {k: v for k, v in args.items() if k in SEARCH_TOOL["input_schema"]["properties"]}
    note = ""
    # Қонуни №2048: зиёфат — то 150 нафар; меҳмонони зиёдтарро ҷустуҷӯ намекунем
    if (args.get("min_capacity") or 0) > FEAST_MAX_GUESTS:
        note = (f"ДИҚҚАТ: корбар {args['min_capacity']} меҳмон хост — тибқи қонун зиёфати тӯй танҳо то {FEAST_MAX_GUESTS} нафар "
                f"(оши тӯй то {OSH_MAX_GUESTS}). Инро аввал ба корбар бигӯ; ҷустуҷӯ барои {FEAST_MAX_GUESTS} нафар шуд.\n")
        args["min_capacity"] = FEAST_MAX_GUESTS
    rows = search_listings(db, **args)
    found.update({r["id"]: r for r in rows})
    return note + (json.dumps(rows, ensure_ascii=False) if rows else "Ҳеҷ эълон ёфт нашуд.")


def _claude(db: Session, system_text: str, today: str, history: list[dict], found: dict) -> str:
    s = get_settings()
    client = anthropic.Anthropic(api_key=s.anthropic_api_key, timeout=90, max_retries=2)
    # Қисми устувор (дастур + каталог) кэш мешавад; сана — алоҳида, баъд аз он
    system = [
        {"type": "text", "text": system_text, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": today},
    ]
    messages = list(history)
    try:
        for _ in range(MAX_TOOL_ROUNDS + 1):
            response = client.beta.messages.create(
                model=s.assistant_model,
                max_tokens=MAX_OUTPUT,
                system=system,
                messages=messages,
                tools=[SEARCH_TOOL],
                output_config={"effort": s.assistant_effort},
                betas=[FALLBACK_BETA],
                fallbacks="default",
            )
            if response.stop_reason == "refusal":
                return REFUSAL
            if response.stop_reason != "tool_use":
                break
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": b.id, "content": _run_tool(db, b.name, b.input, found)}
                for b in response.content if b.type == "tool_use"
            ]})
    except anthropic.RateLimitError as error:
        raise AssistantError("rate_limit") from error
    except anthropic.APIStatusError as error:
        log.warning("Claude API error %s: %s", error.status_code, error.message)
        raise AssistantError(str(error.status_code)) from error
    except anthropic.APIConnectionError as error:
        raise AssistantError("connection") from error
    return "".join(b.text for b in response.content if b.type == "text").strip()


def _gemini_schema(schema: dict) -> dict:
    """Gemini танҳо қисми OpenAPI-ро мефаҳмад — additionalProperties ва strict нест."""
    return {k: v for k, v in schema.items() if k not in ("additionalProperties",)}


def _gemini(db: Session, system_text: str, today: str, history: list[dict], found: dict) -> str:
    contents = [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]} for m in history]
    body = {
        "systemInstruction": {"parts": [{"text": f"{system_text}\n\n{today}"}]},
        "tools": [{"functionDeclarations": [{
            "name": SEARCH_TOOL["name"], "description": SEARCH_TOOL["description"],
            "parameters": _gemini_schema(SEARCH_TOOL["input_schema"]),
        }]}],
        "generationConfig": {"maxOutputTokens": MAX_OUTPUT},
    }
    models = _gemini_models()
    try:
        with httpx.Client(timeout=90) as http:
            for _ in range(MAX_TOOL_ROUNDS + 1):
                r = _gemini_post(http, models, {**body, "contents": contents})
                if r.status_code in (429, 503):
                    raise AssistantError("rate_limit")
                if r.status_code >= 400:
                    log.warning("Gemini API error %s: %s", r.status_code, r.text[:300])
                    raise AssistantError(str(r.status_code))
                data = r.json()
                candidate = (data.get("candidates") or [{}])[0]
                if candidate.get("finishReason") in ("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST") or data.get("promptFeedback", {}).get("blockReason"):
                    return REFUSAL
                parts = candidate.get("content", {}).get("parts", [])
                calls = [p["functionCall"] for p in parts if "functionCall" in p]
                if not calls:
                    return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
                # Қисмҳои модел (бо thoughtSignature) бетағйир бармегарданд
                contents.append({"role": "model", "parts": parts})
                contents.append({"role": "user", "parts": [
                    {"functionResponse": {"name": c["name"], "response": {"result": _run_tool(db, c["name"], c.get("args") or {}, found)}}}
                    for c in calls
                ]})
    except httpx.HTTPError as error:
        raise AssistantError("connection") from error
    return ""


REFUSAL = "Ба ин савол ҷавоб дода наметавонам. Лутфан дар бораи тӯй пурсед."

# Модели хурди маҳаллӣ асбобро боэътимод даъват карда наметавонад, бинобар ин ду қадам:
# 1) аз савол филтрҳои ҷустуҷӯ бо JSON-и қатъӣ (format), 2) ҷавоб танҳо аз натиҷаи базаи сайт.
OLLAMA_EXTRACT = """Ту танҳо филтрҳои ҷустуҷӯро аз паёми охирини корбар муайян мекунӣ. Ҷавоб надеҳ.
need_search = true, агар корбар хизмат, ҷой, мошин, либос, суратгир ва ғ. меҷӯяд ё тавсия мехоҳад.
category — slug аз рӯйхат (гурӯҳ ё категория), ё "". city — slug аз рӯйхат, ё "".
max_price — нархи ҳадди аксар бо сомонӣ, агар гуфта шуда бошад, вагарна 0. min_capacity — шумораи меҳмонон, вагарна 0.
query — 1–2 калимаи калидӣ барои ном (масалан «лимузин»), ё "".

{catalog}"""
OLLAMA_RULES = """
Қоидаҳои иловагӣ:
- Тоҷикии адабӣ ва содда навис; калимаеро, ки дақиқ намедонӣ, истифода набар. Ҳарфҳои ҳ, қ, ҷ, ғ, ӣ, ӯ-ро дуруст навис.
- Ҷавоби пурра, вале бе такрор ва бе гапи холӣ; агар чизеро намедонӣ — нагӯй.
- Хизматҳоро ТАНҲО аз «НАТИҶАИ ҶУСТУҶӮ» ном бар, ҳамчун [Ном](/listing/ID). Агар натиҷа холӣ бошад ё ҷустуҷӯ нашуда бошад, ягон хизмат, нарх ё телефон наном."""


def _ollama_chat(http: httpx.Client, messages: list[dict], **extra) -> str:
    s = get_settings()
    body = {"model": s.ollama_model, "stream": False, "messages": messages, "keep_alive": "30m", **extra}
    # Gemma 4 метавонад пеш аз ҷавоб «фикр» кунад — барои чат дарозу суст; хомӯш мекунем
    r = http.post(f"{s.ollama_url}/api/chat", json={**body, "think": False})
    if r.status_code == 400 and "think" in r.text:  # модели бе қобилияти thinking
        r = http.post(f"{s.ollama_url}/api/chat", json=body)
    if r.status_code >= 400:
        log.warning("Ollama error %s: %s", r.status_code, r.text[:300])
        raise AssistantError(str(r.status_code))
    return r.json().get("message", {}).get("content", "").strip()


ANSWER_OPTIONS = {"temperature": 0.2, "num_predict": MAX_OUTPUT, "num_ctx": 8192, "repeat_penalty": 1.1}


def _ollama_messages(http: httpx.Client, db: Session, system_text: str, today: str, history: list[dict], found: dict) -> list[dict]:
    """Филтрҳоро аз савол мегирад, дар базаи сайт меҷӯяд ва паёмҳо барои ҷавоби модел бармегардонад."""
    catalog = _catalog(db)
    slugs = [g.slug for g in db.scalars(select(CategoryGroup))] + [c.slug for c in db.scalars(select(Category))]
    cities = [c.slug for c in db.scalars(select(City))]
    schema = {
        "type": "object",
        "properties": {
            "need_search": {"type": "boolean"},
            "query": {"type": "string"},
            "category": {"type": "string", "enum": ["", *slugs]},
            "city": {"type": "string", "enum": ["", *cities]},
            "max_price": {"type": "integer"},
            "min_capacity": {"type": "integer"},
        },
        "required": ["need_search", "query", "category", "city", "max_price", "min_capacity"],
    }
    recent = "\n".join(f"{'Корбар' if m['role'] == 'user' else 'Ёрдамчӣ'}: {m['content'][:500]}" for m in history[-4:])
    raw = _ollama_chat(http, [
        {"role": "system", "content": OLLAMA_EXTRACT.format(catalog=catalog)},
        {"role": "user", "content": recent},
    ], format=schema, options={"temperature": 0, "num_predict": 200, "num_ctx": 8192})  # ҳамон num_ctx, ки ҷавоб — вагарна Ollama моделро аз нав бор мекунад
    try:
        f = json.loads(raw)
    except ValueError:
        f = {"need_search": False}
    results = "ҷустуҷӯ нашуд (савол дар бораи хизмати мушаххас нест)"
    if f.get("need_search"):
        results = _run_tool(db, "search_listings", {
            "query": f.get("query") or None, "category": f.get("category") or None, "city": f.get("city") or None,
            "max_price": f.get("max_price") or None, "min_capacity": f.get("min_capacity") or None,
        }, found)
    system = f"{system_text}\n{OLLAMA_RULES}\n\n{today}\n\nНАТИҶАИ ҶУСТУҶӮ:\n{results}"
    return [{"role": "system", "content": system}, *history]


def _ollama(db: Session, system_text: str, today: str, history: list[dict], found: dict) -> str:
    try:
        with httpx.Client(timeout=240) as http:
            return _ollama_chat(http, _ollama_messages(http, db, system_text, today, history, found), options=ANSWER_OPTIONS)
    except httpx.HTTPError as error:
        raise AssistantError("connection") from error


def _ollama_stream(messages: list[dict]) -> Iterator[str]:
    """Ҷавоби Ollama-ро пора-пора медиҳад, то корбар матнро пас аз чанд сония бинад."""
    s = get_settings()
    body = {"model": s.ollama_model, "stream": True, "messages": messages, "keep_alive": "30m", "options": ANSWER_OPTIONS}
    try:
        with httpx.Client(timeout=httpx.Timeout(240, read=120)) as http:
            for payload in ({**body, "think": False}, body):  # модели бе thinking «think»-ро қабул намекунад
                with http.stream("POST", f"{s.ollama_url}/api/chat", json=payload) as r:
                    if r.status_code == 400 and "think" in payload and "think" in r.read().decode(errors="ignore"):
                        continue
                    if r.status_code >= 400:
                        log.warning("Ollama error %s: %s", r.status_code, r.read()[:300])
                        raise AssistantError(str(r.status_code))
                    for line in r.iter_lines():
                        if line:
                            chunk = json.loads(line)
                            if chunk.get("message", {}).get("content"):
                                yield chunk["message"]["content"]
                    return
    except httpx.HTTPError as error:
        raise AssistantError("connection") from error


def start(db: Session, history: list[dict]) -> dict:
    """Ҳама кори бо база (ҷустуҷӯи хизматҳо) — пеш аз ҷараён, то сессияи база дар вақти ҷараён лозим набошад.
    Барои Ollama паёмҳои тайёр бармегардонад (ҷавоб пора-пора меояд), барои Claude/Gemini — ҷавоби пурра."""
    which = provider()
    if which is None:
        raise AssistantUnavailable("На ANTHROPIC_API_KEY, на GEMINI_API_KEY ва на Ollama")
    history = [{"role": m["role"], "content": m["content"]} for m in history[-MAX_TURNS:]]
    found: dict[int, dict] = {}
    system_text, today = f"{SYSTEM}\n\n{_catalog(db)}", f"Санаи имрӯз: {date.today().isoformat()}"
    if which == "ollama":
        try:
            with httpx.Client(timeout=240) as http:
                return {"messages": _ollama_messages(http, db, system_text, today, history, found), "found": found}
        except httpx.HTTPError as error:
            raise AssistantError("connection") from error
    run = {"claude": _claude, "gemini": _gemini}[which]
    return {"reply": run(db, system_text, today, history, found), "found": found}


def stream(plan: dict) -> Iterator[dict]:
    """{'delta': матн} … ва дар охир {'done': True, 'listings': [...]} — бе база."""
    parts = []
    chunks = _ollama_stream(plan["messages"]) if "messages" in plan else iter([plan["reply"]])
    for delta in chunks:
        parts.append(delta)
        yield {"delta": delta}
    reply = "".join(parts).strip()
    if not reply:
        yield {"delta": "Ҷавоб тайёр нашуд. Саволро кӯтоҳтар нависед."}
    linked = [r for i, r in plan["found"].items() if f"/listing/{i})" in reply]
    yield {"done": True, "listings": linked}


def ask(db: Session, history: list[dict]) -> dict:
    """history: [{'role': 'user'|'assistant', 'content': str}, …], охираш — саволи корбар.
    {'reply': матн, 'listings': [эълонҳое, ки дар ҷавоб пайванд шудаанд]} бармегардонад."""
    which = provider()
    if which is None:
        raise AssistantUnavailable("На ANTHROPIC_API_KEY, на GEMINI_API_KEY ва на Ollama")
    history = [{"role": m["role"], "content": m["content"]} for m in history[-MAX_TURNS:]]
    found: dict[int, dict] = {}
    run = {"claude": _claude, "gemini": _gemini, "ollama": _ollama}[which]
    reply = run(db, f"{SYSTEM}\n\n{_catalog(db)}", f"Санаи имрӯз: {date.today().isoformat()}", history, found)
    if not reply:
        reply = "Ҷавоб тайёр нашуд. Саволро кӯтоҳтар нависед."
    # Танҳо эълонҳое, ки воқеан дар ҷавоб пайванд шудаанд — кортҳо дар зери ҷавоб
    linked = [r for i, r in found.items() if f"/listing/{i})" in reply]
    return {"reply": reply, "listings": linked}


# ---------------- Стилисти ороишгоҳ: маслиҳат аз рӯи сурат ва либос ----------------

STYLIST = """Ту стилисти тӯйи сайти Тӯёна ҳастӣ. Ба тоҷикии адабӣ (кириллӣ) маслиҳати пурра ва амалӣ медиҳӣ.
{images}
Либоси интихобшуда: «{title}» — {category}, {price}. {description}

Ҷавобро бо ҳамин се қисм нависед (сарлавҳаҳо бо **ғафс**):
**Ба шумо мезебад?** — рост ва бо эҳтиром: ранги либос бо ранги рӯй ва мӯй, шакл ва андоза аз рӯи сурат. Хушомад накун; агар мувофиқ набошад, бигӯ чаро.
**Чӣ илова кунед** — 3–5 маслиҳати мушаххас: тоқӣ ё рӯймол, пойафзол, камар, ороиш, мӯй, ранги ҳамроҳ.
**Инҳоро ҳам озмоед** — 1–3 либос ТАНҲО аз РӮЙХАТИ КАТАЛОГ дар поён, ҳар кадом ҳамчун [Ном](/listing/ID) ва бо як ҷумла сабаб.

Қоидаҳо: ҳеҷ либос, нарх ё мағозаеро, ки дар рӯйхат нест, наном. Агар сурат равшан набошад ё одам дида нашавад, инро рост бигӯ. Бадан ва намуди одамро таҳқир накун.

РӮЙХАТИ КАТАЛОГ:
{alternatives}"""


_ollama_vision: tuple[float, bool] | None = None


def ollama_sees_images() -> bool:
    global _ollama_vision
    s = get_settings()
    if _ollama_vision is None or time.monotonic() - _ollama_vision[0] > 300:
        try:
            caps = httpx.post(f"{s.ollama_url}/api/show", json={"model": s.ollama_model}, timeout=5).json().get("capabilities", [])
            ok = "vision" in caps
        except (httpx.HTTPError, ValueError):
            ok = False
        _ollama_vision = (time.monotonic(), ok)
    return _ollama_vision[1]


def stylist(outfit: dict, images: list[tuple[str, bytes]], alternatives: list[dict]) -> str:
    """outfit: {title, category, price, description}. images: [(тавсиф, JPEG)], масалан [("сурати корбар", …), ("либос", …)].
    alternatives: либосҳои дигари каталог {id, title, category, price}. Матни маслиҳатро бармегардонад."""
    import base64

    which = provider()
    if which is None:
        raise AssistantUnavailable("AI нест")
    if which == "ollama" and not ollama_sees_images():
        images = []  # модел расмро намебинад — маслиҳат танҳо аз рӯи тавсифи либос
    described = "\n".join(f"Сурати {i + 1} — {label}." for i, (label, _) in enumerate(images)) or \
        "Сурат нест — танҳо аз рӯи тавсифи либос маслиҳат деҳ ва бигӯ, ки бе сурат баҳо додан мумкин нест."
    text = STYLIST.format(
        images=described, title=outfit["title"], category=outfit["category"], price=outfit["price"],
        description=outfit.get("description", "")[:400],
        alternatives="\n".join(f"- ID {a['id']}: {a['title']} ({a['category']}, {a['price']})" for a in alternatives) or "(холӣ)",
    )
    b64 = [base64.b64encode(data).decode() for _, data in images]
    s = get_settings()
    try:
        if which == "claude":
            client = anthropic.Anthropic(api_key=s.anthropic_api_key, timeout=120, max_retries=2)
            content = [{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": d}} for d in b64]
            response = client.beta.messages.create(
                model=s.assistant_model, max_tokens=MAX_OUTPUT, output_config={"effort": s.assistant_effort},
                betas=[FALLBACK_BETA], fallbacks="default",
                messages=[{"role": "user", "content": [*content, {"type": "text", "text": text}]}],
            )
            if response.stop_reason == "refusal":
                return REFUSAL
            return "".join(b.text for b in response.content if b.type == "text").strip()
        if which == "gemini":
            parts = [{"inline_data": {"mime_type": "image/jpeg", "data": d}} for d in b64] + [{"text": text}]
            with httpx.Client(timeout=120) as http:
                r = _gemini_post(http, _gemini_models(), {"contents": [{"role": "user", "parts": parts}], "generationConfig": {"maxOutputTokens": MAX_OUTPUT}})
            if r.status_code >= 400:
                raise AssistantError("rate_limit" if r.status_code in (429, 503) else str(r.status_code))
            cand = (r.json().get("candidates") or [{}])[0]
            return "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []) if not p.get("thought")).strip()
        message = {"role": "user", "content": text, **({"images": b64} if b64 else {})}
        with httpx.Client(timeout=300) as http:
            return _ollama_chat(http, [message], options={"temperature": 0.3, "num_predict": MAX_OUTPUT, "num_ctx": 8192, "repeat_penalty": 1.1})
    except anthropic.RateLimitError as error:
        raise AssistantError("rate_limit") from error
    except anthropic.APIError as error:
        raise AssistantError("api") from error
    except httpx.HTTPError as error:
        raise AssistantError("connection") from error
