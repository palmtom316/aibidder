from fastapi.testclient import TestClient

from app.main import app


RESOURCE_CASES = [
    {
        "resource": "qualifications",
        "create_payload": {
            "qualification_name": "电力工程施工总承包",
            "qualification_level": "一级",
            "certificate_no": "A-001",
            "valid_until": "2028-12-31",
            "metadata_json": '{"issuer":"住建部"}',
        },
        "update_payload": {
            "qualification_level": "特级",
            "valid_until": "2030-12-31",
        },
        "assertions": lambda row: (
            row["qualification_name"] == "电力工程施工总承包"
            and row["qualification_level"] == "特级"
            and row["valid_until"] == "2030-12-31"
        ),
    },
    {
        "resource": "personnel-assets",
        "create_payload": {
            "full_name": "张三",
            "role_title": "项目经理",
            "certificate_no": "P-001",
            "metadata_json": '{"specialty":"机电"}',
        },
        "update_payload": {
            "role_title": "总工程师",
        },
        "assertions": lambda row: (
            row["full_name"] == "张三"
            and row["role_title"] == "总工程师"
        ),
    },
    {
        "resource": "equipment-assets",
        "create_payload": {
            "equipment_name": "发电车",
            "model_no": "EQ-500",
            "quantity": 2,
            "metadata_json": '{"power":"500kW"}',
        },
        "update_payload": {
            "quantity": 3,
            "model_no": "EQ-600",
        },
        "assertions": lambda row: (
            row["equipment_name"] == "发电车"
            and row["quantity"] == 3
            and row["model_no"] == "EQ-600"
        ),
    },
    {
        "resource": "project-credentials",
        "create_payload": {
            "project_name": "浙江示范工程",
            "credential_type": "project_performance",
            "owner_name": "市场经营中心",
            "metadata_json": '{"contract_amount":"1000万"}',
        },
        "update_payload": {
            "owner_name": "工程管理部",
        },
        "assertions": lambda row: (
            row["project_name"] == "浙江示范工程"
            and row["owner_name"] == "工程管理部"
        ),
    },
]


def _login(email: str = "admin@example.com", password: str = "admin123456") -> str:
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]



def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}



def test_library_asset_endpoints_support_crud_for_all_fact_tables() -> None:
    client = TestClient(app)
    token = _login()

    for case in RESOURCE_CASES:
        created = client.post(
            f"/api/v1/workbench/library/{case['resource']}",
            json=case["create_payload"],
            headers=_auth_headers(token),
        )
        assert created.status_code == 201, created.text
        created_payload = created.json()
        resource_id = created_payload["id"]

        listed = client.get(
            f"/api/v1/workbench/library/{case['resource']}",
            headers=_auth_headers(token),
        )
        assert listed.status_code == 200, listed.text
        assert any(row["id"] == resource_id for row in listed.json())

        updated = client.patch(
            f"/api/v1/workbench/library/{case['resource']}/{resource_id}",
            json=case["update_payload"],
            headers=_auth_headers(token),
        )
        assert updated.status_code == 200, updated.text
        assert case["assertions"](updated.json())

        deleted = client.delete(
            f"/api/v1/workbench/library/{case['resource']}/{resource_id}",
            headers=_auth_headers(token),
        )
        assert deleted.status_code == 204, deleted.text

        missing = client.get(
            f"/api/v1/workbench/library/{case['resource']}",
            headers=_auth_headers(token),
        )
        assert missing.status_code == 200
        assert all(row["id"] != resource_id for row in missing.json())
