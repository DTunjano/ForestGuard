import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle


@pytest.mark.django_db
def test_registration_login_and_password_lifecycle():
    client = APIClient()
    registration = client.post("/api/v1/auth/register/", {
        "username": "analista", "email": "Analista@Example.COM", "password": "StrongPass123!",
        "first_name": "Ana",
    }, format="json")
    assert registration.status_code == 201, registration.data
    assert get_user_model().objects.get(username="analista").email == "analista@example.com"
    assert "password" not in registration.data
    duplicate = client.post("/api/v1/auth/register/", {
        "username": "segunda", "email": "ANALISTA@example.com", "password": "StrongPass123!",
    }, format="json")
    assert duplicate.status_code == 400
    assert client.post("/api/v1/auth/token/", {
        "username": "analista", "password": "incorrecta",
    }, format="json").status_code == 401

    login = client.post("/api/v1/auth/token/", {
        "username": "analista", "password": "StrongPass123!",
    }, format="json")
    assert login.status_code == 200, login.data
    old_access, old_refresh = login.data["access"], login.data["refresh"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {old_access}")
    assert client.patch("/api/v1/auth/me/", {"email": "OTRO@Example.com"}, format="json").data[
        "email"
    ] == "otro@example.com"
    wrong = client.post("/api/v1/auth/password/change/", {
        "old_password": "incorrecta", "new_password": "AnotherStrong123!",
    }, format="json")
    assert wrong.status_code == 400
    changed = client.post("/api/v1/auth/password/change/", {
        "old_password": "StrongPass123!", "new_password": "AnotherStrong123!",
    }, format="json")
    assert changed.status_code == 204, changed.data
    assert client.get("/api/v1/auth/me/").status_code == 401
    assert client.post("/api/v1/auth/token/refresh/", {
        "refresh": old_refresh,
    }, format="json").status_code == 401
    assert client.post("/api/v1/auth/token/", {
        "username": "analista", "password": "StrongPass123!",
    }, format="json").status_code == 401
    assert client.post("/api/v1/auth/token/", {
        "username": "analista", "password": "AnotherStrong123!",
    }, format="json").status_code == 200


@pytest.mark.django_db
def test_admin_user_management_and_deactivation():
    user_model = get_user_model()
    admin = user_model.objects.create_user(
        username="admin", email="admin@example.com", password="StrongPass123!", role="admin",
    )
    analyst = user_model.objects.create_user(
        username="analyst", email="analyst@example.com", password="StrongPass123!",
    )
    client = APIClient()
    client.force_authenticate(user=analyst)
    assert client.get("/api/v1/admin/users/").status_code == 403
    client.force_authenticate(user=admin)
    created = client.post("/api/v1/admin/users/", {
        "username": "newuser", "email": "New@Example.COM", "password": "StrongPass123!",
        "role": "analyst", "is_active": True,
    }, format="json")
    assert created.status_code == 201, created.data
    assert "password" not in created.data
    new_user = user_model.objects.get(username="newuser")
    assert new_user.check_password("StrongPass123!") and new_user.email == "new@example.com"
    assert client.patch(f"/api/v1/admin/users/{admin.pk}/", {
        "is_active": False,
    }, format="json").status_code == 400
    assert client.patch(f"/api/v1/admin/users/{admin.pk}/", {
        "role": "analyst",
    }, format="json").status_code == 400
    assert client.patch(f"/api/v1/admin/users/{new_user.pk}/", {
        "is_active": False,
    }, format="json").status_code == 200
    assert client.get("/api/v1/admin/users/?search=newuser").data["count"] == 1
    client.force_authenticate(user=None)
    assert client.post("/api/v1/auth/token/", {
        "username": "newuser", "password": "StrongPass123!",
    }, format="json").status_code == 401


@pytest.mark.django_db
def test_login_is_rate_limited(monkeypatch):
    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"auth": "2/min"})
    cache.clear()
    client = APIClient()
    for _ in range(2):
        assert client.post("/api/v1/auth/token/", {
            "username": "nadie", "password": "incorrecta",
        }, format="json").status_code == 401
    assert client.post("/api/v1/auth/token/", {
        "username": "nadie", "password": "incorrecta",
    }, format="json").status_code == 429
    cache.clear()
