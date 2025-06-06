import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { Message } from '@/types';
import { sendMessage, sendMessageWithImage, uploadImage } from '@/utils/api';
import { getSystemMessage } from '@/utils/helpers';
import { useToast } from '@/hooks/use-toast';
import { useChatHistory } from '@/context/ChatHistoryContext';

interface ChatContextType {
  messages: Message[];
  sendUserMessage: (content: string, imageFile?: File | null) => Promise<void>;
  searchAndRespond: (query: string) => Promise<void>;
  isLoading: boolean;
  regenerateLastResponse: () => Promise<void>;
  regenerateResponseAtIndex: (messageIndex: number) => Promise<void>;
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
      model: 'gpt-4o',
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
          'gpt-4o', 
          currentMessages
        );
      } else {
        // Use regular text API call
        aiResponse = await sendMessage(
          content, 
          'gpt-4o', 
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
        model: 'gpt-4o',
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

      // Extract content from user message and handle multimodal content
      let textContent = '';
      let imageData = null;

      if (typeof userMessage.content === 'string') {
        textContent = userMessage.content;
      } else if (Array.isArray(userMessage.content)) {
        // Handle multimodal content
        const textPart = userMessage.content.find(item => item.type === 'text');
        const imagePart = userMessage.content.find(item => item.type === 'image');

        textContent = textPart?.text || '';
        imageData = imagePart?.image_data || null;
      } else {
        textContent = 'Could not retrieve message content';
      }

      let aiResponse;

      if (imageData) {
        // Use the image-enabled API call with preserved image data
        aiResponse = await sendMessageWithImage(
          textContent,
          imageData,
          'gpt-4o',
          currentMessages
        );
      } else {
        // Regular text message
        aiResponse = await sendMessage(
          textContent,
          'gpt-4o',
          currentMessages
        );
      }

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
        model: 'gpt-4o',
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

  const regenerateResponseAtIndex = useCallback(async (messageIndex: number) => {
    if (messageIndex >= messages.length || messages[messageIndex].role !== 'assistant') return;

    // Find the user message that prompted this assistant response
    let userMessageIndex = -1;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessageIndex = i;
        break;
      }
    }

    if (userMessageIndex === -1) return;

    const userMessage = messages[userMessageIndex];

    // Remove the assistant message and any subsequent messages
    const messagesUpToUserMessage = messages.slice(0, messageIndex);
    setMessages(messagesUpToUserMessage);
    updateCurrentChat(messagesUpToUserMessage);

    // Show loading state
    setIsLoading(true);

    try {
      // Get current messages at the time of regeneration
      const currentMessages = [systemMessage, ...messagesUpToUserMessage];

      // Extract content and image data from user message
      let textContent = '';
      let imageData: string | null = null;

      if (typeof userMessage.content === 'string') {
        textContent = userMessage.content;
      } else if (Array.isArray(userMessage.content)) {
        // Handle multimodal content
        for (const item of userMessage.content) {
          if (item.type === 'text') {
            textContent = item.text || item.content || '';
          } else if (item.type === 'image' && item.image_data) {
            imageData = item.image_data;
          }
        }
      }

      let aiResponse;

      if (imageData) {
        // Use the image-enabled API call with preserved image data
        aiResponse = await sendMessageWithImage(
          textContent,
          imageData,
          'gpt-4o',
          currentMessages
        );
      } else {
        // Regular text message
        aiResponse = await sendMessage(
          textContent,
          'gpt-4o',
          currentMessages
        );
      }

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
        model: 'gpt-4o',
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...messagesUpToUserMessage, errorMessage];
      setMessages(finalMessages);
      updateCurrentChat(finalMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, toast, updateCurrentChat, systemMessage]);

  // Function to search and get AI refined response
  const searchAndRespond = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;

    // Add user's search query to chat
    const userMessage: Message = {
      role: 'user',
      content: `🔍 ${query}`,
      model: 'search',
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    updateCurrentChat(updatedMessages);
    setIsLoading(true);

    try {
      // Search using Serper API
      const searchResponse = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!searchResponse.ok) {
        throw new Error('Search failed');
      }

      const searchData = await searchResponse.json();

      // Create a refined prompt with search results for GPT-4o-mini
      const searchResults = searchData.organic?.slice(0, 5).map((result: any) => 
        `Title: ${result.title}\nSnippet: ${result.snippet}\nURL: ${result.link}`
      ).join('\n\n') || 'No search results found.';

      const refinedPrompt = `Based on the following search results for "${query}", provide a comprehensive and accurate answer:

${searchResults}

Please synthesize this information and provide a helpful response that directly answers the user's query. Include relevant details and cite sources when appropriate.`;

      // Send to GPT-4o-mini for refinement
      const currentMessages = [
        systemMessage,
        ...updatedMessages,
        { role: 'user', content: refinedPrompt }
      ];

      const aiResponse = await sendMessage(
        refinedPrompt,
        'gpt-4o-mini',
        currentMessages
      );

      // Add the refined AI response to the chat
      const newMessage: Message = {
        ...aiResponse,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, newMessage];
      setMessages(finalMessages);
      updateCurrentChat(finalMessages);

      toast({
        title: 'Search completed',
        description: 'Found realtime information and generated response',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to search and respond:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to search for information',
        variant: 'destructive',
      });

      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error while searching for information. Please try again later.',
        model: 'gpt-4o-mini',
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, errorMessage];
      setMessages(finalMessages);
      updateCurrentChat(finalMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, toast, updateCurrentChat, systemMessage, isLoading]);

  return (
    <ChatContext.Provider value={{ 
      messages, 
      sendUserMessage,
      searchAndRespond,
      isLoading, 
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