import { request } from "../../../shared/api/client";

export const saveModel = (body, id) =>
  request(`admin/models/${id ? `${id}/` : ""}`, {
    method: id ? "PATCH" : "POST",
    body,
  });
export const deleteModel = (id) =>
  request(`admin/models/${id}/`, { method: "DELETE" });
