from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status, throttling, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    AdminUserSerializer,
    LogoutSerializer,
    RegistrationSerializer,
    UserSerializer,
)


class AuthThrottle(throttling.ScopedRateThrottle):
    scope = "auth"


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegistrationSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


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
    http_method_names = ("get", "patch", "head", "options")
