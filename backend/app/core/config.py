from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_name: str = "Tuyona API"
    environment: str = "development"  # development | production

    # SQLite барои оғози зуд; дар production PostgreSQL:
    # postgresql+psycopg://user:pass@host:5432/tuyona
    database_url: str = f"sqlite:///{BASE_DIR / 'tuyona.db'}"

    secret_key: str = "CHANGE-ME-in-production-use-a-long-random-string"
    access_token_minutes: int = 60 * 24 * 7
    jwt_algorithm: str = "HS256"

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    upload_dir: Path = BASE_DIR / "uploads"
    max_upload_mb: int = 5
    max_images_per_listing: int = 12

    login_attempts_per_minute: int = 10

    # Воридшавӣ бо Google: OAuth Client ID (Web) аз https://console.cloud.google.com/apis/credentials
    # Бе он тугмаи Google нишон дода намешавад.
    google_client_id: str = ""

    # Ороишгоҳи AI (/oroishgoh): бо FASHN_API_KEY — FASHN (пулакӣ, тез); бе он — модели ройгони Hugging Face.
    fashn_api_key: str = ""
    fashn_api_url: str = "https://api.fashn.ai"
    hf_token: str = ""
    tryon_daily_limit: int = 20
    # Тоза кардани заминаи либос: u2netp — хурд (~5 МБ, кам хотира, барои сервер); u2net — беҳтар, вале ~1 ГБ хотира
    rembg_model: str = "u2netp"

    # Ёрдамчии AI (чат): Claude. Калид аз https://platform.claude.com → API keys
    anthropic_api_key: str = ""
    assistant_model: str = "claude-opus-5-5"
    assistant_effort: str = "medium"  # low | medium | high — чуқурии фикр (ва нарх)
    assistant_hourly_limit: int = 30
    assistant_max_tokens: int = 4096  # дарозии ҷавоб (токенҳо); модели маҳаллӣ дар 8 ГБ — то ~4000 беҳтар
    # Агар калиди Claude набошад — Google Gemini (ройгон, бе корт): https://aistudio.google.com/apikey
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    # Ё модели маҳаллӣ (бе калид): Ollama дар ҳамин компютер, масалан OLLAMA_MODEL=gemma4:12b-it-qat
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = ""


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.environment == "production" and s.secret_key.startswith("CHANGE-ME"):
        raise RuntimeError("SECRET_KEY must be set in production")
    s.upload_dir.mkdir(parents=True, exist_ok=True)
    return s
