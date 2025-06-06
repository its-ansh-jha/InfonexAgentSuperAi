import { Message } from '@/types';
import { apiRequest } from '@/lib/queryClient';

export interface ImageData {
  type: 'image';
  image_data: string;
}

export interface TextData {
  type: 'text';
  text: string;
}

export type MessageContent = string | (TextData | ImageData)[];

export async function uploadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const base64Data = reader.result as string;
      resolve(base64Data);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

export async function sendMessageWithImage(
  content: string,
  imageData: string | null,
  model: 'gpt-4o' | 'gpt-4o-mini' | 'llama-4-maverick',
  messages: Message[]
): Promise<Message> {
  try {
    let messageContent: MessageContent;
    
    // If there's an image, create a multimodal message
    if (imageData) {
      messageContent = [
        { type: 'text', text: content },
        { type: 'image', image_data: imageData }
      ];
    } else {
      messageContent = content;
    }
    
    // Convert messages for API format
    const apiMessages = messages.map(({ role, content }) => ({ 
      role, 
      content 
    }));
    
    // Add the new message with possibly multimodal content
    const newMessage = {
      role: 'user' as const,
      content: messageContent
    };
    
    // Use the improved apiRequest function
    const data = await apiRequest<{
      message: { role: 'user' | 'assistant' | 'system'; content: string };
      model: string;
    }>({
      url: '/api/chat',
      method: 'POST',
      data: {
        model: model,
        messages: [...apiMessages, newMessage],
      },
    });
    
    return {
      role: data.message.role as 'user' | 'assistant' | 'system',
      content: data.message.content,
      model,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error sending message with image:', error);
    throw error;
  }
}

export async function sendMessage(
  content: string,
  model: 'gpt-4o' | 'gpt-4o-mini' | 'llama-4-maverick',
  messages: Message[]
): Promise<Message> {
  try {
    // Use the improved apiRequest function
    const data = await apiRequest<{
      message: { role: 'user' | 'assistant' | 'system'; content: string };
      model: string;
    }>({
      url: '/api/chat',
      method: 'POST',
      data: {
        model: model,
        messages: messages.map(({ role, content }) => ({ role, content })),
      },
    });
    
    return {
      role: data.message.role as 'user' | 'assistant' | 'system',
      content: data.message.content,
      model: model,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}
