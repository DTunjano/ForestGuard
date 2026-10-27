from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class ForestGuardUserAdmin(UserAdmin):
    readonly_fields = (*UserAdmin.readonly_fields, "role")
    fieldsets = UserAdmin.fieldsets + (("ForestGuard", {"fields": ("role",)}),)
