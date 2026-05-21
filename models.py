from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(500), default='')
    created_at = db.Column(db.DateTime, default=db.func.now())
    last_result_at = db.Column(db.DateTime, nullable=True)
    prev_result = db.Column(db.json,nullable=True)
    prev_prev_result = db.Column(db.json,nullable=True)
    # связи
    models = db.relationship('AIModel', backref='project', cascade='all, delete')
    criteria = db.relationship('Criterion', backref='project', cascade='all, delete')

class AIModel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)

    scores = db.relationship('Score', backref='model', cascade='all, delete')


class Criterion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(500), default='')
    weight = db.Column(db.Float, default=0.1)
    group = db.Column(db.String(100), default='Группа 1')
    enabled = db.Column(db.Boolean, default=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)

    scores = db.relationship('Score', backref='criterion', cascade='all, delete')


class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    value = db.Column(db.Integer, default=0)  # от 1 до 5
    model_id = db.Column(db.Integer, db.ForeignKey('ai_model.id'), nullable=False)
    criterion_id = db.Column(db.Integer, db.ForeignKey('criterion.id'), nullable=False)