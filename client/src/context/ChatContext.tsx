import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { Message } from '@/types';
import { sendMessage, sendMessageWithImage, uploadImage } from '@/utils/api';
import { getSystemMessage } from '@/utils/helpers';
import { useToast } from '@/hooks/use-toast';
import { useChatHistory } from '@/context/ChatHistoryContext';

interface ChatContextType {
  messages: Message[];
  isLoading: boolean;
  sendUserMessage: (content: string, imageFile?: File | null) => Promise<void>;
  regenerateLastResponse: () => Promise<void>;
  regenerateResponseAtIndex: (userMessageIndex: number) => Promise<void>;
  clearMessages: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Get current chat from ChatHistoryContext
  const { currentChat, updateCurrentChat, startNewChat } = useChatHistory();

  // Update local messages when currentChat changes
  useEffect(() => {
    if (currentChat) {
      setMessages(currentChat.messages);
    } else {
      // If no current chat, create a new one
      startNewChat();
    }
  }, [currentChat, startNewChat]);

  // Store system message for API requests but don't display it
  const systemMessage = getSystemMessage();

  const sendUserMessage = useCallback(async (content: string, imageFile?: File | null) => {
    if (!content.trim() && !imageFile) return;

    // Process any uploaded image file
    let imageData: string | null = null;
    if (imageFile) {
      try {
        // Get base64 representation of the image
        imageData = await uploadImage(imageFile);
        console.log('Image uploaded successfully');
      } catch (error) {
        console.error('Failed to process image:', error);
        toast({
          title: 'Image Upload Error',
          description: 'Failed to process the image. Please try again.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Create the message content based on whether there's an image
    let messageContent: string | Array<{type: string, text?: string, image_data?: string}> = content;
    
    if (imageFile && imageData) {
      // Store a text representation in the UI for the user's message
      messageContent = `[Image attached] ${content}`;
    }

    const userMessage: Message = {
      role: 'user',
      content: messageContent,
      model: 'gpt-4o-mini',
      timestamp: new Date().toISOString(),
    };

    // Add user message to the chat
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    updateCurrentChat(updatedMessages);
    
    // Show loading state
    setIsLoading(true);

    try {
      // Get current messages at the time of sending, including system message for AI context
      const currentMessages = [systemMessage, ...messages, userMessage];
      
      let aiResponse;
      
      if (imageFile && imageData) {
        // Use the image-enabled API call
        aiResponse = await sendMessageWithImage(
          content, 
          imageData, 
          'gpt-4o-mini', 
          currentMessages
        );
      } else {
        // Use regular text API call
        aiResponse = await sendMessage(
          content, 
          'gpt-4o-mini', 
          currentMessages
        );
      }
      
      // Add AI response to the chat
      const newMessage: Message = {
        ...aiResponse,
        timestamp: new Date().toISOString()
      };
      
      const finalMessages = [...updatedMessages, newMessage];
      setMessages(finalMessages);
      updateCurrentChat(finalMessages);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get a response from the AI',
        variant: 'destructive',
      });
      
      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again later.',
        model: 'gpt-4o-mini',
        timestamp: new Date().toISOString(),
      };
      
      const finalMessages = [...updatedMessages, errorMessage];
      setMessages(finalMessages);
      updateCurrentChat(finalMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, toast, updateCurrentChat, systemMessage]);

  // Function to regenerate the last AI response
  const regenerateLastResponse = useCallback(async () => {
    // We need at least a user message to regenerate a response
    if (messages.length < 1) return;
    
    // Find the last user message
    const lastUserMessageIndex = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserMessageIndex === -1) return;
    
    // Get the actual index in the original array
    const userMessageIndex = messages.length - 1 - lastUserMessageIndex;
    const userMessage = messages[userMessageIndex];
    
    // Remove the last AI response and any subsequent messages
    const messagesUpToUserMessage = messages.slice(0, userMessageIndex + 1);
    setMessages(messagesUpToUserMessage);
    updateCurrentChat(messagesUpToUserMessage);
    
    // Show loading state
    setIsLoading(true);
    
    try {
      // Get all messages up to the user message, including system message for context
      const currentMessages = [systemMessage, ...messagesUpToUserMessage];
      
      // Extract content from user message
      const content = typeof userMessage.content === 'string' 
        ? userMessage.content 
        : 'Could not retrieve message content';
      
      // Call the API to regenerate the response
      const aiResponse = await sendMessage(
        content,
        'gpt-4o-mini',
        currentMessages
      );
      
      // Add the new AI response to the chat
      const newMessage: Message = {
        ...aiResponse,
        timestamp: new Date().toISOString()
      };
      
      const finalMessages = [...messagesUpToUserMessage, newMessage];
      setMessages(finalMessages);
      updateCurrentChat(finalMessages);
      
      toast({
        title: 'Response regenerated',
        description: 'A new AI response has been generated',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to regenerate AI response:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to regenerate the AI response',
        variant: 'destructive',
      });
      
      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error generating a new response. Please try again later.',
        model: 'gpt-4o-mini',
        timestamp: new Date().toISOString(),
      };
      
      const finalMessages = [...messagesUpToUserMessage, errorMessage];
      setMessages(finalMessages);
      updateCurrentChat(finalMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, toast, updateCurrentChat, systemMessage]);

  const clearMessages = useCallback(() => {
    // Reset messages but keep chat history in the background
    setMessages([]);
    // The new chat gets created in the ChatHistoryContext
    startNewChat();
  }, [startNewChat]);

  // Function to regenerate a response for a specific user message by index
  const regenerateResponseAtIndex = useCallback(async (userMessageIndex: number) => {
    // Validate the index
    if (userMessageIndex < 0 || userMessageIndex >= messages.length) {
      console.error('Invalid user message index:', userMessageIndex);
      return;
    }
    
    // Verify it's a user message
    const userMessage = messages[userMessageIndex];
    if (userMessage.role !== 'user') {
      console.error('Expected a user message at index:', userMessageIndex);
      return;
    }
    
    // Remove all messages after this user message
    const messagesUpToUserMessage = messages.slice(0, userMessageIndex + 1);
    setMessages(messagesUpToUserMessage);
    updateCurrentChat(messagesUpToUserMessage);
    
    // Show loading state
    setIsLoading(true);
    
    try {
      // Get all messages up to the user message, including system message for context
      const currentMessages = [systemMessage, ...messagesUpToUserMessage];
      
      // Extract content from user message
      const content = typeof userMessage.content === 'string' 
        ? userMessage.content 
        : 'Could not retrieve message content';
      
      // Call the API to regenerate the response
      const aiResponse = await sendMessage(
        content,
        'gpt-4o-mini',
        currentMessages
      );
      
      // Add the new AI response to the chat
      const newMessage: Message = {
        ...aiResponse,
        timestamp: new Date().toISOString()
      };
      
      const finalMessages = [...messagesUpToUserMessage, newMessage];
      setMessages(finalMessages);
      updateCurrentChat(finalMessages);
      
      toast({
        title: 'Response regenerated',
        description: 'A new AI response has been generated',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to regenerate AI response:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to regenerate the AI response',
        variant: 'destructive',
      });
      
      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error generating a new response. Please try again later.',
        model: 'gpt-4o-mini',
        timestamp: new Date().toISOString(),
      };
      
      const finalMessages = [...messagesUpToUserMessage, errorMessage];
      setMessages(finalMessages);
      updateCurrentChat(finalMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, toast, updateCurrentChat, systemMessage]);

  return (
    <ChatContext.Provider value={{ 
      messages, 
      isLoading, 
      sendUserMessage,
      regenerateLastResponse,
      regenerateResponseAtIndex,
      clearMessages 
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};