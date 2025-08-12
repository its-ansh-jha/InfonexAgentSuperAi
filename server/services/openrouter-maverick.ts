import { Request, Response } from 'express';
import fetch from 'node-fetch';
import { ChatCompletionRequest } from '@shared/schema';
import FormData from 'form-data';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'meta-llama/llama-4-maverick:free';

// Function to convert base64 to blob for image handling
const base64ToBlob = async (base64: string, type: string): Promise<Buffer> => {
  // Remove the data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  
  // Create buffer from base64
  return Buffer.from(base64Data, 'base64');
};

// Process image content if present in the message
const processMessageContent = async (message: any) => {
  // If message has content array (multimodal), process it
  if (Array.isArray(message.content)) {
    const processedContent = [];
    
    for (const item of message.content) {
      if (item.type === 'image' && item.image_data) {
        // Process base64 image
        processedContent.push({
          type: 'image_url',
          image_url: {
            url: item.image_data // Pass through the base64 content
          }
        });
      } else {
        processedContent.push(item);
      }
    }
    
    return processedContent;
  }
  
  // Return original content if not multimodal
  return message.content;
};

export async function generateMaverickResponse(
  request: ChatCompletionRequest
) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured.');
  }

  try {
    console.log('[express] Sending request to Llama-4-Maverick');
    
    // Process messages to handle multimodal content
    const processedMessages = [];
    
    for (const message of request.messages) {
      const processedContent = await processMessageContent(message);
      const processedMessage = { 
        ...message,
        content: processedContent
      };
      
      processedMessages.push(processedMessage);
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.REPLIT_DOMAINS?.split(",")[0] || 'https://infonex.replit.app', 
        'X-Title': 'Infonex by Infonex Pvt Ltd'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: processedMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[express] OpenRouter Maverick API error:', errorData);
      throw new Error(
        `Error from OpenRouter API: ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    console.log('[express] Model Llama-4-Maverick response:', data.choices[0].message.content.substring(0, 50) + '...');
    
    return {
      role: 'assistant',
      content: data.choices[0].message.content,
      model: 'llama-4-maverick',
    };
  } catch (error) {
    console.error('[express] Error with OpenRouter Maverick:', error);
    throw error;
  }
}

// Handler for image uploads
export async function handleImageUpload(req: Request, res: Response) {
  try {
    // Check if file is uploaded via multer
    const file = (req as any).file;
    
    if (!file) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    
    // Convert buffer to base64
    const base64Data = file.buffer.toString('base64');
    
    // Return success with the base64 image data
    return res.status(200).json({ 
      success: true, 
      url: base64Data // Return base64 data that can be used directly
    });
  } catch (error) {
    console.error('[express] Error handling image upload:', error);
    return res.status(500).json({ 
      error: 'Error processing image upload',
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}