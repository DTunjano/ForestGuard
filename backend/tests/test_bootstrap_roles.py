from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_console_bootstrap_creates_project_admin_and_allows_api_creation(monkeypatch):
    command_module = "accounts.management.commands.create_project_admin.getpass"
    monkeypatch.setattr(command_module, lambda prompt: "BootstrapStrong914!")
    output = StringIO()
    call_command(
        "create_project_admin",
        username="console_admin",
        email="Console@example.test",
        stdout=output,
    )
    User = get_user_model()
    user = User.objects.get(username="console_admin")
    assert user.is_project_admin and not user.is_staff and not user.is_superuser
    assert user.check_password("BootstrapStrong914!") and user.email == "console@example.test"
    assert "BootstrapStrong914!" not in output.getvalue()
    client = APIClient()
    login = client.post(
        "/api/v1/auth/token/",
        {"username": "console_admin", "password": "BootstrapStrong914!"},
        format="json",
    )
    assert login.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    response = client.post(
        "/api/v1/admin/administrators/",
        {
            "username": "api_admin",
            "email": "api-admin@example.test",
            "password": "AnotherStrong826!",
        },
        format="json",
    )
    assert (
        response.status_code == 201
        and response.data["roles"][0]["id"] == Group.objects.get(name="admin").pk
    )
    with pytest.raises(CommandError):
        call_command(
            "create_project_admin",
            username="console_admin",
            email="duplicate@example.test",
            stdout=StringIO(),
        )
    assert User.objects.count() == 2


@pytest.mark.django_db
def test_bootstrap_password_mismatch_and_weak_password_do_not_create_accounts(monkeypatch):
    module = "accounts.management.commands.create_project_admin.getpass"
    passwords = iter(["OneStrong784!", "DifferentStrong784!"])
    monkeypatch.setattr(module, lambda prompt: next(passwords))
    with pytest.raises(CommandError, match="no coinciden"):
        call_command("create_project_admin", username="mismatch", email="mismatch@example.test")
    monkeypatch.setattr(module, lambda prompt: "123")
    with pytest.raises(CommandError):
        call_command("create_project_admin", username="weak", email="weak@example.test")
    assert not get_user_model().objects.exists()


@pytest.mark.django_db
def test_assign_by_role_id_reject_string_and_preserve_permissions_when_renamed():
    User = get_user_model()
    admin = User.objects.create_user(
        username="id_admin", email="id-admin@example.test", role="admin"
    )
    client = APIClient()
    client.force_authenticate(admin)
    permission = Permission.objects.get(
        content_type__app_label="catalog", codename="view_studyarea"
    )
    role = client.post(
        "/api/v1/admin/roles/", {"name": "Lector", "permission_ids": [permission.pk]}, format="json"
    )
    assert role.status_code == 201
    role_id = role.data["id"]
    assert client.patch(f"/api/v1/admin/roles/{role_id}/", {"name": "ADMIN"}, format="json").status_code == 400
    created = client.post(
        "/api/v1/admin/users/",
        {
            "username": "assigned_by_id",
            "email": "assigned@example.test",
            "password": "AssignedStrong123!",
            "role_ids": [role_id],
        },
        format="json",
    )
    assert created.status_code == 201, created.data
    assert created.data["roles"][0]["id"] == role_id and created.data["permissions"] == [
        "catalog.view_studyarea"
    ]
    user_id = created.data["id"]
    assert (
        client.patch(
            f"/api/v1/admin/users/{user_id}/", {"role": "admin"}, format="json"
        ).status_code
        == 400
    )
    for ids in ([role_id, role_id], [999999999], ["Lector"]):
        assert (
            client.patch(
                f"/api/v1/admin/users/{user_id}/", {"role_ids": ids}, format="json"
            ).status_code
            == 400
        )
    assert (
        client.patch(
            f"/api/v1/admin/roles/{role_id}/", {"name": "Revisor de áreas"}, format="json"
        ).status_code
        == 200
    )
    details = client.get(f"/api/v1/admin/users/{user_id}/").data
    assert (
        details["roles"][0]["id"] == role_id and details["roles"][0]["name"] == "Revisor de áreas"
    )
    assert details["permissions"] == ["catalog.view_studyarea"]
    assert User.objects.get(pk=user_id).groups.values_list("id", flat=True).get() == role_id


def test_swagger_exposes_only_id_based_role_assignment():
    schema = APIClient().get("/api/schema/?format=json").json()
    for path, method in (("/api/v1/admin/users/", "post"), ("/api/v1/admin/users/{id}/", "patch")):
        body = schema["paths"][path][method]["requestBody"]["content"]["application/json"]["schema"]
        request = schema["components"]["schemas"][body["$ref"].split("/")[-1]]["properties"]
        assert "role_ids" in request and "role" not in request
    user = schema["components"]["schemas"]["User"]["properties"]
    assert user["role"]["readOnly"] and user["role"]["deprecated"]
