import React from 'react';
import { useChat } from '@/context/ChatContext';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useChatHistory } from '@/context/ChatHistoryContext';
import { ChatMenu } from '@/components/ChatMenu';

export function ModelSelector() {
  const { clearMessages } = useChat();
  
  return (
    <div className="bg-muted border-b border-neutral-800">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <ChatMenu />
          <div className="flex items-center">
            <span className="text-sm text-muted-foreground mr-3 font-medium">Using INFONEX AI</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearMessages}
            className="flex items-center gap-1 professional-border"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Chat</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
