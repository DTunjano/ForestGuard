import { request } from "../../../shared/api/client";
export const createAdministrator = (body) =>
  request("admin/administrators/", { method: "POST", body });
export const saveUser = (body, id) =>
  request(`admin/users/${id ? id + "/" : ""}`, {
    method: id ? "PATCH" : "POST",
    body,
  });
