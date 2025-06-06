import fetch from 'node-fetch';

export async function searchSerper(query: string) {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}