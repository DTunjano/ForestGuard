from django.contrib.auth.models import Group
from django.db import transaction
from django.db.models import Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import filters, generics, permissions, serializers, status, throttling, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User
from .rbac import (
    AdministratorCreationPermission,
    RoleManagementPermission,
    UserManagementPermission,
    project_permissions,
)
from .serializers import (
    AdministratorCreateSerializer,
    AdminUserCreateSerializer,
    AdminUserSerializer,
    LogoutSerializer,
    PasswordChangeSerializer,
    PermissionSerializer,
    RegistrationSerializer,
    RoleSerializer,
    UserSerializer,
)


@extend_schema_view(
    post=extend_schema(
        tags=["Autenticación"],
        summary="Iniciar sesión",
        description="Envíe usuario y contraseña. Copie `access` en **Authorize** para llamar a las rutas protegidas; conserve `refresh` para renovar la sesión.",
        auth=[],
        examples=[
            OpenApiExample(
                "Credenciales",
                value={"username": "analista", "password": "su_contraseña"},
                request_only=True,
            )
        ],
    )
)
class LoginView(TokenObtainPairView):
    throttle_scope = "auth"
    throttle_classes = [throttling.ScopedRateThrottle]


@extend_schema_view(
    post=extend_schema(
        tags=["Autenticación"],
        summary="Renovar token de acceso",
        description="Intercambia un refresh token válido por un nuevo access token. El refresh token anterior queda invalidado al rotar.",
        auth=[],
    )
)
class RefreshView(TokenRefreshView):
    throttle_scope = "auth"
    throttle_classes = [throttling.ScopedRateThrottle]


@extend_schema_view(
    post=extend_schema(
        tags=["Autenticación"],
        summary="Registrar cuenta",
        description="Crea una cuenta de analista. Después inicie sesión para obtener los tokens JWT.",
        auth=[],
        examples=[
            OpenApiExample(
                "Nuevo usuario",
                value={
                    "username": "analista",
                    "email": "analista@example.com",
                    "first_name": "Ana",
                    "last_name": "Pérez",
                    "password": "ContraseñaSegura123!",
                },
                request_only=True,
            )
        ],
    )
)
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
        tags=["Autenticación"],
        summary="Cambiar contraseña",
        description="Requiere la contraseña actual. Invalida los refresh tokens existentes; vuelva a iniciar sesión.",
        request=PasswordChangeSerializer,
        responses={204: None},
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
        tags=["Autenticación"],
        summary="Cerrar sesión",
        description="Invalida el refresh token enviado. El cliente debe descartar también su access token.",
        request=LogoutSerializer,
        responses={204: None},
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
    list=extend_schema(tags=["Administración de usuarios"], summary="Listar usuarios",
        parameters=[OpenApiParameter("role_id", int, description="Filtrar por ID de rol, incluidos roles personalizados."),
                    OpenApiParameter("is_active", bool, description="Filtrar cuentas activas o inactivas.")]),
    create=extend_schema(tags=["Administración de usuarios"], summary="Crear usuario y asignar roles por ID",
        request=AdminUserCreateSerializer, responses={201: AdminUserSerializer},
        description="role_ids contiene IDs obtenidos en GET /api/v1/admin/roles/. Si se omite se asigna el rol de analista. Para asignar roles se requiere auth.change_group. El campo legado role no acepta escritura.",
        examples=[OpenApiExample("Usuario con roles seleccionados", value={"username": "nuevo_usuario", "email": "usuario@example.com", "password": "UnaContraseñaSegura123!", "role_ids": [2]}, request_only=True)]),
    retrieve=extend_schema(tags=["Administración de usuarios"], summary="Consultar usuario"),
    partial_update=extend_schema(
        tags=["Administración de usuarios"], summary="Editar datos, estado o roles por ID",
        description="Envíe role_ids con los IDs de los roles elegidos para sustituir sus asignaciones; omítalo para conservarlas. Consulte los IDs reales en GET /api/v1/admin/roles/. role es legado de solo lectura.",
        examples=[OpenApiExample("Asignar roles por ID", value={"role_ids": [2, 3]}, request_only=True)],
    ),
)
class UserAdminViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = AdminUserSerializer
    permission_classes = [UserManagementPermission]
    http_method_names = ("get", "post", "patch", "head", "options")
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("username", "email", "first_name", "last_name")
    ordering_fields = ("username", "date_joined", "role", "is_active")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        role_id = self.request.query_params.get("role_id")
        active = self.request.query_params.get("is_active")
        if role_id not in (None, ""):
            try:
                role_id = serializers.IntegerField(min_value=1, max_value=2147483647).run_validation(role_id)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"role_id": exc.detail}) from exc
            queryset = queryset.filter(groups__id=role_id, groups__project_role__isnull=False).distinct()
        if active not in (None, ""):
            try:
                active = serializers.BooleanField().run_validation(active)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"is_active": exc.detail}) from exc
            queryset = queryset.filter(is_active=active)
        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return AdminUserCreateSerializer
        return AdminUserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(AdminUserSerializer(serializer.instance, context=self.get_serializer_context()).data,
                        status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        if serializer.instance.is_superuser and not self.request.user.is_superuser:
            raise PermissionDenied("Solo un superusuario puede modificar otra cuenta de superusuario.")
        self._check_role_assignment(serializer)
        if serializer.instance.pk == self.request.user.pk:
            if serializer.validated_data.get("is_active") is False:
                raise serializers.ValidationError(
                    {"is_active": "No puede desactivar su propia cuenta."}
                )
        with transaction.atomic():
            # Lock before taking the membership snapshot, including concurrent demotions.
            Group.objects.select_for_update().get(name=User.Role.ADMIN)
            admin_ids = User.objects.filter(groups__name="admin").values("pk")
            admins = list(User.objects.select_for_update().filter(
                Q(pk__in=admin_ids) | Q(is_superuser=True), is_active=True,
            ).order_by("pk"))
            target = serializer.instance
            groups = serializer.validated_data.get("groups")
            if (target.is_superuser and target.pk in [user.pk for user in admins]
                    and serializer.validated_data.get("is_active") is False
                    and sum(user.is_superuser for user in admins) == 1):
                raise serializers.ValidationError("Debe conservar al menos un superusuario activo.")
            if target.is_superuser and (
                groups is not None and not any(group.name == "admin" for group in groups)
            ):
                raise serializers.ValidationError("Un superusuario debe conservar el rol administrador.")
            removes_admin = (
                serializer.validated_data.get("is_active") is False
                or (groups is not None and not any(group.name == "admin" for group in groups))
            )
            if removes_admin and target.pk in [user.pk for user in admins] and len(admins) == 1:
                raise serializers.ValidationError(
                    "Debe conservar al menos un administrador activo."
                )
            if target.pk == self.request.user.pk and groups is not None and removes_admin:
                raise serializers.ValidationError(
                    {"role_ids": "No puede quitarse su propio rol administrador."}
                )
            serializer.save()

    def _check_role_assignment(self, serializer):
        if "groups" in serializer.validated_data and not self.request.user.has_perm("auth.change_group"):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Se requiere permiso de asignación de roles.")

    @transaction.atomic
    def perform_create(self, serializer):
        self._check_role_assignment(serializer)
        serializer.save()


class AdministratorCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = AdministratorCreateSerializer
    permission_classes = [AdministratorCreationPermission]
    throttle_scope = "auth"
    throttle_classes = [throttling.ScopedRateThrottle]

    @extend_schema(
        tags=["Administración de usuarios"], summary="Crear administrador o superusuario",
        description=("Requiere JWT de un administrador con accounts.add_user y auth.change_group. "
                     "Por defecto crea un administrador activo con el rol admin y todos los permisos de ForestGuard. "
                     "account_type=superuser requiere un superusuario y habilita también el administrador de Django. "
                     "Los privilegios se asignan en el servidor; no se solicitan IDs de roles. "
                     "Para el primer administrador use py manage.py create_project_admin; "
                     "para el primer superusuario use py manage.py createsuperuser desde consola. No hay creación pública de administradores."),
        request=AdministratorCreateSerializer,
        responses={201: AdminUserSerializer, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
        examples=[
            OpenApiExample("Administrador de ForestGuard", value={"username": "nuevo_admin", "email": "admin@example.com",
                           "password": "UnaContraseñaSegura123!", "account_type": "administrator"}, request_only=True),
            OpenApiExample("Superusuario (solo superusuarios)", value={"username": "nuevo_superuser", "email": "super@example.com",
                           "password": "UnaContraseñaSegura123!", "account_type": "superuser"}, request_only=True),
        ],
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = serializer.save()
        return Response(AdminUserSerializer(account, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    list=extend_schema(tags=["Roles y permisos"], summary="Listar roles y sus permisos"),
    retrieve=extend_schema(tags=["Roles y permisos"], summary="Consultar rol"),
    create=extend_schema(tags=["Roles y permisos"], summary="Crear rol personalizado"),
    partial_update=extend_schema(tags=["Roles y permisos"], summary="Editar rol y permisos"),
    destroy=extend_schema(tags=["Roles y permisos"], summary="Eliminar rol sin usuarios"),
)
class RoleViewSet(viewsets.ModelViewSet):
    queryset = (
        Group.objects.filter(project_role__isnull=False)
        .select_related("project_role")
        .prefetch_related("permissions")
        .order_by("name")
    )
    serializer_class = RoleSerializer
    permission_classes = [RoleManagementPermission]
    http_method_names = ("get", "post", "patch", "delete", "head", "options")
    pagination_class = None

    def perform_destroy(self, instance):
        with transaction.atomic():
            role = Group.objects.select_for_update().get(pk=instance.pk)
            if role.project_role.is_system:
                raise serializers.ValidationError("Los roles base están protegidos.")
            if role.user_set.exists():
                raise serializers.ValidationError("Reasigne los usuarios antes de eliminar el rol.")
            role.delete()


class PermissionCatalogView(APIView):
    permission_classes = [RoleManagementPermission]

    @extend_schema(
        tags=["Roles y permisos"],
        summary="Consultar catálogo de permisos",
        responses={200: PermissionSerializer(many=True)},
    )
    def get(self, request):
        return Response(
            [
                {
                    "id": item.pk,
                    "code": f"{item.content_type.app_label}.{item.codename}",
                    "name": item.name,
                    "module": item.content_type.model,
                }
                for item in project_permissions()
            ]
        )
