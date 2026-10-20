import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from catalog.models import PipelineModel


class Command(BaseCommand):
    help = "Register the packaged, trusted ForestGuard v9 model"

    def handle(self, *args, **options):
        root = settings.PIPELINE_ROOT
        model_path = root / "model" / "modelo_exploratorio.joblib"
        profile_path = root / "model" / "perfil_desempeno.json"
        if not model_path.is_file() or not profile_path.is_file():
            raise CommandError("El modelo v9 o su perfil no está disponible")
        profile = json.loads(profile_path.read_text(encoding="utf-8"))
        model, _ = PipelineModel.objects.update_or_create(
            version="v9", defaults={
                "name": "ForestGuard cambio histórico",
                "algorithm": "Random Forest",
                "relative_path": "model/modelo_exploratorio.joblib",
                "description": "Clasificación histórica exploratoria; no predice riesgo futuro.",
                "performance_profile": profile,
                "active": True,
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Modelo {model.version} registrado"))
