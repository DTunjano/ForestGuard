"""Branded report built from the same metrics and maps as the API."""

from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.utils import ImageReader
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

GREEN = colors.HexColor("#184b39")
INK = colors.HexColor("#18333d")
WIDTH = A4[0] - 80


def number(value, suffix="", decimals=2):
    return f"{value:,.{decimals}f}{suffix}" if value is not None else "No disponible"


def category_percent(category, condition):
    if category["porcentaje"] is not None:
        return number(category["porcentaje"], " %")
    if condition["tipo"] != "temporal" and category["clave"] == "degradacion":
        return "Requiere otra fecha"
    return "Sin área válida"


def interpretation(condition):
    categories = {item["clave"]: item for item in condition["categorias"]}

    def percent(key):
        return number(categories[key]["porcentaje"], " %")

    if not condition["pixeles_evaluados"]:
        return "Este intervalo no tiene superficie común válida para calcular porcentajes. Seleccione escenas con cobertura válida coincidente."
    if condition["tipo"] == "temporal":
        return (
            f"Sobre el área común válida, {percent('bosque_estable')} conserva la condición de bosque según el proxy NDVI. "
            f"El {percent('posible_deforestacion')} presenta una señal de posible deforestación y el "
            f"{percent('degradacion')} cumple la regla de degradación. "
            "Priorice la revisión de las manchas rojas, después las amarillas, contrastando las fechas y el contexto de cobertura."
        )
    return (
        f"El {percent('bosque_estable')} del área válida presenta vegetación de vigor alto y el "
        f"{percent('posible_deforestacion')} vegetación de vigor bajo. "
        "Estas categorías describen la condición de la fecha seleccionada. Una segunda fecha permite evaluar pérdida y degradación temporal."
    )


def _table(rows, styles, widths):
    wrapped = [
        [
            Paragraph(escape(str(cell)), styles["HeaderCell"] if row == 0 else styles["Cell"])
            for cell in cells
        ]
        for row, cells in enumerate(rows)
    ]
    table = Table(wrapped, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f6f3")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def _page(canvas, doc):
    canvas.saveState()
    canvas.setTitle("ForestGuard | Informe de análisis")
    canvas.setAuthor("ForestGuard")
    canvas.setFillColor(GREEN)
    canvas.rect(0, A4[1] - 56, A4[0], 56, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 16)
    canvas.setFillColor(colors.white)
    canvas.drawString(40, A4[1] - 30, "ForestGuard")
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(A4[0] - 40, A4[1] - 30, "ANÁLISIS DE COBERTURA VEGETAL")
    canvas.setFillColor(INK)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(40, 24, "ForestGuard | Sentinel-2 | Informe de resultados")
    canvas.drawRightString(A4[0] - 40, 24, f"Página {doc.page}")
    canvas.restoreState()


def write_report(analysis, summary, destination):
    destination = Path(destination)
    styles = getSampleStyleSheet()
    for name in ("Title", "Heading1", "Heading2", "BodyText"):
        styles[name].textColor = INK
    styles["BodyText"].leading = 15
    styles.add(ParagraphStyle("Cell", fontName="Helvetica", fontSize=9, leading=12, textColor=INK))
    styles.add(
        ParagraphStyle(
            "HeaderCell", parent=styles["Cell"], textColor=colors.white, fontName="Helvetica-Bold"
        )
    )

    def paragraph(text):
        return Paragraph(escape(str(text)), styles["BodyText"])

    story = [
        Paragraph("Informe de cobertura vegetal", styles["Title"]),
        Spacer(1, 10),
        paragraph(analysis.name),
        paragraph(f"Área de estudio: {analysis.study_area.name}"),
        paragraph(
            f"Escenas: {len(summary.get('escenas', []))} | Intervalos: {len(summary.get('intervalos', []))}"
        ),
        Spacer(1, 16),
        Paragraph("Lectura del informe", styles["Heading2"]),
        paragraph(
            "Verde: vigor alto o bosque estable según la modalidad. Amarillo: señal temporal de degradación. "
            "Rojo: vigor bajo en una fecha o posible deforestación entre fechas. Gris: otra cobertura. "
            "Cada porcentaje representa superficie dentro del área válida; las categorías se excluyen entre sí."
        ),
        Spacer(1, 16),
    ]
    if getattr(analysis, "description", ""):
        story.insert(5, paragraph(analysis.description))
    if getattr(analysis, "pk", None):
        story.insert(
            5,
            paragraph(f"Análisis #{analysis.pk} | Creado: {analysis.created_at:%Y-%m-%d %H:%M %Z}"),
        )
    coverage = [["Fecha", "Cobertura válida", "Área válida (ha)"]]
    for scene in summary.get("escenas", []):
        coverage.append(
            [
                scene["fecha"],
                number(scene.get("fraccion_valida", 0) * 100, " %"),
                number(scene.get("area_observada_ha_aprox")),
            ]
        )
    if len(coverage) > 1:
        story += [_table(coverage, styles, [WIDTH / 3] * 3), Spacer(1, 16)]
    latest = (summary.get("intervalos") or summary.get("escenas") or [{}])[-1]
    headline = latest.get("condicion")
    if headline:
        period = (
            f"{latest['fecha_inicial']} a {latest['fecha_final']}"
            if "fecha_inicial" in latest
            else latest["fecha"]
        )
        rows = [[f"Resumen del periodo {period}", "Superficie (%)"]]
        rows += [
            [
                item["etiqueta"],
                category_percent(item, headline),
            ]
            for item in headline["categorias"]
        ]
        story += [
            _table(rows, styles, [WIDTH * 0.72, WIDTH * 0.28]),
            Spacer(1, 10),
            paragraph(interpretation(headline)),
            Spacer(1, 10),
        ]
    story += [
        Paragraph("Cómo interpretar los porcentajes", styles["Heading2"]),
        paragraph(
            "Las áreas sin datos quedan fuera del denominador. En comparaciones se utiliza la intersección válida "
            "de ambas fechas, en la cuadrícula inicial. Los porcentajes de varios intervalos no se suman porque pueden cubrir el mismo terreno."
        ),
        paragraph(
            "NDVI, NDMI, NBR y NDRE conservan sus valores de índice. Los percentiles p10 y p90 delimitan el 80 % central "
            "de los valores válidos, y la media resume su nivel general."
        ),
    ]
    entries = [
        (
            scene,
            f"Condición individual | {scene['fecha']}",
            destination.parent / "fechas" / scene["fecha"],
            "indices",
        )
        for scene in summary.get("escenas", [])
    ]
    entries += [
        (
            item,
            f"Comparación | {item['fecha_inicial']} a {item['fecha_final']}",
            destination.parent / "intervalos" / f"{item['fecha_inicial']}_{item['fecha_final']}",
            "diferencias",
        )
        for item in summary.get("intervalos", [])
    ]
    for item, title, folder, stats_key in entries:
        story += [PageBreak(), Paragraph(title, styles["Heading1"])]
        condition = item.get("condicion")
        if condition:
            story += [
                paragraph(
                    f"Cobertura válida: {number(condition['porcentaje_cobertura_valida'], ' %')} | "
                    f"Píxeles evaluados: {condition['pixeles_evaluados']:,} | "
                    f"Área evaluada: {number(condition['area_evaluada_ha'], ' ha')}"
                ),
                Spacer(1, 6),
            ]
            image_path = folder / "mapas_original_resultado.png"
            if image_path.is_file():
                width, height = ImageReader(str(image_path)).getSize()
                story += [
                    Image(str(image_path), width=WIDTH, height=WIDTH * height / width),
                    Spacer(1, 8),
                ]
            rows = [["Categoría", "Superficie (%)", "Área (ha)"]]
            for category in condition["categorias"]:
                rows.append(
                    [
                        category["etiqueta"],
                        category_percent(category, condition),
                        number(category["area_ha"]),
                    ]
                )
            story += [
                _table(rows, styles, [WIDTH * 0.50, WIDTH * 0.27, WIDTH * 0.23]),
                Spacer(1, 10),
                paragraph(interpretation(condition)),
                Spacer(1, 8),
            ]
        else:
            story += [
                paragraph(
                    "Este resultado conserva las métricas de su fecha de procesamiento. "
                    "Un nuevo análisis incorpora el mapa de categorías actualizado."
                )
            ]
        rows = [
            [
                "Índice" if stats_key == "indices" else "Cambio final - inicial",
                "Media",
                "p10",
                "Mediana",
                "p90",
            ]
        ]
        for key, stats in item.get(stats_key, {}).items():
            rows.append(
                [key]
                + [
                    number(stats.get(field), decimals=3)
                    for field in ("media", "p10", "mediana", "p90")
                ]
            )
        if len(rows) > 1:
            story += [
                KeepTogether(
                    [
                        Paragraph("Detalle espectral", styles["Heading2"]),
                        _table(rows, styles, [WIDTH * 0.28] + [WIDTH * 0.18] * 4),
                    ]
                )
            ]
        if stats_key == "diferencias":
            story += [
                Spacer(1, 8),
                paragraph(
                    f"Intervalo: {item.get('dias')} días. Clasificación v9: "
                    f"{item.get('estado_clasificacion', 'no solicitada')}. Las reglas espectrales se calculan de forma independiente."
                ),
            ]
            surface = item.get("superficie") or {}
            if surface:
                story += [
                    paragraph(
                        f"Resultado complementario v9: clase 1 en "
                        f"{number(surface.get('fraccion_clase_1_entre_validos', 0) * 100, ' %')} "
                        f"de sus píxeles válidos ({number(surface.get('area_clase_1_ha_aprox'), ' ha')})."
                    )
                ]
        elif item.get("crs"):
            story += [
                Spacer(1, 6),
                paragraph(
                    f"CRS: {item['crs']} | Cuadrícula: {item['ancho_pixeles']} × "
                    f"{item['alto_pixeles']} píxeles | Área de píxel: {number(item['area_pixel_m2'], ' m²')}"
                ),
            ]
    story += [
        PageBreak(),
        Paragraph("Método y trazabilidad", styles["Heading1"]),
        paragraph(
            "Método: forestguard_spectral_rules_v1. La pérdida temporal usa índice inicial menos final. "
            "Los mapas de diferencias técnicos conservan la convención final menos inicial."
        ),
        Spacer(1, 10),
        paragraph(
            "En una fecha: NDVI >= 0,5 indica vigor alto; 0,2 <= NDVI < 0,5 indica vigor bajo; NDVI < 0,2 se separa "
            "como otra cobertura. El seguimiento con otra fecha permite distinguir condición y pérdida."
        ),
        Spacer(1, 10),
        paragraph(
            "Entre fechas: se considera bosque de referencia el proxy NDVI inicial >= 0,5. Se asigna posible deforestación "
            "cuando NDVI final < 0,5 o la pérdida NDVI > 0,3. Después se asigna degradación cuando la pérdida NBR "
            "está entre 0,1 y 0,4, inclusive. La cobertura restante del proxy se clasifica como estable. "
            "Las demás coberturas se presentan por separado."
        ),
        Spacer(1, 10),
        paragraph(
            "Los umbrales son reglas operativas del proyecto. La identificación de bosque utiliza un proxy espectral; "
            "su interpretación se completa con cobertura de referencia, contexto estacional y revisión visual."
        ),
        Spacer(1, 10),
        paragraph(
            "Archivos complementarios: GeoTIFF georreferenciado de categorías; PNG del original, del resultado y de las "
            "láminas de índices; JSON con conteos, superficies, porcentajes y versión del método."
        ),
        Spacer(1, 14),
        Paragraph("Referencias metodológicas", styles["Heading2"]),
        paragraph(
            "USGS: burnseverity.cr.usgs.gov/glossary (diferencias inicial menos final). "
            "NASA: science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/ (interpretación del NDVI)."
        ),
    ]
    SimpleDocTemplate(
        str(destination), pagesize=A4, leftMargin=40, rightMargin=40, topMargin=78, bottomMargin=48
    ).build(story, onFirstPage=_page, onLaterPages=_page)
