# report_maker.py
import os
import json
import traceback
from datetime import datetime
from fpdf import FPDF
from models import db, Project, AIModel, Criterion, Score

FONT_NAME = "DejaVuSans.ttf"

def get_results(project_id):
    p = Project.query.get_or_404(project_id)
    raw = p.prev_result
    if not raw:
        return {}
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, list):
        return {}
    res_dict = {}
    for item in raw:
        if isinstance(item, dict):
            for name, data in item.items():
                res_dict[name] = data
    return res_dict

def get_criteria_analysis(model_id):
    m = AIModel.query.get_or_404(model_id)
    overall = {"high": [], "mid": [], "low": []}
    for score in m.scores:
        crit = score.criterion
        crit_name = crit.name
        val = score.value
        text = f"{crit_name} ({val})"
        if val >= 4:
            overall["high"].append(text)
        elif val >= 2.5:
            overall["mid"].append(text)
        else:
            overall["low"].append(text)
    return overall

def get_groups_analysis(model_id):
    m = AIModel.query.get_or_404(model_id)
    groups_dict = {}
    for score in m.scores:
        group = score.criterion.group
        if group not in groups_dict:
            groups_dict[group] = {"sum": 0, "count": 0}
        groups_dict[group]["sum"] += score.value
        groups_dict[group]["count"] += 1
    groups = []
    for name, data in groups_dict.items():
        avg = data["sum"] / data["count"]
        if avg >= 4.5:
            level = "Отлично"
        elif avg >= 3.5:
            level = "Хорошо"
        elif avg >= 2.5:
            level = "Удовлетворительно"
        elif avg >= 1.5:
            level = "Плохо"
        else:
            level = "Непригодно"
        groups.append({
            "name": name,
            "avg_score": avg,
            "level_text": level
        })
    return groups

def interpret_score(ratio):
    if ratio >= 0.9: return "отлично"
    if ratio >= 0.7: return "хорошо"
    if ratio >= 0.5: return "удовлетворительно"
    if ratio >= 0.3: return "плохо"
    return "ужасно"

class PDF(FPDF):
    def __init__(self, font_file):
        super().__init__()
        self.font_file = font_file
        self.font_name = "CustomFont"
        self.set_margins(20, 20, 20)
        if os.path.exists(self.font_file):
            self.add_font(self.font_name, '', self.font_file, uni=True)
            self.set_font(self.font_name, '', 10)
        else:
            print(f"Предупреждение: шрифт {self.font_file} не найден, использую helvetica")
            self.set_font('helvetica', '', 10)

    def header(self):
        logo_path = os.path.join(os.path.dirname(__file__), "logo.png")
        if os.path.exists(logo_path):
            self.image(logo_path, x=self.w - 40, y=8, w=30)
        self.set_font(self.font_name, '', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, "Отчёт по проекту", 0, 0, 'R')
        self.ln(15)

    def footer(self):
        self.set_y(-15)
        self.set_font(self.font_name, '', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Страница {self.page_no()}', 0, 0, 'C')

def generate_report(project_id, output_pdf_path):
    print(f"=== Генерация отчёта для проекта {project_id} ===")
    try:
        res = get_results(project_id)
        if not res:
            raise ValueError("Нет данных для отчёта")

        sorted_items = sorted(res.items(), key=lambda x: x[1][0], reverse=True)
        if not sorted_items:
            raise ValueError("Нет отсортированных элементов")

        best_model_name, best_model_data = sorted_items[0]
        best_model_score = best_model_data[0]
        best_model_id = best_model_data[2]

        ranking = []
        for name, data in sorted_items:
            ranking.append({
                "name": name,
                "s_k": data[0],
                "k_k": data[1],
                "model_id": data[2]
            })

        criteria = get_criteria_analysis(best_model_id)
        groups = get_groups_analysis(best_model_id)
        total_criteria_count = (len(criteria["high"]) + len(criteria["mid"]) + len(criteria["low"]))

        font_path = os.path.join(os.path.dirname(__file__), FONT_NAME)
        pdf = PDF(font_path)
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=25)

        pdf.set_font(pdf.font_name, '', 20)
        pdf.set_text_color(15, 59, 92)
        pdf.cell(0, 12, "Аналитический отчёт по проекту", ln=1, align='C')
        pdf.set_font(pdf.font_name, '', 10)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 6, f"Дата генерации: {datetime.now().strftime('%d.%m.%Y %H:%M')}", ln=1, align='C')
        pdf.ln(10)

        pdf.set_font(pdf.font_name, '', 14)
        pdf.set_text_color(44, 62, 80)
        pdf.cell(0, 8, "🏆 Лидер рейтинга", ln=1)
        pdf.set_font(pdf.font_name, '', 11)
        pdf.set_text_color(0, 0, 0)
        pdf.multi_cell(0, 6, f"По итогам оценки, модель {best_model_name} занимает первое место в рейтинге данного проекта.\nСогласно подсчётам взвешенных результатов, модель проявила себя {interpret_score(best_model_score)} (оценка {best_model_score:.2f}).")
        pdf.ln(6)

        pdf.set_font(pdf.font_name, '', 14)
        pdf.set_text_color(44, 62, 80)
        pdf.cell(0, 8, "📊 Рейтинг всех моделей", ln=1)
        pdf.ln(4)

        col_widths = [20, 60, 35, 30, 25]
        pdf.set_font(pdf.font_name, '', 9)
        headers = ["Место", "Название модели", "s_k", "k_k", "ID"]
        for i, h in enumerate(headers):
            pdf.cell(col_widths[i], 8, h, border=1, align='C')
        pdf.ln(8)

        for idx, model in enumerate(ranking, start=1):
            if idx == 1:
                pdf.set_fill_color(255, 215, 0)
            elif idx == 2:
                pdf.set_fill_color(192, 192, 192)
            elif idx == 3:
                pdf.set_fill_color(205, 127, 50)
            else:
                pdf.set_fill_color(255, 255, 255)

            model_name = model.get("name", "")
            if len(model_name) > 20:
                model_name = model_name[:18] + ".."
            pdf.cell(col_widths[0], 7, str(idx), border=1, align='C', fill=True)
            pdf.cell(col_widths[1], 7, model_name, border=1, fill=True)
            pdf.cell(col_widths[2], 7, f"{model.get('s_k', 0):.2f}", border=1, align='R', fill=True)
            pdf.cell(col_widths[3], 7, f"{model.get('k_k', 0):.2f}", border=1, align='R', fill=True)
            pdf.cell(col_widths[4], 7, str(model.get("model_id", "")), border=1, align='C', fill=True)
            pdf.ln(7)
        pdf.ln(8)
        pdf.set_x(pdf.l_margin)

        pdf.set_font(pdf.font_name, '', 14)
        pdf.set_text_color(44, 62, 80)
        pdf.cell(0, 8, f"📌 Анализ критериев (модель {best_model_name})", ln=1)
        pdf.set_font(pdf.font_name, '', 10)
        pdf.set_text_color(0, 0, 0)
        pdf.multi_cell(0, 5, f"Среди {total_criteria_count} критериев, влияющих на оценку, стоит отметить:")
        pdf.ln(2)
        pdf.set_x(pdf.l_margin)

        if criteria.get("high"):
            text = "• Высокие показатели (4–5): " + ", ".join(criteria["high"])
            pdf.multi_cell(0, 5, text)
            pdf.set_x(pdf.l_margin)
        if criteria.get("mid"):
            text = "• Средние показатели (2.5–4): " + ", ".join(criteria["mid"])
            pdf.multi_cell(0, 5, text)
            pdf.set_x(pdf.l_margin)
        if criteria.get("low"):
            text = "• Низкие показатели (1–2.5): " + ", ".join(criteria["low"])
            pdf.multi_cell(0, 5, text)
            pdf.set_x(pdf.l_margin)
        pdf.ln(6)

        pdf.set_font(pdf.font_name, '', 14)
        pdf.set_text_color(44, 62, 80)
        pdf.cell(0, 8, "🎯 Оценка групп критериев", ln=1)
        pdf.ln(4)
        pdf.set_x(pdf.l_margin)

        col_groups = [60, 50, 60]
        pdf.set_font(pdf.font_name, '', 10)
        pdf.cell(col_groups[0], 8, "Группа", border=1, align='C')
        pdf.cell(col_groups[1], 8, "Средний балл", border=1, align='C')
        pdf.cell(col_groups[2], 8, "Уровень", border=1, align='C')
        pdf.ln(8)

        for group in groups:
            pdf.cell(col_groups[0], 7, group.get("name", ""), border=1)
            pdf.cell(col_groups[1], 7, f"{group.get('avg_score', 0):.1f}", border=1, align='R')
            pdf.cell(col_groups[2], 7, group.get("level_text", ""), border=1)
            pdf.ln(7)

        pdf.output(output_pdf_path)
        print(f"✅ PDF успешно сохранён: {output_pdf_path}")

    except Exception as e:
        print("❌ Ошибка в generate_report:")
        traceback.print_exc()
        raise