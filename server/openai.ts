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
import { searchSerper } from './services/serper';
import { executeToolCall } from './services/toolExecutor';

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
  },
  {
    type: "function" as const,
    function: {
      name: "generate_image",
      description: "Generate high-quality images using DALL-E 3 when the user requests visual content, artwork, logos, or illustrations",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Detailed description of the image to generate"
          },
          style: {
            type: "string",
            enum: ["vivid", "natural"],
            description: "Image style - vivid for hyper-real and dramatic, natural for more realistic"
          },
          size: {
            type: "string",
            enum: ["1024x1024", "1792x1024", "1024x1792"],
            description: "Image dimensions"
          }
        },
        required: ["prompt"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "generate_pdf",
      description: "Create professional PDF documents from content when users need reports, documents, or downloadable files",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the PDF document"
          },
          content: {
            type: "string",
            description: "Main content/text for the PDF"
          },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                content: { type: "string" }
              }
            },
            description: "Optional structured sections for the PDF"
          }
        },
        required: ["title", "content"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "execute_code",
      description: "Execute JavaScript code safely for calculations, data processing, or algorithmic tasks",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "JavaScript code to execute"
          },
          language: {
            type: "string",
            enum: ["javascript", "python"],
            description: "Programming language"
          }
        },
        required: ["code"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_data",
      description: "Perform statistical analysis and data visualization on datasets",
      parameters: {
        type: "object",
        properties: {
          data: {
            type: "string",
            description: "CSV or JSON data to analyze"
          },
          analysis_type: {
            type: "string",
            enum: ["summary", "correlation", "trend", "distribution"],
            description: "Type of analysis to perform"
          },
          visualization: {
            type: "boolean",
            description: "Whether to generate charts/graphs"
          }
        },
        required: ["data", "analysis_type"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "translate_text",
      description: "Translate text between different languages using advanced translation models",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text to translate"
          },
          source_language: {
            type: "string",
            description: "Source language code (e.g., 'en', 'es', 'fr')"
          },
          target_language: {
            type: "string",
            description: "Target language code"
          }
        },
        required: ["text", "target_language"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get current weather information and forecasts for any location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City name or coordinates"
          },
          forecast_days: {
            type: "number",
            description: "Number of forecast days (1-7)"
          }
        },
        required: ["location"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "calculate_math",
      description: "Perform complex mathematical calculations, solve equations, or work with mathematical expressions",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "Mathematical expression or equation to solve"
          },
          operation: {
            type: "string",
            enum: ["calculate", "solve", "differentiate", "integrate", "plot"],
            description: "Type of mathematical operation"
          }
        },
        required: ["expression"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "compose_email",
      description: "Help compose professional emails with proper formatting and tone",
      parameters: {
        type: "object",
        properties: {
          recipient: {
            type: "string",
            description: "Email recipient"
          },
          subject: {
            type: "string",
            description: "Email subject line"
          },
          purpose: {
            type: "string",
            description: "Purpose or context of the email"
          },
          tone: {
            type: "string",
            enum: ["formal", "casual", "friendly", "professional"],
            description: "Desired tone of the email"
          }
        },
        required: ["subject", "purpose"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_sentiment",
      description: "Analyze the emotional tone and sentiment of text content",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text to analyze for sentiment"
          },
          analysis_depth: {
            type: "string",
            enum: ["basic", "detailed", "emotions"],
            description: "Level of analysis detail"
          }
        },
        required: ["text"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "create_calendar_event",
      description: "Create structured calendar events with proper formatting",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Event title"
          },
          date: {
            type: "string",
            description: "Event date"
          },
          time: {
            type: "string",
            description: "Event time"
          },
          duration: {
            type: "string",
            description: "Event duration"
          },
          description: {
            type: "string",
            description: "Event description or agenda"
          }
        },
        required: ["title", "date"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "generate_qr_code",
      description: "Generate QR codes for URLs, text, contact information, or WiFi credentials",
      parameters: {
        type: "object",
        properties: {
          data: {
            type: "string",
            description: "Data to encode in the QR code (URL, text, contact info, etc.)"
          },
          size: {
            type: "number",
            description: "Size of QR code in pixels (default 256)"
          },
          format: {
            type: "string",
            enum: ["png", "svg"],
            description: "Output format (default png)"
          }
        },
        required: ["data"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_code",
      description: "Analyze code for complexity, performance issues, security vulnerabilities, and best practices",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "Code to analyze"
          },
          language: {
            type: "string",
            description: "Programming language (javascript, python, java, etc.)"
          },
          analysis_type: {
            type: "string",
            enum: ["complexity", "security", "performance", "style", "comprehensive"],
            description: "Type of code analysis to perform"
          }
        },
        required: ["code", "language"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "create_chart",
      description: "Create various types of charts and visualizations from data",
      parameters: {
        type: "object",
        properties: {
          data: {
            type: "string",
            description: "Data in JSON or CSV format"
          },
          chart_type: {
            type: "string",
            enum: ["bar", "line", "pie", "scatter", "area", "histogram"],
            description: "Type of chart to create"
          },
          title: {
            type: "string",
            description: "Chart title"
          },
          x_label: {
            type: "string",
            description: "X-axis label"
          },
          y_label: {
            type: "string",
            description: "Y-axis label"
          }
        },
        required: ["data", "chart_type"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "extract_text_from_url",
      description: "Extract and summarize text content from web pages or articles",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL of the webpage to extract text from"
          },
          summary_length: {
            type: "string",
            enum: ["short", "medium", "long"],
            description: "Length of summary to generate"
          }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "format_text",
      description: "Format and structure text content with various styles and layouts",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text content to format"
          },
          format_type: {
            type: "string",
            enum: ["markdown", "html", "json", "csv", "xml", "yaml"],
            description: "Output format type"
          },
          style: {
            type: "string",
            enum: ["professional", "academic", "casual", "technical"],
            description: "Writing style to apply"
          }
        },
        required: ["text", "format_type"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "generate_password",
      description: "Generate secure passwords with customizable complexity",
      parameters: {
        type: "object",
        properties: {
          length: {
            type: "number",
            description: "Password length (default 16)"
          },
          include_symbols: {
            type: "boolean",
            description: "Include special symbols"
          },
          include_numbers: {
            type: "boolean",
            description: "Include numbers"
          },
          include_uppercase: {
            type: "boolean",
            description: "Include uppercase letters"
          },
          exclude_similar: {
            type: "boolean",
            description: "Exclude similar characters (0, O, l, 1, etc.)"
          }
        }
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
      let toolResults: string[] = [];

      for (const toolCall of toolCalls) {
        try {
          const toolName = (toolCall as any).function?.name;
          const toolArgs = JSON.parse((toolCall as any).function?.arguments || '{}');
          
          log(`Executing tool: ${toolName} with args:`, toolArgs);
          
          const toolResult = await executeToolCall(toolName, toolArgs);
          toolResults.push(toolResult);
          
        } catch (toolError) {
          log(`Tool execution error: ${(toolError as Error).message}`, "error");
          toolResults.push(`Error executing tool: ${(toolError as Error).message}`);
        }
      }

      // Combine original response with tool results
      const combinedContent = [
        finalContent,
        ...toolResults.filter(result => result.trim().length > 0)
      ].filter(content => content && content.trim().length > 0).join('\n\n---\n\n');

      return {
        message: {
          role: "assistant",
          content: combinedContent,
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
