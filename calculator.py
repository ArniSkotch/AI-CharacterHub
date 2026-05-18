from models import Score

def calculate_scores(project, weight_override=None):
    criteria = [c for c in project.criteria if c.enabled]
    weights = weight_override or {c.id: c.weight for c in criteria}

    sum_weights = sum(weights.values())
    S_max = 5 * sum_weights

    results = []
    for model in project.models:
        S_k = sum(
            weights[c.id] * (Score.query.filter_by(
                model_id=model.id, criterion_id=c.id
            ).first() or Score(value=0)).value
            for c in criteria
        )
        K_k = round(S_k / S_max, 3) if S_max > 0 else 0
        results.append({
            'model': {
                'id': model.id,
                'name': model.name
            },
            'S_k': round(S_k, 2),
            'K_k': K_k,
            'label': interpret(K_k),
        })

    return sorted(results, key=lambda r: r['K_k'], reverse=True)

def interpret(k):
    if k >= 0.90: return 'Отличная — рекомендуется'
    if k >= 0.75: return 'Хорошая — подходит для большинства задач'
    if k >= 0.60: return 'Приемлемая — требует доработки'
    if k >= 0.40: return 'Слабая — нужна настройка или замена'
    return 'Не рекомендуется'