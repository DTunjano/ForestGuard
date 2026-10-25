import { request } from "../../../shared/api/client";
export function uploadImage(file, area) {
  const body = new FormData();
  body.append("file", file);
  body.append("study_area", area);
  return request("images/", { method: "POST", body });
}

export const deleteImage = (id) =>
  request(`images/${id}/`, { method: "DELETE" });
