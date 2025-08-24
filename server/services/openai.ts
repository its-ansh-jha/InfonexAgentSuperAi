import OpenAI from "openai";
import { ChatCompletionRequest, ChatCompletionResponse, insertImageSchema, insertPdfSchema } from "@shared/schema";
import { log } from "../vite";
import { searchOpenAIEnhanced } from "./search";
import { searchSerper } from "./serper";
import { db } from "../db";
import { images, pdfs } from "@shared/schema";
import { nanoid } from "nanoid";
import PDFDocument from "pdfkit";

// Use the latest OpenAI model with vision support
const MODEL = "gpt-4o";

/**
 * Generate and store a PDF document in the database
 */
async function generateAndStorePdf(title: string, content: string): Promise<{ id: number }> {
  try {
    // Create a new PDF document
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    
    // Collect the PDF data
    doc.on('data', (chunk) => chunks.push(chunk));
    
    // Wait for the PDF to finish
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
    
    // Add content to PDF
    doc.fontSize(16).text(title, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12).text(content, { width: 410, align: 'left' });
    
    // Finalize the PDF
    doc.end();
    
    // Wait for PDF generation to complete
    const pdfBuffer = await pdfPromise;
    
    // Convert to base64
    const base64Data = pdfBuffer.toString('base64');
    
    // Generate a unique filename
    const filename = `generated-${nanoid()}.pdf`;
    
    // Store in database
    const [storedPdf] = await db.insert(pdfs).values({
      title: title,
      filename: filename,
      content: content,
      pdfData: base64Data
    }).returning({ id: pdfs.id });
    
    log(`PDF stored successfully with ID: ${storedPdf.id}`);
    return storedPdf;
    
  } catch (error: any) {
    log(`Failed to generate and store PDF: ${error.message}`, "error");
    throw error;
  }
}

/**
 * Download an image from a URL and store it in the database
 */
async function downloadAndStoreImage(imageUrl: string, prompt?: string): Promise<{ id: number }> {
  try {
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Convert to base64
    const base64Data = buffer.toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/png';
    
    // Generate a unique filename
    const extension = mimeType.split('/')[1] || 'png';
    const filename = `generated-${nanoid()}.${extension}`;
    
    // Store in database
    const [storedImage] = await db.insert(images).values({
      originalUrl: imageUrl,
      filename: filename,
      mimeType: mimeType,
      imageData: base64Data,
      prompt: prompt || null
    }).returning({ id: images.id });
    
    log(`Image stored successfully with ID: ${storedImage.id}`);
    return storedImage;
    
  } catch (error: any) {
    log(`Failed to download and store image: ${error.message}`, "error");
    throw error;
  }
}

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
  },
  {
    type: "function" as const,
    function: {
      name: "generate_pdf",
      description: "Generate PDF documents from text content. Use this when the user asks for documents, reports, formatted text, PDFs, or wants to download content as PDF. IMPORTANT: If you have search results or gathered information that should be formatted into a PDF document, use this tool immediately after gathering the information.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the PDF document"
          },
          content: {
            type: "string",
            description: "Main text content to include in the PDF"
          }
        },
        required: ["title", "content"]
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
        const formattedResults = {
          search_results: searchResults.organic?.slice(0, 5).map((result: any) => ({
            title: result.title,
            snippet: result.snippet,
            url: result.link
          })) || [],
          query: args.query,
          summary: searchResults.organic?.slice(0, 5).map((result: any) => 
            `${result.title}: ${result.snippet}`
          ).join('\n\n') || ""
        };
        return JSON.stringify(formattedResults);
      
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
            model: "dall-e-2",
            prompt: args.prompt,
            size: args.size || "1024x1024",
            n: 1
          });
          
          const originalUrl = imageResponse.data?.[0]?.url || "";
          
          if (!originalUrl) {
            throw new Error("No image URL returned from DALL-E");
          }
          
          // Download and store the image in database
          log(`Downloading image from: ${originalUrl}`);
          const imageStorageResult = await downloadAndStoreImage(originalUrl, args.prompt);
          
          // Return with special format that includes stored image ID
          return JSON.stringify({
            type: "image_generation_result",
            image_id: imageStorageResult.id,
            image_url: `/api/images/${imageStorageResult.id}`, // Local endpoint
            original_url: originalUrl,
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
      
      case "generate_pdf":
        log(`Executing PDF generation: ${args.title}`);
        try {
          const pdfStorageResult = await generateAndStorePdf(args.title, args.content);
          
          // Return with special format that includes stored PDF ID
          return JSON.stringify({
            type: "pdf_generation_result",
            pdf_id: pdfStorageResult.id,
            pdf_url: `/api/pdfs/${pdfStorageResult.id}`,
            title: args.title,
            message: `I've generated a PDF document titled "${args.title}" for you. You can view and download it using the link below.`,
            display_pdf: true
          });
        } catch (pdfError: any) {
          log(`PDF generation error: ${pdfError.message}`, "error");
          return JSON.stringify({
            error: "Failed to generate PDF",
            message: pdfError.message || "PDF generation is temporarily unavailable"
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

      // Check if any tool result contains PDF generation
      const pdfGenerationResult = toolMessages.find(msg => {
        try {
          const result = JSON.parse(msg.content);
          return result.type === "pdf_generation_result" && result.display_pdf;
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

      if (pdfGenerationResult) {
        // Handle PDF generation specially
        const result = JSON.parse(pdfGenerationResult.content);
        
        // Return multimodal content with PDF link and text
        return {
          message: {
            role: "assistant",
            content: [
              {
                type: "text",
                text: result.message
              },
              {
                type: "pdf_link",
                pdf_url: result.pdf_url,
                title: result.title
              }
            ] as any
          },
          model: MODEL,
        };
      }

      // Get final response after tool execution - allow for additional tool calls
      const finalResponse = await openai.chat.completions.create({
        model: MODEL,
        messages: updatedMessages,
        tools: availableTools,
        tool_choice: "auto"
      });
      
      const finalMessage = finalResponse.choices[0].message;
      
      // Check if AI wants to make more tool calls (e.g., PDF generation after web search)
      if (finalMessage.tool_calls && finalMessage.tool_calls.length > 0) {
        log(`AI requested ${finalMessage.tool_calls.length} additional tool call(s)`);
        
        // Execute additional tool calls
        const additionalToolMessages = [];
        
        for (const toolCall of finalMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
          
          const toolResult = await executeToolCall(functionName, functionArgs);
          
          additionalToolMessages.push({
            role: "tool" as const,
            content: toolResult,
            tool_call_id: toolCall.id
          });
        }
        
        // Check for special tool results in the second round
        const secondRoundImageResult = additionalToolMessages.find(msg => {
          try {
            const result = JSON.parse(msg.content);
            return result.type === "image_generation_result" && result.display_image;
          } catch {
            return false;
          }
        });

        const secondRoundPdfResult = additionalToolMessages.find(msg => {
          try {
            const result = JSON.parse(msg.content);
            return result.type === "pdf_generation_result" && result.display_pdf;
          } catch {
            return false;
          }
        });

        if (secondRoundImageResult) {
          const result = JSON.parse(secondRoundImageResult.content);
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

        if (secondRoundPdfResult) {
          const result = JSON.parse(secondRoundPdfResult.content);
          return {
            message: {
              role: "assistant",
              content: [
                {
                  type: "text",
                  text: result.message
                },
                {
                  type: "pdf_link",
                  pdf_url: result.pdf_url,
                  title: result.title
                }
              ] as any
            },
            model: MODEL,
          };
        }

        // If no special results, get final response after second round
        const secondFinalMessages = [
          ...updatedMessages,
          {
            role: "assistant",
            content: finalMessage.content,
            tool_calls: finalMessage.tool_calls
          },
          ...additionalToolMessages
        ];

        const secondFinalResponse = await openai.chat.completions.create({
          model: MODEL,
          messages: secondFinalMessages,
        });

        return {
          message: {
            role: "assistant",
            content: secondFinalResponse.choices[0].message.content || "I've completed your request using multiple tools.",
          },
          model: MODEL,
        };
      }
      
      return {
        message: {
          role: "assistant",
          content: finalMessage.content || "I used some tools to help answer your question.",
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