import { apiRequest } from "@/services/api-client";

export function estimateFare(payload) {
  return apiRequest("/pricing/estimate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
