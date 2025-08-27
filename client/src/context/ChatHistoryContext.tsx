import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Chat, Message } from '@/types';
import { nanoid } from 'nanoid';
import { getSystemMessage, getWelcomeMessage } from '@/utils/helpers';

interface ChatHistoryContextType {
  chats: Chat[];
  currentChatId: string | null;
  currentChat: Chat | null;
  startNewChat: () => void;
  loadChat: (chatId: string) => void;
  updateCurrentChat: (messages: Message[]) => void;
  deleteChat: (chatId: string) => void;
}

const ChatHistoryContext = createContext<ChatHistoryContextType | undefined>(undefined);

const STORAGE_KEY = 'infoagent-chat-history';

export const ChatHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Load chats from localStorage on initial render
  useEffect(() => {
    const savedChats = localStorage.getItem(STORAGE_KEY);
    const savedCurrentChatId = localStorage.getItem(`${STORAGE_KEY}-current`);
    
    console.log('Loading chat history on app start:', { savedChats: savedChats ? 'found' : 'none', savedCurrentChatId });
    
    if (savedChats) {
      try {
        const parsedChats = JSON.parse(savedChats) as Chat[];
        console.log('Parsed chats from localStorage:', parsedChats.length, 'chats found');
        
        if (parsedChats.length > 0) {
          console.log('First chat messages:', parsedChats[0].messages.length);
        }
        
        setChats(parsedChats);
        
        // Try to restore the previously selected chat first
        if (savedCurrentChatId && parsedChats.find(chat => chat.id === savedCurrentChatId)) {
          console.log('Restoring saved current chat:', savedCurrentChatId);
          setCurrentChatId(savedCurrentChatId);
        } else if (parsedChats.length > 0) {
          // Fallback to most recent chat if saved current chat doesn't exist
          const sortedChats = [...parsedChats].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          console.log('Setting most recent chat as current:', sortedChats[0].id);
          setCurrentChatId(sortedChats[0].id);
        }
      } catch (error) {
        console.error('Failed to parse saved chats:', error);
        // If parsing fails, start fresh
        startNewChat();
      }
    } else {
      console.log('No saved chats found, starting new chat');
      // If no saved chats, start a new chat
      startNewChat();
    }
  }, []);

  // Save chats to localStorage whenever chats change
  useEffect(() => {
    if (chats.length > 0) {
      try {
        // Clean up old chats to prevent storage overflow
        const maxChats = 10; // Limit to 10 recent chats
        const recentChats = chats.slice(-maxChats);
        
        // Preserve multimodal content but compress large base64 images for storage
        const cleanedChats = recentChats.map(chat => ({
          ...chat,
          messages: chat.messages.map(msg => {
            if (Array.isArray(msg.content)) {
              // Keep all content types but handle images smartly
              return {
                ...msg,
                content: msg.content.map(item => {
                  if (item.type === 'image_url' && (item as any).image_url?.url) {
                    const url = (item as any).image_url.url;
                    // Keep HTTPS URLs (AI-generated images) but mark base64 for potential removal
                    if (url.startsWith('https://')) {
                      return item; // Keep AI-generated image URLs
                    } else if (url.startsWith('data:image')) {
                      // For large base64 images, replace with placeholder but keep structure
                      return {
                        ...item,
                        image_url: {
                          url: '[Large uploaded image - temporarily removed to save storage]'
                        }
                      };
                    }
                  }
                  return item; // Keep all other content types (text, etc.)
                })
              };
            }
            return msg;
          })
        }));
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedChats));
      } catch (error) {
        console.warn('Failed to save chat history to localStorage:', error);
        // Clear localStorage if it's full and try again with minimal data
        try {
          localStorage.removeItem(STORAGE_KEY);
          // Keep only the current chat with minimal content
          const minimalChats = chats.slice(-1).map(chat => ({
            ...chat,
            messages: chat.messages.map(msg => {
              if (typeof msg.content === 'string') {
                return msg;
              } else if (Array.isArray(msg.content)) {
                // Keep structure but minimize content
                const hasText = msg.content.some(item => item.type === 'text');
                const hasImage = msg.content.some(item => item.type === 'image_url');
                const hasPdf = msg.content.some(item => item.type === 'pdf_link');
                
                if (hasText && (hasImage || hasPdf)) {
                  return {
                    ...msg,
                    content: msg.content.map(item => {
                      if (item.type === 'text') return item;
                      if (item.type === 'pdf_link') return item; // Keep PDF links intact
                      if (item.type === 'image_url') {
                        return {
                          type: 'image_url',
                          image_url: { url: '[Image content temporarily removed to save storage]' }
                        };
                      }
                      return item;
                    })
                  };
                } else if (hasText) {
                  return {
                    ...msg,
                    content: msg.content.filter(item => item.type === 'text' || item.type === 'pdf_link')
                  };
                } else if (hasPdf) {
                  return {
                    ...msg,
                    content: msg.content.filter(item => item.type === 'pdf_link')
                  };
                } else {
                  return {
                    ...msg,
                    content: 'Multimodal message content'
                  };
                }
              } else {
                return {
                  ...msg,
                  content: 'Unable to preserve message content'
                };
              }
            })
          }));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalChats));
        } catch (fallbackError) {
          console.error('Failed to save even minimal chat history:', fallbackError);
        }
      }
    }
  }, [chats]);

  // Add beforeunload listener to ensure data is saved before page refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Force save current chat state before page unload
      if (chats.length > 0) {
        try {
          const maxChats = 10;
          const recentChats = chats.slice(-maxChats);
          
          const cleanedChats = recentChats.map(chat => ({
            ...chat,
            messages: chat.messages.map(msg => {
              if (Array.isArray(msg.content)) {
                return {
                  ...msg,
                  content: msg.content.map(item => {
                    if (item.type === 'image_url' && (item as any).image_url?.url) {
                      const url = (item as any).image_url.url;
                      if (url.startsWith('https://')) {
                        return item;
                      } else if (url.startsWith('data:image')) {
                        return {
                          ...item,
                          image_url: {
                            url: '[Large uploaded image - temporarily removed to save storage]'
                          }
                        };
                      }
                    }
                    return item;
                  })
                };
              }
              return msg;
            })
          }));
          
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedChats));
          if (currentChatId) {
            localStorage.setItem(`${STORAGE_KEY}-current`, currentChatId);
          }
        } catch (error) {
          console.warn('Failed to save chat history before unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [chats, currentChatId]);

  const startNewChat = useCallback(() => {
    const systemMessage = getSystemMessage();
    const welcomeMessage = getWelcomeMessage('gpt-4o-mini');
    
    const newChat: Chat = {
      id: nanoid(),
      title: 'New Conversation',
      messages: [welcomeMessage],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setChats(prevChats => [newChat, ...prevChats]);
    setCurrentChatId(newChat.id);
    localStorage.setItem(`${STORAGE_KEY}-current`, newChat.id);
    
    return newChat;
  }, []);

  const loadChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
    localStorage.setItem(`${STORAGE_KEY}-current`, chatId);
  }, []);

  const updateCurrentChat = useCallback((messages: Message[]) => {
    if (!currentChatId) return;
    
    setChats(prevChats => {
      const updatedChats = prevChats.map(chat => {
        if (chat.id === currentChatId) {
          // Generate a title from the first user message if it's a new chat with default title
          let title = chat.title;
          if (title === 'New Conversation' && messages.length >= 3) {
            const firstUserMessage = messages.find(m => m.role === 'user');
            if (firstUserMessage) {
              // Extract text from potentially complex content
              let messageText = '';
              
              if (typeof firstUserMessage.content === 'string') {
                messageText = firstUserMessage.content;
              } else if (Array.isArray(firstUserMessage.content)) {
                // Extract text from multimodal content
                messageText = firstUserMessage.content
                  .filter(item => item.type === 'text' && item.text)
                  .map(item => item.text)
                  .join(' ');
              }
              
              // Use the first few words for the title
              const words = messageText.split(' ');
              title = words.slice(0, Math.min(8, words.length)).join(' ');
              
              // Add ellipsis if the content was truncated
              if (words.length > 8) {
                title += '...';
              }
              
              // If no text content was found or the title is empty, use a default
              if (!title || title.trim() === '') {
                title = 'Image Conversation';
              }
            }
          }
          
          return {
            ...chat,
            messages,
            title,
            updatedAt: new Date().toISOString()
          };
        }
        return chat;
      });

      // Immediately save to localStorage to prevent data loss on refresh
      try {
        const maxChats = 10;
        const recentChats = updatedChats.slice(-maxChats);
        
        const cleanedChats = recentChats.map(chat => ({
          ...chat,
          messages: chat.messages.map(msg => {
            if (Array.isArray(msg.content)) {
              return {
                ...msg,
                content: msg.content.map(item => {
                  if (item.type === 'image_url' && (item as any).image_url?.url) {
                    const url = (item as any).image_url.url;
                    if (url.startsWith('https://')) {
                      return item;
                    } else if (url.startsWith('data:image')) {
                      return {
                        ...item,
                        image_url: {
                          url: '[Large uploaded image - temporarily removed to save storage]'
                        }
                      };
                    }
                  }
                  return item;
                })
              };
            }
            return msg;
          })
        }));
        
        console.log('Immediately saving chat with', messages.length, 'messages to localStorage');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedChats));
        localStorage.setItem(`${STORAGE_KEY}-current`, currentChatId);
      } catch (error) {
        console.warn('Failed to immediately save chat history:', error);
      }

      return updatedChats;
    });
  }, [currentChatId]);

  const deleteChat = useCallback((chatId: string) => {
    setChats(prevChats => {
      const filteredChats = prevChats.filter(chat => chat.id !== chatId);
      
      // If the deleted chat was the current one, select another chat
      if (chatId === currentChatId && filteredChats.length > 0) {
        const newCurrentId = filteredChats[0].id;
        setCurrentChatId(newCurrentId);
        localStorage.setItem(`${STORAGE_KEY}-current`, newCurrentId);
      } else if (filteredChats.length === 0) {
        // If no chats left, create a new one
        localStorage.removeItem(`${STORAGE_KEY}-current`);
        startNewChat();
      }
      
      return filteredChats;
    });
  }, [currentChatId, startNewChat]);

  // Get the current chat object
  const currentChat = chats.find(chat => chat.id === currentChatId) || null;

  const value = {
    chats,
    currentChatId,
    currentChat,
    startNewChat,
    loadChat,
    updateCurrentChat,
    deleteChat
  };

  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  );
};

export const useChatHistory = (): ChatHistoryContextType => {
  const context = useContext(ChatHistoryContext);
  if (context === undefined) {
    throw new Error('useChatHistory must be used within a ChatHistoryProvider');
  }
  return context;
};