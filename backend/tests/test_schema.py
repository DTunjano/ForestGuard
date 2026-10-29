from rest_framework.test import APIClient


def test_openapi_groups_modules_and_documents_uploads_and_results():
    response = APIClient().get("/api/schema/?format=json")
    assert response.status_code == 200
    schema = response.json()

    expected_tags = {
        "Autenticación", "Mi cuenta", "Administración de usuarios", "Áreas de estudio",
        "Imágenes satelitales", "Modelos", "Análisis", "Resultados", "Roles y permisos",
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
    user_parameters = {item["name"] for item in schema["paths"]["/api/v1/admin/users/"]["get"]["parameters"]}
    assert {"role_id", "is_active", "page", "search", "ordering"} <= user_parameters
    assert schema["paths"]["/api/v1/analyses/"]["post"]["security"] == [{"jwtAuth": []}]
    analysis_request = schema["components"]["schemas"]["AnalysisRequest"]
    assert "study_area" in analysis_request["properties"]
    assert set(analysis_request["required"]) == {"image_ids", "name", "study_area"}
    examples = schema["paths"]["/api/v1/analyses/"]["post"]["requestBody"]["content"]["application/json"]["examples"]
    assert any(example["value"]["image_ids"] == [1] for example in examples.values())
    assert any(example["value"]["image_ids"] == [1, 2] for example in examples.values())
    assert all("study_area" in example["value"] for example in examples.values())
    preview = schema["paths"]["/api/v1/artifacts/{artifact_id}/preview/"]["get"]
    assert preview["tags"] == ["Resultados"]
    assert "image/png" in preview["responses"]["200"]["content"]
    assert [parameter["name"] for parameter in preview["parameters"]] == ["artifact_id", "palette"]
    assert not preview["parameters"][1].get("required", False)
    for operation in ("download", "metadata", "preview", "category-mask"):
        path = f"/api/v1/artifacts/{{artifact_id}}/{operation}/"
        names = [parameter["name"] for parameter in schema["paths"][path]["get"]["parameters"]]
        assert names == (["artifact_id", "format"] if operation == "download" else
                         ["artifact_id", "palette"] if operation in ("metadata", "preview") else ["artifact_id"])
        assert f"/api/v1/analyses/{{id}}/artifacts/{{artifact_id}}/{operation}/" not in schema["paths"]
    results = schema["paths"]["/api/v1/analyses/{analysis_id}/results/"]["get"]
    export = schema["paths"]["/api/v1/analyses/{analysis_id}/export/"]["get"]
    assert [parameter["name"] for parameter in results["parameters"]] == ["analysis_id", "section"]
    assert [parameter["name"] for parameter in export["parameters"]] == ["analysis_id", "format", "section"]
    assert "application/zip" in export["responses"]["200"]["content"]
