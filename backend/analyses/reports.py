"""Readable, navigable report with the standalone PNG plates of the analysis."""

import hashlib
import json
from html import escape
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile

from django.utils import timezone
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

from .report_catalog import report_plates

GREEN = colors.HexColor("#184b39")
INK = colors.HexColor("#18333d")
NAVY = colors.HexColor("#0b1728")
MUTED = colors.HexColor("#526875")
WIDTH = A4[0] - 80
REPORT_VERSION = "forestguard-report-v3"


def number(value, suffix="", decimals=2):
    if value is None:
        return "No disponible"
    return f"{value:,.{decimals}f}".replace(",", "_").replace(".", ",").replace("_", ".") + suffix


def category_percent(category, condition):
    if category["porcentaje"] is not None:
        return number(category["porcentaje"], " %")
    return (
        "Requiere otra fecha"
        if condition["tipo"] != "temporal" and category["clave"] == "degradacion"
        else "Sin área válida"
    )


def interpretation(condition):
    categories = {item["clave"]: item for item in condition["categorias"]}

    def percent(key):
        return number(categories[key]["porcentaje"], " %")

    if not condition["pixeles_evaluados"]:
        return "No hay superficie común válida para calcular porcentajes en este periodo."
    if condition["tipo"] == "temporal":
        return (
            f"El {percent('bosque_estable')} del área común mantiene una condición de bosque estable; "
            f"el {percent('degradacion')} presenta señales de degradación y el {percent('posible_deforestacion')} "
            f"señales de posible deforestación. Otra cobertura ocupa el {percent('otra_cobertura')}. "
            "Las zonas rojas y amarillas localizan los sectores que conviene examinar al contrastar ambas fechas."
        )
    return (
        f"El {percent('bosque_estable')} del área válida presenta vegetación de vigor alto y el "
        f"{percent('posible_deforestacion')} vegetación de vigor bajo. Otra cobertura representa el "
        f"{percent('otra_cobertura')}. Esta escena describe el estado de la vegetación en esa fecha; "
        "una segunda fecha permite evaluar su evolución y las señales de degradación."
    )


def _styles():
    styles = getSampleStyleSheet()
    definitions = {
        "ReportTitle": dict(
            fontName="Helvetica-Bold", fontSize=27, leading=33, textColor=NAVY, spaceAfter=12
        ),
        "SectionTitle": dict(
            fontName="Helvetica-Bold", fontSize=22, leading=28, textColor=GREEN, spaceAfter=12
        ),
        "PeriodTitle": dict(
            fontName="Helvetica-Bold", fontSize=18, leading=24, textColor=NAVY, spaceAfter=10
        ),
        "PlateTitle": dict(
            fontName="Helvetica-Bold", fontSize=17, leading=22, textColor=NAVY, spaceAfter=10
        ),
        "ReportBody": dict(
            fontName="Helvetica", fontSize=10, leading=15, textColor=INK, spaceAfter=9
        ),
        "Caption": dict(
            fontName="Helvetica", fontSize=9, leading=13, textColor=MUTED, spaceAfter=8
        ),
        "Eyebrow": dict(
            fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=GREEN, spaceAfter=10
        ),
        "Cell": dict(fontName="Helvetica", fontSize=9, leading=12, textColor=INK),
        "HeaderCell": dict(
            fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.white
        ),
    }
    for name, options in definitions.items():
        styles.add(ParagraphStyle(name, **options))
    return styles


def _table(rows, styles, widths):
    wrapped = [
        [
            Paragraph(escape(str(cell)), styles["HeaderCell"] if index == 0 else styles["Cell"])
            for cell in row
        ]
        for index, row in enumerate(rows)
    ]
    table = Table(wrapped, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f5f3")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.HexColor("#d3dfda")),
            ]
        )
    )
    return table


def _categories(condition, styles):
    rows = [["Categoría de cobertura", "Superficie", "Área (ha)"]]
    for item in condition["categorias"]:
        rows.append([item["etiqueta"], category_percent(item, condition), number(item["area_ha"])])
    table = _table(rows, styles, [WIDTH * 0.52, WIDTH * 0.26, WIDTH * 0.22])
    for row, item in enumerate(condition["categorias"], 1):
        table.setStyle(
            TableStyle([("LINEBEFORE", (0, row), (0, row), 3, colors.HexColor(item["color"]))])
        )
    return table


def _page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, A4[1] - 60, A4[0], 60, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#b9e75c"))
    canvas.roundRect(40, A4[1] - 40, 5, 23, 2, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 17)
    canvas.setFillColor(colors.white)
    canvas.drawString(55, A4[1] - 34, "ForestGuard")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(A4[0] - 40, A4[1] - 33, "OBSERVACIÓN DE LA COBERTURA VEGETAL")
    canvas.setStrokeColor(colors.HexColor("#d4dfdb"))
    canvas.line(40, 41, A4[0] - 40, 41)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(40, 25, f"Estudio satelital #{doc.analysis_id} | Sentinel-2")
    canvas.drawRightString(A4[0] - 40, 25, f"Página {doc.page}")
    canvas.restoreState()


class ReportDocument(SimpleDocTemplate):
    def beforeDocument(self):
        self.seq.reset("section", 0)

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name in (
            "SectionTitle",
            "PeriodTitle",
        ):
            text = flowable.getPlainText()
            level = 0 if flowable.style.name == "SectionTitle" else 1
            key = f"section-{self.seq.nextf('section')}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=level)
            self.notify("TOCEntry", (level, text, self.page, key))


def _image_parts(path):
    """Keep long overview plates readable by breaking at complete scene blocks."""
    with PILImage.open(path) as source:
        width, height = source.size
        if path.stem.startswith("visualizacion_") and height > 700 and (height - 110) % 575 == 0:
            count = (height - 110) // 575
            cuts = [0] + [100 + index * 575 for index in range(1, count)] + [height]
        elif height / width > 1.5:
            step = max(1, int(width * 1.2))
            cuts = list(range(0, height, step)) + [height]
        else:
            cuts = [0, height]
        for start, end in zip(cuts, cuts[1:]):
            buffer = BytesIO()
            source.crop((0, start, width, end)).save(buffer, format="PNG")
            buffer.seek(0)
            scale = min(WIDTH / width, 490 / (end - start))
            yield Image(buffer, width=width * scale, height=(end - start) * scale, hAlign="CENTER")


def report_fingerprint(analysis, root, summary=None):
    payload = {
        "version": REPORT_VERSION,
        "name": analysis.name,
        "description": analysis.description,
        "area": analysis.study_area.name,
        "summary": analysis.summary if summary is None else summary,
        "plates": [
            (plate.relative_path, plate.path.stat().st_size, plate.path.stat().st_mtime_ns)
            for plate in report_plates(root)
        ],
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def ensure_current_report(analysis):
    """Refresh a private derived document once; leave image results unchanged."""
    from django.conf import settings
    from django.db import transaction

    from .models import Analysis, ResultArtifact

    if analysis.status != Analysis.Status.COMPLETED or not analysis.summary:
        return
    media = Path(settings.MEDIA_ROOT).resolve()
    root = (media / "results" / str(analysis.pk)).resolve()
    if not root.is_relative_to(media) or not root.is_dir():
        raise ValueError("Ruta de informe inválida")
    target = root / "reporte.pdf"
    stamp = root / ".reporte.version"

    def current(item):
        return (
            target.is_file()
            and stamp.is_file()
            and stamp.read_text(encoding="utf-8") == report_fingerprint(item, root)
        )

    if current(analysis):
        return
    with transaction.atomic():
        locked = (
            Analysis.objects.select_for_update().select_related("study_area").get(pk=analysis.pk)
        )
        if locked.status != Analysis.Status.COMPLETED or not locked.summary or current(locked):
            return
        write_report(locked, locked.summary, target)
        ResultArtifact.objects.update_or_create(
            analysis=locked,
            relative_path="reporte.pdf",
            defaults={"kind": "report", "size_bytes": target.stat().st_size},
        )
    getattr(analysis, "_prefetched_objects_cache", {}).pop("artifacts", None)


def write_report(analysis, summary, destination, *, source_root=None):
    destination = Path(destination)
    root = Path(source_root or destination.parent)
    plates = report_plates(root)
    styles = _styles()

    def text(value, style="ReportBody"):
        return Paragraph(escape(str(value)), styles[style])

    scenes = sorted(summary.get("escenas", []), key=lambda item: item["fecha"])
    intervals = sorted(
        summary.get("intervalos", []), key=lambda item: (item["fecha_inicial"], item["fecha_final"])
    )
    story = [
        text("INFORME DE RESULTADOS", "Eyebrow"),
        text("La vegetación,\nsus condiciones y cambios", "ReportTitle"),
        text(analysis.name, "PlateTitle"),
        text(f"Área de estudio: {analysis.study_area.name}"),
        text(
            f"{len(scenes)} {'fecha analizada' if len(scenes) == 1 else 'fechas analizadas'} | "
            f"{len(intervals)} {'comparación' if len(intervals) == 1 else 'comparaciones'} | "
            f"{len(plates)} láminas PNG independientes",
            "Caption",
        ),
    ]
    if getattr(analysis, "description", ""):
        story.append(text(analysis.description))
    created = getattr(analysis, "created_at", None)
    if created:
        created = timezone.localtime(created)
        offset = created.strftime("%z")
        story.append(
            text(
                f"Creado: {created:%Y-%m-%d %H:%M} (UTC{offset[:3]}:{offset[3:]}) | Estudio satelital #{analysis.pk}",
                "Caption",
            )
        )
    latest = (intervals or scenes or [{}])[-1]
    condition = latest.get("condicion")
    if condition:
        period = (
            f"{latest['fecha_inicial']} a {latest['fecha_final']}" if intervals else latest["fecha"]
        )
        story += [
            Spacer(1, 8),
            text(f"Periodo destacado: {period}", "PlateTitle"),
            _categories(condition, styles),
            Spacer(1, 10),
            text(interpretation(condition)),
        ]
    if scenes:
        coverage = [["Fecha observada", "Cobertura válida", "Área válida (ha)"]]
        for scene in scenes:
            fraction = scene.get("fraccion_valida")
            coverage.append(
                [
                    scene["fecha"],
                    number(fraction * 100 if fraction is not None else None, " %"),
                    number(scene.get("area_observada_ha_aprox")),
                ]
            )
        story += [
            Spacer(1, 6),
            text("Fechas observadas", "PlateTitle"),
            _table(coverage, styles, [WIDTH / 3] * 3),
            Spacer(1, 8),
        ]
    story += [
        text(
            "Cada periodo se interpreta por separado: las superficies de distintas fechas o comparaciones no se suman.",
            "Caption",
        ),
        PageBreak(),
        text("Guía de lectura", "SectionTitle"),
    ]
    legend = [
        ["Contenido", "Qué permite observar"],
        ["Resumen", "Porcentajes de cobertura y distribución espacial de las categorías."],
        ["Una fecha", "Vigor, humedad y condición de la vegetación en esa toma."],
        [
            "Comparaciones",
            "Evolución entre dos fechas, señales de degradación y posible deforestación.",
        ],
        [
            "Índices",
            "NDVI: vigor; NDMI: humedad; NBR: condición de cobertura; NDRE: clorofila y vigor.",
        ],
    ]
    story += [
        _table(legend, styles, [WIDTH * 0.25, WIDTH * 0.75]),
        Spacer(1, 12),
        text("Cómo leer mapas y estadísticas", "PlateTitle"),
        text(
            "En cobertura, verde representa vigor alto o bosque estable, amarillo señal temporal de degradación, rojo vigor bajo o posible deforestación y gris otra cobertura. Las zonas sin datos quedan fuera del porcentaje."
        ),
        text(
            "Los mapas de índices de una fecha usan ocre-verde o rojo-azul. Ambas paletas muestran los mismos valores: bajo-alto. En mapas de cambio, rojo representa descenso y azul aumento; el cambio es fecha final menos fecha inicial."
        ),
        text(
            "La media resume el nivel general. La mediana separa los valores en dos mitades. p10-p90 contiene aproximadamente el 80 % central de los píxeles válidos; no es un porcentaje de bosque ni una medida de exactitud."
        ),
        text("Contenido del informe", "PlateTitle"),
    ]
    contents = TableOfContents()
    contents.levelStyles = [
        ParagraphStyle(
            "ContentsMain",
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=16,
            textColor=GREEN,
            spaceBefore=5,
        ),
        ParagraphStyle(
            "ContentsDetail",
            fontName="Helvetica",
            fontSize=9,
            leading=14,
            leftIndent=12,
            textColor=INK,
        ),
    ]
    story.append(contents)
    included = set()
    figure = 0

    def gallery(selected, first_break=True):
        nonlocal figure
        for plate_number, plate in enumerate(selected):
            included.add(plate.relative_path)
            figure += 1
            parts = list(_image_parts(plate.path))
            for index, image in enumerate(parts, 1):
                period = plate.period.replace("_", " a ") or (
                    "Todos los intervalos del estudio"
                    if plate.section == "comparisons_overview"
                    else "Todas las fechas del estudio"
                )
                suffix = f" | Parte {index} de {len(parts)}" if len(parts) > 1 else ""
                if first_break or plate_number or index > 1:
                    story.append(PageBreak())
                story.extend(
                    [
                        text(f"LÁMINA {figure:02d}{suffix}", "Eyebrow"),
                        text(plate.title, "PlateTitle"),
                        text(period, "Caption"),
                        image,
                        Spacer(1, 10),
                        text(plate.caption, "Caption"),
                    ]
                )

    def detail(item, temporal, first_break=True):
        period = f"{item['fecha_inicial']} a {item['fecha_final']}" if temporal else item["fecha"]
        if first_break:
            story.append(PageBreak())
        story.append(text(period, "PeriodTitle"))
        condition = item.get("condicion")
        if condition:
            story.extend(
                [
                    text(
                        f"Cobertura válida: {number(condition['porcentaje_cobertura_valida'], ' %')} | Área evaluada: {number(condition['area_evaluada_ha'], ' ha')}",
                        "Caption",
                    ),
                    _categories(condition, styles),
                    Spacer(1, 10),
                    text(interpretation(condition)),
                ]
            )
        values = item.get("diferencias" if temporal else "indices", {})
        if values:
            rows = [["Índice" if not temporal else "Cambio", "Media", "p10", "Mediana", "p90"]]
            rows += [
                [name]
                + [number(stats.get(key), decimals=3) for key in ("media", "p10", "mediana", "p90")]
                for name, stats in values.items()
            ]
            story.extend(
                [
                    KeepTogether(
                        [
                            text("Estadísticas de los índices", "PlateTitle"),
                            _table(rows, styles, [WIDTH * 0.24] + [WIDTH * 0.19] * 4),
                        ]
                    ),
                    Spacer(1, 10),
                ]
            )
            descriptions = {
                "NDVI": "vigor y cobertura vegetal",
                "NDMI": "humedad de la vegetación",
                "NBR": "condición de la cobertura",
                "NDRE": "clorofila y vigor",
            }
            readings = []
            for key, stats in values.items():
                mean = stats.get("media")
                index = key.removeprefix("d")
                if mean is not None and index in descriptions:
                    change = (
                        (
                            "aumento medio"
                            if mean > 0
                            else "descenso medio"
                            if mean < 0
                            else "sin cambio medio"
                        )
                        if temporal
                        else "valor medio"
                    )
                    readings.append(
                        f"{index}: {change} de {descriptions[index]} ({number(mean, decimals=3)})."
                    )
            if readings:
                story.append(text(" ".join(readings)))
        if temporal:
            story.append(
                text(
                    f"Intervalo observado: {item.get('dias', 'No disponible')} días. Los mapas permiten distinguir cambios locales que la media del área puede compensar.",
                    "Caption",
                )
            )
            surface = item.get("superficie") or {}
            fraction = surface.get("fraccion_clase_1_entre_validos")
            if fraction is not None:
                story.append(
                    text(
                        f"Resultado complementario del modelo v9: clase 1 en {number(fraction * 100, ' %')} de sus píxeles válidos ({number(surface.get('area_clase_1_ha_aprox'), ' ha')}). Se presenta separado de las categorías de cobertura.",
                        "Caption",
                    )
                )
        return period.replace(" a ", "_")

    overview = [plate for plate in plates if plate.section == "overview"]
    if overview:
        story += [
            PageBreak(),
            text("01 | Visión general de las fechas", "SectionTitle"),
            text(
                "Las siguientes láminas reúnen las escenas en orden temporal. La variante de contraste conserva los mismos resultados con otra paleta."
            ),
        ]
        gallery(overview, first_break=False)
    if scenes:
        story += [
            PageBreak(),
            text("02 | Resultados por fecha", "SectionTitle"),
            text(
                "Cada fecha se presenta con sus porcentajes, interpretación e índices, seguida de sus láminas y referencias visuales."
            ),
        ]
        for index, scene in enumerate(scenes):
            period = detail(scene, False, first_break=index > 0)
            gallery(
                [
                    plate
                    for plate in plates
                    if plate.section == "individual" and plate.period == period
                ]
            )
    if intervals:
        story += [
            PageBreak(),
            text("03 | Cambios entre fechas", "SectionTitle"),
            text(
                "Primero se muestra la comparación general y después cada intervalo con sus porcentajes e índices de cambio. Los periodos pueden observar el mismo territorio; no deben sumarse."
            ),
        ]
        comparison_plates = [plate for plate in plates if plate.section == "comparisons_overview"]
        gallery(comparison_plates, first_break=False)
        for index, interval in enumerate(intervals):
            period = detail(interval, True, first_break=bool(comparison_plates) or index > 0)
            gallery(
                [
                    plate
                    for plate in plates
                    if plate.section == "comparison" and plate.period == period
                ]
            )
    remaining = [plate for plate in plates if plate.relative_path not in included]
    if remaining:
        story += [
            PageBreak(),
            text("04 | Mapas complementarios", "SectionTitle"),
            text("Referencias gráficas adicionales disponibles para este estudio."),
        ]
        gallery(remaining, first_break=False)
    story += [PageBreak(), text("Conclusiones del estudio", "SectionTitle")]
    if intervals:
        rows = [["Periodo", "Bosque estable", "Degradación", "Posible deforestación"]]
        for item in intervals:
            condition = item.get("condicion")
            if condition:
                categories = {entry["clave"]: entry for entry in condition["categorias"]}
                rows.append(
                    [f"{item['fecha_inicial']} a {item['fecha_final']}"]
                    + [
                        category_percent(categories[key], condition)
                        for key in ("bosque_estable", "degradacion", "posible_deforestacion")
                    ]
                )
        if len(rows) > 1:
            story += [_table(rows, styles, [WIDTH * 0.34] + [WIDTH * 0.22] * 3), Spacer(1, 12)]
    for item in intervals or scenes:
        if item.get("condicion"):
            period = (
                f"{item['fecha_inicial']} a {item['fecha_final']}" if intervals else item["fecha"]
            )
            story += [text(period, "PlateTitle"), text(interpretation(item["condicion"]))]
    story += [
        text("Próximos pasos", "PlateTitle"),
        text(
            "Utilice los mapas para localizar las zonas señaladas y comparar su aspecto en las imágenes originales. Mantenga la misma zona al incorporar nuevas fechas para seguir la evolución de la cobertura y su humedad."
        ),
    ]
    destination.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=destination.parent, suffix=".pdf", delete=False) as temporary:
        pending = Path(temporary.name)
    try:
        document = ReportDocument(
            str(pending),
            pagesize=A4,
            leftMargin=40,
            rightMargin=40,
            topMargin=82,
            bottomMargin=56,
            title=f"ForestGuard | {analysis.name}",
            author="ForestGuard",
            subject=REPORT_VERSION,
        )
        document.analysis_id = getattr(analysis, "pk", "") or "-"
        document.multiBuild(story, onFirstPage=_page, onLaterPages=_page)
        pending.replace(destination)
        if root.resolve() == destination.parent.resolve():
            stamp = root / ".reporte.version"
            stamp.write_text(report_fingerprint(analysis, root, summary), encoding="utf-8")
    finally:
        pending.unlink(missing_ok=True)
