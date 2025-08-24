import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Chat, Message } from '@/types';
import { nanoid } from 'nanoid';
import { getSystemMessage, getWelcomeMessage } from '@/utils/helpers';
import { apiRequest } from '@/lib/queryClient';

interface ChatHistoryContextType {
  chats: Chat[];
  currentChatId: string | null;
  currentChat: Chat | null;
  startNewChat: () => void;
  loadChat: (chatId: string) => void;
  updateCurrentChat: (messages: Message[]) => void;
  deleteChat: (chatId: string) => void;
  isLoading: boolean;
}

const ChatHistoryContext = createContext<ChatHistoryContextType | undefined>(undefined);

export const ChatHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load chats from database on initial render
  useEffect(() => {
    loadChatsFromDatabase();
  }, []);

  const loadChatsFromDatabase = async () => {
    try {
      setIsLoading(true);
      const sessions = await apiRequest('/api/chat-sessions');
      
      if (sessions && sessions.length > 0) {
        // Convert database sessions to Chat format
        const dbChats: Chat[] = await Promise.all(
          sessions.map(async (session: any) => {
            try {
              const messages = await apiRequest(`/api/chat-sessions/${session.id}/messages`);
              return {
                id: session.id,
                title: session.title,
                messages: messages.map((msg: any) => ({
                  id: msg.id?.toString() || nanoid(),
                  role: msg.role,
                  content: msg.content,
                  timestamp: new Date(msg.timestamp)
                })),
                createdAt: new Date(session.createdAt),
                updatedAt: new Date(session.updatedAt),
                model: messages.length > 0 ? messages[0].model || 'gpt-4o-mini' : 'gpt-4o-mini'
              };
            } catch (error) {
              console.error(`Failed to load messages for session ${session.id}:`, error);
              return {
                id: session.id,
                title: session.title,
                messages: [],
                createdAt: new Date(session.createdAt),
                updatedAt: new Date(session.updatedAt),
                model: 'gpt-4o-mini'
              };
            }
          })
        );

        setChats(dbChats);
        
        // Set the most recent chat as current
        if (dbChats.length > 0) {
          const sortedChats = [...dbChats].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          setCurrentChatId(sortedChats[0].id);
        }
      } else {
        // If no saved chats, start a new chat
        await startNewChatInternal();
      }
    } catch (error) {
      console.error('Failed to load chats from database:', error);
      // Fall back to creating new chat
      await startNewChatInternal();
    } finally {
      setIsLoading(false);
    }
  };
  
  const startNewChatInternal = async () => {
    try {
      const response = await apiRequest('/api/chat-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' })
      });
      
      const newChatId = response.sessionId;
      const newChat: Chat = {
        id: newChatId,
        title: 'New Conversation',
        messages: [getWelcomeMessage()],
        createdAt: new Date(),
        updatedAt: new Date(),
        model: 'gpt-4o-mini'
      };
      
      setChats(prev => [newChat, ...prev]);
      setCurrentChatId(newChatId);
    } catch (error) {
      console.error('Failed to create new chat session:', error);
      // Fall back to local chat
      const fallbackId = nanoid();
      const fallbackChat: Chat = {
        id: fallbackId,
        title: 'New Conversation',
        messages: [getWelcomeMessage()],
        createdAt: new Date(),
        updatedAt: new Date(),
        model: 'gpt-4o-mini'
      };
      setChats(prev => [fallbackChat, ...prev]);
      setCurrentChatId(fallbackId);
    }
  };

  const startNewChat = useCallback(() => {
    startNewChatInternal();
  }, []);
  
  const loadChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
  }, []);

  const updateCurrentChat = useCallback(async (messages: Message[]) => {
    if (!currentChatId) return;
    
    try {
      // Update local state immediately
      setChats(prev => 
        prev.map(chat => 
          chat.id === currentChatId
            ? {
                ...chat,
                messages,
                updatedAt: new Date(),
                // Update title based on first user message if it's still the default
                title: chat.title === 'New Conversation' && messages.length > 1
                  ? generateChatTitle(messages[1]) // Skip welcome message
                  : chat.title
              }
            : chat
        )
      );
      
      // Update title in database if needed
      const currentChatData = chats.find(chat => chat.id === currentChatId);
      if (currentChatData && currentChatData.title === 'New Conversation' && messages.length > 1) {
        const newTitle = generateChatTitle(messages[1]);
        await apiRequest(`/api/chat-sessions/${currentChatId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle })
        });
      }
    } catch (error) {
      console.error('Failed to update chat session:', error);
    }
  }, [currentChatId, chats]);

  const deleteChat = useCallback(async (chatId: string) => {
    try {
      // Note: We're not implementing delete endpoint yet, just local removal
      setChats(prev => {
        const filtered = prev.filter(chat => chat.id !== chatId);
        
        // If we deleted the current chat, switch to another one or create new
        if (chatId === currentChatId) {
          if (filtered.length > 0) {
            setCurrentChatId(filtered[0].id);
          } else {
            startNewChatInternal();
          }
        }
        
        return filtered;
      });
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  }, [currentChatId]);

  const currentChat = chats.find(chat => chat.id === currentChatId) || null;

  return (
    <ChatHistoryContext.Provider value={{
      chats,
      currentChatId,
      currentChat,
      startNewChat,
      loadChat,
      updateCurrentChat,
      deleteChat,
      isLoading
    }}>
      {children}
    </ChatHistoryContext.Provider>
  );
};

// Helper function to generate a title from the first message
function generateChatTitle(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
  } else if (Array.isArray(message.content)) {
    const textContent = message.content.find(item => item.type === 'text');
    if (textContent && 'text' in textContent) {
      const text = textContent.text;
      return text.slice(0, 50) + (text.length > 50 ? '...' : '');
    }
  }
  return 'New Conversation';
}

export const useChatHistory = () => {
  const context = useContext(ChatHistoryContext);
  if (context === undefined) {
    throw new Error('useChatHistory must be used within a ChatHistoryProvider');
  }
  return context;
};