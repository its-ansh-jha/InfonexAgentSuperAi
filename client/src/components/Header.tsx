import React from 'react';
import { PlusCircle, Menu, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/context/ChatContext';
import { useChatHistory } from '@/context/ChatHistoryContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import logoImage from '../assets/logo.webp';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocation } from 'wouter';

export function Header() {
  const { clearMessages } = useChat();
  const { startNewChat } = useChatHistory();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  
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

  const handleSignIn = () => {
    window.location.href = '/api/login';
  };

  const handleSignUp = () => {
    window.location.href = '/api/login';
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
        <div className="flex items-center space-x-2">
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-neutral-700 animate-pulse"></div>
              <div className="h-8 w-20 rounded-full bg-neutral-700 animate-pulse"></div>
            </div>
          ) : isAuthenticated ? (
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
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white transition-colors"
                    data-testid="button-menu"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-neutral-800 border-neutral-700 text-white">
                  <DropdownMenuItem 
                    className="hover:bg-neutral-700 cursor-pointer" 
                    onClick={() => navigate("/privacy-policy")}
                  >
                    Privacy Policy
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="hover:bg-neutral-700 cursor-pointer" 
                    onClick={() => navigate("/terms-conditions")}
                  >
                    Terms & Conditions
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="hover:bg-neutral-700 cursor-pointer" 
                    onClick={() => window.location.href = '/api/logout'}
                  >
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white transition-colors"
                onClick={handleSignIn}
                data-testid="button-sign-in"
              >
                <LogIn className="h-4 w-4 mr-1" />
                Sign In
              </Button>
              
              <Button
                variant="default"
                size="sm"
                className="flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-primary hover:bg-primary/90 text-white transition-colors"
                onClick={handleSignUp}
                data-testid="button-sign-up"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Sign Up
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="text-center pb-1 text-xs text-neutral-500">
        Developed by Infonex
      </div>
    </header>
  );
}