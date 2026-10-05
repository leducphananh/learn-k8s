from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_index_page():
    response = client.get("/")
    assert response.status_code == 200
    assert "EchoTTS" in response.text
    assert "text/html" in response.headers["content-type"]

def test_static_css():
    response = client.get("/static/css/style.css")
    assert response.status_code == 200
    assert "var(--bg-dark)" in response.text
