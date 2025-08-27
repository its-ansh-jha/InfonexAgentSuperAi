
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Chat, Message } from '@/types';

const STORAGE_KEY = 'chat-history';

interface ChatHistoryContextType {
  chats: Chat[];
  currentChatId: string | null;
  createNewChat: (title?: string) => Promise<string>;
  selectChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  updateChatTitle: (chatId: string, title: string) => void;
  addMessageToCurrentChat: (message: Message) => void;
  clearAllChats: () => Promise<void>;
}

const ChatHistoryContext = createContext<ChatHistoryContextType | undefined>(undefined);

export function ChatHistoryProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Load chat sessions from database on mount
  useEffect(() => {
    loadChatsFromDatabase();
  }, []);

  const loadChatsFromDatabase = async () => {
    try {
      const response = await fetch('/api/chat-sessions?limit=50');
      if (response.ok) {
        const data = await response.json();
        const sessions = data.sessions || data; // Handle both paginated and non-paginated responses
        const formattedChats: Chat[] = sessions.map((session: any) => ({
          id: session.id.toString(),
          title: session.title,
          messages: [],
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        }));
        setChats(formattedChats);
      }
    } catch (error) {
      console.error('Failed to load chats from database:', error);
    }
  };

  const loadChatMessages = async (chatId: string): Promise<Message[]> => {
    try {
      const response = await fetch(`/api/chat-sessions/${chatId}`);
      if (response.ok) {
        const sessionData = await response.json();
        return sessionData.messages.map((msg: any) => ({
          id: msg.id.toString(),
          role: msg.role as 'user' | 'assistant' | 'system',
          content: typeof msg.content === 'string' ? msg.content : JSON.parse(msg.content),
          timestamp: msg.timestamp,
          model: msg.model
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to load chat messages:', error);
      return [];
    }
  };

  const createNewChat = async (title?: string): Promise<string> => {
    try {
      const response = await fetch('/api/chat-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title || 'New Conversation',
          userId: null // You can add user authentication later
        }),
      });

      if (response.ok) {
        const newSession = await response.json();
        const newChat: Chat = {
          id: newSession.id.toString(),
          title: newSession.title,
          messages: [],
          createdAt: newSession.createdAt,
          updatedAt: newSession.updatedAt
        };

        setChats(prev => [...prev, newChat]);
        setCurrentChatId(newChat.id);
        return newChat.id;
      } else {
        throw new Error('Failed to create new chat session');
      }
    } catch (error) {
      console.error('Failed to create new chat:', error);
      throw error;
    }
  };

  const selectChat = async (chatId: string): Promise<void> => {
    try {
      setCurrentChatId(chatId);
      
      // Load messages for this chat if not already loaded
      const chat = chats.find(c => c.id === chatId);
      if (chat && chat.messages.length === 0) {
        const messages = await loadChatMessages(chatId);
        setChats(prev => prev.map(c => 
          c.id === chatId ? { ...c, messages } : c
        ));
      }
    } catch (error) {
      console.error('Failed to select chat:', error);
    }
  };

  const deleteChat = async (chatId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/chat-sessions/${chatId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setChats(prev => prev.filter(chat => chat.id !== chatId));
        if (currentChatId === chatId) {
          setCurrentChatId(null);
        }
      } else {
        throw new Error('Failed to delete chat session');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      throw error;
    }
  };

  const updateChatTitle = (chatId: string, title: string) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId ? { ...chat, title } : chat
    ));
  };

  const addMessageToCurrentChat = (message: Message) => {
    if (!currentChatId) return;

    setChats(prev => prev.map(chat =>
      chat.id === currentChatId
        ? { ...chat, messages: [...chat.messages, message] }
        : chat
    ));
  };

  const clearAllChats = async (): Promise<void> => {
    try {
      // Delete all chats from database
      await Promise.all(chats.map(chat => deleteChat(chat.id)));
      setChats([]);
      setCurrentChatId(null);
    } catch (error) {
      console.error('Failed to clear all chats:', error);
      throw error;
    }
  };

  return (
    <ChatHistoryContext.Provider
      value={{
        chats,
        currentChatId,
        createNewChat,
        selectChat,
        deleteChat,
        updateChatTitle,
        addMessageToCurrentChat,
        clearAllChats,
      }}
    >
      {children}
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistory() {
  const context = useContext(ChatHistoryContext);
  if (context === undefined) {
    throw new Error('useChatHistory must be used within a ChatHistoryProvider');
  }
  return context;
}
