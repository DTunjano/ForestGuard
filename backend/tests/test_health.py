import pytest
from django.db import DatabaseError, connection
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_checks_postgresql(monkeypatch):
    client = APIClient()
    assert client.get("/health/").json() == {"status": "ok"}

    def unavailable():
        raise DatabaseError("database unavailable")

    monkeypatch.setattr(connection, "cursor", unavailable)
    response = client.get("/health/")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
    assert "database" not in response.content.decode()
