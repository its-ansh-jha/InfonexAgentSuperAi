
import { Request, Response } from 'express';
import OpenAI from 'openai';
import { z } from 'zod';

// Define a schema for search results
export const searchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  description: z.string().optional(),
  source: z.string().optional(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

// Initialize OpenAI client for search
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Search using OpenAI GPT-4o-mini with search preview capabilities
 */
export async function searchOpenAI(query: string): Promise<SearchResult[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured.');
    }

    // Use GPT-4o-mini with search capabilities
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini-search-preview",
      messages: [
        {
          role: "system",
          content: "You are a search assistant. When given a query, search for current information and provide structured results. Format your response as a JSON array of search results with title, url, description, and source fields. Only return valid JSON."
        },
        {
          role: "user", 
          content: `Search for: ${query}`
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "web_search",
            description: "Search the web for current information",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query"
                }
              },
              required: ["query"]
            }
          }
        }
      ],
      tool_choice: "auto"
    });

    const content = response.choices[0].message.content;
    
    if (!content) {
      return [];
    }

    try {
      // Try to parse as JSON first
      const results = JSON.parse(content);
      if (Array.isArray(results)) {
        return results.map(result => ({
          title: result.title || 'Search Result',
          url: result.url || '#',
          description: result.description || '',
          source: result.source || 'OpenAI Search'
        }));
      }
    } catch (parseError) {
      // If JSON parsing fails, create a single result with the content
      return [
        {
          title: `Search results for: ${query}`,
          url: '#',
          description: content,
          source: 'OpenAI Search'
        }
      ];
    }

    return [];
  } catch (error) {
    console.error('OpenAI search error:', error);
    return [
      {
        title: `Error searching for: ${query}`,
        url: '#',
        description: 'Search temporarily unavailable. Please try again.',
        source: 'Search Error'
      }
    ];
  }
}

/**
 * Enhanced search using OpenAI with web search capabilities
 */
export async function searchOpenAIEnhanced(query: string): Promise<any> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured.');
    }

    // Use the new search preview feature
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini-search-preview",
      messages: [
        {
          role: "user",
          content: query
        }
      ]
    });

    const content = response.choices[0].message.content;
    
    // Return in Serper-like format for compatibility
    return {
      organic: [
        {
          title: `AI-Enhanced Search: ${query}`,
          snippet: content,
          link: '#',
          source: 'OpenAI Search Preview'
        }
      ],
      searchInformation: {
        totalResults: "1",
        timeTaken: 0.1,
        query: query
      }
    };
  } catch (error) {
    console.error('OpenAI enhanced search error:', error);
    return {
      organic: [
        {
          title: `Search: ${query}`,
          snippet: 'Search results temporarily unavailable.',
          link: '#',
          source: 'OpenAI Search'
        }
      ],
      searchInformation: {
        totalResults: "0",
        timeTaken: 0,
        query: query
      }
    };
  }
}

/**
 * Handle search requests from the client
 */
export async function handleSearch(req: Request, res: Response) {
  const query = req.query.query as string;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Invalid query parameter',
      results: []
    });
  }
  
  try {
    const results = await searchOpenAI(query);
    return res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      error: 'Failed to perform search',
      results: []
    });
  }
}
