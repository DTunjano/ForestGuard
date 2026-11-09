"""Compare binary masks on a shared valid pixel grid."""

import numpy as np


def overlap_counts(candidate, reference, valid):
    candidate = candidate[valid]
    reference = reference[valid]
    both = int(np.count_nonzero(candidate & reference))
    return both, int(candidate.sum()) - both, int(reference.sum()) - both


def ratio(numerator, denominator):
    return numerator / denominator if denominator else None
