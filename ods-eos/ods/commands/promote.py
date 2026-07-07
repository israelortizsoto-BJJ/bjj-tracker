"""Knowledge Promotion Engine v1."""

from __future__ import annotations

from pathlib import Path

from ods.config import get_bootstrap_dir, get_store_dir, get_store_path
from ods.doctrine import (
    DoctrineError,
    load_decision_entries,
    load_section_entries,
    promote_knowledge,
    remove_decision_entry,
    remove_section_entry,
)
from ods.generators.active_slice import write_active_slice
from ods.generators.bootstrap import load_registry_doc, write_operator_bootstrap
from ods.knowledge_store import load_store


class PromoteError(Exception):
    """Promotion command failure."""


SURFACE_LABELS = {
    "doctrine": "Doctrine",
    "decision_register": "Decision Register",
    "bootstrap": "Bootstrap regenerated",
    "execution_brief": "Execution Brief regenerated",
    "notion": "Notion verification",
}


def run_promote(section: str, text: str) -> None:
    try:
        result = promote_knowledge(section, text)
    except DoctrineError as exc:
        raise PromoteError(str(exc)) from exc

    try:
        bootstrap_path, active_slice_path = regenerate_startup_artifacts()
        refresh_notion_homepage()
        verification = verify_promotion_surfaces(result.section, result.text, require_notion=True)
    except Exception as exc:
        if result.doctrine_updated:
            remove_section_entry(result.section, result.text)
        if result.decision_register_updated:
            remove_decision_entry(result.section, result.text)
        try:
            regenerate_startup_artifacts()
            refresh_notion_homepage()
        except Exception:
            pass
        if isinstance(exc, PromoteError):
            raise
        raise PromoteError(f"Promotion aborted: {exc}") from exc

    if not verification["ok"]:
        if result.doctrine_updated:
            remove_section_entry(result.section, result.text)
        if result.decision_register_updated:
            remove_decision_entry(result.section, result.text)
        try:
            regenerate_startup_artifacts()
            refresh_notion_homepage()
        except Exception:
            pass
        raise PromoteError(_format_failure(verification))

    print("Knowledge promotion complete.")
    print(f"  Section: {result.section}")
    print(f"  Text: {result.text}")
    print(f"  Doctrine: {result.doctrine_path} ({'updated' if result.doctrine_updated else 'already present'})")
    print(
        "  Decision Register: "
        f"{result.decision_register_path} ({'updated' if result.decision_register_updated else 'already present'})"
    )
    print(f"  Operator Bootstrap: {bootstrap_path}")
    print(f"  Active Slice: {active_slice_path}")
    print("  Notion homepage: refreshed and verified")


def run_verify_promotions() -> None:
    verification = verify_all_promotions(require_notion=True)
    for key in ("doctrine", "decision_register", "bootstrap", "execution_brief", "notion"):
        print(f"{SURFACE_LABELS[key]:<24} {'PASS' if verification[key] else 'FAIL'}")
    if verification["missing"]:
        print()
        print("Missing:")
        for item in verification["missing"]:
            print(f"  - {item}")
    if not verification["ok"]:
        raise PromoteError("Promotion verification failed.")


def regenerate_startup_artifacts() -> tuple[Path, Path]:
    registry_doc = load_registry_doc(get_store_dir() / "mission-registry.json")
    store = load_store(get_store_path())
    bootstrap_path = write_operator_bootstrap(
        registry_doc=registry_doc,
        output_dir=get_bootstrap_dir(),
        store=store,
    )
    active_slice_path = write_active_slice(
        registry_doc=registry_doc,
        output_dir=get_bootstrap_dir(),
        cwd=Path.cwd(),
    )
    return bootstrap_path, active_slice_path


def refresh_notion_homepage() -> bool:
    try:
        from scripts.setup_operating_surface import load_env, refresh_todays_command

        env = load_env()
        token = env.get("NOTION_API_KEY", "")
        parent_page_id = env.get("NOTION_PARENT_PAGE_ID", "")
        if not token or not parent_page_id:
            raise PromoteError("Missing NOTION_API_KEY or NOTION_PARENT_PAGE_ID.")
        refresh_todays_command(token, parent_page_id)
        return True
    except Exception as exc:  # pragma: no cover - external Notion boundary
        raise PromoteError(f"Could not refresh Notion homepage: {exc}") from exc


def verify_promotion_surfaces(section: str, text: str, *, require_notion: bool) -> dict:
    return verify_entries([{"section": section, "text": text}], require_notion=require_notion)


def verify_all_promotions(*, require_notion: bool) -> dict:
    return verify_entries(load_decision_entries(), require_notion=require_notion)


def verify_entries(entries: list[dict[str, str]], *, require_notion: bool) -> dict:
    bootstrap_text = _read_text(get_bootstrap_dir() / "operator-bootstrap.md")
    active_slice_text = _read_text(get_bootstrap_dir() / "active-slice.md")
    notion_text = _notion_homepage_text() if require_notion else ""
    status = {
        "doctrine": True,
        "decision_register": True,
        "bootstrap": True,
        "execution_brief": True,
        "notion": True,
        "missing": [],
    }
    decisions = load_decision_entries()
    decision_keys = {(_canonical(item["section"]), _canonical(item["text"])) for item in decisions}
    for entry in entries:
        section = entry["section"]
        text = entry["text"]
        label = f"{section}: {text}"
        if _canonical(text) not in {_canonical(item) for item in load_section_entries(section)}:
            status["doctrine"] = False
            status["missing"].append(f"Doctrine missing {label}")
        if (_canonical(section), _canonical(text)) not in decision_keys:
            status["decision_register"] = False
            status["missing"].append(f"Decision Register missing {label}")
        if text not in bootstrap_text:
            status["bootstrap"] = False
            status["missing"].append(f"Bootstrap missing {label}")
        if text not in active_slice_text:
            status["execution_brief"] = False
            status["missing"].append(f"Execution Brief missing {label}")
        if require_notion and text not in notion_text:
            status["notion"] = False
            status["missing"].append(f"Notion missing {label}")
    status["ok"] = all(status[key] for key in ("doctrine", "decision_register", "bootstrap", "execution_brief", "notion"))
    return status


def _notion_homepage_text() -> str:
    try:
        from scripts.setup_operating_surface import load_env, notion, _block_text

        env = load_env()
        token = env.get("NOTION_API_KEY", "")
        parent_page_id = env.get("NOTION_PARENT_PAGE_ID", "")
        if not token or not parent_page_id:
            raise PromoteError("Missing NOTION_API_KEY or NOTION_PARENT_PAGE_ID.")
        return "\n".join(_notion_block_texts(token, parent_page_id, notion, _block_text))
    except PromoteError:
        raise
    except Exception as exc:  # pragma: no cover - external Notion boundary
        raise PromoteError(f"Could not verify Notion homepage: {exc}") from exc


def _read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def _notion_block_texts(token: str, block_id: str, notion_fn, block_text_fn) -> list[str]:
    blocks = notion_fn("GET", f"/blocks/{block_id}/children?page_size=100", token).get("results", [])
    texts = []
    for block in blocks:
        texts.append(block_text_fn(block))
        if block.get("has_children"):
            texts.extend(_notion_block_texts(token, block["id"], notion_fn, block_text_fn))
    return texts


def _format_failure(verification: dict) -> str:
    lines = ["Promotion aborted."]
    for key in ("doctrine", "decision_register", "bootstrap", "execution_brief", "notion"):
        lines.append(f"{SURFACE_LABELS[key]}: {'PASS' if verification[key] else 'FAIL'}")
    if verification["missing"]:
        lines.append("Missing:")
        lines.extend(f"- {item}" for item in verification["missing"])
    return "\n".join(lines)


def _canonical(value: str) -> str:
    return " ".join(value.strip().lower().split())
