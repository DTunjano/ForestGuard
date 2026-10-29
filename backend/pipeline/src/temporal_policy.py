"""Runtime temporal eligibility; the model training interval remains metadata."""

MIN_INTERVAL_DAYS = 35


def require_interval(days):
    if days < MIN_INTERVAL_DAYS:
        raise ValueError(
            f"Intervalo de {days} días: se requieren al menos {MIN_INTERVAL_DAYS} días entre fechas consecutivas."
        )


def temporal_policy():
    return {"minimo_dias": MIN_INTERVAL_DAYS, "maximo_dias": None}
