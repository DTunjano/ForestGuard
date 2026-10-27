"""Privileged account creation and trusted model lifecycle, with real permissions."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from accounts.rbac import project_permissions
from analyses.models import Analysis
from catalog.models import PipelineModel, StudyArea


def account(username, **kwargs):
    return get_user_model().objects.create_user(
        username=username, email=f"{username}@example.test", **kwargs
    )


def credentials(name, **kwargs):
    return {
        "username": name,
        "email": f"{name}@example.test",
        "password": "AccountTest9824!",
        **kwargs,
    }


@pytest.mark.django_db
def test_administrator_creation_defaults_permissions_and_denials():
    client = APIClient()
    path = "/api/v1/admin/administrators/"
    assert client.post(path, credentials("blocked"), format="json").status_code == 401
    analyst = account("plain_analyst")
    client.force_authenticate(analyst)
    assert client.post(path, credentials("blocked"), format="json").status_code == 403
    admin = account("project_admin", role="admin")
    client.force_authenticate(admin)
    response = client.post(path, credentials("created_admin"), format="json")
    assert response.status_code == 201, response.data
    created = get_user_model().objects.get(username="created_admin")
    assert created.is_active and created.is_project_admin
    assert not created.is_staff and not created.is_superuser
    assert created.groups.filter(name="admin").exists()
    assert created.check_password("AccountTest9824!")
    expected = {
        f"{permission.content_type.app_label}.{permission.codename}"
        for permission in project_permissions()
    }
    assert expected <= set(response.data["permissions"])
    assert all(
        f"catalog.{action}_pipelinemodel" in response.data["permissions"]
        for action in ("view", "add", "change", "delete")
    )
    assert "password" not in response.data and response.data["is_superuser"] is False
    assert (
        client.post(
            path, credentials("blocked_super", account_type="superuser"), format="json"
        ).status_code
        == 403
    )
    for extra in (
        {"is_superuser": True},
        {"role_ids": []},
        {"role": "analyst"},
        {"is_staff": True},
    ):
        assert (
            client.post(path, credentials("bad_flags", **extra), format="json").status_code == 400
        )
    assert client.post(path, credentials("weak", password="123"), format="json").status_code == 400
    assert client.post(path, credentials("created_admin"), format="json").status_code == 400
    assert (
        client.post(
            path, credentials("different", email="CREATED_ADMIN@example.test"), format="json"
        ).status_code
        == 400
    )
    assert (
        not get_user_model()
        .objects.filter(username__in=["blocked", "blocked_super", "bad_flags", "weak"])
        .exists()
    )


@pytest.mark.django_db
def test_superuser_creation_protected_editing_and_last_superuser():
    User = get_user_model()
    root = User.objects.create_superuser(
        username="root_account", email="root@example.test", password="AccountTest9824!"
    )
    assert root.role == "admin" and root.groups.filter(name="admin").exists()
    client = APIClient()
    client.force_authenticate(root)
    response = client.post(
        "/api/v1/admin/administrators/",
        credentials("root_second", account_type="superuser"),
        format="json",
    )
    assert response.status_code == 201, response.data
    second = User.objects.get(username="root_second")
    assert second.is_superuser and second.is_staff and second.is_active
    assert second.check_password("AccountTest9824!")
    admin = account("standard_admin", role="admin")
    client.force_authenticate(admin)
    assert (
        client.patch(
            f"/api/v1/admin/users/{root.pk}/", {"email": "takeover@example.test"}, format="json"
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/admin/users/", credentials("generic_super", is_superuser=True), format="json"
        ).status_code
        == 400
    )
    assert (
        client.patch(
            f"/api/v1/admin/users/{admin.pk}/", {"is_superuser": True}, format="json"
        ).status_code
        == 400
    )
    client.force_authenticate(root)
    assert (
        client.patch(
            f"/api/v1/admin/users/{second.pk}/", {"role_ids": []}, format="json"
        ).status_code
        == 400
    )
    assert (
        client.patch(
            f"/api/v1/admin/users/{second.pk}/", {"is_active": False}, format="json"
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/api/v1/admin/users/{root.pk}/", {"is_active": False}, format="json"
        ).status_code
        == 400
    )
    # Independently exercise the last-superuser check without requiring the caller to be active.
    client.force_authenticate(second)
    denied = client.patch(f"/api/v1/admin/users/{root.pk}/", {"is_active": False}, format="json")
    assert denied.status_code == 400 and "superusuario activo" in str(denied.data)
    root.refresh_from_db()
    assert root.is_active
    public = APIClient().post(
        "/api/v1/auth/register/",
        credentials(
            "public_flags", is_superuser=True, is_staff=True, role="admin", account_type="superuser"
        ),
        format="json",
    )
    assert public.status_code == 201
    candidate = User.objects.get(username="public_flags")
    assert not candidate.is_superuser and not candidate.is_staff and not candidate.is_project_admin


@pytest.mark.django_db
def test_trusted_model_registration_edit_activation_and_protected_delete():
    client = APIClient()
    analyst = account("model_reader")
    admin = account("model_admin", role="admin")
    client.force_authenticate(analyst)
    assert client.get("/api/v1/admin/models/").status_code == 403
    assert client.get("/api/v1/admin/models/packages/").status_code == 403
    assert (
        client.post("/api/v1/admin/models/", {"package_key": "v9"}, format="json").status_code
        == 403
    )
    client.force_authenticate(admin)
    packages = client.get("/api/v1/admin/models/packages/")
    assert packages.status_code == 200 and packages.data[0]["available"], packages.data
    created = client.post(
        "/api/v1/admin/models/", {"package_key": "v9", "name": "Modelo administrado"}, format="json"
    )
    assert created.status_code == 201, created.data
    model = PipelineModel.objects.get(pk=created.data["id"])
    assert model.version == "v9" and model.active and created.data["analysis_count"] == 0
    assert "relative_path" not in created.data
    assert model.performance_profile
    assert (
        client.post("/api/v1/admin/models/", {"package_key": "v9"}, format="json").status_code
        == 400
    )
    assert (
        client.patch(
            f"/api/v1/admin/models/{model.pk}/", {"relative_path": "outside.joblib"}, format="json"
        ).status_code
        == 400
    )
    assert (
        client.patch(
            f"/api/v1/admin/models/{model.pk}/", {"performance_profile": {}}, format="json"
        ).status_code
        == 400
    )
    changed = client.patch(
        f"/api/v1/admin/models/{model.pk}/",
        {"name": "Modelo editado", "description": "Seguimiento", "active": False},
        format="json",
    )
    assert changed.status_code == 200 and not changed.data["active"]
    client.force_authenticate(analyst)
    assert client.get("/api/v1/models/").data["count"] == 0
    assert (
        client.patch(
            f"/api/v1/admin/models/{model.pk}/", {"active": True}, format="json"
        ).status_code
        == 403
    )
    client.force_authenticate(admin)
    assert client.get("/api/v1/admin/models/?active=false").data["count"] == 1
    assert client.get("/api/v1/admin/models/?active=bad").status_code == 400
    assert (
        client.patch(
            f"/api/v1/admin/models/{model.pk}/", {"active": True}, format="json"
        ).status_code
        == 200
    )
    area = StudyArea.objects.create(owner=analyst, name="Modelo en uso")
    job = Analysis.objects.create(owner=analyst, study_area=area, model=model, name="En cola")
    assert client.get("/api/v1/admin/models/").data["results"][0]["analysis_count"] == 1
    assert client.delete(f"/api/v1/admin/models/{model.pk}/").status_code == 400
    assert (
        client.patch(
            f"/api/v1/admin/models/{model.pk}/", {"active": False}, format="json"
        ).status_code
        == 200
    )
    job.refresh_from_db()
    assert job.model_id == model.pk and job.status == "queued"
    job.delete()
    assert client.delete(f"/api/v1/admin/models/{model.pk}/").status_code == 204
    assert client.get("/api/v1/admin/models/packages/").data[0]["registered_id"] is None


@pytest.mark.django_db
def test_model_integrity_rejection_and_delegated_model_manager(settings, tmp_path):
    operator = account("delegated_model_manager")
    operator.user_permissions.add(
        *Permission.objects.filter(
            content_type__app_label="catalog",
            codename__in=["view_pipelinemodel", "change_pipelinemodel"],
        )
    )
    client = APIClient()
    client.force_authenticate(get_user_model().objects.get(pk=operator.pk))
    model = PipelineModel.objects.create(
        name="Installed",
        version="v9",
        algorithm="RF",
        relative_path="model/modelo_exploratorio.joblib",
        active=True,
    )
    assert client.get("/api/v1/admin/models/").status_code == 200
    assert (
        client.post("/api/v1/admin/models/", {"package_key": "v9"}, format="json").status_code
        == 403
    )
    assert client.delete(f"/api/v1/admin/models/{model.pk}/").status_code == 403
    settings.PIPELINE_ROOT = tmp_path
    assert (
        client.patch(
            f"/api/v1/admin/models/{model.pk}/", {"active": True}, format="json"
        ).status_code
        == 400
    )
    assert (
        client.patch(
            f"/api/v1/admin/models/{model.pk}/", {"active": False}, format="json"
        ).status_code
        == 200
    )
    # A malformed/tampered installed file never gets deserialized by the web API.
    (tmp_path / "model").mkdir()
    (tmp_path / "model/modelo_exploratorio.joblib").write_bytes(b"tampered")
    (tmp_path / "model/perfil_desempeno.json").write_text("{}")
    (tmp_path / "manifiesto.json").write_text(
        '{"archivos_sha256":{"model/modelo_exploratorio.joblib":"wrong"}}'
    )
    assert (
        client.patch(
            f"/api/v1/admin/models/{model.pk}/", {"active": True}, format="json"
        ).status_code
        == 400
    )


def test_swagger_documents_privileged_creation_and_model_mutations():
    schema = APIClient().get("/api/schema/?format=json").json()
    operation = schema["paths"]["/api/v1/admin/administrators/"]["post"]
    assert operation["security"] == [{"jwtAuth": []}]
    assert set(operation["responses"]) >= {"201", "400", "401", "403"}
    assert len(operation["requestBody"]["content"]["application/json"]["examples"]) == 2
    assert set(schema["paths"]["/api/v1/admin/models/"]) >= {"get", "post"}
    assert set(schema["paths"]["/api/v1/admin/models/{id}/"]) >= {"get", "patch", "delete"}


@pytest.mark.django_db(transaction=True)
def test_concurrent_admin_demotions_keep_one_active_administrator():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from django.db import close_old_connections

    first = account("concurrent_first", role="admin")
    second = account("concurrent_second", role="admin")
    first.get_all_permissions()
    second.get_all_permissions()
    analyst_id = first.groups.model.objects.get(name="analyst").pk
    barrier = Barrier(2)

    def demote(actor, target):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(actor)
            barrier.wait(timeout=10)
            return client.patch(
                f"/api/v1/admin/users/{target.pk}/", {"role_ids": [analyst_id]}, format="json"
            ).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [pool.submit(demote, first, second), pool.submit(demote, second, first)]
        assert sorted(result.result(timeout=20) for result in results) == [200, 400]
    assert get_user_model().objects.filter(groups__name="admin", is_active=True).count() == 1
