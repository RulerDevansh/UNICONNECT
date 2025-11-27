from fastapi.testclient import TestClient

from src.app import main

client = TestClient(main.app)


def test_alcohol_endpoint_flags_beer(monkeypatch):
    class DummyDetector:
        def predict_from_url(self, image_url):
            assert str(image_url) == 'https://cdn.example.com/beer.jpg'
            return {
                'filename': image_url,
                'predicted_class': 'positive',
                'probability': 0.91,
                'threshold': 0.6,
                'blocked': True,
            }

    monkeypatch.setattr(main, 'alcohol_detector', DummyDetector())

    response = client.post(
        '/predict/alcohol-image',
        json={'image_url': 'https://cdn.example.com/beer.jpg'},
    )

    assert response.status_code == 200
    data = response.json()
    assert data['predicted_class'] == 'positive'
    assert data['blocked'] is True
    assert data['probability'] == 0.91


def test_predict_url_alias(monkeypatch):
    class DummyDetector:
        def predict_from_url(self, image_url):
            return {
                'filename': str(image_url),
                'predicted_class': 'negative',
                'probability': 0.12,
                'threshold': 0.6,
                'blocked': False,
            }

    monkeypatch.setattr(main, 'alcohol_detector', DummyDetector())

    response = client.post(
        '/predict/url',
        json={'image_url': 'https://cdn.example.com/safe.jpg'},
    )

    assert response.status_code == 200
    data = response.json()
    assert data['filename'] == 'https://cdn.example.com/safe.jpg'
    assert data['blocked'] is False
    assert data['predicted_class'] == 'negative'