from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.db.models.functions import Lower
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from .models import RoleProfile, User
from .rbac import project_permissions


class PermissionSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    code = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    module = serializers.CharField(read_only=True)


class RoleSerializer(serializers.ModelSerializer):
    description = serializers.CharField(
        source="project_role.description", required=False, allow_blank=True, max_length=1000
    )
    is_system = serializers.BooleanField(source="project_role.is_system", read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        source="permissions",
        many=True,
        queryset=project_permissions(),
        help_text="Permisos disponibles en GET /api/v1/admin/permissions/. Solo operaciones soportadas por el proyecto.",
    )
    users_count = serializers.IntegerField(source="user_set.count", read_only=True)

    class Meta:
        model = Group
        fields = ("id", "name", "description", "is_system", "permission_ids", "users_count")
        read_only_fields = ("id", "is_system", "users_count")

    def validate(self, attrs):
        if self.instance and self.instance.project_role.is_system:
            if "name" in attrs and attrs["name"] != self.instance.name:
                raise serializers.ValidationError(
                    {"name": "Los roles del sistema conservan su nombre."}
                )
            if "permissions" in attrs:
                raise serializers.ValidationError(
                    {
                        "permission_ids": "Los permisos base del sistema están protegidos. Cree un rol personalizado."
                    }
                )
        if attrs.get("name", "").lower() in ("admin", "analyst") and not (self.instance and self.instance.project_role.is_system):
            raise serializers.ValidationError({"name": "Nombre reservado para el sistema."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        profile = validated_data.pop("project_role", {})
        permissions = validated_data.pop("permissions", [])
        group = Group.objects.create(**validated_data)
        RoleProfile.objects.create(group=group, **profile)
        group.permissions.set(permissions)
        return group

    @transaction.atomic
    def update(self, instance, validated_data):
        profile = validated_data.pop("project_role", {})
        if "description" in profile:
            instance.project_role.description = profile["description"]
            instance.project_role.save(update_fields=("description",))
        return super().update(instance, validated_data)


@extend_schema_serializer(deprecate_fields=["role"])
class UserSerializer(serializers.ModelSerializer):
    roles = RoleSerializer(source="groups", many=True, read_only=True)
    permissions = serializers.SerializerMethodField()

    def get_permissions(self, obj) -> list[str]:
        return sorted(obj.get_all_permissions()) if obj.is_active else []

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "roles",
            "permissions",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
        )
        read_only_fields = ("id", "role", "is_active", "is_staff", "is_superuser", "date_joined")
        extra_kwargs = {
            "role": {
                "help_text": "Legado, solo lectura. Las relaciones y asignaciones usan roles[].id y role_ids; los permisos efectivos están en permissions."
            }
        }

    def validate_email(self, value):
        email = value.strip().lower()
        existing = User.objects.annotate(email_lower=Lower("email")).filter(email_lower=email)
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("Este correo ya está registrado.")
        return email


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "password")
        read_only_fields = ("id",)

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)

    def validate_email(self, value):
        return UserSerializer().validate_email(value)

    def validate(self, attrs):
        candidate = User(username=attrs.get("username", ""), email=attrs.get("email", ""))
        validate_password(attrs["password"], candidate)
        return attrs


class AdminUserSerializer(UserSerializer):
    role_ids = serializers.PrimaryKeyRelatedField(
        source="groups",
        queryset=Group.objects.filter(project_role__isnull=False),
        many=True,
        write_only=True,
        required=False,
        help_text="IDs de GET /api/v1/admin/roles/. Sustituye la lista de roles asignados; [] elimina todos los roles cuando las protecciones de administración lo permitan.",
    )

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ("role_ids",)
        read_only_fields = ("id", "role", "is_staff", "is_superuser", "date_joined")

    def validate(self, attrs):
        if any(field in self.initial_data for field in ("is_staff", "is_superuser")):
            raise serializers.ValidationError("Use el endpoint de creación de administradores para crear cuentas privilegiadas.")
        if "role" in self.initial_data:
            raise serializers.ValidationError({"role": "Este campo es de solo lectura. Asigne roles usando role_ids de GET /api/v1/admin/roles/."})
        if len({group.pk for group in attrs.get("groups", [])}) != len(attrs.get("groups", [])):
            raise serializers.ValidationError({"role_ids": "Seleccione IDs de roles distintos."})
        return attrs

    def update(self, instance, validated_data):
        groups = validated_data.pop("groups", None)
        if groups is not None:
            instance.role = (
                User.Role.ADMIN
                if any(role.name == "admin" for role in groups)
                else User.Role.ANALYST
            )
        instance = super().update(instance, validated_data)
        if groups is not None:
            instance.groups.set(groups)
        return instance


class AdminUserCreateSerializer(RegistrationSerializer):
    role_ids = serializers.PrimaryKeyRelatedField(
        source="groups",
        queryset=Group.objects.filter(project_role__isnull=False),
        many=True,
        write_only=True,
        required=False,
        help_text="IDs de GET /api/v1/admin/roles/. Si se omite, se asigna automáticamente el rol de analista.",
    )
    is_active = serializers.BooleanField(default=True)

    class Meta(RegistrationSerializer.Meta):
        fields = RegistrationSerializer.Meta.fields + ("role_ids", "is_active")

    def validate(self, attrs):
        if any(field in self.initial_data for field in ("is_staff", "is_superuser")):
            raise serializers.ValidationError("Use el endpoint de creación de administradores para crear cuentas privilegiadas.")
        if "role" in self.initial_data:
            raise serializers.ValidationError({"role": "Asigne roles usando role_ids de GET /api/v1/admin/roles/."})
        if len({group.pk for group in attrs.get("groups", [])}) != len(attrs.get("groups", [])):
            raise serializers.ValidationError({"role_ids": "Seleccione IDs de roles distintos."})
        return super().validate(attrs)

    def create(self, validated_data):
        groups = validated_data.pop("groups", None)
        if groups is not None:
            validated_data["role"] = (
                User.Role.ADMIN
                if any(role.name == "admin" for role in groups)
                else User.Role.ANALYST
            )
        instance = super().create(validated_data)
        if groups is not None:
            instance.groups.set(groups)
        return instance


class AdministratorCreateSerializer(RegistrationSerializer):
    account_type = serializers.ChoiceField(
        choices=[("administrator", "Administrador de ForestGuard"), ("superuser", "Superusuario de Django")],
        default="administrator", write_only=True,
        help_text="administrator recibe el rol admin con todos los permisos del proyecto. Solo un superusuario puede crear otro superuser.",
    )

    class Meta(RegistrationSerializer.Meta):
        fields = RegistrationSerializer.Meta.fields + ("account_type",)

    def validate(self, attrs):
        if any(field in self.initial_data for field in ("role", "role_ids", "is_staff", "is_superuser", "is_active")):
            raise serializers.ValidationError("El tipo de cuenta determina los privilegios automáticamente; no envíe roles ni banderas internas.")
        if attrs["account_type"] == "superuser" and not self.context["request"].user.is_superuser:
            raise PermissionDenied("Solo un superusuario puede crear otro superusuario.")
        return super().validate(attrs)

    @transaction.atomic
    def create(self, validated_data):
        superuser = validated_data.pop("account_type") == "superuser"
        validated_data.update(role=User.Role.ADMIN, is_active=True, is_staff=superuser, is_superuser=superuser)
        return super().create(validated_data)


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("La contraseña actual es incorrecta.")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
