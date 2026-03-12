import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export function useAdminAuth() {
  return useQuery({
    queryKey: ["admin-me"],
    queryFn: async () => {
      // lightweight check by hitting profile
      const res = await api.get("/api/admin/profile");
      return res.data;
    },
    retry: false
  });
}