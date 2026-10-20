import pytest
from django.db import DatabaseError, connection
from rest_framework.test import APIClient


def test_root_redirects_to_api_docs():
    response = APIClient().get("/")
    assert response.status_code == 302
    assert response["Location"] == "/api/docs/"
    assert APIClient().get("/favicon.ico").status_code == 204


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
