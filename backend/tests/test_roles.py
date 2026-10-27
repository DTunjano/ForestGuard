import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_roles_crud_assignment_effective_permissions_and_owner_scope():
    User = get_user_model()
    admin = User.objects.create_user(username="rbac_admin", email="rbac@example.com", role="admin")
    analyst = User.objects.create_user(username="rbac_analyst", email="rbac-a@example.com")
    client = APIClient()
    client.force_authenticate(admin)
    catalog = client.get("/api/v1/admin/permissions/")
    assert catalog.status_code == 200
    assert len(catalog.data) == 21
    view_area = next(
        item["id"] for item in catalog.data if item["code"] == "catalog.view_studyarea"
    )
    role = client.post(
        "/api/v1/admin/roles/",
        {"name": "area_reader", "description": "Solo lectura", "permission_ids": [view_area]},
        format="json",
    )
    assert role.status_code == 201, role.data
    rid = role.data["id"]
    assigned = client.patch(
        f"/api/v1/admin/users/{analyst.pk}/", {"role_ids": [rid]}, format="json"
    )
    assert assigned.status_code == 200, assigned.data
    assert assigned.data["permissions"] == ["catalog.view_studyarea"]
    assert assigned.data["roles"][0]["name"] == "area_reader"
    from catalog.models import StudyArea

    StudyArea.objects.create(owner=admin, name="Privada")
    client.force_authenticate(User.objects.get(pk=analyst.pk))
    assert client.get("/api/v1/study-areas/").data["count"] == 0
    assert client.post("/api/v1/study-areas/", {"name": "No autorizado"}).status_code == 403
    assert client.get("/api/v1/analyses/").status_code == 403
    assert client.get("/api/v1/artifacts/999/preview/").status_code == 403
    assert client.get("/api/v1/artifacts/999/category-mask/").status_code == 403
    assert client.get("/api/v1/admin/roles/").status_code == 403
    assert (
        client.patch(
            "/api/v1/auth/me/",
            {"role": "admin", "role_ids": [Group.objects.get(name="admin").pk]},
            format="json",
        ).status_code
        == 200
    )
    assert not User.objects.get(pk=analyst.pk).is_project_admin
    client.force_authenticate(User.objects.get(pk=admin.pk))
    assert client.delete(f"/api/v1/admin/roles/{rid}/").status_code == 400
    updated = client.patch(f"/api/v1/admin/roles/{rid}/", {"permission_ids": []}, format="json")
    assert updated.status_code == 200
    client.force_authenticate(User.objects.get(pk=analyst.pk))
    assert client.get("/api/v1/study-areas/").status_code == 403
    client.force_authenticate(User.objects.get(pk=admin.pk))
    assert (
        client.patch(
            f"/api/v1/admin/users/{analyst.pk}/", {"role_ids": []}, format="json"
        ).status_code
        == 200
    )
    assert client.delete(f"/api/v1/admin/roles/{rid}/").status_code == 204


@pytest.mark.django_db
def test_builtin_protection_multi_role_union_and_assignment_permission():
    User = get_user_model()
    admin = User.objects.create_user(username="admin_safe", email="safe@example.com", role="admin")
    second = User.objects.create_user(username="second", email="second@example.com")
    client = APIClient()
    client.force_authenticate(admin)
    admin_group = Group.objects.get(name="admin")
    assert (
        client.patch(
            f"/api/v1/admin/users/{admin.pk}/", {"role_ids": []}, format="json"
        ).status_code
        == 400
    )
    assert client.delete(f"/api/v1/admin/roles/{admin_group.pk}/").status_code == 400
    assert (
        client.patch(
            f"/api/v1/admin/roles/{admin_group.pk}/", {"permission_ids": []}, format="json"
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/v1/admin/roles/", {"name": "ADMIN", "permission_ids": []}, format="json"
        ).status_code
        == 400
    )
    client.force_authenticate(second)
    assert client.get("/api/v1/admin/permissions/").status_code == 403
    # A user editor cannot assign administrator without change_group.
    second.user_permissions.add(
        Permission.objects.get(content_type__app_label="accounts", codename="change_user")
    )
    client.force_authenticate(User.objects.get(pk=second.pk))
    assert (
        client.patch(
            f"/api/v1/admin/users/{second.pk}/", {"role_ids": [admin_group.pk]}, format="json"
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/admin/users/{second.pk}/", {"role": "admin"}, format="json"
        ).status_code
        == 400
    )
    client.force_authenticate(User.objects.get(pk=admin.pk))
    analyst_group = Group.objects.get(name="analyst")
    changed = client.patch(
        f"/api/v1/admin/users/{second.pk}/",
        {"role_ids": [admin_group.pk, analyst_group.pk]},
        format="json",
    )
    assert changed.status_code == 200
    assert len(changed.data["roles"]) == 2
    assert "auth.change_group" in changed.data["permissions"]


@pytest.mark.django_db
def test_last_active_admin_and_ambiguous_creation_are_rejected():
    User = get_user_model()
    admin = User.objects.create_user(username="last_admin", email="last@example.test", role="admin")
    operator = User.objects.create_user(username="operator", email="operator@example.test")
    operator.user_permissions.add(
        *Permission.objects.filter(codename__in=("change_user", "change_group"))
    )
    client = APIClient()
    client.force_authenticate(operator)
    assert (
        client.patch(
            f"/api/v1/admin/users/{admin.pk}/", {"is_active": False}, format="json"
        ).status_code
        == 400
    )
    assert (
        client.patch(
            f"/api/v1/admin/users/{admin.pk}/", {"role_ids": []}, format="json"
        ).status_code
        == 400
    )
    admin.refresh_from_db()
    assert admin.is_active and admin.is_project_admin
    client.force_authenticate(admin)
    response = client.post(
        "/api/v1/admin/users/",
        {
            "username": "ambiguous",
            "email": "ambiguous@example.test",
            "password": "StrongPass123!",
            "role": "admin",
            "role_ids": [],
        },
        format="json",
    )
    assert response.status_code == 400
    assert not User.objects.filter(username="ambiguous").exists()
