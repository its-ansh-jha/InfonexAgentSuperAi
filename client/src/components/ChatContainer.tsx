import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/components/ChatMessage';
import { useChat } from '@/context/ChatContext';
import { useChatHistory } from '@/context/ChatHistoryContext';
import { Loader2 } from 'lucide-react';

export function ChatContainer() {
  const { messages, isLoading, lastMessageId } = useChat();
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
          // Use typing animation only for the last AI message that was just generated
          const shouldUseTyping = message.role === 'assistant' && 
                                 index === messages.length - 1 && 
                                 messages.length > 1 &&
                                 message.timestamp === lastMessageId;
          
          return (
            <ChatMessage 
              key={index} 
              message={message} 
              useTypingAnimation={shouldUseTyping}
            />
          );
        })}
        
        {/* Loading indicator when AI is thinking */}
        {isLoading && (
          <div className="flex items-start space-x-3 mb-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden">
              <img 
                src="/src/assets/logo.webp" 
                alt="AI Logo" 
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="flex-1 bg-neutral-800 rounded-lg p-4 border border-neutral-700">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </main>
  );
}
