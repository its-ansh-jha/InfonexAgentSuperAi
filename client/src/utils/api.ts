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
  try {
    // Create FormData to upload the image file
    const formData = new FormData();
    formData.append('image', file);

    // Upload image to server and get URL
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    return result.url;
  } catch (error) {
    console.error('Image upload failed:', error);
    throw new Error('Failed to upload image');
  }
}

export async function sendMessageWithImage(
  content: string,
  imageData: string | null,
  model: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano' | 'gpt-4o' | 'gpt-4o-mini' | 'llama-4-maverick',
  messages: Message[],
  signal?: AbortSignal
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
      url: '/api/chat-with-image',
      method: 'POST',
      data: {
        model: model,
        messages: [...apiMessages, newMessage],
      },
      signal,
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
  model: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano' | 'gpt-4o' | 'gpt-4o-mini' | 'llama-4-maverick',
  messages: Message[],
  signal?: AbortSignal
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
      signal,
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