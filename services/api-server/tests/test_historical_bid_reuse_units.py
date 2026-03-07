from fastapi.testclient import TestClient

from app.main import app
from tests.test_historical_bid_ingestion import _login, _upload_parsed_docx_document


def test_rebuild_reuse_units_sanitizes_risky_content() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    document_id = _upload_parsed_docx_document(client, token, "Historical Reuse Unit Project")

    imported = client.post(
        "/api/v1/historical-bids/import",
        json={
            "document_id": document_id,
            "source_type": "won_bid",
            "project_type": "power_engineering",
            "region": "zhejiang",
            "year": 2022,
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
    assert rebuilt_reuse_units.status_code == 200
    payload = rebuilt_reuse_units.json()
    assert len(payload) >= 2
    risky_unit = next(item for item in payload if "张三" in item["raw_text"])
    assert risky_unit["reuse_mode"] == "slot_reuse"
    assert "[PERSON_NAME]" in risky_unit["sanitized_text"]
    assert "[DATE]" in risky_unit["sanitized_text"]

    reuse_units = client.get(
        f"/api/v1/historical-bids/{historical_bid_id}/reuse-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert reuse_units.status_code == 200
    listed_payload = reuse_units.json()
    assert len(listed_payload) >= 2
