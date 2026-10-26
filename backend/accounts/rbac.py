"""Project roles use Django's normalized groups and permission relations."""

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework.permissions import BasePermission

PROJECT_MODELS = {
    "accounts": ("user",),
    "auth": ("group",),
    "catalog": ("studyarea", "satelliteimage", "pipelinemodel"),
    "analyses": ("analysis",),
}
SUPPORTED_ACTIONS = {
    "user": ("view", "add", "change"),
    "group": ("view", "add", "change", "delete"),
    "studyarea": ("view", "add", "change", "delete"),
    "satelliteimage": ("view", "add", "delete"),
    "pipelinemodel": ("view", "add", "change", "delete"),
    "analysis": ("view", "add", "delete"),
}


def project_permissions():
    from django.db.models import Q

    query = Q(pk__in=[])
    for app, models in PROJECT_MODELS.items():
        query |= Q(content_type__app_label=app, content_type__model__in=models)
    return (
        Permission.objects.filter(
            query,
            codename__in=[
                f"{action}_{model}"
                for model, actions in SUPPORTED_ACTIONS.items()
                for action in actions
            ],
        )
        .select_related("content_type")
        .order_by("content_type__app_label", "codename")
    )


def ensure_builtin_roles():
    """Also works in tests that flush data; get_or_create never resets edited roles."""
    from .models import RoleProfile

    for name in ("admin", "analyst"):
        group, created = Group.objects.get_or_create(name=name)
        RoleProfile.objects.get_or_create(group=group, defaults={"is_system": True})
        if created:
            for app, models in PROJECT_MODELS.items():
                for model in models:
                    ct, _ = ContentType.objects.get_or_create(app_label=app, model=model)
                    for action in ("view", "add", "change", "delete"):
                        permission, _ = Permission.objects.get_or_create(
                            content_type=ct,
                            codename=f"{action}_{model}",
                            defaults={"name": f"Can {action} {model}"},
                        )
                        if name == "admin" or (
                            app in ("catalog", "analyses")
                            and (model != "pipelinemodel" or action == "view")
                        ):
                            group.permissions.add(permission)


class ProjectPermission(BasePermission):
    """Module permission plus existing owner querysets; no ownership bypass."""

    def has_permission(self, request, view):
        model = getattr(view, "permission_model", None)
        if model is None:
            model = getattr(getattr(view, "queryset", None), "model", None)
        if model is None:
            return True
        app, name = model._meta.app_label, model._meta.model_name
        if name not in PROJECT_MODELS.get(app, ()):
            return True
        action = {
            "GET": "view",
            "HEAD": "view",
            "OPTIONS": "view",
            "POST": "add",
            "PUT": "change",
            "PATCH": "change",
            "DELETE": "delete",
        }.get(request.method)
        return bool(action and request.user.has_perm(f"{app}.{action}_{name}"))


class UserManagementPermission(BasePermission):
    def has_permission(self, request, view):
        action = {
            "GET": "view",
            "HEAD": "view",
            "OPTIONS": "view",
            "POST": "add",
            "PATCH": "change",
        }.get(request.method)
        return request.user.is_authenticated and bool(
            action and request.user.has_perm(f"accounts.{action}_user")
        )


class AdministratorCreationPermission(BasePermission):
    message = "Solo un administrador con permisos de creación de usuarios y asignación de roles puede crear administradores."

    def has_permission(self, request, view):
        return (request.user.is_authenticated and request.user.is_project_admin
                and request.user.has_perms(("accounts.add_user", "auth.change_group")))


class ModelManagementPermission(BasePermission):
    message = "Se requieren permisos de administración de modelos."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        action = {"GET": "view", "HEAD": "view", "OPTIONS": "view", "POST": "add",
                  "PATCH": "change", "DELETE": "delete"}.get(request.method)
        if not action or not request.user.has_perm(f"catalog.{action}_pipelinemodel"):
            return False
        return action != "view" or request.user.is_project_admin or any(
            request.user.has_perm(f"catalog.{name}_pipelinemodel") for name in ("add", "change", "delete")
        )


class RoleManagementPermission(BasePermission):
    def has_permission(self, request, view):
        action = {
            "GET": "view",
            "HEAD": "view",
            "OPTIONS": "view",
            "POST": "add",
            "PATCH": "change",
            "DELETE": "delete",
        }.get(request.method)
        return request.user.is_authenticated and bool(
            action and request.user.has_perm(f"auth.{action}_group")
        )
