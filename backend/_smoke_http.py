"""HTTP-level smoke test: middleware wiring, auth guards, validation (no DB)."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)  # lifespan intentionally not entered (no DB in test env)

# 1) Health probe
resp = client.get("/health")
assert resp.status_code == 200 and resp.json()["status"] == "healthy", resp.text
print("health OK")

# 2) OpenAPI exposes all 9 PRD contracts
spec = client.get("/openapi.json").json()
paths = spec["paths"]
expected = [
    ("/api/v1/auth/signup", "post"),
    ("/api/v1/auth/login", "post"),
    ("/api/v1/exams/list", "get"),
    ("/api/v1/exam/setup", "post"),
    ("/api/v1/exam/rubric", "put"),
    ("/api/v1/papers/batch-upload", "post"),
    ("/api/v1/papers/{student_id}", "get"),
    ("/api/v1/papers/{student_id}/override", "post"),
    ("/api/v1/analytics/export", "get"),
]
for path, method in expected:
    assert path in paths and method in paths[path], f"missing {method.upper()} {path}"
print("openapi contracts OK (9/9 endpoints)")

# 3) JWT guard: protected routes reject missing/invalid tokens with 401
assert client.get("/api/v1/exams/list").status_code == 401
assert (
    client.get(
        "/api/v1/exams/list", headers={"Authorization": "Bearer not-a-jwt"}
    ).status_code
    == 401
)
assert client.get("/api/v1/papers/STU-102").status_code == 401
assert (
    client.post(
        "/api/v1/papers/STU-102/override", json={"new_score": 5.0}
    ).status_code
    == 401
)
assert client.get("/api/v1/analytics/export?exam_id=abc").status_code in (401, 422)
print("jwt guard OK")

# 4) Pydantic validation on signup (no DB hit before validation passes)
resp = client.post("/api/v1/auth/signup", json={"full_name": "A"})
assert resp.status_code == 422, resp.text
resp = client.post(
    "/api/v1/auth/signup",
    json={
        "full_name": "Rohail Khan",
        "email": "not-an-email",
        "institution_name": "NU",
        "password": "longenough123",
        "role": "teacher",
    },
)
assert resp.status_code == 422, resp.text
resp = client.post(
    "/api/v1/auth/signup",
    json={
        "full_name": "Rohail Khan",
        "email": "teacher@school.edu",
        "institution_name": "National University",
        "password": "short",
        "role": "superuser",
    },
)
assert resp.status_code == 422, resp.text
print("validation OK")

# 5) Rubric update body validation (auth first → 401 without token)
assert client.put("/api/v1/exam/rubric", json={}).status_code == 401
# Export format validation requires auth → 401 as well
assert client.get("/api/v1/analytics/export?format=docx").status_code in (401, 422)

print("ALL HTTP SMOKE TESTS PASSED")
