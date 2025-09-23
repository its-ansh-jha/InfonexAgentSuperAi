// Hook for tracking daily usage limits for non-authenticated users
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from './useAuth';

export interface DailyUsage {
  messageCount: number;
  limit: number;
  canSendMessage: boolean;
  canGenerateImage: boolean;
  canUploadImage: boolean;
}

export function useUsageLimit() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Query daily usage for non-authenticated users
  const { data: usage, isLoading } = useQuery<DailyUsage>({
    queryKey: ['/api/usage/daily'],
    enabled: !isAuthenticated,
    retry: false,
  });

  // Mutation to increment message count
  const incrementUsageMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest({
        url: '/api/usage/increment',
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/usage/daily'] });
    },
  });

  // For authenticated users, no limits apply
  if (isAuthenticated) {
    return {
      usage: {
        messageCount: 0,
        limit: Infinity,
        canSendMessage: true,
        canGenerateImage: true,
        canUploadImage: true,
      } as DailyUsage,
      isLoading: false,
      incrementUsage: () => Promise.resolve(),
    };
  }

  return {
    usage: usage || {
      messageCount: 0,
      limit: 10,
      canSendMessage: true,
      canGenerateImage: false,
      canUploadImage: false,
    },
    isLoading,
    incrementUsage: incrementUsageMutation.mutateAsync,
  };
}