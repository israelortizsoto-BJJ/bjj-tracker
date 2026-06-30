from pathlib import Path

DEFAULT_STORE_DIR = Path(".ods-eos")
DEFAULT_STORE_FILENAME = "knowledge-store.json"
DEFAULT_EOD_DIR = Path("docs/eod")
DEFAULT_MORNING_DIR = Path("docs/morning")


def get_store_path() -> Path:
    return DEFAULT_STORE_DIR / DEFAULT_STORE_FILENAME


def get_eod_dir() -> Path:
    return DEFAULT_EOD_DIR


def get_morning_dir() -> Path:
    return DEFAULT_MORNING_DIR
