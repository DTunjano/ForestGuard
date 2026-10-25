import { request } from "../../../shared/api/client";
export const createAnalysis = (body) =>
  request("analyses/", { method: "POST", body });

export const deleteAnalysis = (id) =>
  request(`analyses/${id}/`, { method: "DELETE" });
