"""Tests for deterministic color matching."""

from __future__ import annotations

from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from color_matcher import CATEGORY_PRECEDENCE, match_category_name, task_style  # noqa: E402
from timeline_builder import load_config  # noqa: E402


class TestColorMatcher:
    def test_precedence_order(self):
        assert CATEGORY_PRECEDENCE[0] == "Delivery / Air / Live"
        assert CATEGORY_PRECEDENCE[-1] == "Concepting"

    def test_delivery_beats_review(self):
        categories, _, default, _ = load_config(ROOT / "colors.yaml")
        assert match_category_name("Final delivery review", categories) == "Delivery / Air / Live"

    def test_review_beats_shoot(self):
        categories, _, default, _ = load_config(ROOT / "colors.yaml")
        assert match_category_name("Post shoot review", categories) == "Review / Approval"
        assert task_style("Post shoot review", categories, default).fill == "A6A6A6"

    def test_edit_does_not_match_editorial(self):
        categories, _, default, _ = load_config(ROOT / "colors.yaml")
        assert match_category_name("Live editorial cut", categories) == "Delivery / Air / Live"

    def test_color_beats_shoot_in_compound_name(self):
        categories, _, default, _ = load_config(ROOT / "colors.yaml")
        assert match_category_name("Color shoot", categories) == "Edit / Post / VFX / Color"
        assert task_style("Color shoot", categories, default).fill == "00B0A8"

    def test_concepting_baseline(self):
        categories, _, default, _ = load_config(ROOT / "colors.yaml")
        assert task_style("Concepting", categories, default).fill == "1F3864"
        assert task_style("Unknown phase", categories, default).fill == "D9D9D9"
