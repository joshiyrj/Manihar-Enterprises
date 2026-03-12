import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export function useUserAuth() {
    return useQuery({
        queryKey: ["user-me"],
        queryFn: () => api.get("/api/users/me").then(r => r.data),
        retry: false,
        refetchOnWindowFocus: false,
    });
}
