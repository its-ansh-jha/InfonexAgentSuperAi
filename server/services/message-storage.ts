import { db } from "../db";
import { nanoid } from "nanoid";
import { sql } from "drizzle-orm";

export class MessageStorage {
  
  async createChatSession(title: string = "New Conversation", userId?: number): Promise<string> {
    const sessionId = nanoid();
    
    // Insert chat session using the existing database structure
    await db.execute(sql`
      INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) 
      VALUES (${sessionId}, ${userId || null}, ${title}, NOW(), NOW())
    `);
    
    return sessionId;
  }

  async saveMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string | any[],
    model?: string,
    messageType?: string
  ): Promise<void> {
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);
    
    await db.execute(sql`
      INSERT INTO messages (
        from_user, 
        to_user, 
        content, 
        is_ai_generated, 
        timestamp, 
        message_type, 
        role, 
        model, 
        session_id
      ) VALUES (
        ${role === 'user' ? 'user' : null},
        ${role === 'assistant' ? 'assistant' : null},
        ${contentString},
        ${role === 'assistant'},
        NOW(),
        ${messageType || 'text'},
        ${role},
        ${model || null},
        ${sessionId}
      )
    `);
  }

  async getChatMessages(sessionId: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT id, content, role, model, timestamp, message_type 
      FROM messages 
      WHERE session_id = ${sessionId}
      ORDER BY timestamp ASC
    `);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: this.parseContent(row.content),
      model: row.model,
      timestamp: row.timestamp,
      messageType: row.message_type
    }));
  }

  async getChatSessions(userId?: number): Promise<any[]> {
    const result = userId 
      ? await db.execute(sql`SELECT id, title, created_at, updated_at FROM chat_sessions WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 10`)
      : await db.execute(sql`SELECT id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC LIMIT 10`);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: [] // Will be loaded separately when needed
    }));
  }

  async updateChatSession(sessionId: string, title: string): Promise<void> {
    await db.execute(sql`
      UPDATE chat_sessions SET title = ${title}, updated_at = NOW() WHERE id = ${sessionId}
    `);
  }

  private parseContent(contentString: string): string | any[] {
    try {
      // Try to parse as JSON for multimodal content
      const parsed = JSON.parse(contentString);
      return Array.isArray(parsed) ? parsed : contentString;
    } catch {
      // If not valid JSON, return as string
      return contentString;
    }
  }
}

export const messageStorage = new MessageStorage();