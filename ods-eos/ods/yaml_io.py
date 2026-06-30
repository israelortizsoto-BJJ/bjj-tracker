"""Minimal YAML loader for structured operator proposal input."""

from __future__ import annotations

import json
from pathlib import Path


class StructuredInputError(Exception):
    """Structured input file cannot be parsed."""


def load_structured_file(path: Path) -> object:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise StructuredInputError(f"Cannot read input file: {exc}") from exc

    suffix = path.suffix.lower()
    if suffix == ".json":
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise StructuredInputError(f"Invalid JSON in input file: {exc}") from exc

    if suffix in {".yaml", ".yml"}:
        try:
            return _load_yaml(text)
        except StructuredInputError:
            raise
        except Exception as exc:
            raise StructuredInputError(f"Invalid YAML in input file: {exc}") from exc

    raise StructuredInputError(
        f"Unsupported input format {suffix!r}. Use .json, .yaml, or .yml."
    )


def _load_yaml(text: str) -> object:
    try:
        import yaml
    except ImportError:
        return _load_yaml_minimal(text)

    data = yaml.safe_load(text)
    if data is None:
        return {}
    return data


def _load_yaml_minimal(text: str) -> object:
    """Parse a constrained YAML subset without external dependencies."""
    lines = text.splitlines()
    if not lines or all(not line.strip() or line.strip().startswith("#") for line in lines):
        return {}

    parsed_lines: list[tuple[int, str]] = []
    for line_number, raw in enumerate(lines, start=1):
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        if indent % 2 != 0:
            raise StructuredInputError(
                f"Line {line_number}: indentation must use multiples of two spaces."
            )
        parsed_lines.append((indent, stripped))

    if not parsed_lines:
        return {}

    return _parse_block(parsed_lines, 0, 0)[0]


def _parse_block(
    lines: list[tuple[int, str]], index: int, indent: int
) -> tuple[object, int]:
    if index >= len(lines):
        return {}, index

    current_indent, content = lines[index]
    if current_indent < indent:
        return {}, index

    if content.startswith("- "):
        items: list[object] = []
        while index < len(lines) and lines[index][0] == indent and lines[index][1].startswith("- "):
            item_text = lines[index][1][2:].strip()
            index += 1

            if not item_text:
                child, index = _parse_block(lines, index, indent + 2)
                items.append(child)
                continue

            key, value = _split_key_value(item_text)
            if value is None:
                child, index = _parse_block(lines, index, indent + 2)
                item_obj: dict[str, object] = {key: child}
            else:
                item_obj = {key: _parse_scalar(value)}

            sibling_indent = indent + 2
            while (
                index < len(lines)
                and lines[index][0] == sibling_indent
                and not lines[index][1].startswith("- ")
            ):
                sibling_key, sibling_value = _split_key_value(lines[index][1])
                index += 1
                if sibling_value is None:
                    child, index = _parse_block(lines, index, sibling_indent + 2)
                    item_obj[sibling_key] = child
                else:
                    item_obj[sibling_key] = _parse_scalar(sibling_value)

            items.append(item_obj)
        return items, index

    mapping: dict[str, object] = {}
    while index < len(lines) and lines[index][0] == indent and not lines[index][1].startswith("- "):
        key, value = _split_key_value(lines[index][1])
        index += 1
        if value is None:
            child, index = _parse_block(lines, index, indent + 2)
            mapping[key] = child
        else:
            mapping[key] = _parse_scalar(value)
    return mapping, index


def _split_key_value(line: str) -> tuple[str, str | None]:
    if ":" not in line:
        raise StructuredInputError(f"Expected key/value pair, got: {line!r}")
    key, value = line.split(":", 1)
    key = key.strip()
    value = value.strip()
    if not key:
        raise StructuredInputError(f"Missing key in line: {line!r}")
    return key, value if value else None


def _parse_scalar(value: str) -> object:
    if not value:
        return ""
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    lowered = value.lower()
    if lowered in {"null", "~"}:
        return None
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    return value
