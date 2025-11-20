from fastapi.testclient import TestClient

from src.app.main import app

client = TestClient(app)


def test_health():
    res = client.get('/health')
    assert res.status_code == 200
    assert res.json()['status'] == 'ok'


def test_recommendations_returns_list():
    payload = {'userId': 'u1', 'recent_item_ids': ['L1'], 'limit': 2}
    res = client.post('/predict/recommendations', json=payload)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) <= 2
    if data:
        assert {'id', 'score', 'title', 'category'} <= data[0].keys()


def test_moderation_flags_keywords():
    payload = {'title': 'Selling fake IDs', 'description': 'Counterfeit docs'}
    res = client.post('/predict/moderation', json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data['flagged'] is True
    assert data['reason'].startswith('keyword:')
