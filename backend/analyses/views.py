import shutil
from pathlib import Path
from tempfile import SpooledTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import decorators, filters, mixins, serializers, viewsets
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Analysis, ResultArtifact
from .raster_preview import category_mask, raster_metadata, render_preview
from .reports import ensure_current_report
from .serializers import (
    AnalysisResultsSerializer,
    AnalysisSerializer,
    CategoryMaskSerializer,
    ResultArtifactSerializer,
)

RESULT_SECTIONS = ("all", "summary", "individual", "comparison")
EXPORT_FORMATS = ("png", "tiff", "both")
PALETTE_PARAMETER = OpenApiParameter(
    "palette", str, OpenApiParameter.QUERY, enum=["default", "contrast"],
    description="contrast usa rojo–neutro–azul y las escalas fijas de las láminas para NDVI, NDMI, NBR y NDRE.",
)


def _query_choice(request, name, choices, default):
    value = request.query_params.get(name, default)
    if value not in choices:
        raise serializers.ValidationError({name: f"Elija una opción válida: {', '.join(choices)}."})
    return value


def _result_groups(analysis):
    artifacts = list(analysis.artifacts.all())
    raster_paths = {item.relative_path for item in artifacts if item.kind == "raster"}
    groups = {"reports": [], "individual": [], "comparisons": [], "other": []}
    for item in artifacts:
        path = item.relative_path
        # Each raster already offers its PNG through png_download_url.
        if item.kind == "visualization" and str(Path(path).with_suffix(".tif")).replace("\\", "/") in raster_paths:
            continue
        if path in ("resumen_serie.json", "reporte.pdf"):
            groups["reports"].append(item)
        elif path in ("visualizacion_individual.png", "visualizacion_individual_contraste.png") or path.startswith("fechas/"):
            groups["individual"].append(item)
        elif path == "visualizacion_comparativa.png" or path.startswith("intervalos/"):
            groups["comparisons"].append(item)
        else:
            groups["other"].append(item)
    return groups


def artifact_file(artifact):
    root = (Path(settings.MEDIA_ROOT) / "results" / str(artifact.analysis_id)).resolve()
    target = (root / artifact.relative_path).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise Http404
    return target


class BinaryResponseContentNegotiation(DefaultContentNegotiation):
    """Binary success responses bypass DRF rendering; DRF renders only errors."""

    def select_renderer(self, request, renderers, format_suffix=None):
        return renderers[0], renderers[0].media_type


class ArtifactPreviewView(APIView):
    permission_model = Analysis
    content_negotiation_class = BinaryResponseContentNegotiation

    @extend_schema(
        tags=["Resultados"], summary="Ver PNG de un artefacto raster",
        description=("Solo se necesita el ID del artefacto, disponible en `artifacts` del análisis. "
                     "El servidor elige automáticamente el tamaño de la miniatura. "
                     "El PNG es privado y requiere autenticación."),
        parameters=[PALETTE_PARAMETER],
        responses={(200, "image/png"): OpenApiTypes.BINARY},
    )
    def get(self, request, artifact_id):
        artifact = get_object_or_404(
            ResultArtifact, pk=artifact_id, analysis__owner=request.user, kind="raster",
        )
        palette = _query_choice(request, "palette", ("default", "contrast"), "default")
        return HttpResponse(render_preview(artifact_file(artifact), palette=palette), content_type="image/png",
                            headers={"Cache-Control": "private, no-store"})


class ArtifactCategoryMaskView(APIView):
    permission_model = Analysis

    @extend_schema(
        tags=["Resultados"], summary="Obtener categorías para el mapa interactivo",
        description=("Máscara privada de condicion_bosque.tif. Valores uint8 en base64, por filas: "
                     "0 otra cobertura, 1 bosque estable/vigor alto, 2 degradación, 3 posible pérdida; "
                     "255 sin datos. Máximo 768 píxeles por lado y muestreo de vecino más cercano. "
                     "Permite resaltar categorías sin recalcular ni modificar porcentajes originales. "
                     "grid identifica la geometría original para comprobar la alineación con los índices."),
        responses={200: CategoryMaskSerializer},
    )
    def get(self, request, artifact_id):
        artifact = get_object_or_404(
            ResultArtifact, pk=artifact_id, analysis__owner=request.user, kind="raster",
        )
        if Path(artifact.relative_path).name != "condicion_bosque.tif":
            raise Http404
        return Response(category_mask(artifact_file(artifact)), headers={"Cache-Control": "private, no-store"})


class ArtifactDownloadView(APIView):
    permission_model = Analysis
    content_negotiation_class = BinaryResponseContentNegotiation

    @extend_schema(
        tags=["Resultados"], summary="Descargar archivo por ID de artefacto",
        description=("Para un raster, `format=tiff` descarga los datos georreferenciados y "
                     "`format=png` descarga el mapa con colores usando el mismo ID. "
                     "Sin `format`, se descarga el archivo original. Para obtener todos los "
                     "resultados sin elegir artefactos use la exportación del análisis. "
                     "El PDF reúne las láminas PNG independientes, métricas e interpretación por fecha e intervalo; "
                     "los informes antiguos se actualizan al descargar, sin recalcular las imágenes."),
        parameters=[OpenApiParameter("format", str, OpenApiParameter.QUERY, required=False,
                                     enum=["png", "tiff"],
                                     description="Formato deseado del raster; omitir para el archivo original.")],
        responses={(200, "application/octet-stream"): OpenApiTypes.BINARY},
    )
    def get(self, request, artifact_id):
        artifact = get_object_or_404(ResultArtifact, pk=artifact_id, analysis__owner=request.user)
        requested_format = request.query_params.get("format")
        if requested_format not in (None, "png", "tiff"):
            raise serializers.ValidationError({"format": "Elija png o tiff."})
        if requested_format and artifact.kind != "raster":
            raise serializers.ValidationError({"format": "Este formato solo se aplica a raster GeoTIFF."})
        if artifact.kind == "report" and artifact.relative_path == "reporte.pdf":
            ensure_current_report(artifact.analysis)
        if requested_format == "png":
            png_path = str(Path(artifact.relative_path).with_suffix(".png")).replace("\\", "/")
            png = ResultArtifact.objects.filter(analysis=artifact.analysis, relative_path=png_path,
                                                kind="visualization").first()
            if png is not None:
                target = artifact_file(png)
                return FileResponse(target.open("rb"), as_attachment=True, filename=target.name,
                                    content_type="image/png")
            target = artifact_file(artifact)
            return HttpResponse(render_preview(target, max_size=1024), content_type="image/png",
                                headers={"Content-Disposition": f'attachment; filename="{target.stem}.png"'})
        target = artifact_file(artifact)
        return FileResponse(target.open("rb"), as_attachment=True, filename=target.name)


class AnalysisResultsView(APIView):
    permission_model = Analysis
    @extend_schema(
        tags=["Resultados"], summary="Ver todos los resultados de un análisis",
        description=("Devuelve métricas, informe, láminas PNG y mapas de cada fecha e intervalo "
                     "sin pedir IDs de artefactos. `section` permite mostrar solo una parte. "
                     "Cada GeoTIFF incluye su descarga PNG. Disponible al completar el análisis."),
        parameters=[OpenApiParameter("section", str, OpenApiParameter.QUERY, required=False,
                                     enum=list(RESULT_SECTIONS),
                                     description="Filtra las secciones visibles; predeterminado: all.")],
        responses={200: AnalysisResultsSerializer},
    )
    def get(self, request, analysis_id):
        analysis = get_object_or_404(Analysis.objects.prefetch_related("artifacts"),
                                     pk=analysis_id, owner=request.user)
        section = _query_choice(request, "section", RESULT_SECTIONS, "all")
        groups = _result_groups(analysis)
        visible = {"summary": "reports", "individual": "individual", "comparison": "comparisons"}
        selected = None if section == "all" else visible[section]
        root = request.build_absolute_uri(reverse("analysis-export", kwargs={"analysis_id": analysis.pk}))
        return Response({
            "analysis_id": analysis.pk, "status": analysis.status, "section": section,
            "summary": analysis.summary if section in ("all", "summary") else {},
            **{name: ResultArtifactSerializer(items, many=True, context={"request": request}).data
               if selected is None or selected == name else [] for name, items in groups.items()},
            "download_png_url": f"{root}?format=png",
            "download_tiff_url": f"{root}?format=tiff",
            "download_both_url": f"{root}?format=both",
        })


class AnalysisExportView(APIView):
    permission_model = Analysis
    content_negotiation_class = BinaryResponseContentNegotiation

    @extend_schema(
        tags=["Resultados"], summary="Descargar análisis completo en ZIP",
        description=("Incluye siempre resumen JSON e informe PDF. `format=png` añade mapas en color "
                     "y láminas; `format=tiff` añade mapas GeoTIFF; `format=both` añade ambos. "
                     "`section` permite exportar solo resultados individuales o comparaciones. "
                     "El PDF abarca el estudio completo y se actualiza al descargar si corresponde; "
                     "incluye las láminas PNG independientes, ordenadas por fecha y comparación."),
        parameters=[
            OpenApiParameter("format", str, OpenApiParameter.QUERY, required=False,
                             enum=list(EXPORT_FORMATS), description="Formato de mapas; predeterminado: png."),
            OpenApiParameter("section", str, OpenApiParameter.QUERY, required=False,
                             enum=list(RESULT_SECTIONS), description="Parte del análisis; predeterminado: all."),
        ],
        responses={(200, "application/zip"): OpenApiTypes.BINARY},
    )
    def get(self, request, analysis_id):
        analysis = get_object_or_404(Analysis.objects.prefetch_related("artifacts"),
                                     pk=analysis_id, owner=request.user)
        if analysis.status != Analysis.Status.COMPLETED:
            raise serializers.ValidationError("El análisis debe estar completado para descargarlo.")
        export_format = _query_choice(request, "format", EXPORT_FORMATS, "png")
        section = _query_choice(request, "section", RESULT_SECTIONS, "all")
        ensure_current_report(analysis)
        groups = _result_groups(analysis)
        chosen = [*groups["reports"]]
        if section in ("all", "individual"):
            chosen.extend(groups["individual"])
        if section in ("all", "comparison"):
            chosen.extend(groups["comparisons"])
        if section == "all":
            chosen.extend(groups["other"])
        png_paths = {item.relative_path: item for item in analysis.artifacts.all()
                     if item.kind == "visualization"}
        archive = SpooledTemporaryFile(max_size=16 * 1024 * 1024)
        try:
            with ZipFile(archive, "w", ZIP_DEFLATED) as output:
                output.writestr("LEEME_RESULTADOS.txt", (
                    "ForestGuard - resultados del análisis\n"
                    "Abra visualizacion_individual.png para ver índices, mapas y métricas por fecha.\n"
                    "Abra visualizacion_individual_contraste.png para los mismos índices en rojo-neutro-azul.\n"
                    "En esa lámina, rojo indica valor bajo del índice, no pérdida entre fechas.\n"
                    "Abra visualizacion_comparativa.png para ver cambios y métricas entre fechas.\n"
                    "Las carpetas png/ y tiff/ contienen los mapas individuales.\n"
                    "Cada fecha/intervalo incluye resumen_condicion.png (original, categorías y porcentajes),\n"
                    "mapas_original_resultado.png (dos mapas separados) y condicion_bosque.tif/png.\n"
                    "Los porcentajes de categorías usan el área válida; otra cobertura se muestra en gris.\n"
                    "resumen_serie.json guarda todas las métricas; reporte.pdf es el informe.\n"
                    "reporte.pdf reúne las láminas PNG independientes, métricas e interpretación del estudio completo.\n"
                ))
                for item in chosen:
                    path = artifact_file(item)
                    if item.kind == "raster":
                        if export_format in ("tiff", "both"):
                            output.write(path, f"tiff/{item.relative_path}")
                        if export_format in ("png", "both"):
                            png_path = str(Path(item.relative_path).with_suffix(".png")).replace("\\", "/")
                            png = png_paths.get(png_path)
                            if png:
                                output.write(artifact_file(png), f"png/{png_path}")
                            else:
                                output.writestr(f"png/{png_path}", render_preview(path, max_size=1024))
                    elif item.kind == "visualization" and export_format in ("png", "both"):
                        board = item.relative_path in ("visualizacion_individual.png",
                                                       "visualizacion_individual_contraste.png",
                                                       "visualizacion_comparativa.png")
                        output.write(path, item.relative_path if board else f"png/{item.relative_path}")
                    elif item.kind in ("report", "metadata"):
                        output.write(path, item.relative_path)
            archive.seek(0)
            return FileResponse(archive, as_attachment=True,
                                filename=f"forestguard_analisis_{analysis.pk}_{section}_{export_format}.zip",
                                content_type="application/zip")
        except Exception:
            archive.close()
            raise


class ArtifactMetadataView(APIView):
    permission_model = Analysis
    @extend_schema(
        tags=["Resultados"], summary="Consultar metadatos por ID de artefacto",
        description="Solo admite artefactos raster del usuario autenticado.",
        parameters=[PALETTE_PARAMETER],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request, artifact_id):
        artifact = get_object_or_404(
            ResultArtifact, pk=artifact_id, analysis__owner=request.user, kind="raster",
        )
        palette = _query_choice(request, "palette", ("default", "contrast"), "default")
        return Response(raster_metadata(artifact_file(artifact), palette=palette))


@extend_schema_view(
    list=extend_schema(tags=["Análisis"], summary="Listar mis análisis"),
    create=extend_schema(
        tags=["Análisis"], summary="Analizar una imagen o comparar varias",
        description=(
            "Crea un trabajo en estado `queued`; el worker local debe estar en ejecución para procesarlo. "
            "Cada imagen requiere cobertura válida ≥ 60 %; las comparaciones exigen al menos 35 días sin máximo y 60 % de cobertura común. "
            "Elige un área de `GET /api/v1/study-areas/` y los IDs de las escenas de `GET /api/v1/images/`. "
            "`image_ids` admite de 1 a 32 imágenes distintas de la misma área y con fechas diferentes; "
            "se ordenan por fecha. Una imagen produce índices descriptivos automáticamente y no usa v9, "
            "aunque se envíe `model_id`. Dos o más imágenes permiten comparar fechas. "
            "`model_id` es opcional y, para varias fechas, requiere escenas con SCL; "
            "el modelo solo se aplica a intervalos compatibles con su contrato. "
            "Los resultados exploratorios requieren revisión humana."
        ),
        examples=[
            OpenApiExample("Análisis de una imagen", value={
                "name": "Índices de una escena", "study_area": 1, "image_ids": [1],
            }, request_only=True),
            OpenApiExample("Comparación de dos fechas", value={
                "name": "Comparación histórica", "study_area": 1, "image_ids": [1, 2],
                "description": "Escenas del mismo sector",
            }, request_only=True),
            OpenApiExample("Comparación con v9", value={
                "name": "Clasificación exploratoria", "study_area": 1,
                "image_ids": [1, 2], "model_id": 1,
            }, request_only=True),
        ],
    ),
    retrieve=extend_schema(tags=["Análisis"], summary="Consultar estado y resumen"),
    destroy=extend_schema(
        tags=["Análisis"], summary="Eliminar análisis terminado",
        description="Elimina el registro y sus resultados. Los trabajos `queued` o `running` no se pueden eliminar.",
    ),
)
class AnalysisViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, mixins.ListModelMixin,
                      mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = AnalysisSerializer
    queryset = Analysis.objects.all()
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("name", "study_area__name")
    ordering_fields = ("name", "created_at", "status")

    def get_queryset(self):
        return (Analysis.objects.filter(owner=self.request.user)
                .select_related("study_area", "model")
                .prefetch_related("scene_links__image", "artifacts"))

    def perform_destroy(self, instance):
        if instance.status in (Analysis.Status.QUEUED, Analysis.Status.RUNNING):
            raise serializers.ValidationError("El análisis debe terminar antes de eliminarlo.")
        media_root = Path(settings.MEDIA_ROOT).resolve()
        folders = [(media_root / name / str(instance.pk)).resolve() for name in ("results", "normalized")]
        if any(not folder.is_relative_to(media_root) for folder in folders):
            raise serializers.ValidationError("Ruta de resultado inválida.")
        instance.delete()
        for folder in folders:
            if folder.is_dir():
                shutil.rmtree(folder)

    @extend_schema(exclude=True)
    @decorators.action(detail=True, methods=["get"], url_path="artifacts/(?P<artifact_id>[0-9]+)/download")
    def download(self, request, pk=None, artifact_id=None):
        artifact, target = self._artifact_file(artifact_id)
        if artifact.kind == "report" and artifact.relative_path == "reporte.pdf":
            ensure_current_report(artifact.analysis)
        return FileResponse(target.open("rb"), as_attachment=True, filename=target.name)

    @extend_schema(exclude=True)
    @decorators.action(detail=True, methods=["get"], url_path="artifacts/(?P<artifact_id>[0-9]+)/metadata")
    def metadata(self, request, pk=None, artifact_id=None):
        artifact, target = self._artifact_file(artifact_id)
        if artifact.kind != "raster":
            raise Http404
        return Response(raster_metadata(target))

    @extend_schema(exclude=True)
    @decorators.action(detail=True, methods=["get"], url_path="artifacts/(?P<artifact_id>[0-9]+)/preview")
    def preview(self, request, pk=None, artifact_id=None):
        artifact, target = self._artifact_file(artifact_id)
        if artifact.kind != "raster":
            raise Http404
        size = serializers.IntegerField(min_value=64, max_value=1024)
        try:
            max_size = size.run_validation(request.query_params.get("max_size", 768))
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({"max_size": exc.detail}) from exc
        return HttpResponse(render_preview(target, max_size), content_type="image/png")

    def _artifact_file(self, artifact_id):
        analysis = self.get_object()
        artifact = ResultArtifact.objects.filter(analysis=analysis, pk=artifact_id).first()
        if artifact is None:
            raise Http404
        return artifact, artifact_file(artifact)
