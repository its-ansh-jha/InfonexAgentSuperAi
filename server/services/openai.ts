import OpenAI from "openai";
import { ChatCompletionRequest, ChatCompletionResponse } from "@shared/schema";
import { log } from "../vite";

// Use the latest OpenAI model with vision support
const MODEL = "gpt-4o";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Build the OpenAI message content as multimodal (text + image) if image is provided.
 * @param text User's text input
 * @param imageBase64 Optional base64 data URL of image (e.g., "data:image/png;base64,...")
 */
function buildUserContent(text: string, imageBase64?: string) {
  if (imageBase64) {
    return [
      { type: "text", text: text || "" },
      { type: "image_url", image_url: { url: imageBase64 } }
    ];
  }
  return text || ""; // fallback for text-only
}

/**
 * This function expects that user messages may have an additional field: imageBase64.
 * If present, it will build the multimodal message accordingly.
 */
export async function generateOpenAIResponse(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured.");
    }

    log(`Sending request to ${MODEL}`);

    // Look for a user message with imageBase64 field or multimodal content.
    // If found, convert .content into the multimodal array.
    const messages = request.messages.map((msg) => {
      if (msg.role === "user") {
        // Handle imageBase64 field (legacy support)
        if (typeof msg === "object" && "imageBase64" in msg && (msg as any).imageBase64) {
          const imageBase64 = (msg as any).imageBase64;
          const { imageBase64: _, ...rest } = msg as any;
          return {
            ...rest,
            content: buildUserContent(
              typeof msg.content === "string" ? msg.content : "",
              imageBase64
            ),
          };
        }
        
        // Handle multimodal content array
        if (Array.isArray(msg.content)) {
          const contentArray = msg.content.map((item: any) => {
            if (item.type === "text") {
              return { type: "text", text: item.text || item.content || "" };
            } else if (item.type === "image" && item.image_data) {
              return { type: "image_url", image_url: { url: item.image_data } };
            }
            return item;
          });
          return { ...msg, content: contentArray };
        }
      }
      return msg;
    });

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: messages,
    });

    if (!response.choices[0].message.content) {
      throw new Error("OpenAI returned an empty response");
    }

    return {
      message: {
        role: "assistant",
        content: response.choices[0].message.content,
      },
      model: "gpt-4o",
    };
  } catch (error: any) {
    log(`OpenAI API error: ${error.message}`, "error");

    if (error.response) {
      // If it's an OpenAI API error with a response
      const status = error.response.status;
      const errorData = error.response.data || {};

      if (status === 401) {
        throw new Error("Invalid API key or authentication error");
      } else if (status === 429) {
        throw new Error("Rate limit exceeded or quota reached");
      } else {
        throw new Error(`OpenAI API error (${status}): ${errorData.error?.message || 'Unknown error'}`);
      }
    }

    // For any other error
    throw new Error(`Error generating response: ${error.message}`);
  }
}