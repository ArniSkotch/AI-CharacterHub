import json
import os

from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash, send_file, abort, after_this_request
from models import db, Project, AIModel, Criterion, Score
from calculator import calculate_scores
from report_maker import generate_report
import datetime
import tempfile

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///eval.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = '93a0494cded2a1647660d68f88b6a07c9acde607d49e9562c58b945a11f24d7a'
db.init_app(app)

# создать таблицы при первом запуске
with app.app_context():
    db.create_all()

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HINTS_FILE        = os.path.join(_BASE_DIR, 'criteria_hints.txt')
GROUP_HINTS_FILE  = os.path.join(_BASE_DIR, 'group_hints.txt')

# начальные группы, записываются при первом старте
_DEFAULT_GROUPS = ['Точность', 'Устойчивость', 'Контекст', 'Производительность', 'Безопасность', 'Без группы']


def _load_hints(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]


def _save_hint(name: str, path: str):
    hints = _load_hints(path)
    if name not in hints:
        with open(path, 'a', encoding='utf-8') as f:
            f.write(name + '\n')


def _ensure_group_hints():
    """Записать дефолтные группы, если файл ещё не существует."""
    if not os.path.exists(GROUP_HINTS_FILE):
        with open(GROUP_HINTS_FILE, 'w', encoding='utf-8') as f:
            f.write('\n'.join(_DEFAULT_GROUPS) + '\n')

_ensure_group_hints()


@app.get('/')
def index():
    return render_template('index.html')

# ── ПОДСКАЗКИ ДЛЯ КРИТЕРИЕВ ───────────────────────────────────────────────────

@app.get('/api/criteria-hints')
def get_criteria_hints():
    q = request.args.get('q', '').strip().lower()
    hints = _load_hints(HINTS_FILE)
    if q:
        hints = [h for h in hints if q in h.lower()]
    return jsonify(hints[:20])

@app.get('/api/group-hints')
def get_group_hints():
    q = request.args.get('q', '').strip().lower()
    hints = _load_hints(GROUP_HINTS_FILE)
    if q:
        hints = [h for h in hints if q in h.lower()]
    return jsonify(hints[:20])

# ── ПРОЕКТЫ ───────────────────────────────────────────────────────────────────

@app.get('/api/projects')
def get_projects():
    projects = Project.query.all()
    return jsonify([{'id': p.id, 'name': p.name} for p in projects])

@app.post('/api/projects')
def create_project():
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Название не может быть пустым'}), 400

    p = Project(name=name)
    db.session.add(p)
    db.session.commit()
    return jsonify({'id': p.id, 'name': p.name}), 201

@app.delete('/api/projects/<int:id>')
def delete_project(id):
    p = Project.query.get_or_404(id)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'ok': True})

@app.patch('/api/projects/<int:id>')
def update_project(id):
    p = Project.query.get_or_404(id)
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Название не может быть пустым'}), 400
    p.name = name
    db.session.commit()
    return jsonify({'id': p.id, 'name': p.name})

# ── МОДЕЛИ ─────────────────────────────────────────────────────────────────────

@app.get('/api/projects/<int:id>/models')
def get_models(id):
    models = AIModel.query.filter_by(project_id=id).all()
    return jsonify([{'id': m.id, 'name': m.name} for m in models])

@app.post('/api/projects/<int:id>/models')
def create_model(id):
    Project.query.get_or_404(id)
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Название не может быть пустым'}), 400

    # проверка дубликата
    existing = AIModel.query.filter_by(project_id=id, name=name).first()
    if existing:
        return jsonify({'error': 'Модель с таким названием уже существует'}), 409

    m = AIModel(name=name, project_id=id)
    db.session.add(m)
    db.session.flush()

    criteria = Criterion.query.filter_by(project_id=id, enabled=True).all()
    for c in criteria:
        db.session.add(Score(model_id=m.id, criterion_id=c.id, value=3))

    db.session.commit()
    return jsonify({'id': m.id, 'name': m.name}), 201

@app.patch('/api/projects/<int:id>/models/<int:mid>')
def update_model(id, mid):
    m = AIModel.query.filter_by(id=mid, project_id=id).first_or_404()
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Название не может быть пустым'}), 400
    m.name = name
    db.session.commit()
    return jsonify({'id': m.id, 'name': m.name})

@app.delete('/api/projects/<int:id>/models/<int:mid>')
def delete_model(id, mid):
    m = AIModel.query.filter_by(id=mid, project_id=id).first_or_404()
    db.session.delete(m)
    db.session.commit()
    return jsonify({'ok': True})

# ── КРИТЕРИИ ───────────────────────────────────────────────────────────────────

@app.get('/api/projects/<int:id>/criteria')
def get_criteria(id):
    criteria = Criterion.query.filter_by(project_id=id).all()
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'group': c.group,
        'weight': c.weight,
        'enabled': c.enabled
    } for c in criteria])

@app.post('/api/projects/<int:id>/criteria')
def save_criteria(id):
    data = request.get_json()  # [{id, weight, enabled}, ...]
    for item in data:
        c = Criterion.query.get(item['id'])
        if c and c.project_id == id:
            c.weight = float(item.get('weight', c.weight))
            c.enabled = bool(item.get('enabled', c.enabled))
    db.session.commit()
    return jsonify({'ok': True})

@app.post('/api/projects/<int:id>/criteria/add')
def add_criterion(id):
    """Добавить новый критерий в проект."""
    Project.query.get_or_404(id)
    data = request.get_json()
    name = data.get('name', '').strip()
    group = data.get('group', 'Без группы').strip() or 'Без группы'
    weight = float(data.get('weight', 5)) / 100  # приходит в процентах

    if not name:
        return jsonify({'error': 'Название не может быть пустым'}), 400

    # дубликат внутри проекта
    exists = Criterion.query.filter_by(project_id=id, name=name).first()
    if exists:
        return jsonify({'error': 'Критерий с таким названием уже существует в этом проекте'}), 409

    c = Criterion(name=name, group=group, weight=weight, project_id=id, enabled=True)
    db.session.add(c)
    db.session.flush()

    # добавить Score для всех текущих моделей
    for m in AIModel.query.filter_by(project_id=id).all():
        db.session.add(Score(model_id=m.id, criterion_id=c.id, value=3))

    db.session.commit()

    # сохраняем подсказку
    _save_hint(name, HINTS_FILE)
    _save_hint(group, GROUP_HINTS_FILE)

    return jsonify({'id': c.id, 'name': c.name, 'group': c.group, 'weight': c.weight, 'enabled': c.enabled}), 201

@app.patch('/api/projects/<int:id>/criteria/<int:cid>')
def update_criterion(id, cid):
    c = Criterion.query.filter_by(id=cid, project_id=id).first_or_404()
    data = request.get_json()

    new_name = data.get('name', c.name).strip()
    new_group = data.get('group', c.group).strip() or c.group
    new_weight = data.get('weight', None)

    # дубликат (кроме самого себя)
    dup = Criterion.query.filter_by(project_id=id, name=new_name).first()
    if dup and dup.id != cid:
        return jsonify({'error': 'Критерий с таким названием уже существует в этом проекте'}), 409

    c.name = new_name
    c.group = new_group
    if new_weight is not None:
        c.weight = float(new_weight) / 100

    db.session.commit()
    _save_hint(new_name, HINTS_FILE)
    _save_hint(new_group, GROUP_HINTS_FILE)
    return jsonify({'id': c.id, 'name': c.name, 'group': c.group, 'weight': c.weight, 'enabled': c.enabled})

@app.delete('/api/projects/<int:id>/criteria/<int:cid>')
def delete_criterion(id, cid):
    c = Criterion.query.filter_by(id=cid, project_id=id).first_or_404()
    db.session.delete(c)
    db.session.commit()
    return jsonify({'ok': True})

# ── ОЦЕНКИ ─────────────────────────────────────────────────────────────────────

@app.get('/api/projects/<int:id>/scores')
def get_scores(id):
    models = AIModel.query.filter_by(project_id=id).all()
    criteria = Criterion.query.filter_by(project_id=id, enabled=True).all()

    result = {}
    for m in models:
        result[m.id] = {}
        for c in criteria:
            s = Score.query.filter_by(model_id=m.id, criterion_id=c.id).first()
            result[m.id][c.id] = s.value if s else 3

    return jsonify({
        'models': [{'id': m.id, 'name': m.name} for m in models],
        'criteria': [{'id': c.id, 'name': c.name, 'group': c.group} for c in criteria],
        'scores': result
    })

@app.post('/api/projects/<int:id>/scores')
def save_scores(id):
    data = request.get_json()  # [{model_id, criterion_id, value}, ...]
    for item in data:
        s = Score.query.filter_by(
            model_id=item['model_id'],
            criterion_id=item['criterion_id']
        ).first()
        if s:
            s.value = int(item['value'])
        else:
            db.session.add(Score(
                model_id=item['model_id'],
                criterion_id=item['criterion_id'],
                value=int(item['value'])
            ))
    db.session.commit()
    return jsonify({'ok': True})

# ── РЕЗУЛЬТАТЫ ─────────────────────────────────────────────────────────────────

@app.get('/api/projects/<int:id>/results')
def get_results(id):
    p = Project.query.get_or_404(id)
    results = calculate_scores(p)
    p.last_result_at = datetime.datetime.now()

    prev = [
        {r['model']['name']: [r['S_k'], r['K_k'], r['model']['id']]}
        for r in results
    ]
    if p.prev_result:
        p.prev_prev_result = p.prev_result
    p.prev_result = prev

    db.session.commit()
    return jsonify(results)

@app.get('/api/projects/<int:id>/sensitivity')
def get_sensitivity(id):
    p = Project.query.get_or_404(id)
    weight_override = {}
    for key, val in request.args.items():
        if key.startswith('w_'):
            criterion_id = int(key[2:])
            weight_override[criterion_id] = float(val)

    results = calculate_scores(p, weight_override=weight_override)
    return jsonify(results)

@app.get('/api/projects/<int:id>/analysis')
def get_analysis(id):
    from report_maker import collect_analysis_data
    data = collect_analysis_data(id)
    if not data:
        return jsonify({'error': 'Нет данных. Сначала выполните расчёт результатов.'}), 404
    return jsonify(data)

@app.get('/api/projects/<int:id>/report')
def report_generation(id):
    fd, temp_path = tempfile.mkstemp(suffix='.pdf')
    os.close(fd)

    try:
        generate_report(id, temp_path)

        @after_this_request
        def cleanup(response):
            try:
                os.remove(temp_path)
            except:
                pass
            return response

        return send_file(
            temp_path,
            as_attachment=True,
            download_name=f'project_{id}_report.pdf',
            mimetype='application/pdf'
        )
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        abort(500, f'Ошибка генерации отчёта: {e}')

@app.get('/api/projects/<int:id>/top-models')
def get_top_models(id):
    group = request.args.get('group')
    project = Project.query.get_or_404(id)

    criteria = Criterion.query.filter_by(
        project_id=id,
        group=group,
        enabled=True
    ).all()

    if not criteria:
        return jsonify([])

    models = AIModel.query.filter_by(project_id=id).all()
    results = []

    for model in models:
        total_score = 0
        total_weight = 0

        for criterion in criteria:
            score = Score.query.filter_by(
                model_id=model.id,
                criterion_id=criterion.id
            ).first()

            value = score.value if score else 0
            total_score += value * criterion.weight
            total_weight += criterion.weight

        final_score = (
            total_score / total_weight
            if total_weight > 0 else 0
        )

        results.append({
            'model_id': model.id,
            'model_name': model.name,
            'score': round(final_score, 3)
        })

    results.sort(key=lambda x: x['score'], reverse=True)
    return jsonify(results[:3])

if __name__ == '__main__':
    app.run(debug=True)