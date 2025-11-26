from fastapi.testclient import TestClient

from src.app import main

client = TestClient(main.app)


def test_alcohol_endpoint_flags_beer(monkeypatch):
    class DummyDetector:
        def predict_from_url(self, image_url):
            assert image_url == 'https://cdn.example.com/beer.jpg'
            return {
                'predicted_label': 'Beer Bottle',
                'confidence': 0.91,
                'scores': {
                    'Beer Bottle': 0.91,
                    'Plastic Bottle': 0.09,
                },
                'flagged': True,
                'is_beer': True,
            }

    monkeypatch.setattr(main, 'alcohol_detector', DummyDetector())

    response = client.post(
        '/predict/alcohol-image',
        json={'image_url': 'https://cdn.example.com/beer.jpg'},
    )

    assert response.status_code == 200
    data = response.json()
    assert data['predicted_label'] == 'Beer Bottle'
    assert data['is_beer'] is True
    assert data['flagged'] is True
    assert data['confidence'] == 0.91