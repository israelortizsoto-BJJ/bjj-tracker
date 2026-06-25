"""Deterministic word-boundary color matching with fixed category precedence."""

from __future__ import annotations

import re

from models import CategoryRule, ColorStyle

# Highest precedence first. First category with a word-boundary match wins.
CATEGORY_PRECEDENCE: tuple[str, ...] = (
    "Delivery / Air / Live",
    "Review / Approval",
    "Edit / Post / VFX / Color",
    "Shoot",
    "Pre Pro / Prep",
    "Concepting",
)

_BOUNDARY = r"(?<![a-z0-9])"
_BOUNDARY_END = r"(?![a-z0-9])"


def _pattern_regex(pattern: str) -> re.Pattern[str]:
    parts = pattern.lower().split()
    if len(parts) > 1:
        body = r"\s+".join(re.escape(part) for part in parts)
    else:
        body = re.escape(pattern.lower())
    return re.compile(rf"{_BOUNDARY}{body}{_BOUNDARY_END}", re.IGNORECASE)


def _matches(task_name: str, pattern: str) -> bool:
    return _pattern_regex(pattern).search(task_name) is not None


def build_category_lookup(
    categories: list[CategoryRule],
) -> dict[str, CategoryRule]:
    return {rule.name: rule for rule in categories}


def task_style(
    task_name: str,
    categories: list[CategoryRule],
    default_style: ColorStyle,
) -> ColorStyle:
    lookup = build_category_lookup(categories)
    for category_name in CATEGORY_PRECEDENCE:
        rule = lookup.get(category_name)
        if rule is None:
            continue
        for pattern in rule.patterns:
            if _matches(task_name, pattern):
                return rule.style
    return default_style


def match_category_name(
    task_name: str,
    categories: list[CategoryRule],
) -> str | None:
    lookup = build_category_lookup(categories)
    for category_name in CATEGORY_PRECEDENCE:
        rule = lookup.get(category_name)
        if rule is None:
            continue
        for pattern in rule.patterns:
            if _matches(task_name, pattern):
                return category_name
    return None
