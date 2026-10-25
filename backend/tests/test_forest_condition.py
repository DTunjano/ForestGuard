import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline" / "src"))
from forest_condition import classify, condition_summary  # noqa: E402


def test_temporal_rules_boundaries_priority_other_cover_and_nodata():
    before = np.array([[0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.3, 0.8]], dtype="float32")
    after = np.array([[0.8, 0.7, 0.7, 0.49, 0.5, 0.4998, 0.2, 0.8]], dtype="float32")
    initial_nbr = np.full(before.shape, 0.7, dtype="float32")
    final_nbr = np.array([[0.65, 0.6, 0.3, 0.4, 0.7, 0.7, 0.4, 0.5]], dtype="float32")
    valid = np.ones(before.shape, dtype=bool)
    valid[0, -1] = False
    classes = classify(after, valid, before, initial_nbr, final_nbr)
    assert classes.tolist() == [[1, 2, 2, 3, 1, 3, 0, 255]]
    counts = np.bincount(classes[valid], minlength=4)
    summary = condition_summary(counts, 8, 100, temporal=True)
    assert summary["pixeles_evaluados"] == 7
    assert sum(item["porcentaje"] for item in summary["categorias"]) == pytest.approx(100)
    assert sum(item["area_ha"] for item in summary["categorias"]) == pytest.approx(0.07)
    assert summary["porcentaje_cobertura_valida"] == 87.5


def test_one_date_never_invents_degradation_or_change_and_zero_coverage():
    ndvi = np.array([[0.1, 0.2, 0.4999, 0.5, 0.9]], dtype="float32")
    valid = np.ones(ndvi.shape, dtype=bool)
    classes = classify(ndvi, valid)
    assert classes.tolist() == [[0, 3, 3, 1, 1]]
    summary = condition_summary(np.bincount(classes[valid], minlength=4), 5, None)
    assert summary["categorias"][2]["porcentaje"] is None
    assert sum(item["porcentaje"] or 0 for item in summary["categorias"]) == 100
    empty = condition_summary(np.zeros(4, dtype=int), 5, 100, temporal=True)
    assert all(item["porcentaje"] is None for item in empty["categorias"])
