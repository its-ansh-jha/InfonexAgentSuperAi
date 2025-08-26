import { searchOpenAIEnhanced } from './services/search';
import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { chatCompletionRequestSchema, insertMessageSchema, insertChatSessionSchema, images, pdfs } from "@shared/schema";
import { generateOpenAIResponse, generateOpenAIMiniResponse } from "./services/openai";
import { generateDeepSeekResponse } from "./services/openrouter";
import { generateMaverickResponse, handleImageUpload } from "./services/openrouter-maverick";
import { handleSearch } from "./services/search";
import { log } from "./vite";
import { db } from "./db";
import { messages, chatSessions } from "@shared/schema";
import { eq } from "drizzle-orm";
import multer from 'multer';

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for image uploads (memory storage)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 8 * 1024 * 1024, // 8MB max file size
    }
  });
  // Search endpoint for realtime data using OpenAI
  app.post('/api/search', async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required and must be a string' });
      }
      
      const data = await searchOpenAIEnhanced(query);
      res.json(data);
    } catch (error: any) {
      log(`Error in OpenAI search endpoint: ${error.message}`, "error");
      res.status(500).json({ error: error.message || 'OpenAI search failed' });
    }
  });
  app.post("/api/upload-image", upload.single('image'), async (req, res) => {
    try {
      await handleImageUpload(req, res);
    } catch (error: any) {
      log(`Error in image upload endpoint: ${error.message}`, "error");
      return res.status(500).json({ message: error.message || "Error processing image" });
    }
  });

  // Image serving endpoint
  app.get("/api/images/:id", async (req, res) => {
    try {
      const imageId = parseInt(req.params.id);
      
      if (isNaN(imageId)) {
        return res.status(400).json({ error: 'Invalid image ID' });
      }
      
      // Get image from database
      const [image] = await db.select().from(images).where(eq(images.id, imageId));
      
      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      // Convert base64 back to buffer
      const imageBuffer = Buffer.from(image.imageData, 'base64');
      
      // Set appropriate headers
      res.set({
        'Content-Type': image.mimeType,
        'Content-Length': imageBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${image.filename}"`,
        'Cache-Control': 'public, max-age=31536000' // Cache for 1 year since images are immutable
      });
      
      res.send(imageBuffer);
    } catch (error: any) {
      log(`Error serving image: ${error.message}`, "error");
      res.status(500).json({ error: 'Failed to serve image' });
    }
  });

  // PDF serving endpoint
  app.get("/api/pdfs/:id", async (req, res) => {
    try {
      const pdfId = parseInt(req.params.id);
      
      if (isNaN(pdfId)) {
        return res.status(400).json({ error: 'Invalid PDF ID' });
      }
      
      // Get PDF from database
      const [pdf] = await db.select().from(pdfs).where(eq(pdfs.id, pdfId));
      
      if (!pdf) {
        return res.status(404).json({ error: 'PDF not found' });
      }
      
      // Convert base64 back to buffer
      const pdfBuffer = Buffer.from(pdf.pdfData, 'base64');
      
      // Set appropriate headers
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${pdf.filename}"`,
        'Cache-Control': 'public, max-age=31536000' // Cache for 1 year since PDFs are immutable
      });
      
      res.send(pdfBuffer);
    } catch (error: any) {
      log(`Error serving PDF: ${error.message}`, "error");
      res.status(500).json({ error: 'Failed to serve PDF' });
    }
  });
  
  // Chat completion endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      // Validate request payload
      const validationResult = chatCompletionRequestSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request format", 
          errors: validationResult.error.format() 
        });
      }
      
      const chatRequest = validationResult.data;
      let response;
      
      // Route to appropriate model
      if (chatRequest.model === "gpt-4o") {
        // Use OpenAI's GPT-4o
        response = await generateOpenAIResponse(chatRequest);
      } else if (chatRequest.model === "gpt-4o-mini") {
        // Use OpenAI's GPT-4o-mini (specifically for search refinement)
        response = await generateOpenAIMiniResponse(chatRequest);
      } else if (chatRequest.model === "deepseek-r1") {
        response = await generateDeepSeekResponse(chatRequest);
      } else if (chatRequest.model === "llama-4-maverick") {
        // For now, redirect to GPT-4o-mini since we're not using Maverick
        response = await generateOpenAIResponse(chatRequest);
      } else {
        return res.status(400).json({ message: "Invalid model selection" });
      }
      
      // Log the response for debugging
      let previewContent = 'Complex content structure';
      let formattedResponse;
      
      // Handle different response formats with proper type checking
      const hasRole = typeof response === 'object' && response !== null && 'role' in response;
      const hasContent = typeof response === 'object' && response !== null && 'content' in response;
      const hasMessage = typeof response === 'object' && response !== null && 'message' in response;
      
      if (hasRole && hasContent) {
        // Direct format from Maverick service
        const typedResponse = response as unknown as { role: string; content: any; model?: string };
        
        if (typeof typedResponse.content === 'string') {
          previewContent = typedResponse.content.substring(0, 50);
        }
        
        formattedResponse = {
          message: {
            role: typedResponse.role,
            content: typedResponse.content
          },
          model: typedResponse.model || chatRequest.model
        };
      } else if (hasMessage) {
        // Already in message format
        const typedResponse = response as { message: { role: string; content: string }; model: string };
        formattedResponse = typedResponse;
        
        if (typeof typedResponse.message.content === 'string') {
          previewContent = typedResponse.message.content.substring(0, 50);
        }
      } else {
        // Unknown format, try to adapt
        formattedResponse = {
          message: {
            role: 'assistant',
            content: JSON.stringify(response)
          },
          model: chatRequest.model
        };
      }
      
      log(`Model ${chatRequest.model} response: ${previewContent}...`);
      
      // Store messages in the database if sessionId is provided
      if (chatRequest.sessionId) {
        try {
          // First, store the user message
          const lastUserMessage = chatRequest.messages[chatRequest.messages.length - 1];
          if (lastUserMessage.role === 'user') {
            await db.insert(messages).values({
              role: lastUserMessage.role,
              content: typeof lastUserMessage.content === 'string' 
                ? lastUserMessage.content 
                : JSON.stringify(lastUserMessage.content),
              model: chatRequest.model,
              sessionId: parseInt(chatRequest.sessionId)
            });
          }
          
          // Then store the assistant's response
          await db.insert(messages).values({
            role: formattedResponse.message.role,
            content: formattedResponse.message.content,
            model: formattedResponse.model,
            sessionId: parseInt(chatRequest.sessionId)
          });
          
          // Update the chat session's updatedAt timestamp
          await db
            .update(chatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(chatSessions.id, parseInt(chatRequest.sessionId)));
        } catch (dbError: any) {
          log(`Error storing messages in database: ${dbError.message}`, "error");
          // Continue with the response even if database storage fails
        }
      }
      
      // Return the standardized response
      return res.status(200).json(formattedResponse);
    } catch (error: any) {
      log(`Error in chat endpoint: ${error.message}`, "error");
      return res.status(500).json({ message: error.message || "Something went wrong" });
    }
  });

  // Search endpoint
  app.get("/api/search", async (req, res) => {
    try {
      await handleSearch(req, res);
    } catch (error: any) {
      log(`Error in search endpoint: ${error.message}`, "error");
      return res.status(500).json({ message: error.message || "Error performing search" });
    }
  });

  // Chat sessions endpoints
  app.post("/api/chat-sessions", async (req, res) => {
    try {
      const validationResult = insertChatSessionSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request format", 
          errors: validationResult.error.format() 
        });
      }

      const [newSession] = await db
        .insert(chatSessions)
        .values(validationResult.data)
        .returning();

      return res.status(201).json(newSession);
    } catch (error: any) {
      log(`Error creating chat session: ${error.message}`, "error");
      return res.status(500).json({ message: error.message || "Failed to create chat session" });
    }
  });

  app.get("/api/chat-sessions", async (req, res) => {
    try {
      const allSessions = await db
        .select()
        .from(chatSessions)
        .orderBy(chatSessions.updatedAt);

      return res.status(200).json(allSessions);
    } catch (error: any) {
      log(`Error fetching chat sessions: ${error.message}`, "error");
      return res.status(500).json({ message: error.message || "Failed to fetch chat sessions" });
    }
  });

  app.get("/api/chat-sessions/:id", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      
      if (isNaN(sessionId)) {
        return res.status(400).json({ message: "Invalid session ID" });
      }

      const [session] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, sessionId));

      if (!session) {
        return res.status(404).json({ message: "Chat session not found" });
      }

      const sessionMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.timestamp);

      return res.status(200).json({
        ...session,
        messages: sessionMessages
      });
    } catch (error: any) {
      log(`Error fetching chat session: ${error.message}`, "error");
      return res.status(500).json({ message: error.message || "Failed to fetch chat session" });
    }
  });

  app.delete("/api/chat-sessions/:id", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      
      if (isNaN(sessionId)) {
        return res.status(400).json({ message: "Invalid session ID" });
      }

      // First delete all messages for this session
      await db
        .delete(messages)
        .where(eq(messages.sessionId, sessionId));

      // Then delete the session
      const [deletedSession] = await db
        .delete(chatSessions)
        .where(eq(chatSessions.id, sessionId))
        .returning();

      if (!deletedSession) {
        return res.status(404).json({ message: "Chat session not found" });
      }

      return res.status(200).json({ message: "Chat session deleted successfully" });
    } catch (error: any) {
      log(`Error deleting chat session: ${error.message}`, "error");
      return res.status(500).json({ message: error.message || "Failed to delete chat session" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    const missingKeys = [];
    
    if (!process.env.OPENAI_API_KEY) {
      missingKeys.push("OPENAI_API_KEY");
    }
    
    if (!process.env.OPENAI_MINI_API_KEY) {
      missingKeys.push("OPENAI_MINI_API_KEY");
    }
    
    if (!process.env.OPENROUTER_API_KEY) {
      missingKeys.push("OPENROUTER_API_KEY");
    }

    if (!process.env.DATABASE_URL) {
      missingKeys.push("DATABASE_URL");
    }

    // OpenAI API key is already checked above - no additional search API key needed
    
    if (missingKeys.length > 0) {
      return res.status(500).json({ 
        status: "error", 
        message: `Missing environment variables: ${missingKeys.join(", ")}` 
      });
    }
    
    return res.status(200).json({ status: "ok" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
