import { searchSerper } from './serper';

export async function buildPrompt(userMessage: string) {
  let prompt = userMessage;

  if (userMessage.toLowerCase().includes("latest") || userMessage.toLowerCase().includes("news")) {
    const webResults = await searchSerper(userMessage);
    const snippets = webResults.organic?.map((r: any) => r.snippet).join("\n");
    prompt = `System: You are an assistant that uses both your knowledge and real-time web results when relevant.\nReal-time info:\n${snippets}\n\nUser asked: ${userMessage}`;
  }

  return prompt;
}