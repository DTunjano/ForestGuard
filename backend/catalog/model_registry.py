"""Only server-installed model packages can be registered through the API."""

import hashlib
import json
from pathlib import Path

from django.conf import settings
from rest_framework.exceptions import ValidationError

PACKAGES = {
    "v9": {
        "version": "v9",
        "name": "ForestGuard cambio histórico",
        "algorithm": "Random Forest",
        "relative_path": "model/modelo_exploratorio.joblib",
        "description": "Clasificación histórica exploratoria de cambio de cobertura.",
        "profile_path": "model/perfil_desempeno.json",
    },
}


def installed_package(key: str) -> dict:
    if key not in PACKAGES:
        raise ValidationError({"package_key": "Paquete de modelo no admitido."})
    package = PACKAGES[key]
    root = Path(settings.PIPELINE_ROOT).resolve()
    try:
        manifest = json.loads((root / "manifiesto.json").read_text(encoding="utf-8"))
        if not isinstance(manifest, dict) or not isinstance(manifest.get("archivos_sha256"), dict):
            raise ValueError("Manifiesto del paquete no válido.")
        normalization = manifest.get("normalizacion_texto_sha256", "")
        if not isinstance(normalization, str):
            raise ValueError("Normalización del manifiesto no válida.")
        for relative in (package["relative_path"], package["profile_path"]):
            path = (root / relative).resolve()
            if not path.is_relative_to(root) or not path.is_file():
                raise ValueError("Archivo del paquete no disponible.")
            content = path.read_bytes()
            if path.suffix == ".json" and normalization.startswith("LF"):
                content = content.replace(b"\r\n", b"\n")
            if hashlib.sha256(content).hexdigest() != manifest["archivos_sha256"][relative]:
                raise ValueError("La integridad del paquete no coincide con su manifiesto.")
        profile = json.loads((root / package["profile_path"]).read_text(encoding="utf-8"))
        if not isinstance(profile, dict):
            raise ValueError("Perfil del paquete no válido.")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise ValidationError(
            {
                "package_key": "El paquete no está disponible o no supera la verificación de integridad. Revise la instalación del servidor."
            }
        ) from exc
    return {field: value for field, value in package.items() if field != "profile_path"} | {
        "performance_profile": profile
    }
