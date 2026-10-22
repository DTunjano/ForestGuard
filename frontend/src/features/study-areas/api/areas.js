import { request } from "../../../shared/api/client";
export const saveArea = (body, id) =>
  request(`study-areas/${id ? id + "/" : ""}`, {
    method: id ? "PATCH" : "POST",
    body,
  });
