from rest_framework.test import APIClient


def test_openapi_groups_modules_and_documents_uploads_and_results():
    response = APIClient().get("/api/schema/?format=json")
    assert response.status_code == 200
    schema = response.json()

    expected_tags = {
        "Autenticación", "Mi cuenta", "Administración de usuarios", "Áreas de estudio",
        "Imágenes satelitales", "Modelos", "Análisis", "Resultados",
    }
    assert expected_tags == {tag["name"] for tag in schema["tags"]}
    operations = [operation for methods in schema["paths"].values()
                  for operation in methods.values() if isinstance(operation, dict) and "operationId" in operation]
    assert all(operation["tags"][0] in expected_tags for operation in operations)

    upload = schema["paths"]["/api/v1/images/"]["post"]
    assert list(upload["requestBody"]["content"]) == ["multipart/form-data"]
    request_schema = upload["requestBody"]["content"]["multipart/form-data"]["schema"]
    component = schema["components"]["schemas"][request_schema["$ref"].split("/")[-1]]
    assert component["properties"]["file"]["format"] == "binary"

    assert not schema["paths"]["/api/v1/auth/token/"]["post"].get("security")
    assert schema["paths"]["/api/v1/analyses/"]["post"]["security"] == [{"jwtAuth": []}]
    preview = schema["paths"]["/api/v1/artifacts/{artifact_id}/preview/"]["get"]
    assert preview["tags"] == ["Resultados"]
    assert "image/png" in preview["responses"]["200"]["content"]
    assert [parameter["name"] for parameter in preview["parameters"]] == ["artifact_id"]
    assert "/api/v1/analyses/{id}/artifacts/{artifact_id}/preview/" not in schema["paths"]
