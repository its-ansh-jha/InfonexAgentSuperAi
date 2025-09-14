import { users, chatSessions, messages, dailyUsage, type User, type UpsertUser, type DailyUsage, type InsertDailyUsage } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Daily usage tracking for non-authenticated users
  getDailyUsage(ipAddress: string, date: string): Promise<DailyUsage | undefined>;
  incrementDailyUsage(ipAddress: string): Promise<DailyUsage>;
  
  // Legacy methods that might be needed by existing code
  getUserByEmail(email: string): Promise<User | undefined>;
}

// Database implementation of storage
export class DatabaseStorage implements IStorage {
  // User operations for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  // Daily usage tracking for non-authenticated users
  async getDailyUsage(ipAddress: string, date: string): Promise<DailyUsage | undefined> {
    const [usage] = await db
      .select()
      .from(dailyUsage)
      .where(and(eq(dailyUsage.ipAddress, ipAddress), eq(dailyUsage.date, date)));
    return usage || undefined;
  }

  async incrementDailyUsage(ipAddress: string): Promise<DailyUsage> {
    const today = new Date().toISOString().split('T')[0];
    const existingUsage = await this.getDailyUsage(ipAddress, today);

    if (existingUsage) {
      const [updatedUsage] = await db
        .update(dailyUsage)
        .set({ messageCount: existingUsage.messageCount + 1 })
        .where(eq(dailyUsage.id, existingUsage.id))
        .returning();
      return updatedUsage;
    } else {
      const [newUsage] = await db
        .insert(dailyUsage)
        .values({
          ipAddress,
          date: today,
          messageCount: 1,
        })
        .returning();
      return newUsage;
    }
  }
}

export const storage = new DatabaseStorage();
