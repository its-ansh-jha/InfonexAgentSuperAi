import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const query = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }), // Return null instead of throwing on 401
    retry: false, // Don't retry auth queries to avoid login redirects
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Consider user data fresh for 5 minutes
  });

  return {
    user: query.data,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}