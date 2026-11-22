import json
import sqlite3
import sys
from datetime import date, timedelta
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.shared import Cm, Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


ROOT = Path(__file__).resolve().parent
APP_ROOT = ROOT.parent
DATA_DIR = (
    APP_ROOT
    / "exportacion_bd"
    / "simulacion_2026-08-23_a_2026-11-16"
)
CSV_DIR = DATA_DIR / "csv"
DB_PATH = DATA_DIR / "agenda_odontologica_simulada.db"
SOURCE_DB = APP_ROOT / "database.db"
FIG_DIR = ROOT / "figuras"
MODEL_DIR = ROOT / "modelos"
MODEL_METRICS_PATH = MODEL_DIR / "metricas_modelos.json"
TEST_PREDICTIONS_PATH = MODEL_DIR / "predicciones_prueba.csv"
DOCX_PATH = ROOT / "Proyecto_Ciencia_de_Datos_Agenda_Odontologica.docx"
NOTEBOOK_PATH = ROOT / "EDA_Agenda_Odontologica.ipynb"
AS_OF_DATE = date(2026, 11, 16)


def load_data():
    appointments = pd.read_csv(CSV_DIR / "appointments.csv")
    links = pd.read_csv(CSV_DIR / "appointment_treatments.csv")
    treatments = pd.read_csv(CSV_DIR / "treatments.csv")
    transactions = pd.read_csv(CSV_DIR / "inventory_transactions.csv")

    appointments["es_sintetico"] = (
        appointments["es_sintetico"].astype(str).str.lower().eq("true")
    )
    links["es_sintetico"] = links["es_sintetico"].astype(str).str.lower().eq("true")
    transactions["es_sintetico"] = (
        transactions["es_sintetico"].astype(str).str.lower().eq("true")
    )
    appointments["appointment_date"] = pd.to_datetime(
        appointments["appointment_date"], errors="coerce"
    )
    transactions["fecha"] = pd.to_datetime(transactions["fecha"], errors="coerce")

    source = sqlite3.connect(SOURCE_DB)
    source_appointments = source.execute(
        "SELECT COUNT(*), MIN(appointment_date), MAX(appointment_date) FROM appointments"
    ).fetchone()
    age_mismatches = source.execute(
        """
        SELECT COUNT(*) FROM patients
        WHERE fecha_nacimiento IS NOT NULL AND edad IS NOT NULL
          AND edad != (
            2026 - CAST(substr(fecha_nacimiento, 1, 4) AS INTEGER)
            - CASE
                WHEN substr(fecha_nacimiento, 6, 2) || substr(fecha_nacimiento, 9, 2) > '1116'
                THEN 1 ELSE 0
              END
          )
        """
    ).fetchone()[0]
    late_created_at = source.execute(
        """
        SELECT COUNT(*) FROM appointments
        WHERE datetime(created_at) > datetime(appointment_date || ' ' || appointment_time)
        """
    ).fetchone()[0]
    source_statuses = dict(
        source.execute("SELECT status, COUNT(*) FROM appointments GROUP BY status").fetchall()
    )
    source.close()
    source_start = date.fromisoformat(source_appointments[1])
    source_end = date.fromisoformat(source_appointments[2])
    source_open_days = 0
    current_source_day = source_start
    while current_source_day <= source_end:
        if current_source_day.weekday() != 6:
            source_open_days += 1
        current_source_day += timedelta(days=1)

    synthetic = appointments[appointments["es_sintetico"]]
    labeled_appointments = synthetic[synthetic["status"].isin(["Atendida", "Ausente"])]
    if not MODEL_METRICS_PATH.is_file() or not TEST_PREDICTIONS_PATH.is_file():
        raise FileNotFoundError(
            "Ejecute entrenar_prediccion_ausentismo.py antes de generar el informe."
        )
    with MODEL_METRICS_PATH.open(encoding="utf-8") as file:
        model_results = json.load(file)
    test_predictions = pd.read_csv(TEST_PREDICTIONS_PATH)
    analysis_start = appointments["appointment_date"].min().date()
    analysis_end = appointments["appointment_date"].max().date()
    analysis_open_days = sum(
        (analysis_start + timedelta(days=offset)).weekday() != 6
        for offset in range((analysis_end - analysis_start).days + 1)
    )
    metrics = {
        "appointments": appointments,
        "synthetic_appointments": synthetic,
        "links": links,
        "treatments": treatments,
        "transactions": transactions,
        "source_count": source_appointments[0],
        "source_first": source_appointments[1],
        "source_last": source_appointments[2],
        "age_mismatches": age_mismatches,
        "late_created_at": late_created_at,
        "source_statuses": source_statuses,
        "source_open_days": source_open_days,
        "source_average": source_appointments[0] / source_open_days,
        "analysis_start": analysis_start,
        "analysis_end": analysis_end,
        "analysis_open_days": analysis_open_days,
        "analysis_count": len(appointments),
        "analysis_average": len(appointments) / analysis_open_days,
        "synthetic_count": len(synthetic),
        "synthetic_status_counts": synthetic["status"].value_counts().to_dict(),
        "labeled_appointment_count": len(labeled_appointments),
        "train_count": len(labeled_appointments) - len(test_predictions),
        "test_count": len(test_predictions),
        "test_attended_count": int(test_predictions["status"].eq("Atendida").sum()),
        "test_absent_count": int(test_predictions["status"].eq("Ausente").sum()),
        "model_results": model_results,
    }
    return metrics


def make_figures(metrics):
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    appointments = metrics["appointments"].copy()
    appointments["mes"] = appointments["appointment_date"].dt.to_period("M").astype(str)
    monthly = appointments.groupby("mes").size()

    fig, ax = plt.subplots(figsize=(8, 4.3))
    monthly.plot(kind="bar", ax=ax, color="#4278a8", width=0.72)
    ax.set_title("Citas totales por mes (incluye registros de práctica)")
    ax.set_xlabel("Mes de 2026")
    ax.set_ylabel("Número de registros")
    ax.grid(axis="y", alpha=0.2)
    fig.tight_layout()
    monthly_path = FIG_DIR / "citas_por_mes_total.png"
    fig.savefig(monthly_path, dpi=180)
    plt.close(fig)

    synthetic_status = (
        metrics["synthetic_appointments"]["status"]
        .value_counts()
        .reindex(["Atendida", "Ausente", "Cancelada"], fill_value=0)
    )
    fig, ax = plt.subplots(figsize=(7, 3.8))
    colors = ["#4c956c", "#d9675b", "#9aa5b1"]
    synthetic_status.plot(kind="bar", ax=ax, color=colors, width=0.65)
    ax.set_title("Estados de citas generadas para la práctica")
    ax.set_xlabel("Estado")
    ax.set_ylabel("Número de registros")
    ax.tick_params(axis="x", rotation=0)
    ax.grid(axis="y", alpha=0.2)
    fig.tight_layout()
    status_path = FIG_DIR / "estados_citas_simuladas.png"
    fig.savefig(status_path, dpi=180)
    plt.close(fig)

    txn = metrics["transactions"]
    synthetic_txn = (
        txn[txn["es_sintetico"]]
        .groupby("tipo")
        .size()
        .reindex(["ENTRADA", "SALIDA", "AJUSTE"], fill_value=0)
    )
    fig, ax = plt.subplots(figsize=(7, 3.8))
    synthetic_txn.plot(kind="bar", ax=ax, color="#648caa", width=0.65)
    ax.set_title("Movimientos de inventario generados para la práctica")
    ax.set_xlabel("Tipo de movimiento")
    ax.set_ylabel("Número de registros")
    ax.tick_params(axis="x", rotation=0)
    ax.grid(axis="y", alpha=0.2)
    fig.tight_layout()
    inventory_path = FIG_DIR / "movimientos_inventario_simulados.png"
    fig.savefig(inventory_path, dpi=180)
    plt.close(fig)
    return monthly_path, status_path, inventory_path


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill)
    tc_pr.append(shading)


def set_cell_margins(cell, top=70, start=90, bottom=70, end=90):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    repeat = OxmlElement("w:tblHeader")
    repeat.set(qn("w:val"), "true")
    tr_pr.append(repeat)


def set_no_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    no_split = OxmlElement("w:cantSplit")
    tr_pr.append(no_split)


def add_page_field(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, text, end])


def add_toc_field(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = ' TOC \\o "1-2" \\h \\z \\u '
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "Abra en Word, haga clic derecho y seleccione Actualizar campo."
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, text, end])


def set_page_number_format(section, fmt, start=1):
    pg_num = section._sectPr.find(qn("w:pgNumType"))
    if pg_num is None:
        pg_num = OxmlElement("w:pgNumType")
        section._sectPr.append(pg_num)
    pg_num.set(qn("w:fmt"), fmt)
    pg_num.set(qn("w:start"), str(start))


def add_body(doc, text, bold_lead=None):
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    paragraph.paragraph_format.first_line_indent = Cm(1.25)
    paragraph.paragraph_format.space_after = Pt(6)
    paragraph.paragraph_format.line_spacing = 1.5
    if bold_lead and text.startswith(bold_lead):
        lead = paragraph.add_run(bold_lead)
        lead.bold = True
        paragraph.add_run(text[len(bold_lead):])
    else:
        paragraph.add_run(text)
    return paragraph


def add_bullet(doc, text):
    paragraph = doc.add_paragraph(style="List Bullet")
    paragraph.paragraph_format.left_indent = Cm(1)
    paragraph.paragraph_format.first_line_indent = Cm(-0.4)
    paragraph.paragraph_format.space_after = Pt(4)
    paragraph.paragraph_format.line_spacing = 1.35
    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    paragraph.add_run(text)
    return paragraph


def add_caption(doc, text, source):
    caption = doc.add_paragraph()
    caption.paragraph_format.space_before = Pt(4)
    caption.paragraph_format.space_after = Pt(0)
    run = caption.add_run(text)
    run.bold = True
    run.font.size = Pt(10)
    src = doc.add_paragraph()
    src.paragraph_format.space_after = Pt(5)
    r = src.add_run(f"Fuente: {source}.")
    r.italic = True
    r.font.size = Pt(9)


def add_table(doc, headers, rows, caption=None, source="elaboración propia"):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    header = table.rows[0]
    set_repeat_table_header(header)
    for idx, label in enumerate(headers):
        cell = header.cells[idx]
        cell.text = str(label)
        set_cell_shading(cell, "DCE6F1")
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_margins(cell)
        for paragraph in cell.paragraphs:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            paragraph.paragraph_format.line_spacing = 1.0
            paragraph.paragraph_format.space_after = Pt(0)
            for run in paragraph.runs:
                run.bold = True
                run.font.name = "Times New Roman"
                run.font.size = Pt(9)

    for row_data in rows:
        row = table.add_row()
        set_no_split(row)
        for idx, value in enumerate(row_data):
            cell = row.cells[idx]
            cell.text = str(value)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)
            for paragraph in cell.paragraphs:
                paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
                paragraph.paragraph_format.line_spacing = 1.0
                paragraph.paragraph_format.space_after = Pt(1)
                for run in paragraph.runs:
                    run.font.name = "Times New Roman"
                    run.font.size = Pt(8.5)
    if caption:
        add_caption(doc, caption, source)
    return table


def add_figure(doc, path, caption, source, width=5.8):
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_before = Pt(4)
    paragraph.paragraph_format.space_after = Pt(2)
    paragraph.add_run().add_picture(str(path), width=Inches(width))
    add_caption(doc, caption, source)


def add_reference(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.left_indent = Cm(1.25)
    paragraph.paragraph_format.first_line_indent = Cm(-1.25)
    paragraph.paragraph_format.line_spacing = 1.15
    paragraph.paragraph_format.space_after = Pt(6)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
    paragraph.add_run(text)


def set_styles(doc):
    normal = doc.styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(12)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    normal.paragraph_format.line_spacing = 1.5
    normal.paragraph_format.space_after = Pt(6)

    for style_name, size in (("Heading 1", 14), ("Heading 2", 12), ("Heading 3", 12)):
        style = doc.styles[style_name]
        style.font.name = "Times New Roman"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.space_before = Pt(10)
        style.paragraph_format.space_after = Pt(4)
        style.paragraph_format.line_spacing = 1.15

    for style_name in ("List Bullet", "List Number"):
        style = doc.styles[style_name]
        style.font.name = "Times New Roman"
        style.font.size = Pt(12)
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")


def configure_section(section, margins=True):
    section.page_width = Cm(21.59)
    section.page_height = Cm(27.94)
    if margins:
        section.left_margin = Cm(4)
        section.right_margin = Cm(3)
        section.top_margin = Cm(3)
        section.bottom_margin = Cm(3)


def add_footer_page(section, linked=False):
    section.footer.is_linked_to_previous = linked
    footer = section.footer
    paragraph = footer.paragraphs[0]
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    paragraph.paragraph_format.line_spacing = 1.0
    run = paragraph.add_run()
    run.font.name = "Times New Roman"
    run.font.size = Pt(10)
    add_page_field(paragraph)


def add_cover(doc):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(5)
    for line in [
        "UNIVERSIDAD AUTÓNOMA JUAN MISAEL SARACHO",
        "FACULTAD DE INGENIERÍA DE RECURSOS NATURALES Y TECNOLOGÍA",
        "CARRERA DE INGENIERÍA INFORMÁTICA",
    ]:
        r = p.add_run(line + "\n")
        r.bold = True
        r.font.name = "Times New Roman"
        r.font.size = Pt(12)

    for _ in range(1):
        doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(10)
    for line, size in [
        ("PROYECTO FINAL", 14),
        ("TALLER II", 14),
        ("ANÁLISIS EXPLORATORIO Y PREDICCIÓN", 14),
        ("EXPERIMENTAL DE AUSENTISMO EN LA", 14),
        ("AGENDA ODONTOLÓGICA DEL CONSULTORIO", 14),
        ("CRISTO REY", 14),
    ]:
        r = p.add_run(line + "\n")
        r.bold = True
        r.font.name = "Times New Roman"
        r.font.size = Pt(size)

    for _ in range(1):
        doc.add_paragraph()
    for line in [
        "Estudiante: Wilson Piter Martínez Solano",
        "Docente: MSc. Ing. José Renzo Espinoza",
        "Fecha de entrega: 18 / 11 / 2026",
    ]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(6)
        p.add_run(line)

    for _ in range(1):
        doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run("Yacuiba – Bolivia\n2026")


def create_document(metrics, figures):
    doc = Document()
    set_styles(doc)
    configure_section(doc.sections[0])

    settings = doc.settings.element
    update_fields = OxmlElement("w:updateFields")
    update_fields.set(qn("w:val"), "true")
    settings.append(update_fields)

    add_cover(doc)

    prelim = doc.add_section(WD_SECTION.NEW_PAGE)
    configure_section(prelim)
    add_footer_page(prelim)
    set_page_number_format(prelim, "upperRoman", 1)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("ÍNDICE")
    r.bold = True
    r.font.name = "Times New Roman"
    r.font.size = Pt(14)
    add_toc_field(doc.add_paragraph())

    doc.add_page_break()
    doc.add_heading("RESUMEN", level=1)
    add_body(
        doc,
        "Este proyecto realiza un análisis exploratorio y una prueba de clasificación supervisada "
        "para estimar si una cita odontológica será atendida o ausente. La aplicación del "
        "Consultorio Cristo Rey registra citas, pacientes y tratamientos; el conjunto analizado "
        f"reúne {metrics['analysis_count']} citas entre el 10 de agosto y el 16 de noviembre de "
        "2026: 51 registros de la fuente y 320 registros generados para la práctica. El análisis "
        "descriptivo revisa la calidad, procedencia y distribución de las citas. Para el modelo "
        f"binario se utilizaron {metrics['labeled_appointment_count']} citas con estado Atendida "
        "o Ausente; se excluyeron las canceladas. Se compararon Regresión Logística y Random "
        f"Forest mediante una división temporal de {metrics['train_count']} citas de entrenamiento "
        f"y {metrics['test_count']} de prueba. En la prueba, la Regresión Logística obtuvo un "
        f"recall de ausencias de {metrics['model_results']['regresion_logistica']['recall']:.0%}; "
        f"Random Forest obtuvo {metrics['model_results']['random_forest']['recall']:.0%}. Los "
        "registros generados permiten demostrar el flujo técnico, pero no representan el "
        "comportamiento real de pacientes ni validan el uso operativo del modelo. El notebook "
        "incluye además un formulario interactivo de demostración."
    )
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(10)
    r = p.add_run("Palabras clave: ")
    r.bold = True
    p.add_run("análisis exploratorio; aprendizaje supervisado; ausentismo; agenda odontológica; clasificación binaria.")

    main = doc.add_section(WD_SECTION.NEW_PAGE)
    configure_section(main)
    add_footer_page(main)
    set_page_number_format(main, "decimal", 1)

    doc.add_heading("CAPÍTULO I. INTRODUCCIÓN", level=1)
    add_body(
        doc,
        "La disponibilidad de registros digitales no garantiza por sí sola que una organización "
        "pueda tomar decisiones basadas en datos. Para convertir una base transaccional en evidencia "
        "útil, primero es necesario comprender qué representa cada fila, distinguir datos observados "
        "de datos de prueba, detectar inconsistencias y resumir la información de forma reproducible. "
        "Este proyecto aplica ese enfoque a la Agenda Odontológica del Consultorio Cristo Rey. "
        "El propósito es describir la estructura y calidad de los datos y desarrollar una prueba "
        "académica de clasificación de ausentismo, distinguiendo siempre los registros de la fuente "
        "de los generados para completar el ejercicio."
    )
    add_body(
        doc,
        "La selección del análisis exploratorio se inspira en la organización de la Práctica 7 de "
        "EDA disponible en los materiales de Taller II: definir una pregunta, seleccionar variables, "
        "limpiar, resumir distribuciones y explicar que una asociación no demuestra causalidad. "
        "Las prácticas de clasificación binaria orientan la separación entrenamiento/prueba y la "
        "lectura de métricas por clase. En esta prueba se comparan Regresión Logística y Random "
        "Forest con etiquetas de registros generados para fines académicos; por ello, el desempeño "
        "obtenido no se extrapola al consultorio (Arauz Fernández, 2026; Universidad Autónoma Juan "
        "Misael Saracho, 2026)."
    )

    doc.add_heading("1.1 Antecedentes", level=2)
    add_body(
        doc,
        "El Consultorio Odontológico Cristo Rey brinda atención odontológica integral bajo la "
        "dirección profesional del Dr. Luis D. Reynaga Padilla, según el informe previo del sistema. "
        "Ese antecedente describe que antes de digitalizar procesos se utilizaban agendas impresas "
        "y fichas físicas, con dificultades para evitar traslapes, localizar antecedentes clínicos y "
        "controlar tratamientos e insumos (Martínez Solano, 2026). El sistema actual centraliza "
        "citas, pacientes, tratamientos, evolución clínica e inventario en una aplicación de "
        "escritorio y web local."
    )
    doc.add_heading("1.1.1 La institución o empresa", level=3)
    add_body(
        doc,
        "La información de identificación y contacto siguiente se compone de datos entregados por "
        "el estudiante y del informe anterior. El promedio de la tabla institucional usa solo las "
        "citas de la base fuente del 10 al 22 de agosto. El promedio combinado del análisis incluye "
        "una continuación generada para la práctica, por lo que no representa un volumen real verificado ni se "
        "extrapola como promedio anual."
    )
    add_table(
        doc,
        ["Dato", "Detalle"],
        [
            ("Nombre", "Consultorio Odontológico Cristo Rey"),
            ("Rubro", "Servicios de salud odontológica"),
            ("Dirección", "Calle N.º 9, entre Av. Libertadores y Avaroa II; Plus Code X8XF+676, C. 9, Yacuíba"),
            ("Años de funcionamiento", "No disponible; confirmar con la institución"),
            ("Personal", "2 personas: odontólogo y ayudante/asistente"),
            (
                "Promedio diario en la fuente",
                f"{metrics['source_average']:.2f} citas registradas por día abierto en la base fuente (10–22/08/2026); no extrapolar fuera de ese periodo",
            ),
            ("Contacto", "Dr. Luis D. Reynaga Padilla, odontólogo/director; teléfono y correo no proporcionados"),
            ("Visita o entrevista", "16 de noviembre de 2026, según dato proporcionado por el estudiante"),
        ],
        "Tabla 1. Datos institucionales disponibles",
        "datos proporcionados por el estudiante e informe previo; promedio calculado sobre los 51 registros fuente del 10 al 22 de agosto",
    )

    doc.add_heading("1.1.2 Sistemas o trabajos similares", level=3)
    add_body(
        doc,
        "Se revisaron tres plataformas de gestión clínica o de consultorio como referencia funcional. "
        "La comparación no constituye una evaluación de calidad ni de costos; se limita a contrastar "
        "el alcance públicamente descrito con el proyecto local."
    )
    add_table(
        doc,
        ["Sistema / año", "Qué ofrece según su sitio oficial", "Diferencia respecto al proyecto"],
        [
            (
                "Open Dental (consulta 2026)",
                "Gestión de consultorio dental y servicios electrónicos, como recordatorios, confirmaciones, portal del paciente y agenda web.",
                "La Agenda Cristo Rey es una aplicación local con SQLite/Electron; este trabajo añade EDA y una prueba de clasificación, sin integrar el modelo a producción.",
            ),
            (
                "Dentrix (consulta 2026)",
                "Plataforma de administración dental con agenda, imágenes, facturación, analítica y comunicación con pacientes.",
                "Dentrix es un ecosistema comercial integrado; este proyecto no sustituye un producto comercial ni conecta sistemas externos.",
            ),
            (
                "OpenEMR (consulta 2026)",
                "Sistema de historia clínica electrónica y gestión de consultorios, de código abierto y orientado a múltiples áreas médicas.",
                "OpenEMR es una plataforma general; la propuesta se limita al conjunto de datos odontológicos local existente y a su análisis exploratorio.",
            ),
        ],
        "Tabla 2. Sistemas relacionados",
        "sitios oficiales de Open Dental, Dentrix y OpenEMR",
    )

    doc.add_heading("1.2 Descripción del problema", level=2)
    doc.add_heading("1.2.1 Situación actual", level=3)
    add_body(
        doc,
        "La aplicación registra citas con fecha, hora, paciente, tratamiento y estado; relaciona "
        "citas con fichas de pacientes y tratamientos; y mantiene tablas de evolución, lotes y "
        "movimientos de inventario. La base se almacena en SQLite y puede exportarse a CSV, JSON y "
        "SQL. Para este estudio se emplea una copia anonimizada que integra las citas desde el 10 "
        "de agosto hasta el 16 de noviembre de 2026: 371 en total. Se suman los registros fuente "
        "disponibles y la continuación de la serie en la copia de análisis; las filas posteriores "
        "al 22 de agosto se generaron para el ejercicio académico y no describen actividad real "
        "del consultorio. No hay "
        "citas los domingos, de acuerdo con el horario de atención indicado."
    )
    add_body(
        doc,
        "El procedimiento analítico es: (1) identificar la fuente y el periodo; "
        "(2) excluir credenciales e información identificable; (3) marcar el origen de cada fila; "
        "(4) validar fechas, estados, relaciones y valores faltantes; (5) agrupar citas por mes, "
        "día, estado y categoría; (6) resumir movimientos de inventario; (7) preparar una "
        "clasificación binaria de citas atendidas/ausentes con variables disponibles antes de la "
        "cita; y (8) evaluar los modelos en una partición temporal. Esta secuencia conserva el "
        "énfasis de las prácticas previas en limpieza, selección de variables, evaluación y "
        "conclusiones limitadas a lo que el conjunto permite sostener."
    )
    add_table(
        doc,
        ["Periodo / tabla", "Registros en copia", "Origen y uso correcto"],
        [
            (
                "Citas del periodo completo 10 agosto–16 noviembre",
                str(metrics["analysis_count"]),
                f"Total combinado: {metrics['analysis_open_days']} días de lunes a sábado; promedio {metrics['analysis_average']:.2f} por día abierto, incluye registros generados para la práctica",
            ),
            ("Citas de la base fuente", str(metrics["source_count"]), "Registros disponibles del 10 al 22 de agosto; autenticidad histórica no verificada"),
            ("Citas de continuación", str(metrics["synthetic_count"]), "Registros generados para la práctica, del 24 de agosto al 16 de noviembre; el 23 fue domingo"),
            ("Pacientes", "125", "25 filas fuente anonimizadas y 100 pacientes ficticios"),
            ("Tratamientos", "105", "Catálogo existente; se usa para vincular registros de práctica"),
            ("Evoluciones", "313", "47 filas fuente y 266 registros generados"),
            ("Movimientos de inventario", "220", "36 filas fuente y 184 movimientos generados para la práctica"),
        ],
        "Tabla 3. Inventario inicial de datos",
        "base de análisis anonimizada; conteos verificados en SQLite",
    )
    add_figure(
        doc,
        figures[0],
        "Figura 1. Citas totales por mes en una sola serie",
        "base de análisis combinada; incluye registros de práctica posteriores al 22 de agosto",
        width=5.6,
    )
    add_body(
        doc,
        "En la copia combinada hay 83 filas de citas en agosto, 120 en septiembre, 111 en octubre "
        "y 57 en noviembre: 371 citas en todo el periodo. La procedencia se marca para distinguir "
        "los registros fuente de los generados para la práctica; por tanto, las diferencias entre "
        "meses no se interpretan como aumento o disminución real de la demanda."
    )

    doc.add_heading("1.2.2 Problemas identificados", level=3)
    add_table(
        doc,
        ["#", "Problema", "Causa", "Consecuencia"],
        [
            (
                "1",
                "La base fuente no contiene registros reales posteriores al 22 de agosto.",
                f"La copia de análisis sí continúa hasta el 16 de noviembre, pero sus {metrics['synthetic_count']} citas posteriores fueron generadas para fines académicos.",
                "Permite demostrar el análisis y el entrenamiento técnico, pero no describir la operación real posterior al 22 de agosto ni estimar el ausentismo real.",
            ),
            (
                "2",
                "Estados y marcas de tiempo históricos no son uniformes.",
                "La fuente contiene Completada, En Espera y Programada; las 51 citas tienen created_at posterior a la cita.",
                "La etiqueta de asistencia y la anticipación de reserva pueden quedar mal interpretadas.",
            ),
            (
                "3",
                "Edad y fecha de nacimiento son inconsistentes en la fuente.",
                f"Se detectó discrepancia en {metrics['age_mismatches']} de 25 pacientes fuente.",
                "La edad de la fuente no se considera fiable; la prueba predictiva usa registros generados y no permite inferir efectos demográficos reales.",
            ),
            (
                "4",
                "Los consumos de inventario no pueden atribuirse con certeza a cada servicio.",
                "La tabla de materiales por tratamiento no contiene asociaciones para esta fuente.",
                "Los movimientos generados son supuestos y no respaldan compras ni decisiones clínicas.",
            ),
            (
                "5",
                "Los datos incluyen información clínica y personal sensible.",
                "Pacientes, contactos, usuarios y notas están vinculados en una misma base.",
                "Se requiere anonimización, acceso limitado y evitar publicar la base operativa.",
            ),
            (
                "6",
                "El calendario fuente habilitaba los domingos, aunque la clínica no atiende.",
                "El horario almacenado no refleja la aclaración del estudiante.",
                "El domingo se cerró solo en la copia de análisis y se documentó el ajuste.",
            ),
        ],
        "Tabla 4. Problemas, causas y consecuencias",
        "elaboración propia a partir de revisión de la base; los registros generados se distinguen de la fuente",
    )

    doc.add_heading("1.3 Planteamiento del problema", level=2)
    add_body(
        doc,
        "Aunque la Agenda Odontológica almacena información de citas, tratamientos y existencias, "
        "la base disponible tiene cobertura histórica corta, atributos con inconsistencias y una "
        "continuación generada para la práctica que no constituye evidencia clínica. Sin un proceso "
        "reproducible de limpieza y análisis, existe riesgo de confundir resultados de prueba con "
        "operación real. Se requiere caracterizar los datos y evaluar un prototipo supervisado para "
        "clasificar citas atendidas o ausentes, documentando las limitaciones que impiden "
        "extrapolar sus resultados a pacientes reales."
    )
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    lead = p.add_run("Pregunta del problema: ")
    lead.bold = True
    p.add_run(
        "¿Cómo caracterizar los datos de la Agenda Odontológica y evaluar un prototipo supervisado "
        "para clasificar citas atendidas o ausentes, distinguiendo la fuente de los registros "
        "generados para la práctica y documentando las limitaciones de la predicción?"
    )

    doc.add_heading("1.4 Justificación", level=2)
    doc.add_heading("1.4.1 Justificación técnica", level=3)
    add_body(
        doc,
        "La aplicación ya utiliza SQLite, lo que permite consultar una copia local sin instalar un "
        "servidor adicional. Python, pandas y Matplotlib permiten preparar tablas y visualizaciones; "
        "scikit-learn compara clasificadores y ipywidgets ofrece un formulario de demostración en "
        "el notebook. El estudio complementa la aplicación existente; no altera su base operativa "
        "ni integra el modelo al instalador."
    )
    doc.add_heading("1.4.2 Justificación económica", level=3)
    add_body(
        doc,
        "El análisis se ejecuta con herramientas de uso abierto y sobre una copia exportada, por lo "
        "que no requiere adquirir una plataforma analítica comercial. No se afirma un monto de "
        "ahorro: para estimarlo sería necesario medir tiempos actuales de elaboración de reportes, "
        "costos de insumos y horas de trabajo, información que no está documentada en la base."
    )
    doc.add_heading("1.4.3 Justificación social o institucional", level=3)
    add_body(
        doc,
        "El análisis puede ayudar al odontólogo y a su ayudante a revisar la calidad de los registros "
        "y a conocer cómo se evaluaría una predicción de ausentismo. El formulario es demostrativo: "
        "no genera diagnósticos ni decisiones automáticas sobre pacientes. Cualquier uso real "
        "requeriría datos correctos y autorizados, además de una validación satisfactoria."
    )

    doc.add_heading("1.5 Objetivos", level=2)
    doc.add_heading("1.5.1 Objetivo general", level=3)
    add_body(
        doc,
        "Realizar un análisis exploratorio reproducible de los datos de la Agenda Odontológica del "
        "Consultorio Cristo Rey y evaluar, mediante una prueba temporal, modelos supervisados para "
        "clasificar citas atendidas o ausentes, documentando la procedencia de los registros y las "
        "limitaciones de calidad y generalización."
    )
    doc.add_heading("1.5.2 Objetivos específicos", level=3)
    add_table(
        doc,
        ["Objetivo específico", "Actividades principales", "Resultado / evidencia"],
        [
            (
                "1. Identificar las tablas, campos y periodos disponibles.",
                "Consultar SQLite, revisar el esquema y contabilizar filas por tabla y origen.",
                "Inventario de datos y manifest de conteos.",
            ),
            (
                "2. Proteger los datos personales y separar los registros generados para la práctica.",
                "Usar una copia anonimizada; verificar la marca de procedencia y la tabla de procedencia.",
                "Dataset de análisis sin credenciales ni datos de contacto identificables.",
            ),
            (
                "3. Detectar problemas de calidad que afecten la interpretación.",
                "Comprobar fechas, estados, duplicados, relaciones, edades y marcas de tiempo.",
                "Lista de limitaciones reproducible en el notebook.",
            ),
            (
                "4. Describir la distribución de citas, tratamientos e inventario.",
                "Agrupar por mes, día, estado, categoría y movimiento; producir gráficos etiquetados.",
                "Notebook EDA y figuras con procedencia documentada.",
            ),
            (
                "5. Entrenar y evaluar un prototipo de clasificación de ausentismo.",
                "Comparar Regresión Logística y Random Forest en una partición temporal; revisar métricas por clase.",
                "Métricas, matriz de confusión, formulario demostrativo y límites explícitos.",
            ),
        ],
        "Tabla 5. Objetivos, actividades y resultados esperados",
        "elaboración propia",
    )

    doc.add_heading("1.6 Propuesta de solución", level=2)
    add_body(
        doc,
        "Se propone un flujo reproducible de análisis exploratorio y una prueba de clasificación, "
        "no un nuevo sistema clínico. La entrada es la copia anonimizada SQLite y sus exportaciones "
        "CSV. El notebook documenta la limpieza, procedencia, gráficos, preparación de variables, "
        "entrenamiento y evaluación. El clasificador usa solo citas generadas para la práctica con "
        "estado final Atendida o Ausente; excluye Cancelada y no mezcla las 51 filas fuente, cuyos "
        "estados no son equivalentes."
    )
    add_body(
        doc,
        "La parte descriptiva resume citas por periodo y estado, categorías de tratamiento y "
        "movimientos de inventario. Para la prueba supervisada, la variable objetivo es binaria: "
        "Atendida (0) o Ausente (1). Se comparan Regresión Logística y Random Forest con una "
        "partición temporal; el notebook incluye un formulario que recibe información de una cita "
        "y muestra una estimación y sus probabilidades. El formulario es demostrativo y no se "
        "conecta con la aplicación ni con la base de producción."
    )
    add_table(
        doc,
        ["Módulo del análisis", "Qué hará", "Usuario principal"],
        [
            ("Preparación y anonimización", "Leer copia local, excluir campos sensibles y documentar origen.", "Estudiante / responsable de datos"),
            ("Calidad de datos", "Revisar fechas, estados, campos vacíos, relaciones y consistencia.", "Estudiante"),
            ("EDA de citas", "Resumir citas por mes, día, estado y procedencia.", "Odontólogo y ayudante, como lectores de resultados"),
            ("EDA de tratamientos", "Contar servicios vinculados y describir categorías sin inferir demanda real.", "Odontólogo"),
            ("EDA de inventario", "Resumir entradas, salidas y ajustes, separando los datos generados.", "Odontólogo y ayudante"),
            ("Clasificación supervisada", "Comparar Regresión Logística y Random Forest para estimar Atendida/Ausente.", "Estudiante / docente"),
            ("Formulario de prueba", "Ingresar datos de una cita y mostrar clase estimada y probabilidades.", "Estudiante / lector del notebook"),
            ("Reporte reproducible", "Guardar gráficos, conclusiones, limitaciones y pasos para repetir análisis.", "Estudiante / docente"),
        ],
        "Tabla 6. Componentes de la solución propuesta",
        "elaboración propia",
    )
    add_figure(
        doc,
        figures[1],
        "Figura 2. Estados de las citas generadas para la práctica",
        "base de análisis; distribución del ejercicio, no tasa real de asistencia",
        width=5.1,
    )
    add_body(
        doc,
        f"En los registros generados para la práctica hay {metrics['synthetic_status_counts'].get('Atendida', 0)} citas atendidas, "
        f"{metrics['synthetic_status_counts'].get('Ausente', 0)} ausencias y "
        f"{metrics['synthetic_status_counts'].get('Cancelada', 0)} cancelaciones. Estos estados se presentan separados de los de la base fuente. El promedio combinado del periodo "
        f"es {metrics['analysis_average']:.2f} citas por día abierto "
        f"({metrics['analysis_count']} citas en {metrics['analysis_open_days']} días de lunes a "
        "sábado); incluye filas generadas y no constituye una medición real de la demanda del "
        "consultorio."
    )
    model_results = metrics["model_results"]
    add_body(
        doc,
        f"Para la clasificación se conservaron {metrics['labeled_appointment_count']} citas "
        f"Atendida/Ausente y se excluyeron las canceladas. La división temporal utilizó "
        f"{metrics['train_count']} observaciones para entrenamiento y {metrics['test_count']} para "
        f"prueba ({metrics['test_attended_count']} atendidas y {metrics['test_absent_count']} "
        "ausentes). Las variables incluyen calendario, hora, tratamiento, datos demográficos "
        "disponibles y conteos de historial anterior a cada cita."
    )
    add_table(
        doc,
        ["Modelo", "Accuracy", "Precision (ausente)", "Recall (ausente)", "F1 (ausente)", "ROC-AUC"],
        [
            (
                "Regresión Logística",
                f"{model_results['regresion_logistica']['accuracy']:.1%}",
                f"{model_results['regresion_logistica']['precision']:.1%}",
                f"{model_results['regresion_logistica']['recall']:.1%}",
                f"{model_results['regresion_logistica']['f1']:.1%}",
                f"{model_results['regresion_logistica']['roc_auc']:.3f}",
            ),
            (
                "Random Forest",
                f"{model_results['random_forest']['accuracy']:.1%}",
                f"{model_results['random_forest']['precision']:.1%}",
                f"{model_results['random_forest']['recall']:.1%}",
                f"{model_results['random_forest']['f1']:.1%}",
                f"{model_results['random_forest']['roc_auc']:.3f}",
            ),
        ],
        "Tabla 7. Métricas en el conjunto temporal de prueba",
        "elaboración propia a partir de las métricas generadas por scikit-learn",
    )
    add_body(
        doc,
        f"En la prueba, la Regresión Logística detectó "
        f"{int(model_results['regresion_logistica']['recall'] * metrics['test_absent_count'])} de "
        f"{metrics['test_absent_count']} ausencias (recall "
        f"{model_results['regresion_logistica']['recall']:.0%}). Random Forest no detectó ausencias "
        f"(recall {model_results['random_forest']['recall']:.0%}); su accuracy de "
        f"{model_results['random_forest']['accuracy']:.1%} se debe interpretar con cautela porque "
        "la clase Atendida es mayoritaria. El rendimiento observado no justifica uso operativo."
    )
    logistic_matrix = model_results["regresion_logistica"]["confusion_matrix"]
    forest_matrix = model_results["random_forest"]["confusion_matrix"]
    add_body(
        doc,
        "Las matrices de confusión (filas = clase real; columnas = clase predicha; orden "
        f"Atendida/Ausente) fueron: Regresión Logística {logistic_matrix} y Random Forest "
        f"{forest_matrix}. La prueba temporal es pequeña y contiene solo "
        f"{metrics['test_absent_count']} ausencias."
    )

    doc.add_heading("1.7 Alcance y limitaciones", level=2)
    doc.add_heading("1.7.1 Alcance", level=3)
    for item in [
        "Analizar una copia anonimizada de SQLite y exportaciones CSV/JSON del proyecto.",
        "Cubrir en la copia de análisis del 10 de agosto al 16 de noviembre de 2026: 51 citas fuente (10–22 de agosto) y 320 registros generados para la práctica (24 de agosto–16 de noviembre); el 23 de agosto fue domingo y no hubo atención.",
        "Describir estructura y calidad de citas, tratamientos, evoluciones e inventario.",
        "Entrenar y comparar dos clasificadores en las 299 citas generadas etiquetadas como Atendida o Ausente, con división temporal de 239 para entrenamiento y 60 para prueba.",
        "Incluir en el notebook un formulario interactivo de demostración; no integrarlo a la aplicación ni a la base de producción.",
    ]:
        add_bullet(doc, item)
    doc.add_heading("1.7.2 Limitaciones", level=3)
    for item in [
        "No se dispone de registros operativos reales posteriores al 22 de agosto; los registros generados para la práctica no reemplazan observaciones.",
        f"El promedio combinado del periodo es {metrics['analysis_average']:.2f} citas por día abierto ({metrics['analysis_count']}/{metrics['analysis_open_days']}); incluye registros generados y no representa una tasa real del consultorio.",
        "La edad y la fecha de nacimiento de pacientes de la fuente presentan discrepancias; la prueba predictiva se realiza con registros generados y no permite inferir efectos demográficos reales.",
        "El campo created_at de las 51 citas fuente aparece posterior a la fecha y hora de atención y no permite calcular anticipación de reserva.",
        "Los estados históricos incluyen filas vencidas que siguen como Programada o En Espera; no se usan como etiquetas de asistencia sin validación.",
        "El clasificador no detectó ausencias suficientes en la prueba; las métricas provienen de datos generados y no demuestran desempeño en pacientes reales.",
        "Los consumos, compras y saldos generados no son base para decisiones de inventario o clínicas.",
        "La copia está anonimizada, los usuarios no pueden iniciar sesión con ella y no sustituye el respaldo original.",
    ]:
        add_bullet(doc, item)
    add_body(
        doc,
        "El prototipo no realiza diagnóstico, no recomienda tratamientos, no envía recordatorios y "
        "no modifica la base de producción. Antes de cualquier uso real se necesitan registros "
        "autorizados y suficientes, estados definidos de forma consistente, fechas confiables de "
        "reserva y evaluación temporal satisfactoria con casos reales."
    )
    add_figure(
        doc,
        figures[2],
        "Figura 3. Movimientos de inventario incluidos para la práctica",
        "base de análisis; cantidades artificiales que no representan compras ni consumo real",
        width=5.1,
    )

    doc.add_heading("1.8 Metodología y cronograma", level=2)
    add_body(
        doc,
        "Se adopta CRISP-DM de forma adaptada: comprensión del problema y los datos, preparación, "
        "modelado, evaluación e informe. Se inspeccionan esquema y procedencia, se anonimiza la "
        "copia y se revisan estados y variables. El EDA resume distribuciones; para el modelado se "
        "define la etiqueta binaria Atendida/Ausente, se excluyen cancelaciones y se comparan "
        "Regresión Logística y Random Forest. Los registros se ordenan temporalmente y se separan "
        f"en {metrics['train_count']} casos de entrenamiento y {metrics['test_count']} de prueba. Se reportan accuracy, precision, recall, "
        "F1, ROC-AUC y matriz de confusión, con atención especial a recall de ausencias por el "
        "desbalance de clases (Chapman et al., 2000; scikit-learn developers, s. f.)."
    )
    add_body(
        doc,
        "La práctica de EDA de maíz guía la limpieza, las preguntas descriptivas y las conclusiones "
        "cautelosas. Las prácticas de clasificación binaria guían la preparación de variables y las "
        "métricas. El formulario del notebook permite probar entradas manuales con el modelo "
        "entrenado; su salida es solo demostrativa porque los datos etiquetados fueron generados "
        "para la práctica."
    )
    add_table(
        doc,
        ["#", "Actividad", "Inicio", "Fin"],
        [
            ("1", "Confirmación institucional, objetivo y acceso autorizado", "16/11/2026", "18/11/2026"),
            ("2", "Inventario de tablas, anonimización y control de procedencia", "19/11/2026", "21/11/2026"),
            ("3", "Limpieza, validaciones y análisis exploratorio", "22/11/2026", "26/11/2026"),
            ("4", "EDA, entrenamiento y comparación de modelos", "27/11/2026", "30/11/2026"),
            ("5", "Evaluación, formulario demostrativo y revisión de limitaciones", "01/12/2026", "03/12/2026"),
            ("6", "Presentación del informe y recomendaciones", "04/12/2026", "04/12/2026"),
        ],
        "Tabla 8. Cronograma propuesto",
        "elaboración propia; fechas sujetas al calendario académico",
    )
    add_body(
        doc,
        "La entrevista o visita se registra con fecha 16 de noviembre de 2026, según lo indicado "
        "por el estudiante. La cantidad de trabajadores y la dirección también se consignan con "
        "base en la información proporcionada; los años de funcionamiento, teléfonos y correos "
        "quedan pendientes porque no se dispone de evidencia verificable."
    )

    doc.add_heading("REFERENCIAS BIBLIOGRÁFICAS", level=1)
    references = [
        "Arauz Fernández, J. (2026). Práctica 7: Análisis exploratorio de datos (EDA), predicción del rendimiento del maíz a partir de variables climáticas [Notebook de curso no publicado]. Taller II, Universidad Autónoma Juan Misael Saracho.",
        "Chapman, P., Clinton, J., Kerber, R., Khabaza, T., Reinartz, T., Shearer, C., & Wirth, R. (2000). CRISP-DM 1.0: Step-by-step data mining guide. SPSS Inc. https://www.the-modeling-agency.com/crisp-dm.pdf",
        "Dentrix. (s. f.). Dental practice management software. Recuperado el 18 de noviembre de 2026, de https://www.dentrix.com/",
        "Martínez Solano, W. P. (2026). Sistema de gestión de agenda y ficha clínica odontológica [Informe de proyecto no publicado]. Universidad Autónoma Juan Misael Saracho.",
        "Matplotlib Development Team. (s. f.). Matplotlib documentation. Recuperado el 18 de noviembre de 2026, de https://matplotlib.org/stable/users/index.html",
        "Open Dental Software. (s. f.). Features. Recuperado el 18 de noviembre de 2026, de https://www.opendental.com/site/features.html",
        "OpenEMR. (s. f.). OpenEMR: Open-source electronic health records and medical practice management. Recuperado el 18 de noviembre de 2026, de https://www.open-emr.org/",
        "scikit-learn developers. (s. f.). User guide: Supervised learning and model evaluation. Recuperado el 19 de noviembre de 2026, de https://scikit-learn.org/stable/user_guide.html",
        "pandas development team. (s. f.). User guide. Recuperado el 18 de noviembre de 2026, de https://pandas.pydata.org/docs/user_guide/index.html",
        "SQLite Consortium. (s. f.). SQLite documentation. Recuperado el 18 de noviembre de 2026, de https://www.sqlite.org/docs.html",
        "Universidad Autónoma Juan Misael Saracho. (2026). Práctico: clasificación binaria con PyTorch [Notebook de curso no publicado]. Taller II.",
    ]
    for reference in references:
        add_reference(doc, reference)

    doc.save(DOCX_PATH)
    return DOCX_PATH


def notebook_cell(cell_type, source):
    if isinstance(source, str):
        source = source.splitlines(keepends=True)
    if cell_type == "markdown":
        return {"cell_type": "markdown", "metadata": {}, "source": source}
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": source,
    }


def create_notebook():
    cells = [
        notebook_cell(
            "markdown",
            """# Análisis exploratorio de la Agenda Odontológica

**Estudiante:** Wilson Piter Martínez Solano  
**Proyecto:** Consultorio Odontológico Cristo Rey  
**Periodo del conjunto de análisis:** 10 de agosto–16 de noviembre de 2026 (371 citas)

> **Procedencia:** las 371 citas se presentan en una sola serie para todo el periodo indicado. De ellas, 51 provienen de la base fuente y 320 son sintéticas, identificadas con `es_sintetico`. Las sintéticas permiten ensayar el análisis, pero no representan actividad real ni deben usarse para afirmar tasas reales de ausentismo, consumo o demanda del consultorio.

El notebook sigue la secuencia trabajada en las prácticas de EDA: definir preguntas, limpiar y seleccionar datos, resumir distribuciones y formular conclusiones que no excedan la evidencia. No entrena un modelo predictivo.
""",
        ),
        notebook_cell(
            "markdown",
            """## 1. Carga de datos y trazabilidad

Se carga la exportación CSV anonimizada. El indicador `es_sintetico` permite separar los registros de la fuente de los agregados para el ejercicio.
""",
        ),
        notebook_cell(
            "code",
            """from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
from IPython.display import display

DATASET_NAME = "simulacion_2026-08-23_a_2026-11-16"
candidates = []
for parent in [Path.cwd(), *Path.cwd().parents]:
    candidates.append(parent / "exportacion_bd" / DATASET_NAME / "csv")
    candidates.append(parent / "Agenda odontologica" / "exportacion_bd" / DATASET_NAME / "csv")
DATA_DIR = next((p for p in candidates if (p / "appointments.csv").is_file()), None)
if DATA_DIR is None:
    raise FileNotFoundError("No se encontró el CSV. Abra el notebook desde la carpeta del proyecto.")

appointments = pd.read_csv(DATA_DIR / "appointments.csv")
transactions = pd.read_csv(DATA_DIR / "inventory_transactions.csv")
appointments["es_sintetico"] = appointments["es_sintetico"].astype(str).str.lower().eq("true")
transactions["es_sintetico"] = transactions["es_sintetico"].astype(str).str.lower().eq("true")
appointments["appointment_date"] = pd.to_datetime(appointments["appointment_date"], errors="coerce")
appointments["created_at"] = pd.to_datetime(appointments["created_at"], errors="coerce")
transactions["fecha"] = pd.to_datetime(transactions["fecha"], errors="coerce")

print("CSV:", DATA_DIR)
print("Citas:", len(appointments))
print("Fuente:", int((~appointments["es_sintetico"]).sum()))
print("Sintéticas:", int(appointments["es_sintetico"].sum()))
""",
        ),
        notebook_cell(
            "markdown",
            """## 2. Calidad y cobertura

Se revisan fechas, valores faltantes, duplicados, domingos y estados. Las validaciones detectan problemas del archivo, pero no prueban que los registros de la fuente correspondan a atenciones reales.
""",
        ),
        notebook_cell(
            "code",
            """source = appointments.loc[~appointments["es_sintetico"]].copy()
synthetic = appointments.loc[appointments["es_sintetico"]].copy()

print("Rango completo:", appointments["appointment_date"].min(), "a", appointments["appointment_date"].max())
print("Duplicados exactos:", int(appointments.duplicated().sum()))
print("Turnos duplicados por fecha/hora:", int(appointments.duplicated(["appointment_date", "appointment_time"]).sum()))
print("Citas en domingo:", int((appointments["appointment_date"].dt.dayofweek == 6).sum()))
appointment_datetime = pd.to_datetime(
    appointments["appointment_date"].dt.strftime("%Y-%m-%d") + " " + appointments["appointment_time"],
    errors="coerce",
)
late_source_timestamps = (
    (~appointments["es_sintetico"])
    & (appointments["created_at"] > appointment_datetime)
)
print("Marcas created_at posteriores a la cita en la fuente:", int(late_source_timestamps.sum()))
print("\\nEstados por procedencia:")
print(appointments.groupby(["es_sintetico", "status"]).size().unstack(fill_value=0))
print("\\nValores faltantes relevantes:")
print(appointments[["appointment_date", "appointment_time", "status", "patient_id"]].isna().sum())
""",
        ),
        notebook_cell(
            "markdown",
            """## 3. Pregunta: ¿cuántas citas hubo por mes en la serie completa?

Se suman las citas de la base de análisis en una sola serie mensual. Como parte de los registros es sintética, estos totales describen el conjunto de análisis y no la demanda histórica real.
""",
        ),
        notebook_cell(
            "code",
            """appointments["month"] = appointments["appointment_date"].dt.to_period("M").astype(str)
monthly = appointments.groupby("month").size()
display(monthly.to_frame("Citas totales"))

ax = monthly.plot(kind="bar", figsize=(9, 4), color="#4278a8")
ax.set_title("Citas totales por mes (incluye extensión sintética)")
ax.set_xlabel("Mes de 2026")
ax.set_ylabel("Número de filas")
ax.grid(axis="y", alpha=0.2)
plt.tight_layout()
plt.show()
""",
        ),
        notebook_cell(
            "markdown",
            """## 4. Pregunta: ¿qué estados aparecen en las citas simuladas?

Los estados de las citas de la fuente (`Completada`, `En Espera`, `Programada`) no se deben mezclar sin normalización con los simulados (`Atendida`, `Ausente`, `Cancelada`). La distribución siguiente solo describe la generación artificial.
""",
        ),
        notebook_cell(
            "code",
            """status_counts = synthetic["status"].value_counts().reindex(
    ["Atendida", "Ausente", "Cancelada"], fill_value=0
)
display(status_counts.to_frame("citas simuladas"))
ax = status_counts.plot(kind="bar", figsize=(7, 4), color=["#4c956c", "#d9675b", "#9aa5b1"])
ax.set_title("Estados asignados a las citas sintéticas")
ax.set_xlabel("Estado")
ax.set_ylabel("Número de filas")
ax.tick_params(axis="x", rotation=0)
ax.grid(axis="y", alpha=0.2)
plt.tight_layout()
plt.show()
""",
        ),
        notebook_cell(
            "markdown",
            """## 5. Pregunta: ¿qué categorías de tratamiento y movimientos de inventario se registran?

El catálogo contiene tratamientos existentes, pero las citas simuladas se asignaron artificialmente. De igual modo, las entradas, salidas y ajustes simulados no equivalen a compras o consumo observados.
""",
        ),
        notebook_cell(
            "code",
            """links = pd.read_csv(DATA_DIR / "appointment_treatments.csv")
treatments = pd.read_csv(DATA_DIR / "treatments.csv")
links["es_sintetico"] = links["es_sintetico"].astype(str).str.lower().eq("true")
synthetic_links = links.loc[links["es_sintetico"]]
category_counts = (
    synthetic_links.merge(treatments[["id", "categoria"]], left_on="treatment_id", right_on="id")
    .groupby("categoria").size().sort_values(ascending=False)
)
display(category_counts.to_frame("asociaciones simuladas"))

synthetic_transactions = transactions.loc[transactions["es_sintetico"]]
movement_counts = synthetic_transactions["tipo"].value_counts().reindex(
    ["ENTRADA", "SALIDA", "AJUSTE"], fill_value=0
)
display(movement_counts.to_frame("movimientos simulados"))
ax = movement_counts.plot(kind="bar", figsize=(7, 4), color="#648caa")
ax.set_title("Movimientos de inventario simulados")
ax.set_xlabel("Tipo")
ax.set_ylabel("Número de registros")
ax.tick_params(axis="x", rotation=0)
ax.grid(axis="y", alpha=0.2)
plt.tight_layout()
plt.show()
""",
        ),
        notebook_cell(
            "markdown",
            """## 6. Resumen del periodo completo

Se suman las citas de todo el conjunto, desde el inicio de los registros disponibles hasta el 16 de noviembre. El promedio combinado usa los días de lunes a sábado; incluye citas sintéticas y describe la copia de análisis, no la actividad real del consultorio.
""",
        ),
        notebook_cell(
            "code",
            """period_start = appointments["appointment_date"].min().normalize()
period_end = appointments["appointment_date"].max().normalize()
open_days = pd.date_range(period_start, period_end, freq="D")
open_days = open_days[open_days.dayofweek != 6]
combined_average = len(appointments) / len(open_days)
print("Periodo completo:", period_start.date(), "a", period_end.date())
print("Citas totales del conjunto:", len(appointments))
print("Días abiertos considerados (lunes a sábado):", len(open_days))
print("Promedio combinado por día abierto:", round(combined_average, 2))
print("Este promedio incluye citas sintéticas; no es una tasa real del consultorio.")
source_days = pd.date_range(source["appointment_date"].min(), source["appointment_date"].max(), freq="D")
source_days = source_days[source_days.dayofweek != 6]
print("Citas registradas en la fuente por día abierto:", round(len(source) / len(source_days), 2))
""",
        ),
        notebook_cell(
            "markdown",
            """## 7. Conclusiones y límites

1. La copia de análisis reúne 371 citas del 10 de agosto al 16 de noviembre; su promedio combinado incluye citas sintéticas, por lo que no representa la demanda real. Solo las 51 filas con `es_sintetico=False` provienen de la base original y su veracidad operativa tampoco fue verificada independientemente.
2. Las 320 citas añadidas, las ausencias y los movimientos de inventario son datos artificiales. No permiten estimar demanda real, ausentismo, gasto ni eficacia de un modelo.
3. La fuente presenta estados históricos pendientes y marcas `created_at` posteriores a la cita; esas variables requieren validación antes de cualquier modelo.
4. No se debe entrenar un clasificador de inasistencia con este conjunto como si las etiquetas fueran reales. La siguiente etapa válida es recopilar registros autorizados, con definiciones consistentes y fechas fiables.
""",
        ),
    ]
    notebook = {
        "cells": cells,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {"name": "python", "version": "3.10"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    NOTEBOOK_PATH.write_text(
        json.dumps(notebook, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main():
    if not DB_PATH.exists():
        raise FileNotFoundError(f"No se encontró la base de análisis: {DB_PATH}")
    metrics = load_data()
    figures = make_figures(metrics)
    create_document(metrics, figures)
    print(f"DOCX: {DOCX_PATH}")
    print(f"Fuente: {metrics['source_count']} citas ({metrics['source_first']} a {metrics['source_last']})")
    print(f"Promedio en periodo fuente: {metrics['source_average']:.2f} citas/día abierto")
    print(
        f"Periodo combinado: {metrics['analysis_count']} citas, "
        f"{metrics['analysis_open_days']} días abiertos, "
        f"promedio {metrics['analysis_average']:.2f}/día"
    )
    print(f"Sintéticas: {metrics['synthetic_count']} citas")
    print(f"Edad fuente inconsistente: {metrics['age_mismatches']} registros")
    print(f"created_at posterior a cita: {metrics['late_created_at']} registros")


if __name__ == "__main__":
    main()
