from pathlib import Path

DEFAULT_STORE_DIR = Path(".ods-eos")
DEFAULT_STORE_FILENAME = "knowledge-store.json"
DEFAULT_CAPTURE_QUEUE_FILENAME = "capture-queue.json"
DEFAULT_EOD_DIR = Path("docs/eod")
DEFAULT_MORNING_DIR = Path("docs/morning")
DEFAULT_BOOTSTRAP_DIR = Path("docs/bootstrap")
DEFAULT_YESTERDAY_FILENAME = "yesterday.md"
DEFAULT_DATASETS_DIR = Path("datasets")


def get_store_dir() -> Path:
    return DEFAULT_STORE_DIR


def get_store_path() -> Path:
    return DEFAULT_STORE_DIR / DEFAULT_STORE_FILENAME


def get_capture_queue_path() -> Path:
    return DEFAULT_STORE_DIR / DEFAULT_CAPTURE_QUEUE_FILENAME


def get_datasets_dir() -> Path:
    return DEFAULT_DATASETS_DIR


def get_eod_dir() -> Path:
    return DEFAULT_EOD_DIR


def get_morning_dir() -> Path:
    return DEFAULT_MORNING_DIR


def get_bootstrap_dir() -> Path:
    return DEFAULT_BOOTSTRAP_DIR


def get_yesterday_path() -> Path:
    return DEFAULT_BOOTSTRAP_DIR / DEFAULT_YESTERDAY_FILENAME
