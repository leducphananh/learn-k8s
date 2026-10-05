import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_voices():
    response = client.get("/api/voices")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert any("vi-VN" in item["locale"] for item in data)

def test_api_upload_txt():
    files = {"file": ("test.txt", b"Xin chao Viet Nam", "text/plain")}
    response = client.post("/api/upload", files=files)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["text"] == "Xin chao Viet Nam"
    assert res_data["word_count"] == 4
    assert res_data["char_count"] == 17

def test_api_upload_invalid_extension():
    files = {"file": ("program.exe", b"binary content", "application/octet-stream")}
    response = client.post("/api/upload", files=files)
    assert response.status_code == 400
    assert "Định dạng file không được hỗ trợ" in response.json()["detail"]

def test_api_synthesize_empty_text():
    response = client.post("/api/synthesize", json={
        "text": "   ",
        "voice": "vi-VN-HoaiMyNeural"
    })
    assert response.status_code == 422

def test_api_synthesize_valid():
    response = client.post("/api/synthesize", json={
        "text": "Kiểm tra tổng hợp giọng nói từ API.",
        "voice": "vi-VN-HoaiMyNeural",
        "rate": "+0%",
        "pitch": "+0Hz",
        "volume": "+0%"
    })
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert len(response.content) > 0
