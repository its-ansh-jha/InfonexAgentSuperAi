import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { Message } from '@/types';
import { sendMessage, sendMessageWithImage, sendReasoningMessage } from '@/utils/api';
import { getSystemMessage } from '@/utils/helpers';
import { useToast } from '@/hooks/use-toast';
import { useChatHistory } from '@/context/ChatHistoryContext';

interface ChatContextType {
  messages: Message[];
  sendUserMessage: (content: string, imageFile?: File | null) => Promise<void>;
  searchAndRespond: (query: string) => Promise<void>;
  reasonAndRespond: (query: string) => Promise<void>;
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

  // Function to detect if a query needs real-time data
  const isRealTimeQuery = (query: string): boolean => {
    const realTimeKeywords = [
      'latest', 'recent', 'current', 'today', 'now', 'breaking', 'news',
      'what happened', 'what\'s happening', 'update', 'this week', 'this month',
      'this year', 'trending', 'weather', 'stock price', 'currency', 'exchange rate',
      'covid', 'coronavirus', 'election', 'sports score', 'match result',
      'who won', 'winner', 'score', 'live', 'real time', 'real-time'
    ];

    const lowerQuery = query.toLowerCase();
    return realTimeKeywords.some(keyword => lowerQuery.includes(keyword));
  };

  const sendUserMessage = useCallback(async (content: string, imageFile?: File | null) => {
    if (!content.trim() && !imageFile) return;

    // Check if this is a real-time query that should be automatically searched
    const shouldAutoSearch = !imageFile && isRealTimeQuery(content);

    if (shouldAutoSearch) {
      // Automatically route to search
      await searchAndRespond(content);
      return;
    }

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
      // Extract content from user message
      const content = typeof userMessage.content === 'string' 
        ? userMessage.content 
        : 'Could not retrieve message content';

      // Check if this is a search message or reasoning message
      const isSearchMessage = userMessage.model === 'search' || content.startsWith('🔍');
      const isReasoningMessage = userMessage.model === 'reasoning' || content.startsWith('🧠');

      if (isSearchMessage) {
        // Extract the actual search query (remove 🔍 if present)
        const searchQuery = content.startsWith('🔍') ? content.replace('🔍 ', '').trim() : content;

        // Perform search using Serper API
        const searchResponse = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: searchQuery }),
        });

        if (!searchResponse.ok) {
          throw new Error('Search failed');
        }

        const searchData = await searchResponse.json();

        // Create a refined prompt with search results for GPT-4o-mini
        const searchResults = searchData.organic?.slice(0, 5).map((result: any) => 
          `Title: ${result.title}\nSnippet: ${result.snippet}\nURL: ${result.link}`
        ).join('\n\n') || 'No search results found.';

        // Check if this is a question about who developed/created the AI
        const isDeveloperQuery = searchQuery.toLowerCase().includes('who developed') || 
                                searchQuery.toLowerCase().includes('who created') ||
                                searchQuery.toLowerCase().includes('who made') ||
                                searchQuery.toLowerCase().includes('developer') ||
                                searchQuery.toLowerCase().includes('creator');

        let refinedPrompt;

        if (isDeveloperQuery && searchQuery.toLowerCase().includes('you')) {
          refinedPrompt = `I was developed by Infonex and I am running as a search question refiner using the GPT-4o-mini AI model engine. I help provide real-time information by searching the web and refining the results to give you accurate and up-to-date answers.

Based on the following search results for "${searchQuery}":

${searchResults}

Please provide a comprehensive response that includes the above information about my development by Infonex and my role as a search refiner, while also incorporating any relevant information from the search results.`;
        } else {
          refinedPrompt = `Based on the following search results for "${searchQuery}", provide a comprehensive and accurate answer:

${searchResults}

Please synthesize this information and provide a helpful response that directly answers the user's query. Include relevant details and cite sources when appropriate.`;
        }

        // Send to GPT-4o-mini for refinement
        const currentMessages = [
          systemMessage,
          ...messagesUpToUserMessage,
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

        const finalMessages = [...messagesUpToUserMessage, newMessage];
        setMessages(finalMessages);
        updateCurrentChat(finalMessages);

        toast({
          title: 'Search response regenerated',
          description: 'A new search response has been generated',
          duration: 2000,
        });
      } else if (isReasoningMessage) {
        // Extract the actual reasoning query (remove 🧠 if present)
        const reasoningQuery = content.startsWith('🧠') ? content.replace('🧠 ', '').trim() : content;

        // Check if this is a question about which model is being used
        const isModelQuery = reasoningQuery.toLowerCase().includes('which model') || 
                            reasoningQuery.toLowerCase().includes('what model') ||
                            reasoningQuery.toLowerCase().includes('which ai') ||
                            reasoningQuery.toLowerCase().includes('what ai') ||
                            reasoningQuery.toLowerCase().includes('ai engine') ||
                            reasoningQuery.toLowerCase().includes('model') ||
                            reasoningQuery.toLowerCase().includes('engine');

        let reasoningPrompt;

        if (isModelQuery && (reasoningQuery.toLowerCase().includes('you') || reasoningQuery.toLowerCase().includes('running'))) {
          reasoningPrompt = `I am using the o4 reasoning model AI engine to answer this question. This advanced reasoning model is designed to provide deep, thoughtful analysis and step-by-step logical reasoning for complex problems.

${reasoningQuery}

Please provide a comprehensive response that includes the above information about the o4 reasoning model while also addressing the specific question asked.`;
        } else {
          reasoningPrompt = `Please provide a detailed, step-by-step reasoning response to the following question. Think through this carefully and show your reasoning process:

${reasoningQuery}

Use advanced reasoning to break down the problem, consider multiple perspectives, and provide a thorough analysis.`;
        }

        // Send to DeepSeek R1 for reasoning
        const currentMessages = [
          systemMessage,
          ...messagesUpToUserMessage,
          { role: 'user', content: reasoningPrompt }
        ];

        const aiResponse = await sendReasoningMessage(
          currentMessages,
          currentSessionId
        );

        // Add the reasoning AI response to the chat
        const newMessage: Message = {
          ...aiResponse,
          timestamp: new Date().toISOString(),
        };

        const finalMessages = [...messagesUpToUserMessage, newMessage];
        setMessages(finalMessages);
        updateCurrentChat(finalMessages);

        toast({
          title: 'Reasoning response regenerated',
          description: 'A new reasoning response has been generated',
          duration: 2000,
        });
      } else {
        // Handle regular (non-search) messages
        // Get all messages up to the user message, including system message for context
        const currentMessages = [systemMessage, ...messagesUpToUserMessage];

        // Check if the message contains image data
        const hasImage = userMessage.imageData || 
          (Array.isArray(userMessage.content) && 
           userMessage.content.some((item: any) => item.type === 'image'));

        let aiResponse;
        if (hasImage) {
          // Handle image messages with GPT-4o
          aiResponse = await sendMessageWithImage(
            typeof userMessage.content === 'string' ? userMessage.content : '',
            userMessage.imageData,
            'gpt-4o',
            currentMessages
          );
        } else {
          // Handle text-only messages with GPT-4o
          aiResponse = await sendMessage(
            content,
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
      }
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
  }, [messages, toast, updateCurrentChat, systemMessage, sendMessage, sendMessageWithImage]);

  // Function to get reasoning response using o4 reasoning model
  const reasonAndRespond = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;

    // Add user's reasoning query to chat
    const userMessage: Message = {
      role: 'user',
      content: `🧠 ${query}`,
      model: 'reasoning',
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    updateCurrentChat(updatedMessages);
    setIsLoading(true);

    try {
      // Check if this is a question about which model is being used
      const isModelQuery = query.toLowerCase().includes('which model') || 
                          query.toLowerCase().includes('what model') ||
                          query.toLowerCase().includes('which ai') ||
                          query.toLowerCase().includes('what ai') ||
                          query.toLowerCase().includes('ai engine') ||
                          query.toLowerCase().includes('model') ||
                          query.toLowerCase().includes('engine');

      let reasoningPrompt;

      if (isModelQuery && (query.toLowerCase().includes('you') || query.toLowerCase().includes('running'))) {
        reasoningPrompt = `I am using the o4 reasoning model AI engine to answer this question. This advanced reasoning model is designed to provide deep, thoughtful analysis and step-by-step logical reasoning for complex problems.

${query}

Please provide a comprehensive response that includes the above information about the o4 reasoning model while also addressing the specific question asked.`;
      } else {
        reasoningPrompt = `Please provide a detailed, step-by-step reasoning response to the following question. Think through this carefully and show your reasoning process:

${query}

Use advanced reasoning to break down the problem, consider multiple perspectives, and provide a thorough analysis.`;
      }

      // Send to DeepSeek R1 for reasoning
      const currentMessages = [
        systemMessage,
        ...updatedMessages,
        { role: 'user', content: reasoningPrompt }
      ];

      const aiResponse = await sendReasoningMessage(
        currentMessages,
        currentSessionId
      );

      // Add the reasoning AI response to the chat
      const newMessage: Message = {
        ...aiResponse,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, newMessage];
      setMessages(finalMessages);
      updateCurrentChat(finalMessages);

      toast({
        title: 'Reasoning completed',
        description: 'Advanced reasoning response generated',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to get reasoning response:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get reasoning response',
        variant: 'destructive',
      });

      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your reasoning request. Please try again later.',
        model: 'deepseek-r1',
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, errorMessage];
      setMessages(finalMessages);
      updateCurrentChat(finalMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, toast, updateCurrentChat, systemMessage, isLoading]);

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

      // Check if this is a question about who developed/created the AI
      const isDeveloperQuery = query.toLowerCase().includes('who developed') || 
                              query.toLowerCase().includes('who created') ||
                              query.toLowerCase().includes('who made') ||
                              query.toLowerCase().includes('developer') ||
                              query.toLowerCase().includes('creator');

      let refinedPrompt;

      if (isDeveloperQuery && query.toLowerCase().includes('you')) {
        refinedPrompt = `I was developed by Infonex and I am running as a search question refiner using the GPT-4o-mini AI model engine. I help provide real-time information by searching the web and refining the results to give you accurate and up-to-date answers.

Based on the following search results for "${query}":

${searchResults}

Please provide a comprehensive response that includes the above information about my development by Infonex and my role as a search refiner, while also incorporating any relevant information from the search results.`;
      } else {
        refinedPrompt = `Based on the following search results for "${query}", provide a comprehensive and accurate answer:

${searchResults}

Please synthesize this information and provide a helpful response that directly answers the user's query. Include relevant details and cite sources when appropriate.`;
      }

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
      reasonAndRespond,
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