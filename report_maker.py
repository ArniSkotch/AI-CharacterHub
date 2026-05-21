import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
import matplotlib.pyplot as plt   # если понадобятся графики – можно вставить
import pandas as pd
from models import db, Project, AIModel, Criterion, Score

from models import db, Project, AIModel, Criterion, Score
# ---------- 1. ЗАГРУЗКА ШАБЛОНА ----------
template_dir = os.path.dirname(__file__)
env = Environment(loader=FileSystemLoader(template_dir))
template = env.get_template("report_template.html")

# ---------- 2. ФУНКЦИИ ПОЛУЧЕНИЯ ДАННЫХ (вместо БД) ----------
# Здесь вы будете подключаться к своей базе и формировать структуры.
# Ниже примеры-заглушки – замените на реальные запросы.

def get_results(project_id):
    p = Project.query.get_or_404(project_id)
    results = p.prev_result
    return results

def get_criteria_analysis(model_id):
    """
    Возвращает три списка: high, mid, low (названия критериев с оценками 4-5, 2.5-4, 1-2.5)
    """
    m = AIModel.query.get_or_404(model_id)
    s = m.scores
    overall_res = {
        "high": [],
        "mid": [],
        "low": []
    }
    for i in s:
        c = Criterion.query.get_or_404(i.criterion_id)
        c = c.name
        if i.value >= 4:
            overall_res["high"].append(c.name + " (" + i.value + ")")
        elif i.value >=2.5:
            overall_res['mid'].append(c.name + " (" + i.value + ")")
        else:
            overall_res['low'].append(c.name + " (" + i.value + ")")

    return overall_res

def get_groups_analysis(model_id):
    """
    Возвращает список групп с их средними баллами и общей оценкой
    """
    groups_data = {"Точность": 4.2, "Устойчивость": 3.8, "Контекст": 4.5}
    groups = []
    m = AIModel.query.get_or_404(model_id)
    for i in m.scores:
        criterion = Criterion.query.get_or_404(i.criterion_id)
        group = criterion.group
        if not group in groups:
            groups.append({group : [i.value, 1, ""]})
        else:
            groups.group[0] +=i.value
            groups.group[1] +=1

    for i in groups:
        i[0]=round(i[0]/i[1],2)
        s = i[0]
        if s>=4.5:
            i[2] = "Отлично"
        elif s>=3.5:
            i[2] = "Хорошо"
        elif s>=2.5:
            i[2] = "Удовлетворительно"
        elif s>=1.5:
            i[2] = "Плохо"
        else:
            i[2] = 'Непригодно'

    return groups

# def get_candidates(project_id):
#     """
#     Возвращает список моделей-кандидатов.
#     """
#     return [
#         {"name": "LLaMA-2", "better_criteria": ["Логичность", "Обработка сложных запросов"]}
#     ]
#
# def get_sensitivity_v(project_id):
#     """
#     Рассчитывает коэффициент чувствительности v (0..1).
#     Заглушка – реализуйте по вашей формуле.
#     """
#     return 0.6

# ---------- 3. ОСНОВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ ОТЧЁТА ----------
def generate_report(project_id, output_pdf_path):
    # Получаем все необходимые данные
    res = get_results(project_id)
    best_model = res[0]
    best_model["performance_text"] = interpret_score(best_model[1])  # определим ниже

    criteria = get_criteria_analysis(project_id)
    groups = get_groups_analysis(project_id)
    # candidates = get_candidates(project_id)
    # sensitivity_v = get_sensitivity_v(project_id)

    total_criteria_count = len(criteria["high"]) + len(criteria["mid"]) + len(criteria["low"])

    # Рендерим HTML
    html_out = template.render(
        generation_date=datetime.now().strftime("%d.%m.%Y %H:%M"),
        best_model=best_model,
        ranking=res,
        total_criteria_count=total_criteria_count,
        high_criteria=criteria["high"],
        mid_criteria=criteria["mid"],
        low_criteria=criteria["low"],
        groups=groups,
        # candidates=candidates,
        # sensitivity_v=sensitivity_v
    )

    # Генерируем PDF
    HTML(string=html_out, base_url=os.path.dirname(__file__)).write_pdf(output_pdf_path)
    print(f"PDF сохранён: {output_pdf_path}")

def interpret_score(ratio):
    if ratio >= 0.9: return "отлично"
    if ratio >= 0.7: return "хорошо"
    if ratio >= 0.5: return "удовлетворительно"
    if ratio >= 0.3: return "плохо"
    return "Ужасно"

# ---------- 4. ЗАПУСК (пример) ----------
if __name__ == "__main__":
    # Укажите ID проекта и путь, куда сохранить PDF
    generate_report(project_id=123, output_pdf_path="report.pdf")