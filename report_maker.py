import os
import io
import math
from datetime import datetime

import matplotlib
matplotlib.use("Agg")  # без GUI
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

from reportlab.lib.pagesizes import A4
from reportlab.platypus import Image as RLImage
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from models import db, Project, AIModel, Criterion, Score

from reportlab.lib.fonts import addMapping
addMapping("DejaVu Sans", 0, 0, "DejaVu Sans")
addMapping("DejaVu Sans", 1, 0, "DejaVu Sans Bold")

# ── Шрифты ────────────────────────────────────────────────────────────────────
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_FONT_DIR = os.path.join(_BASE_DIR, "static", "fonts")
pdfmetrics.registerFont(TTFont("Space Mono", f"{_FONT_DIR}/SpaceMono-Regular.ttf"))
pdfmetrics.registerFont(TTFont("DejaVu Sans", f"{_FONT_DIR}/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DejaVu Sans Bold", f"{_FONT_DIR}/DejaVuSans-Bold.ttf"))

# ── Цвета ─────────────────────────────────────────────────────────────────────
C_ORANGE   = colors.HexColor("#6d28d9")
C_DARK     = colors.HexColor("#1e2a3a")
C_HEADER   = colors.HexColor("#0f3b5c")
C_LIGHT    = colors.HexColor("#f5f3ff")
C_GOLD     = colors.HexColor("#ffd700")
C_SILVER   = colors.HexColor("#c0c0c0")
C_BRONZE   = colors.HexColor("#cd7f32")
C_GRAY     = colors.HexColor("#bdc3c7")
C_MUTED    = colors.HexColor("#7f8c8d")

# ── Стили текста ──────────────────────────────────────────────────────────────
def _s(name, **kw):
    defaults = dict(fontName="DejaVu Sans", fontSize=11, leading=16, textColor=C_DARK)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)

S_TITLE   = _s("title",  fontName="DejaVu Sans Bold",   fontSize=20, textColor=C_HEADER, leading=26)
S_H2      = _s("h2",     fontName="DejaVu Sans Bold",   fontSize=14, textColor=C_HEADER, leading=20,
                          spaceBefore=14, spaceAfter=4)
S_BODY    = _s("body",   fontSize=11, leading=16)
S_SMALL   = _s("small",  fontSize=9,  leading=13, textColor=C_MUTED)
S_BOLD    = _s("bold",   fontName="DejaVu Sans Bold", fontSize=11, leading=16)
S_TABLE_H = _s("th",     fontName="DejaVu Sans", fontSize=10, textColor=colors.white, leading=14)
S_TABLE_C = _s("td",     fontSize=10, leading=14)


# ── Вспомогательные функции ───────────────────────────────────────────────────
def _hr():
    return HRFlowable(width="100%", thickness=1, color=C_ORANGE, spaceAfter=6, spaceBefore=2)


def _h2(text):
    return Paragraph(text, S_H2)


def _p(text):
    return Paragraph(text, S_BODY)


def _sp(n=6):
    return Spacer(1, n)


# ── Сбор данных ───────────────────────────────────────────────────────────────
def get_results(project_id):
    p = Project.query.get_or_404(project_id)
    data = p.prev_result
    if not data:
        return None
    result = {}
    for entry in data:
        for name, values in entry.items():
            result[name] = values
    return result


def get_criteria_analysis(model_id):
    m = AIModel.query.get_or_404(model_id)
    res = {"high": [], "mid": [], "low": []}
    for score in m.scores:
        c = Criterion.query.get_or_404(score.criterion_id)
        label = f"{c.name} ({score.value})"
        if score.value >= 4:
            res["high"].append(label)
        elif score.value >= 3:
            res["mid"].append(label)
        else:
            res["low"].append(label)
    return res


def get_groups_analysis(model_id):
    m = AIModel.query.get_or_404(model_id)
    groups_data = {}
    for score in m.scores:
        criterion = Criterion.query.get_or_404(score.criterion_id)
        g = criterion.group
        if g not in groups_data:
            groups_data[g] = {"total": 0.0, "count": 0}
        groups_data[g]["total"] += score.value
        groups_data[g]["count"] += 1

    groups = []
    for group_name, d in groups_data.items():
        avg = round(d["total"] / d["count"], 2) if d["count"] > 0 else 0.0
        if avg >= 4.5:   level = "Отлично"
        elif avg >= 3.5: level = "Хорошо"
        elif avg >= 2.5: level = "Удовлетворительно"
        elif avg >= 1.5: level = "Плохо"
        else:            level = "Непригодно"
        groups.append({"name": group_name, "avg_score": avg, "level_text": level})
    return groups


def interpret_score(ratio):
    if ratio >= 4.5: return "Отлично"
    if ratio >= 3.5: return "Хорошо"
    if ratio >= 2.5: return "Удовлетворительно"
    if ratio >= 1.5: return "Плохо"
    return "Ужасно"


# ── Функция для сбора данных анализа (используется и PDF, и JSON-эндпоинтом) ──
def collect_analysis_data(project_id, model_ids=None):
    res = get_results(project_id)
    if not res:
        return None

    sorted_items = sorted(res.items(), key=lambda x: x[1][0], reverse=True)
    best_model_name, best_model_data = sorted_items[0]
    best_model_score = best_model_data[0]
    best_model_id    = best_model_data[2]

    ranking = [
        {"name": name, "s_k": data[0], "k_k": data[1], "model_id": data[2]}
        for name, data in sorted_items
    ]

    criteria = get_criteria_analysis(best_model_id)
    groups   = get_groups_analysis(best_model_id)
    total_criteria_count = len(criteria["high"]) + len(criteria["mid"]) + len(criteria["low"])

    radar_data = _collect_radar_data(project_id, model_ids=model_ids)

    return {
        "generation_date":        datetime.now().strftime("%d.%m.%Y %H:%M"),
        "best_model_name":        best_model_name,
        "best_model_score":       best_model_score,
        "best_model_performance": interpret_score(best_model_score),
        "ranking":                ranking,
        "total_criteria_count":   total_criteria_count,
        "high_criteria":          criteria["high"],
        "mid_criteria":           criteria["mid"],
        "low_criteria":           criteria["low"],
        "groups":                 groups,
        "radar_data":             radar_data,
    }


# ── Построение PDF ────────────────────────────────────────────────────────────
# ── Данные для розы ветров ───────────────────────────────────────
def _collect_radar_data(project_id, model_ids=None):
    """Если model_ids передан — берём только эти модели в указанном порядке."""
    p = Project.query.get(project_id)
    if not p:
        return {}
    criteria_all = Criterion.query.filter_by(project_id=project_id, enabled=True).all()
    groups_ordered = []
    seen = set()
    for c in criteria_all:
        if c.group not in seen:
            seen.add(c.group)
            groups_ordered.append(c.group)
    # Получаем модели: если список ID задан — берём только их в нужном порядке
    if model_ids:
        id_to_model = {m.id: m for m in AIModel.query.filter_by(project_id=project_id).all()}
        all_models = [id_to_model[mid] for mid in model_ids if mid in id_to_model]
    else:
        all_models = AIModel.query.filter_by(project_id=project_id).all()
    result = {}
    for model in all_models:
        group_scores = {}
        for g in groups_ordered:
            crits_in_group = [c for c in criteria_all if c.group == g]
            total, weight_sum = 0.0, 0.0
            for c in crits_in_group:
                s = Score.query.filter_by(model_id=model.id, criterion_id=c.id).first()
                v = s.value if s else 0
                total      += v * c.weight
                weight_sum += c.weight
            group_scores[g] = round(total / weight_sum, 2) if weight_sum else 0.0
        result[model.name] = group_scores
    return {"groups": groups_ordered, "models": result}


def _build_radar_image(radar_data):
    """Рендерит радарную диаграмму и возвращает BytesIO с PNG."""
    groups = radar_data.get("groups", [])
    models = radar_data.get("models", {})
    if not groups or not models:
        return None
    N = len(groups)
    angles = [2 * math.pi * i / N for i in range(N)] + [0]
    palette = ["#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6"]
    fig, ax = plt.subplots(figsize=(7, 7), subplot_kw=dict(polar=True))
    fig.patch.set_facecolor("white")
    ax.set_facecolor("#f9f7ff")
    ax.set_ylim(0, 5)
    ax.set_yticks([1, 2, 3, 4, 5])
    ax.set_yticklabels(["1", "2", "3", "4", "5"], fontsize=8, color="#9ca3af")
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(groups, fontsize=9, color="#374151")
    ax.grid(color="#e5e7eb", linewidth=0.8)
    ax.spines["polar"].set_color("#e5e7eb")
    legend_patches = []
    for i, (model_name, group_scores) in enumerate(list(models.items())[:5]):
        values = [group_scores.get(g, 0) for g in groups] + [group_scores.get(groups[0], 0)]
        color  = palette[i % len(palette)]
        ax.plot(angles, values, color=color, linewidth=2)
        ax.fill(angles, values, color=color, alpha=0.15)
        legend_patches.append(mpatches.Patch(color=color, label=model_name))
    ax.legend(
        handles=legend_patches,
        loc="upper right",
        bbox_to_anchor=(1.35, 1.15),
        fontsize=9,
        frameon=True,
        framealpha=0.9,
    )
    # Сохраняем в память — никаких временных файлов и проблем с путями
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return buf


# ── Построение PDF ────────────────────────────────────────────────
def _build_story(data):
    story = []

    # Заголовок
    story.append(Paragraph("Аналитический отчёт по проекту", S_TITLE))
    story.append(_sp(4))
    story.append(Paragraph(f"Дата генерации: {data['generation_date']}", S_SMALL))
    story.append(_sp(12))
    story.append(_hr())

    # Лидер рейтинга
    story.append(_h2("Лидер рейтинга"))
    story.append(_p(
        f"По итогам оценки модель <b>{data['best_model_name']}</b> заняла первое место. "
        f"Результат: <b>{data['best_model_performance']}</b> "
        f"(взвешенная оценка {data['best_model_score']:.2f})."
    ))
    story.append(_sp(10))

    # Таблица рейтинга
    story.append(_h2("Рейтинг всех моделей"))

    header = [
        Paragraph("Место",            S_TABLE_H),
        Paragraph("Модель",           S_TABLE_H),
        Paragraph("Оценка (s_k)",     S_TABLE_H),
        Paragraph("Коэф. (k_k)",      S_TABLE_H),
    ]
    rows = [header]
    medal_colors = {1: C_GOLD, 2: C_SILVER, 3: C_BRONZE}

    for i, m in enumerate(data["ranking"], 1):
        rows.append([
            Paragraph(str(i),            S_TABLE_C),
            Paragraph(m["name"],         S_TABLE_C),
            Paragraph(f"{m['s_k']:.2f}", S_TABLE_C),
            Paragraph(f"{m['k_k']:.2f}", S_TABLE_C),
        ])

    col_w = [2*cm, 7*cm, 4*cm, 4*cm]
    tbl = Table(rows, colWidths=col_w, repeatRows=1)

    ts = TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), C_ORANGE),
        ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT]),
        ("GRID",        (0, 0), (-1, -1), 0.5, C_GRAY),
        ("TOPPADDING",  (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0,0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ])
    for i, _ in enumerate(data["ranking"], 1):
        if i in medal_colors:
            ts.add("BACKGROUND", (0, i), (-1, i), medal_colors[i])
    tbl.setStyle(ts)

    story.append(tbl)
    story.append(_sp(10))

    # Анализ критериев
    story.append(_h2(f"Анализ критериев — {data['best_model_name']}"))
    story.append(_p(
        f"Из <b>{data['total_criteria_count']}</b> критериев:"
    ))

    def _bullet_list(items, color_hex, label):
        if not items:
            return
        story.append(_sp(4))
        story.append(Paragraph(f"<b>{label}:</b>", S_BOLD))
        for item in items:
            story.append(Paragraph(f"• {item}", S_BODY))

    _bullet_list(data["high_criteria"], "#27ae60", "Высокие показатели (4–5)")
    _bullet_list(data["mid_criteria"],  "#f39c12", "Средние показатели (3)")
    _bullet_list(data["low_criteria"],  "#e74c3c", "Низкие показатели (1–2)")

    story.append(_sp(10))

    # Группы критериев
    story.append(_h2(f"Оценка групп критериев — {data['best_model_name']}"))

    g_header = [
        Paragraph("Группа",       S_TABLE_H),
        Paragraph("Средний балл", S_TABLE_H),
        Paragraph("Уровень",      S_TABLE_H),
    ]
    g_rows = [g_header]
    for g in data["groups"]:
        g_rows.append([
            Paragraph(g["name"],             S_TABLE_C),
            Paragraph(f"{g['avg_score']:.1f}", S_TABLE_C),
            Paragraph(g["level_text"],       S_TABLE_C),
        ])

    g_col_w = [6*cm, 5*cm, 6*cm]
    g_tbl = Table(g_rows, colWidths=g_col_w, repeatRows=1)
    g_tbl.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), C_ORANGE),
        ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT]),
        ("GRID",        (0, 0), (-1, -1), 0.5, C_GRAY),
        ("TOPPADDING",  (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0,0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(g_tbl)
    story.append(_sp(16))

    # Роза ветров
    radar_data = data.get("radar_data", {})
    if radar_data.get("groups") and radar_data.get("models"):
        story.append(_h2("Сравнение моделей (роза ветров)"))
        radar_buf = _build_radar_image(radar_data)
        if radar_buf:
            img = RLImage(radar_buf, width=14*cm, height=14*cm)
            story.append(img)
        story.append(_sp(16))

    # Подвал
    story.append(_hr())
    story.append(Paragraph("Отчёт сгенерирован автоматически.", S_SMALL))

    return story


def generate_report(project_id, output_pdf_path, model_ids=None):
    data = collect_analysis_data(project_id, model_ids=model_ids)
    if not data:
        raise ValueError("Нет данных для отчёта. Сначала выполните расчёт результатов.")

    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm,  bottomMargin=2.5*cm,
        title="Аналитический отчёт",
        author="AI CharacterHub",
    )

    story = _build_story(data)
    doc.build(story)
    print(f"PDF сохранён: {output_pdf_path}")