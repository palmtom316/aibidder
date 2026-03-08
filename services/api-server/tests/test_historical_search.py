from fastapi.testclient import TestClient

from app.main import app
from tests.test_historical_bid_ingestion import _login, _upload_parsed_docx_document


def test_search_reuse_units_returns_grouped_reuse_pack() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    document_id = _upload_parsed_docx_document(client, token, "Historical Search Project")

    imported = client.post(
        "/api/v1/historical-bids/import",
        json={
            "document_id": document_id,
            "source_type": "won_bid",
            "project_type": "power_engineering",
            "region": "zhejiang",
            "year": 2024,
            "is_recommended": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert imported.status_code == 201, imported.text
    historical_bid_id = imported.json()["id"]

    rebuilt_sections = client.post(
        f"/api/v1/historical-bids/{historical_bid_id}/rebuild-sections",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuilt_sections.status_code == 200, rebuilt_sections.text

    rebuilt_reuse_units = client.post(
        f"/api/v1/historical-bids/{historical_bid_id}/rebuild-reuse-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuilt_reuse_units.status_code == 200, rebuilt_reuse_units.text

    response = client.get(
        "/api/v1/historical-bids/reuse-units/search",
        params={"project_type": "power_engineering", "section_type": "quality_assurance"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["query"]["project_type"] == "power_engineering"
    assert payload["query"]["section_type"] == "quality_assurance"
    assert payload["safe_reuse"] == []
    assert len(payload["slot_reuse"]) >= 1
    assert payload["style_only"] == []
    assert "[PERSON_NAME]" in payload["slot_reuse"][0]["sanitized_text"]
    assert "raw_text" not in payload["slot_reuse"][0]
    assert "张三" not in response.text


def test_search_reuse_units_supports_text_query_filter() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    document_id = _upload_parsed_docx_document(client, token, "Historical Search Filter Project")

    imported = client.post(
        "/api/v1/historical-bids/import",
        json={
            "document_id": document_id,
            "source_type": "won_bid",
            "project_type": "power_engineering",
            "region": "zhejiang",
            "year": 2024,
            "is_recommended": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert imported.status_code == 201, imported.text
    historical_bid_id = imported.json()["id"]

    rebuilt_sections = client.post(
        f"/api/v1/historical-bids/{historical_bid_id}/rebuild-sections",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuilt_sections.status_code == 200, rebuilt_sections.text

    rebuilt_reuse_units = client.post(
        f"/api/v1/historical-bids/{historical_bid_id}/rebuild-reuse-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuilt_reuse_units.status_code == 200, rebuilt_reuse_units.text

    matched = client.get(
        "/api/v1/historical-bids/reuse-units/search",
        params={"project_type": "power_engineering", "section_type": "quality_assurance", "q": "质量保证"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert matched.status_code == 200, matched.text
    matched_payload = matched.json()
    assert matched_payload["query"]["q"] == "质量保证"
    assert matched_payload["slot_reuse"]

    filtered = client.get(
        "/api/v1/historical-bids/reuse-units/search",
        params={"project_type": "power_engineering", "section_type": "quality_assurance", "q": "不存在的短语"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert filtered.status_code == 200, filtered.text
    filtered_payload = filtered.json()
    assert filtered_payload["query"]["q"] == "不存在的短语"
    assert filtered_payload["safe_reuse"] == []
    assert filtered_payload["slot_reuse"] == []
    assert filtered_payload["style_only"] == []
