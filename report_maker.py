import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from models import db, Project, AIModel, Criterion, Score
import tempfile

from models import db, Project, AIModel, Criterion, Score
template_dir = os.path.dirname(__file__)
env = Environment(loader=FileSystemLoader(template_dir))
template = env.get_template("report_template.html")



def get_results(project_id):
    p = Project.query.get_or_404(project_id)
    results = p.prev_result
    return results

def get_criteria_analysis(model_id):
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

def generate_report(project_id, output_pdf_path):
    # res - словарь вида {model_name: [s_k, k_k, model_id]}
    res = get_results(project_id)
    if not res:
        raise ValueError("Нет данных для отчёта")

    sorted_items = sorted(res.items(), key=lambda x: x[1][0], reverse=True)

    best_model_name, best_model_data = sorted_items[0]
    best_model_score = best_model_data[0]  # s_k
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

    total_criteria_count = len(criteria["high"]) + len(criteria["mid"]) + len(criteria["low"])

    html_out = template.render(
        generation_date=datetime.now().strftime("%d.%m.%Y %H:%M"),
        best_model_name=best_model_name,
        best_model_score=best_model_score,
        best_model_performance=interpret_score(best_model_score),
        ranking=ranking,
        total_criteria_count=total_criteria_count,
        high_criteria=criteria["high"],
        mid_criteria=criteria["mid"],
        low_criteria=criteria["low"],
        groups=groups,
    )


    HTML(string=html_out, base_url=os.path.dirname(__file__)).write_pdf(output_pdf_path)
    print(f"PDF сохранён: {output_pdf_path}")

def interpret_score(ratio):
    if ratio >= 0.9: return "отлично"
    if ratio >= 0.7: return "хорошо"
    if ratio >= 0.5: return "удовлетворительно"
    if ratio >= 0.3: return "плохо"
    return "Ужасно"