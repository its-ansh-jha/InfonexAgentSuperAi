import { ChatCompletionRequest, ChatCompletionResponse } from "@shared/schema";
import { log } from "../vite";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-r1-zero:free";

export async function generateDeepSeekResponse(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OpenRouter API key is not configured.");
    }

    log(`Sending request to ${MODEL}`);
    
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.REPLIT_DOMAINS?.split(",")[0] || "https://infonex.replit.app",
        "X-Title": "Infonex by Infonex Pvt Ltd",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: request.messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error (${response.status}): ${
        errorData.error?.message || response.statusText
      }`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error("DeepSeek returned an empty response");
    }

    return {
      message: {
        role: "assistant",
        content: data.choices[0].message.content,
      },
      model: "deepseek-r1",
    };
  } catch (error: any) {
    log(`DeepSeek API error: ${error.message}`, "error");
    throw error;
  }
}
