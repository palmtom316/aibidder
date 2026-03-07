from fastapi.testclient import TestClient

from app.main import app
from tests.test_historical_bid_ingestion import _login, _upload_parsed_docx_document


def test_verify_historical_leakage_blocks_legacy_terms() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    document_id = _upload_parsed_docx_document(client, token, "Historical Leakage Project")

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
    assert rebuilt_reuse_units.status_code == 200, rebuilt_reuse_units.text
    risky_unit = next(item for item in rebuilt_reuse_units.json() if "张三" in item["raw_text"])

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Leakage Check Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    leaked = client.post(
        f"/api/v1/projects/{project_id}/sections/quality-assurance/verify-historical-leakage",
        json={
            "draft_text": "项目经理张三承诺于2024年12月31日前完成浙江示范工程质量目标。",
            "forbidden_legacy_terms": ["张三", "2024年12月31日", "浙江示范工程"],
            "history_candidate_pack": {"reuse_unit_ids": [risky_unit["id"]]},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert leaked.status_code == 200, leaked.text
    leaked_payload = leaked.json()
    assert leaked_payload["ok"] is False
    assert "张三" in leaked_payload["matched_terms"]

    clean = client.post(
        f"/api/v1/projects/{project_id}/sections/quality-assurance/verify-historical-leakage",
        json={
            "draft_text": "项目经理[PERSON_NAME]承诺于[DATE]前完成质量目标。",
            "forbidden_legacy_terms": ["张三", "2024年12月31日", "浙江示范工程"],
            "history_candidate_pack": {"reuse_unit_ids": [risky_unit["id"]]},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert clean.status_code == 200, clean.text
    clean_payload = clean.json()
    assert clean_payload["ok"] is True
    assert clean_payload["matched_terms"] == []


def test_verify_historical_leakage_uses_selected_reuse_unit_risk_marks() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    document_id = _upload_parsed_docx_document(client, token, "Historical Leakage Risk Mark Project")

    imported = client.post(
        "/api/v1/historical-bids/import",
        json={
            "document_id": document_id,
            "source_type": "excellent_sample",
            "project_type": "power_engineering",
            "region": "zhejiang",
            "year": 2021,
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
    risky_unit = next(item for item in rebuilt_reuse_units.json() if "张三" in item["raw_text"])

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Leakage Check By Risk Mark Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    leaked = client.post(
        f"/api/v1/projects/{project_id}/sections/quality-assurance/verify-historical-leakage",
        json={
            "draft_text": "项目经理张三承诺于2024年12月31日前完成浙江示范工程质量目标。",
            "history_candidate_pack": {"reuse_unit_ids": [risky_unit["id"]]},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert leaked.status_code == 200, leaked.text
    leaked_payload = leaked.json()
    assert leaked_payload["ok"] is False
    assert "张三" in leaked_payload["matched_terms"]
