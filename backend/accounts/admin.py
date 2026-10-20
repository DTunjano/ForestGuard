from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class ForestGuardUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("ForestGuard", {"fields": ("role",)}),)
