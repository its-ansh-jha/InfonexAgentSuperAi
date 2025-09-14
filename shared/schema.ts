import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  serial,
  integer,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table compatible with Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily message usage tracking for non-authenticated users
export const dailyUsage = pgTable("daily_usage", {
  id: serial("id").primaryKey(),
  ipAddress: varchar("ip_address").notNull(),
  date: date("date").notNull().defaultNow(),
  messageCount: integer("message_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertDailyUsageSchema = createInsertSchema(dailyUsage).omit({
  id: true,
  createdAt: true,
});

export type InsertDailyUsage = z.infer<typeof insertDailyUsageSchema>;
export type DailyUsage = typeof dailyUsage.$inferSelect;

// Chat Sessions table (updated to work with varchar user IDs)
export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  title: text("title").notNull().default("New Conversation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;

// Chat Messages Schema
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  model: text("model").notNull(), // gpt-5, gpt-5-mini, gpt-5-nano, deepseek-r1
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  sessionId: integer("session_id").references(() => chatSessions.id).notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Relations are defined through foreign keys in the table schemas

// Define the image content type schema
const imageContentSchema = z.object({
  type: z.literal("image"),
  image_data: z.string(), // Base64 encoded image data
});

// Define the image_url content type schema (OpenAI format)
const imageUrlContentSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string(), // Data URL format
  })
});

// Define the text content type schema
const textContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

// Request schema for chat completions
export const chatCompletionRequestSchema = z.object({
  model: z.enum(["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4o", "gpt-4o-mini", "deepseek-r1", "llama-4-maverick"]),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.union([
        z.string(),
        z.array(z.union([textContentSchema, imageContentSchema, imageUrlContentSchema]))
      ]),
    })
  ),
  sessionId: z.string().optional(),
  webSearchEnabled: z.boolean().optional().default(true),
});

export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;

// Response schema for chat completions
export const chatCompletionResponseSchema = z.object({
  message: z.object({
    role: z.enum(["assistant"]),
    content: z.string(),
  }),
  model: z.enum(["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4o", "gpt-4o-mini", "deepseek-r1", "llama-4-maverick"]),
});

export type ChatCompletionResponse = z.infer<typeof chatCompletionResponseSchema>;

// Images table for storing generated images
export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  originalUrl: text("original_url").notNull(), // Original DALL-E URL
  filename: text("filename").notNull(), // Generated filename
  mimeType: text("mime_type").notNull().default("image/png"),
  imageData: text("image_data").notNull(), // Base64 encoded image data
  prompt: text("prompt"), // The prompt used to generate the image
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertImageSchema = createInsertSchema(images).omit({
  id: true,
  createdAt: true,
});

export type InsertImage = z.infer<typeof insertImageSchema>;
export type Image = typeof images.$inferSelect;

// PDFs table for storing generated PDFs
export const pdfs = pgTable("pdfs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  content: text("content").notNull(), // The text content used to generate the PDF
  pdfData: text("pdf_data").notNull(), // Base64 encoded PDF data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPdfSchema = createInsertSchema(pdfs).omit({
  id: true,
  createdAt: true,
});

export type InsertPdf = z.infer<typeof insertPdfSchema>;
export type Pdf = typeof pdfs.$inferSelect;
