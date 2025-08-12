import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/components/ChatMessage';
import { useChat } from '@/context/ChatContext';
import { useChatHistory } from '@/context/ChatHistoryContext';
import { Loader2 } from 'lucide-react';

export function ChatContainer() {
  const { messages, isLoading } = useChat();
  const { updateCurrentChat } = useChatHistory();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Update chat history in the background when messages change
  // This stores conversation context even though we don't show it to the user
  useEffect(() => {
    // Only update if there are messages to save
    if (messages.length > 0) {
      updateCurrentChat(messages);
    }
  }, [messages, updateCurrentChat]);

  return (
    <main className="flex-grow container mx-auto px-4 py-6 overflow-auto bg-background subtle-grid">
      <div className="max-w-3xl mx-auto space-y-6 relative">
        {/* Subtle indicator line */}
        <div className="absolute top-0 left-0 w-[2px] h-full bg-primary bg-opacity-10"></div>
        
        {messages.map((message, index) => {
          // Use typing animation for the last AI message and control it with isTyping state
          const shouldUseTyping = message.role === 'assistant' && 
                                 index === messages.length - 1 && 
                                 messages.length > 1;
          
          return (
            <ChatMessage 
              key={index} 
              message={message} 
              useTypingAnimation={shouldUseTyping}
            />
          );
        })}
        
        {isLoading && (
          <div className="flex items-start space-x-3 animate-fade-in">
            <div className="bg-primary rounded-full w-8 h-8 flex items-center justify-center text-white flex-shrink-0 mt-1 shadow-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
            <div className="bg-card/80 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-border/50">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-100"></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-200"></div>
                </div>
                <span className="text-sm text-muted-foreground animate-pulse">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </main>
  );
}
