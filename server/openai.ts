import OpenAI from "openai";
import { ChatCompletionRequest, ChatCompletionResponse } from "@shared/schema";
import { log } from "./vite";

// Use the latest OpenAI model with vision support
const MODEL = "gpt-5-mini";

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
import { searchSerper } from './serper';

// Define available tools for GPT-5
const availableTools = [
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description: "Search the web for real-time information when the user asks about current events, news, or recent information",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find relevant information"
          }
        },
        required: ["query"]
      }
    }
  }
];

export async function generateOpenAIResponse(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured.");
    }

    log(`Sending request to ${MODEL}`);

    // Look for a user message with imageBase64 field.
    // If found, convert .content into the multimodal array.
    const messages = request.messages.map((msg) => {
      if (
        msg.role === "user" &&
        typeof msg === "object" &&
        "imageBase64" in msg &&
        (msg as any).imageBase64
      ) {
        const imageBase64 = (msg as any).imageBase64;
        // Remove imageBase64 after extracting to avoid sending extra fields to OpenAI.
        const { imageBase64: _, ...rest } = msg as any;
        return {
          ...rest,
          content: buildUserContent(
            typeof msg.content === "string" ? msg.content : "",
            imageBase64
          ),
        };
      }
      return msg;
    });

    // Configure OpenAI request with conditional tools
    const openaiRequest: any = {
      model: MODEL,
      messages: messages,
    };

    // Add tools only if web search is enabled
    if (request.webSearchEnabled) {
      openaiRequest.tools = availableTools;
      openaiRequest.tool_choice = "auto";
    }

    const response = await openai.chat.completions.create(openaiRequest);

    // Handle tool calls if web search is enabled
    if (request.webSearchEnabled && response.choices[0].message.tool_calls) {
      const toolCalls = response.choices[0].message.tool_calls;
      let finalContent = response.choices[0].message.content || "";

      for (const toolCall of toolCalls) {
        if (toolCall.function.name === "web_search") {
          try {
            const searchQuery = JSON.parse(toolCall.function.arguments).query;
            const searchResults = await searchSerper(searchQuery);
            
            // Create a summary of search results
            const searchSummary = searchResults.organic?.slice(0, 5).map((result: any) => 
              `${result.title}: ${result.snippet}`
            ).join('\n') || 'No search results found.';

            // Get AI response with search context
            const contextResponse = await openai.chat.completions.create({
              model: MODEL,
              messages: [
                ...messages,
                {
                  role: "assistant",
                  content: `I searched for "${searchQuery}" and found this information:\n\n${searchSummary}\n\nBased on this current information, here's my response:`
                }
              ]
            });

            finalContent = contextResponse.choices[0].message.content || finalContent;
          } catch (searchError) {
            log(`Web search error: ${(searchError as Error).message}`, "error");
            // Continue with original response if search fails
          }
        }
      }

      return {
        message: {
          role: "assistant",
          content: finalContent,
        },
        model: "gpt-5-mini",
      };
    }

    if (!response.choices[0].message.content) {
      throw new Error("OpenAI returned an empty response");
    }

    return {
      message: {
        role: "assistant",
        content: response.choices[0].message.content,
      },
      model: "gpt-5-mini",
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
