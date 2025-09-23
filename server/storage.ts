import { 
  users, 
  chatSessions, 
  messages, 
  dailyUsage,
  type User, 
  type InsertUser,
  type DailyUsage,
  type InsertDailyUsage
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations for Firebase authentication
  getUser(id: number): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  createOrUpdateUser(user: InsertUser): Promise<User>;
  
  // Daily usage operations
  getDailyUsage(ipAddress: string, date: string): Promise<DailyUsage | undefined>;
  createOrUpdateDailyUsage(usage: InsertDailyUsage): Promise<DailyUsage>;
  incrementDailyUsage(ipAddress: string, date: string): Promise<DailyUsage>;
}

// Database implementation of storage
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
    return user || undefined;
  }

  async createOrUpdateUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.firebaseUid,
        set: {
          email: userData.email,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          emailVerified: userData.emailVerified,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getDailyUsage(ipAddress: string, date: string): Promise<DailyUsage | undefined> {
    const [usage] = await db
      .select()
      .from(dailyUsage)
      .where(and(eq(dailyUsage.ipAddress, ipAddress), eq(dailyUsage.date, date)));
    return usage || undefined;
  }

  async createOrUpdateDailyUsage(usageData: InsertDailyUsage): Promise<DailyUsage> {
    const [usage] = await db
      .insert(dailyUsage)
      .values(usageData)
      .onConflictDoUpdate({
        target: [dailyUsage.ipAddress, dailyUsage.date],
        set: {
          messageCount: usageData.messageCount,
          updatedAt: new Date(),
        },
      })
      .returning();
    return usage;
  }

  async incrementDailyUsage(ipAddress: string, date: string): Promise<DailyUsage> {
    const existing = await this.getDailyUsage(ipAddress, date);
    const newCount = (existing?.messageCount || 0) + 1;
    
    return await this.createOrUpdateDailyUsage({
      ipAddress,
      date,
      messageCount: newCount,
    });
  }
}

export const storage = new DatabaseStorage();
