from app.main import app


def test_admin_routes_are_registered():
    paths = set(app.openapi()["paths"].keys())

    assert "/api/v1/admin/dashboard" in paths
    assert "/api/v1/admin/users" in paths
    assert "/api/v1/admin/users/{user_id}" in paths
    assert "/api/v1/admin/users/{user_id}/role" in paths
    assert "/api/v1/admin/users/{user_id}/status" in paths
    assert "/api/v1/admin/forms" in paths
    assert "/api/v1/admin/forms/{form_id}/analytics" in paths
    assert "/api/v1/admin/analytics/users" in paths
