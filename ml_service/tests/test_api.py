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


def test_location_recommendations_use_direct_haversine_distance():
    payload = {
        'user_location': {'latitude': 0, 'longitude': 0},
        'max_distance_km': 10,
        'limit': 5,
        'listings': [
            {
                '_id': 'near',
                'title': 'Nearby Book',
                'category': 'physical',
                'location': {'latitude': 0, 'longitude': 0.05},
            },
            {
                '_id': 'far',
                'title': 'Far Bike',
                'category': 'physical',
                'location': {'latitude': 0, 'longitude': 0.2},
            },
        ],
    }
    res = client.post('/predict/location-based-recommendations', json=payload)
    assert res.status_code == 200
    data = res.json()
    assert [item['id'] for item in data] == ['near']
    assert data[0]['distance_km'] < 10
