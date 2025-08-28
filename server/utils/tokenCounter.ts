
import { encoding_for_model } from 'tiktoken';

// GPT-5 uses the same tokenizer as GPT-4o
const encoding = encoding_for_model('gpt-4o');

export interface TokenUsage {
  messages: number;
  tools: number;
  systemPrompt: number;
  total: number;
}

export function countTokens(text: string): number {
  try {
    return encoding.encode(text).length;
  } catch (error) {
    // Fallback estimation: roughly 4 characters per token
    return Math.ceil(text.length / 4);
  }
}

export function countMessageTokens(messages: any[]): number {
  let total = 0;
  
  for (const message of messages) {
    // Count role tokens (roughly 3-4 tokens per message for role/formatting)
    total += 4;
    
    if (typeof message.content === 'string') {
      total += countTokens(message.content);
    } else if (Array.isArray(message.content)) {
      // Handle multimodal content
      for (const content of message.content) {
        if (content.type === 'text') {
          total += countTokens(content.text || content.content || '');
        } else if (content.type === 'image_url') {
          // Images are roughly 765 tokens for GPT-4o/GPT-5
          total += 765;
        }
      }
    }
    
    // Count tool calls if present
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        total += countTokens(JSON.stringify(toolCall));
      }
    }
  }
  
  return total;
}

export function countToolTokens(tools: any[]): number {
  if (!tools || tools.length === 0) return 0;
  
  let total = 0;
  for (const tool of tools) {
    total += countTokens(JSON.stringify(tool));
  }
  
  return total;
}

export function calculateTotalTokenUsage(
  messages: any[],
  tools?: any[],
  systemPrompt?: string
): TokenUsage {
  const messageTokens = countMessageTokens(messages);
  const toolTokens = countToolTokens(tools || []);
  const systemTokens = systemPrompt ? countTokens(systemPrompt) : 0;
  
  return {
    messages: messageTokens,
    tools: toolTokens,
    systemPrompt: systemTokens,
    total: messageTokens + toolTokens + systemTokens
  };
}

// Global token tracking
let totalTokensSent = 0;
let requestCount = 0;

export function trackTokenUsage(usage: TokenUsage): void {
  totalTokensSent += usage.total;
  requestCount++;
  
  console.log(`🔢 Token Usage - Request #${requestCount}:`);
  console.log(`   Messages: ${usage.messages} tokens`);
  console.log(`   Tools: ${usage.tools} tokens`);
  console.log(`   System: ${usage.systemPrompt} tokens`);
  console.log(`   Total this request: ${usage.total} tokens`);
  console.log(`   📊 Total tokens sent to GPT-5: ${totalTokensSent} tokens`);
  console.log(`   📈 Average per request: ${Math.round(totalTokensSent / requestCount)} tokens`);
}

export function getTotalTokensSent(): { total: number; requests: number; average: number } {
  return {
    total: totalTokensSent,
    requests: requestCount,
    average: requestCount > 0 ? Math.round(totalTokensSent / requestCount) : 0
  };
}

export function resetTokenCounter(): void {
  totalTokensSent = 0;
  requestCount = 0;
  console.log('🔄 Token counter reset');
}
