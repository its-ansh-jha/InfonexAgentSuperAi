import React from 'react';
import { Header } from '@/components/Header';
import { ChatContainer } from '@/components/ChatContainer';
import { ChatInput } from '@/components/ChatInput';
import { ChatProvider } from '@/context/ChatContext';
import { ChatHistoryProvider } from '@/context/ChatHistoryContext';

export default function Home() {
  return (
    <ChatHistoryProvider>
      <ChatProvider>
        <div className="flex flex-col min-h-screen bg-neutral-900 text-white">
          <Header />
          <ChatContainer />
          <ChatInput />
        </div>
      </ChatProvider>
    </ChatHistoryProvider>
  );
}
