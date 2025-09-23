import React from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/context/ChatContext';
import { useChatHistory } from '@/context/ChatHistoryContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import logoImage from '../assets/logo.webp';
import { AuthButtons } from './AuthButtons';
import { UserMenu } from './UserMenu';

export function Header() {
  const { clearMessages } = useChat();
  const { startNewChat } = useChatHistory();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  
  const handleNewChat = () => {
    // Create a new chat
    clearMessages();
    startNewChat();
    
    toast({
      title: "New Chat Started",
      description: "Previous conversation has been archived",
      duration: 2000,
    });
  };
  
  return (
    <header className="sticky top-0 z-10 bg-neutral-900 border-b border-neutral-800">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Infonex Logo" className="h-9 w-9 rounded-full overflow-hidden object-cover" />
          <h1 className="font-bold text-xl text-white">
            Infonex
          </h1>
        </div>
        
        {/* Conditional rendering based on authentication state */}
        <div className="flex items-center space-x-2">
          {isLoading ? (
            // Show loading state
            <div className="flex items-center space-x-2">
              <div className="animate-pulse bg-neutral-700 h-8 w-16 rounded-full"></div>
              <div className="animate-pulse bg-neutral-700 h-8 w-8 rounded-full"></div>
            </div>
          ) : isAuthenticated ? (
            // Authenticated users: show New Chat button and User Menu
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white transition-colors"
                onClick={handleNewChat}
                data-testid="button-new-chat"
              >
                <PlusCircle className="h-4 w-4 mr-1" />
                New Chat
              </Button>
              <UserMenu />
            </>
          ) : (
            // Non-authenticated users: show Sign In and Sign Up buttons
            <AuthButtons />
          )}
        </div>
      </div>
      <div className="text-center pb-1 text-xs text-neutral-500">
        Developed by Infonex
      </div>
    </header>
  );
}