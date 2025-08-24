import OpenAI from "openai";
import { ChatCompletionRequest, ChatCompletionResponse } from "@shared/schema";
import { log } from "../vite";
import { searchOpenAIEnhanced } from "./search";
import { searchSerper } from "./serper";

// Use the latest OpenAI model with vision support
const MODEL = "gpt-4o";

// Initialize OpenAI client for GPT-4o
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Initialize separate OpenAI client for GPT-4o-mini (for search refinement)
const openaiMini = new OpenAI({
  apiKey: process.env.OPENAI_MINI_API_KEY || process.env.OPENAI_API_KEY || '',
});

// Define available tools for the AI
const availableTools = [
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description: "Search the web for current, real-time information. Use this when you need up-to-date information, news, current events, or anything that might have changed recently.",
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
  },
  {
    type: "function" as const,
    function: {
      name: "file_search",
      description: "Search through uploaded files and documents to find specific information. Use this to analyze documents, find specific content within files, or answer questions about uploaded materials.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to search for in the files"
          },
          file_type: {
            type: "string",
            description: "Optional: specific file type to search (pdf, txt, doc, etc.)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "generate_image",
      description: "Generate images based on text descriptions. Use this when the user asks for visual content, artwork, diagrams, or any kind of image creation.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Detailed description of the image to generate"
          },
          size: {
            type: "string",
            enum: ["1024x1024", "1792x1024", "1024x1792"],
            description: "Image dimensions"
          },
          quality: {
            type: "string",
            enum: ["standard", "hd"],
            description: "Image quality level"
          }
        },
        required: ["prompt"]
      }
    }
  }
];

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
 * Execute a tool call based on the function name and arguments
 */
async function executeToolCall(functionName: string, args: any): Promise<string> {
  try {
    switch (functionName) {
      case "web_search":
        log(`Executing web search: ${args.query}`);
        const searchResults = await searchSerper(args.query);
        return JSON.stringify({
          search_results: searchResults.organic?.slice(0, 5).map((result: any) => ({
            title: result.title,
            snippet: result.snippet,
            url: result.link
          })) || [],
          query: args.query
        });
      
      case "file_search":
        log(`Executing file search: ${args.query}`);
        // For now, return a placeholder - you would implement actual file search here
        return JSON.stringify({
          message: "File search functionality is available but no files are currently uploaded. Please upload documents to search through them.",
          query: args.query
        });
      
      case "generate_image":
        log(`Executing image generation: ${args.prompt}`);
        try {
          const imageResponse = await openai.images.generate({
            model: "dall-e-3",
            prompt: args.prompt,
            size: args.size || "1024x1024",
            quality: args.quality || "standard",
            n: 1
          });
          
          const imageUrl = imageResponse.data?.[0]?.url || "";
          
          // Return with special format that includes image display metadata
          return JSON.stringify({
            type: "image_generation_result",
            image_url: imageUrl,
            prompt: args.prompt,
            message: `Here is the image I generated for you: "${args.prompt}"`,
            display_image: true
          });
        } catch (imageError: any) {
          log(`Image generation error: ${imageError.message}`, "error");
          return JSON.stringify({
            error: "Failed to generate image",
            message: imageError.message || "Image generation is temporarily unavailable"
          });
        }
      
      default:
        return JSON.stringify({ error: `Unknown function: ${functionName}` });
    }
  } catch (error: any) {
    log(`Tool execution error for ${functionName}: ${error.message}`, "error");
    return JSON.stringify({ 
      error: `Failed to execute ${functionName}`, 
      message: error.message 
    });
  }
}

/**
 * This function expects that user messages may have an additional field: imageBase64.
 * If present, it will build the multimodal message accordingly.
 */
/**
 * Generate response using GPT-4o-mini specifically for search result refinement
 */
export async function generateOpenAIMiniResponse(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  try {
    if (!process.env.OPENAI_MINI_API_KEY && !process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI Mini API key is not configured.");
    }

    log(`Sending request to gpt-4o-mini for search refinement`);

    const response = await openaiMini.chat.completions.create({
      model: "gpt-4o-mini",
      messages: request.messages as any,
    });

    if (!response.choices[0].message.content) {
      throw new Error("OpenAI returned an empty response");
    }

    return {
      message: {
        role: "assistant",
        content: response.choices[0].message.content,
      },
      model: "gpt-4o-mini",
    };
  } catch (error: any) {
    log(`OpenAI Mini API error: ${error.message}`, "error");

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

export async function generateOpenAIResponse(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured.");
    }

    log(`Sending request to ${MODEL} with tools enabled`);

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

    // Initial AI response with tools
    let response = await openai.chat.completions.create({
      model: MODEL,
      messages: messages as any,
      tools: availableTools,
      tool_choice: "auto", // Let AI decide when to use tools
    });

    const responseMessage = response.choices[0].message;
    
    // Handle tool calls if present
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      log(`AI requested ${responseMessage.tool_calls.length} tool call(s)`);
      
      // Execute all tool calls
      const toolMessages = [];
      
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
        
        const toolResult = await executeToolCall(functionName, functionArgs);
        
        toolMessages.push({
          role: "tool" as const,
          content: toolResult,
          tool_call_id: toolCall.id
        });
      }
      
      // Add assistant message with tool calls and tool responses to conversation
      const updatedMessages: any[] = [
        ...messages,
        {
          role: "assistant",
          content: responseMessage.content,
          tool_calls: responseMessage.tool_calls
        },
        ...toolMessages
      ];
      
      // Check if any tool result contains image generation
      const imageGenerationResult = toolMessages.find(msg => {
        try {
          const result = JSON.parse(msg.content);
          return result.type === "image_generation_result" && result.display_image;
        } catch {
          return false;
        }
      });

      if (imageGenerationResult) {
        // Handle image generation specially
        const result = JSON.parse(imageGenerationResult.content);
        
        // Return multimodal content with image and text
        return {
          message: {
            role: "assistant",
            content: [
              {
                type: "text",
                text: result.message
              },
              {
                type: "image_url",
                image_url: {
                  url: result.image_url
                }
              }
            ] as any
          },
          model: MODEL,
        };
      }

      // Get final response after tool execution for non-image cases
      const finalResponse = await openai.chat.completions.create({
        model: MODEL,
        messages: updatedMessages,
        tools: availableTools,
        tool_choice: "auto"
      });
      
      return {
        message: {
          role: "assistant",
          content: finalResponse.choices[0].message.content || "I used some tools to help answer your question.",
        },
        model: MODEL,
      };
    }

    // No tool calls, return regular response
    if (!responseMessage.content) {
      throw new Error("OpenAI returned an empty response");
    }

    return {
      message: {
        role: "assistant",
        content: responseMessage.content,
      },
      model: MODEL,
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