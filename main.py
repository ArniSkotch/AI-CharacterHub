from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
import os
from models import db, Project, AIModel, Criterion, Score
from calculator import calculate_scores

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///eval.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = '93a0494cded2a1647660d68f88b6a07c9acde607d49e9562c58b945a11f24d7a'
db.init_app(app)

# создать таблицы при первом запуске
with app.app_context():
    db.create_all()

@app.get('/')
def index():
    return render_template('index.html')

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
    db.session.flush()

    for c in DEFAULT_CRITERIA:
        db.session.add(Criterion(
            name=c['name'],
            group=c['group'],
            weight=c['weight'],
            project_id=p.id
        ))

    db.session.commit()
    return jsonify({'id': p.id, 'name': p.name}), 201

@app.delete('/api/projects/<int:id>')
def delete_project(id):
    p = Project.query.get_or_404(id)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'ok': True})

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

    m = AIModel(name=name, project_id=id)
    db.session.add(m)
    db.session.commit()
    return jsonify({'id': m.id, 'name': m.name}), 201

@app.delete('/api/projects/<int:id>/models/<int:mid>')
def delete_model(id, mid):
    m = AIModel.query.filter_by(id=mid, project_id=id).first_or_404()
    db.session.delete(m)
    db.session.commit()
    return jsonify({'ok': True})

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

@app.get('/api/projects/<int:id>/scores')
def get_scores(id):
    models = AIModel.query.filter_by(project_id=id).all()
    criteria = Criterion.query.filter_by(project_id=id, enabled=True).all()

    # {model_id: {criterion_id: value}}
    result = {}
    for m in models:
        result[m.id] = {}
        for c in criteria:
            s = Score.query.filter_by(model_id=m.id, criterion_id=c.id).first()
            result[m.id][c.id] = s.value if s else 0

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


@app.get('/api/projects/<int:id>/results')
def get_results(id):
    p = Project.query.get_or_404(id)
    results = calculate_scores(p)
    return jsonify(results)

@app.get('/api/projects/<int:id>/sensitivity')
def get_sensitivity(id):
    p = Project.query.get_or_404(id)
    # веса приходят как query params: ?w_1=0.3&w_2=0.2
    weight_override = {}
    for key, val in request.args.items():
        if key.startswith('w_'):
            criterion_id = int(key[2:])
            weight_override[criterion_id] = float(val)

    results = calculate_scores(p, weight_override=weight_override)
    return jsonify(results)

DEFAULT_CRITERIA = [
    {'name': 'Точность ответа',              'group': 'Точность',      'weight': 0.10},
    {'name': 'Логичность и структура',       'group': 'Точность',      'weight': 0.10},
    {'name': 'Глубина и полнота ответа',     'group': 'Точность',      'weight': 0.10},
    {'name': 'Гибкость в интерпретации',     'group': 'Точность',      'weight': 0.10},
    {'name': 'Адекватность формата',         'group': 'Точность',      'weight': 0.05},
    {'name': 'Устойчивость к нагрузке',      'group': 'Устойчивость',  'weight': 0.10},
    {'name': 'Обработка сложных запросов',   'group': 'Устойчивость',  'weight': 0.10},
    {'name': 'Восприятие неоднозначности',   'group': 'Устойчивость',  'weight': 0.05},
    {'name': 'Анализ и синтез информации',   'group': 'Устойчивость',  'weight': 0.10},
    {'name': 'Контекстная согласованность',  'group': 'Контекст',      'weight': 0.10},
    {'name': 'Адаптивность к стилю',         'group': 'Контекст',      'weight': 0.05},
    {'name': 'Чувствительность к контексту', 'group': 'Контекст',      'weight': 0.05},
]

if __name__ == '__main__':
    app.run(debug=True)