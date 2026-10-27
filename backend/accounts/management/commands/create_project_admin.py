"""Local operator bootstrap for an application administrator, without Django root."""

from getpass import getpass

from django.core.management.base import BaseCommand, CommandError
from rest_framework.exceptions import ValidationError

from accounts.serializers import AdministratorCreateSerializer


class Command(BaseCommand):
    help = (
        "Crear un administrador de ForestGuard desde consola, sin acceso de superusuario a Django."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--username", help="Usuario de la nueva cuenta; se solicita si se omite."
        )
        parser.add_argument("--email", help="Correo de la nueva cuenta; se solicita si se omite.")

    def handle(self, *args, **options):
        try:
            username = options["username"] or input("Usuario: ").strip()
            email = options["email"] or input("Correo: ").strip()
            password = getpass("Contraseña: ")
            confirmation = getpass("Confirmar contraseña: ")
        except (EOFError, KeyboardInterrupt) as exc:
            raise CommandError("Operación cancelada; no se creó ninguna cuenta.") from exc
        if password != confirmation:
            raise CommandError("Las contraseñas no coinciden; no se creó ninguna cuenta.")
        serializer = AdministratorCreateSerializer(
            data={
                "username": username,
                "email": email,
                "password": password,
                "account_type": "administrator",
            }
        )
        try:
            serializer.is_valid(raise_exception=True)
            account = serializer.save()
        except ValidationError as exc:
            message = "; ".join(
                f"{field}: {' '.join(str(item) for item in (details if isinstance(details, list) else [details]))}"
                for field, details in exc.detail.items()
            )
            raise CommandError(message) from exc
        self.stdout.write(
            self.style.SUCCESS(
                f"Administrador de ForestGuard creado: {account.username} (ID {account.pk})."
            )
        )
