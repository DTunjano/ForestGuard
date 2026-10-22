import { request } from "../../../shared/api/client";
export const createAnalysis = (body) =>
  request("analyses/", { method: "POST", body });
