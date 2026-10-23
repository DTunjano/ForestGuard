from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ANALYST = "analyst", "Analista"
        ADMIN = "admin", "Administrador"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.ANALYST)

    @property
    def is_project_admin(self):
        return self.is_superuser or self.role == self.Role.ADMIN
