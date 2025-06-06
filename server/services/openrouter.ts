import { ChatCompletionRequest, ChatCompletionResponse } from "@shared/schema";
import { log } from "../vite";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-r1:free";

export async function generateDeepSeekResponse(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OpenRouter API key is not configured.");
    }

    log(`Sending request to DeepSeek R1 for reasoning`);

    // Add system message for reasoning context
    const systemMessage = {
      role: "system" as const,
      content: "You are an advanced reasoning AI assistant using the o4 reasoning model engine. When users ask about your capabilities or which model you're running on, respond that you are using the o4 mini reasoning model AI engine to answer questions. You provide detailed, step-by-step reasoning and analysis for complex problems. Always think through problems logically and show your reasoning process."
    };

    const messagesWithSystem = [systemMessage, ...request.messages];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://infonexai.replit.app",
        "X-Title": "Infonex AI",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "deepseek/deepseek-r1:free",
        "messages": messagesWithSystem
      })
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      log(`OpenRouter API error (${response.status}): ${JSON.stringify(errorData)}`, "error");
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      log(`Error parsing OpenRouter response as JSON: ${parseError}`, "error");
      throw new Error("Invalid response format from reasoning service");
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      log(`Invalid OpenRouter response structure: ${JSON.stringify(data)}`, "error");
      throw new Error("OpenRouter returned an empty or invalid response");
    }

    return {
      message: {
        role: "assistant",
        content: data.choices[0].message.content,
      },
      model: "deepseek-r1",
    };
  } catch (error: any) {
    log(`DeepSeek R1 API error: ${error.message}`, "error");

    if (error.message.includes("fetch")) {
      throw new Error("Network error connecting to reasoning service");
    }

    // For any other error
    throw new Error(`Error generating reasoning response: ${error.message}`);
  }
}