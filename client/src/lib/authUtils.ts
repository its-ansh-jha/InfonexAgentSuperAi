import { toast } from "@/hooks/use-toast";

/**
 * Checks if an error is an unauthorized (401) error
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof Error) {
    // Check if the error message contains "401" status code
    return error.message.includes("401");
  }
  return false;
}

/**
 * Handles unauthorized errors by showing a toast and redirecting to login
 */
export function handleUnauthorizedError(error: unknown): void {
  if (isUnauthorizedError(error)) {
    toast({
      title: "Authentication Required",
      description: "Please sign in to continue using this feature.",
      variant: "destructive",
    });

    // Redirect to login after a short delay to allow the toast to be seen
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 2000);
  }
}

/**
 * Redirects to the login endpoint
 */
export function redirectToLogin(): void {
  window.location.href = "/api/login";
}

/**
 * Redirects to the logout endpoint
 */
export function redirectToLogout(): void {
  window.location.href = "/api/logout";
}