from django.contrib.auth.password_validation import validate_password
from django.db.models.functions import Lower
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "role", "is_active", "date_joined")
        read_only_fields = ("id", "role", "is_active", "date_joined")

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
    class Meta(UserSerializer.Meta):
        read_only_fields = ("id", "date_joined")


class AdminUserCreateSerializer(RegistrationSerializer):
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.ANALYST)
    is_active = serializers.BooleanField(default=True)

    class Meta(RegistrationSerializer.Meta):
        fields = RegistrationSerializer.Meta.fields + ("role", "is_active")


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
