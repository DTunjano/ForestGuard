"""Human-readable report of the pipeline's historical, exploratory outputs."""

from html import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def write_report(analysis, summary, destination):
    styles = getSampleStyleSheet()
    story = [
        Paragraph("ForestGuard — reporte de análisis", styles["Title"]),
        Spacer(1, 12),
        Paragraph(f"Análisis: {escape(analysis.name)}", styles["Normal"]),
        Paragraph(f"Área: {escape(analysis.study_area.name)}", styles["Normal"]),
        Paragraph(f"Modalidad: {escape(str(summary.get('modalidad', '')))}", styles["Normal"]),
        Spacer(1, 14),
        Paragraph("Alcance", styles["Heading2"]),
        Paragraph(
            "Los mapas muestran índices, diferencias e indicios de cambio histórico exploratorio. "
            "No predicen riesgo futuro ni confirman deforestación o degradación oficial. "
            "El puntaje del modelo no es una probabilidad calibrada.", styles["BodyText"],
        ),
        Spacer(1, 12),
    ]
    scene_rows = [["Fecha", "Cobertura válida"]]
    for scene in summary.get("escenas", []):
        scene_rows.append([str(scene.get("fecha", "")), str(scene.get("pixeles_validos", "—"))])
    if len(scene_rows) > 1:
        story += [Paragraph("Escenas", styles["Heading2"]), _table(scene_rows), Spacer(1, 12)]
    interval_rows = [["Intervalo", "Clasificación", "Indicios de cambio"]]
    for interval in summary.get("intervalos", []):
        signal = interval.get("deforestacion_observada") or {}
        interval_rows.append([
            f"{interval.get('fecha_inicial', '')} a {interval.get('fecha_final', '')}",
            str(interval.get("estado_clasificacion", "sin modelo")),
            str(signal.get("pixeles_clase_1", "no evaluable")),
        ])
    if len(interval_rows) > 1:
        story += [Paragraph("Intervalos", styles["Heading2"]), _table(interval_rows)]
    SimpleDocTemplate(str(destination), pagesize=A4, leftMargin=40, rightMargin=40).build(story)


def _table(rows):
    table = Table(rows, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#164735")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d0d8d3")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table
