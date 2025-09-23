// Firebase authentication hook
import { useState, useEffect } from 'react';
import { onAuthStateChange, type FirebaseUser } from '@/lib/firebase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { User } from '@shared/schema';

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setFirebaseUser(user);
      setIsLoading(false);
      
      // Clear user data from cache when user signs out
      if (!user) {
        queryClient.setQueryData(['/api/auth/user'], null);
      }
    });

    return () => unsubscribe();
  }, [queryClient]);

  // Query to sync Firebase user with database
  const { data: dbUser, isLoading: isDbUserLoading } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    enabled: !!firebaseUser,
    retry: false,
  });

  // Mutation to sync user data with database
  const syncUserMutation = useMutation({
    mutationFn: async (userData: {
      firebaseUid: string;
      email: string;
      displayName: string | null;
      photoURL: string | null;
      emailVerified: boolean;
    }) => {
      return await apiRequest<User>({
        url: '/api/auth/sync-user',
        method: 'POST',
        data: userData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  // Sync Firebase user with database when Firebase user changes
  useEffect(() => {
    if (firebaseUser && !syncUserMutation.isPending) {
      syncUserMutation.mutate({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified,
      });
    }
  }, [firebaseUser, syncUserMutation]);

  return {
    firebaseUser,
    user: dbUser,
    isLoading: isLoading || isDbUserLoading,
    isAuthenticated: !!firebaseUser,
    syncUser: syncUserMutation.mutate,
  };
}