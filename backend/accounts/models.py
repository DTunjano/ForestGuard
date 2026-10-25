from django.contrib.auth.models import AbstractUser, Group
from django.db import models, transaction


class User(AbstractUser):
    class Role(models.TextChoices):
        ANALYST = "analyst", "Analista"
        ADMIN = "admin", "Administrador"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.ANALYST)

    @property
    def is_project_admin(self):
        return self.is_superuser or self.groups.filter(name="admin").exists()

    @transaction.atomic
    def save(self, *args, **kwargs):
        adding = self._state.adding
        old_role = (
            None
            if adding
            else type(self).objects.filter(pk=self.pk).values_list("role", flat=True).first()
        )
        super().save(*args, **kwargs)
        if adding or old_role != self.role:
            from .rbac import ensure_builtin_roles

            ensure_builtin_roles()
            self.groups.remove(*Group.objects.filter(name__in=self.Role.values))
            self.groups.add(Group.objects.get(name=self.role))


class RoleProfile(models.Model):
    group = models.OneToOneField(
        Group, primary_key=True, on_delete=models.CASCADE, related_name="project_role"
    )
    description = models.TextField(blank=True, max_length=1000)
    is_system = models.BooleanField(default=False, editable=False)
