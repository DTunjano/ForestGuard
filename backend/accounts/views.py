from drf_spectacular.utils import extend_schema
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


class LoginView(TokenObtainPairView):
    throttle_scope = "auth"
    throttle_classes = [throttling.ScopedRateThrottle]


class RefreshView(TokenRefreshView):
    throttle_scope = "auth"
    throttle_classes = [throttling.ScopedRateThrottle]


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegistrationSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"
    throttle_classes = [throttling.ScopedRateThrottle]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class PasswordChangeView(APIView):
    @extend_schema(request=PasswordChangeSerializer, responses={204: None})
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
    @extend_schema(request=LogoutSerializer, responses={204: None})
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
