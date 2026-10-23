from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import filters, generics, permissions, serializers, status, throttling, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User
from .serializers import (
    AdminUserCreateSerializer,
    AdminUserSerializer,
    LogoutSerializer,
    PasswordChangeSerializer,
    RegistrationSerializer,
    UserSerializer,
)


@extend_schema_view(post=extend_schema(
    tags=["Autenticación"], summary="Iniciar sesión",
    description="Envíe usuario y contraseña. Copie `access` en **Authorize** para llamar a las rutas protegidas; conserve `refresh` para renovar la sesión.",
    auth=[],
    examples=[OpenApiExample("Credenciales", value={"username": "analista", "password": "su_contraseña"}, request_only=True)],
))
class LoginView(TokenObtainPairView):
    throttle_scope = "auth"
    throttle_classes = [throttling.ScopedRateThrottle]


@extend_schema_view(post=extend_schema(
    tags=["Autenticación"], summary="Renovar token de acceso",
    description="Intercambia un refresh token válido por un nuevo access token. El refresh token anterior queda invalidado al rotar.",
    auth=[],
))
class RefreshView(TokenRefreshView):
    throttle_scope = "auth"
    throttle_classes = [throttling.ScopedRateThrottle]


@extend_schema_view(post=extend_schema(
    tags=["Autenticación"], summary="Registrar cuenta",
    description="Crea una cuenta de analista. Después inicie sesión para obtener los tokens JWT.",
    auth=[],
    examples=[OpenApiExample("Nuevo usuario", value={
        "username": "analista", "email": "analista@example.com", "first_name": "Ana",
        "last_name": "Pérez", "password": "ContraseñaSegura123!",
    }, request_only=True)],
))
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegistrationSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"
    throttle_classes = [throttling.ScopedRateThrottle]


@extend_schema_view(
    get=extend_schema(tags=["Mi cuenta"], summary="Consultar mi perfil"),
    put=extend_schema(tags=["Mi cuenta"], summary="Actualizar mi perfil"),
    patch=extend_schema(tags=["Mi cuenta"], summary="Actualizar parcialmente mi perfil"),
)
class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class PasswordChangeView(APIView):
    @extend_schema(
        tags=["Autenticación"], summary="Cambiar contraseña",
        description="Requiere la contraseña actual. Invalida los refresh tokens existentes; vuelva a iniciar sesión.",
        request=PasswordChangeSerializer, responses={204: None},
    )
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=("password",))
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutView(APIView):
    @extend_schema(
        tags=["Autenticación"], summary="Cerrar sesión",
        description="Invalida el refresh token enviado. El cliente debe descartar también su access token.",
        request=LogoutSerializer, responses={204: None},
    )
    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response({"refresh": ["Este campo es obligatorio."]}, status=400)
        try:
            token = RefreshToken(refresh)
            if str(token["user_id"]) != str(request.user.pk):
                return Response({"detail": "Token ajeno al usuario."}, status=403)
            token.blacklist()
        except Exception:
            return Response({"detail": "Refresh token inválido."}, status=400)
        return Response(status=status.HTTP_204_NO_CONTENT)


class IsProjectAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_project_admin


@extend_schema_view(
    list=extend_schema(tags=["Administración de usuarios"], summary="Listar usuarios"),
    create=extend_schema(tags=["Administración de usuarios"], summary="Crear usuario"),
    retrieve=extend_schema(tags=["Administración de usuarios"], summary="Consultar usuario"),
    partial_update=extend_schema(tags=["Administración de usuarios"], summary="Cambiar rol, datos o estado"),
)
class UserAdminViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = AdminUserSerializer
    permission_classes = [IsProjectAdmin]
    http_method_names = ("get", "post", "patch", "head", "options")
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("username", "email", "first_name", "last_name")
    ordering_fields = ("username", "date_joined", "role", "is_active")

    def get_serializer_class(self):
        if self.action == "create":
            return AdminUserCreateSerializer
        return AdminUserSerializer

    def perform_update(self, serializer):
        if serializer.instance.pk == self.request.user.pk:
            if serializer.validated_data.get("is_active") is False:
                raise serializers.ValidationError({"is_active": "No puede desactivar su propia cuenta."})
            if serializer.validated_data.get("role") == User.Role.ANALYST:
                raise serializers.ValidationError({"role": "No puede quitarse su propio rol administrador."})
        serializer.save()
