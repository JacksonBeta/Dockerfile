import {
  users, videos, platforms, distributions, revenues, subscriptionPlans, revenueStatements,
  contentReports, moderationQueue, filmmakerContacts, magazineSubscriptions, magazineIssues,
  visitorCounter,
  type User, type InsertUser,
  type Video, type InsertVideo,
  type Platform, type InsertPlatform,
  type Distribution, type InsertDistribution, 
  type Revenue, type InsertRevenue,
  type SubscriptionPlan, type InsertSubscriptionPlan,
  type RevenueStatement, type InsertRevenueStatement,
  type ContentReport, type InsertContentReport,
  type ModerationQueue, type InsertModerationQueue,
  type FilmmakerContact, type InsertFilmmakerContact,
  type MagazineSubscription, type InsertMagazineSubscription,
  type MagazineIssue, type InsertMagazineIssue,
  type VisitorCounter
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, SQL, sql, gt, lt, between } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User Methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  updateStripeCustomerId(userId: number, customerId: string): Promise<User | undefined>;
  updateUserStripeInfo(userId: number, stripeInfo: { stripeCustomerId?: string; stripeAccountId?: string; stripeSubscriptionId?: string }): Promise<User | undefined>;
  updateFilmmakerSubscription(userId: number, tier: string, startDate: Date, endDate: Date): Promise<User | undefined>;
  getActiveFilmmakers(): Promise<User[]>;
  
  // Video Methods
  getVideo(id: number): Promise<Video | undefined>;
  getVideosByUser(userId: number): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: number, videoData: Partial<Video>): Promise<Video | undefined>;
  deleteVideo(id: number): Promise<boolean>;
  
  // Platform Methods
  getPlatform(id: number): Promise<Platform | undefined>;
  getAllPlatforms(): Promise<Platform[]>;
  createPlatform(platform: InsertPlatform): Promise<Platform>;
  
  // Distribution Methods
  getDistribution(id: number): Promise<Distribution | undefined>;
  getDistributionsByVideo(videoId: number): Promise<Distribution[]>;
  getDistributionsByUser(userId: number): Promise<Distribution[]>;
  createDistribution(distribution: InsertDistribution): Promise<Distribution>;
  updateDistribution(id: number, data: Partial<Distribution>): Promise<Distribution | undefined>;
  
  // Revenue Methods
  getRevenue(id: number): Promise<Revenue | undefined>;
  getRevenuesByVideo(videoId: number): Promise<Revenue[]>;
  getRevenuesByUser(userId: number): Promise<Revenue[]>;
  createRevenue(revenue: InsertRevenue): Promise<Revenue>;
  getRevenueStatsByUser(userId: number): Promise<{ total: number, byPlatform: Record<string, number> }>;
  
  // Subscription Plan Methods
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  
  // Revenue Statement Methods
  getRevenueStatements(userId: number): Promise<RevenueStatement[]>;
  getRevenueStatement(id: number): Promise<RevenueStatement | undefined>;
  createRevenueStatement(statement: InsertRevenueStatement): Promise<RevenueStatement>;
  updateRevenueStatementPayment(id: number, isPaid: boolean, paymentDate?: Date): Promise<RevenueStatement | undefined>;
  getMonthlyStatementForUser(userId: number, month: number, year: number): Promise<RevenueStatement | undefined>;
  
  // Content Moderation Methods
  createContentReport(report: InsertContentReport): Promise<ContentReport>;
  getContentReportsByVideo(videoId: number): Promise<ContentReport[]>;
  updateContentReport(id: number, data: Partial<ContentReport>): Promise<ContentReport | undefined>;
  getPendingContentReports(): Promise<ContentReport[]>;
  
  // Moderation Queue Methods
  createModerationQueue(queueItem: InsertModerationQueue): Promise<ModerationQueue>;
  getModerationQueueByVideoId(videoId: number): Promise<ModerationQueue | undefined>;
  updateModerationQueue(id: number, data: Partial<ModerationQueue>): Promise<ModerationQueue | undefined>;
  getPendingModerationItems(limit?: number): Promise<ModerationQueue[]>;
  assignModerationItem(queueId: number, moderatorId: number): Promise<ModerationQueue | undefined>;
  
  // Filmmaker Contact Methods
  getFilmmakerContact(id: number): Promise<FilmmakerContact | undefined>;
  getFilmmakerContactByEmail(email: string): Promise<FilmmakerContact | undefined>;
  getAllFilmmakerContacts(limit?: number, offset?: number): Promise<FilmmakerContact[]>;
  createFilmmakerContact(contact: InsertFilmmakerContact): Promise<FilmmakerContact>;
  updateFilmmakerContact(id: number, contactData: Partial<FilmmakerContact>): Promise<FilmmakerContact | undefined>;
  deleteFilmmakerContact(id: number): Promise<boolean>;
  markFilmmakerContactAsInvited(id: number): Promise<FilmmakerContact | undefined>;
  markFilmmakerContactAsRegistered(id: number, userId: number): Promise<FilmmakerContact | undefined>;
  getUnregisteredContacts(): Promise<FilmmakerContact[]>;
  getContactsWithoutInvitation(): Promise<FilmmakerContact[]>;
  searchFilmmakerContacts(query: string): Promise<FilmmakerContact[]>;
  getFilmmakerContactsByTags(tags: string[]): Promise<FilmmakerContact[]>;
  importFilmmakerContacts(contacts: InsertFilmmakerContact[]): Promise<{ imported: number, failed: number }>;
  
  // Magazine Subscription Methods
  getMagazineSubscription(id: number): Promise<MagazineSubscription | undefined>;
  getMagazineSubscriptionByUserId(userId: number): Promise<MagazineSubscription | undefined>;
  getMagazineSubscriptions(limit?: number, offset?: number): Promise<MagazineSubscription[]>;
  getMagazineSubscriptionsByStatus(status: string): Promise<MagazineSubscription[]>;
  createMagazineSubscription(subscription: InsertMagazineSubscription): Promise<MagazineSubscription>;
  updateMagazineSubscription(id: number, data: Partial<MagazineSubscription>): Promise<MagazineSubscription | undefined>;
  cancelMagazineSubscription(id: number): Promise<MagazineSubscription | undefined>;
  renewMagazineSubscription(id: number): Promise<MagazineSubscription | undefined>;
  
  // Magazine Issue Methods
  getMagazineIssue(id: number): Promise<MagazineIssue | undefined>;
  getAllMagazineIssues(limit?: number, offset?: number): Promise<MagazineIssue[]>;
  getPublishedMagazineIssues(limit?: number, offset?: number): Promise<MagazineIssue[]>;
  getLatestMagazineIssue(): Promise<MagazineIssue | undefined>;
  createMagazineIssue(issue: InsertMagazineIssue): Promise<MagazineIssue>;
  updateMagazineIssue(id: number, data: Partial<MagazineIssue>): Promise<MagazineIssue | undefined>;
  publishMagazineIssue(id: number): Promise<MagazineIssue | undefined>;
  unpublishMagazineIssue(id: number): Promise<MagazineIssue | undefined>;
  
  // Session Store
  sessionStore: session.Store;
  
  // Visitor Counter
  incrementVisitorCount(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
    this.initializePlatforms();
    this.initializeSubscriptionPlans();
  }

  private async initializePlatforms() {
    try {
      const existingPlatforms = await db.select().from(platforms);
      
      if (existingPlatforms.length === 0) {
        const defaultPlatforms = [
          { name: "Google TV", logoUrl: "/assets/platform-logos/google-tv.svg", apiEndpoint: "https://api.googletv.com" },
          { name: "Prime Video", logoUrl: "/assets/platform-logos/prime-video.svg", apiEndpoint: "https://api.primevideo.com" },
          { name: "Apple TV", logoUrl: "/assets/platform-logos/apple-tv.svg", apiEndpoint: "https://api.appletv.com" },
          { name: "Peacock", logoUrl: "/assets/platform-logos/peacock.svg", apiEndpoint: "https://api.peacocktv.com" }
        ];
        
        for (const platform of defaultPlatforms) {
          await db.insert(platforms).values(platform);
        }
      }
    } catch (error) {
      console.error("Error initializing platforms:", error);
      // Continue without crashing - tables might not exist yet
    }
  }
  
  private async initializeSubscriptionPlans() {
    try {
      const existingPlans = await db.select().from(subscriptionPlans);
      
      if (existingPlans.length === 0) {
        const defaultPlans = [
          { 
            name: "Basic", 
            price: 9900, // $99.00 in cents
            durationMonths: 3,
            description: "Basic 3-month plan for independent filmmakers. Your content will be distributed for 3 months."
          },
          { 
            name: "Premium", 
            price: 59900, // $599.00 in cents
            durationMonths: 6,
            description: "Premium 6-month plan for independent filmmakers. Your content will be distributed for 6 months."
          },
          { 
            name: "Professional", 
            price: 99900, // $999.00 in cents
            durationMonths: 12,
            description: "Professional 12-month plan for independent filmmakers. Your content will be distributed for 1 year."
          }
        ];
        
        for (const plan of defaultPlans) {
          await db.insert(subscriptionPlans).values(plan);
        }
      }
    } catch (error) {
      console.error("Error initializing subscription plans:", error);
      // Continue without crashing - tables might not exist yet
    }
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async updateStripeCustomerId(userId: number, customerId: string): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }
  
  async updateUserStripeInfo(userId: number, stripeInfo: { stripeCustomerId?: string; stripeAccountId?: string; stripeSubscriptionId?: string }): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(stripeInfo)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId));
  }

  // Video Methods
  async getVideo(id: number): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video;
  }

  async getVideosByUser(userId: number): Promise<Video[]> {
    return db
      .select()
      .from(videos)
      .where(eq(videos.userId, userId))
      .orderBy(desc(videos.uploadDate));
  }

  async createVideo(videoData: InsertVideo): Promise<Video> {
    const [video] = await db.insert(videos).values(videoData).returning();
    return video;
  }

  async updateVideo(id: number, videoData: Partial<Video>): Promise<Video | undefined> {
    const [updatedVideo] = await db
      .update(videos)
      .set(videoData)
      .where(eq(videos.id, id))
      .returning();
    return updatedVideo;
  }

  async deleteVideo(id: number): Promise<boolean> {
    // First delete any distributions referencing this video
    await db.delete(distributions).where(eq(distributions.videoId, id));
    
    // Then delete any revenues referencing this video
    await db.delete(revenues).where(eq(revenues.videoId, id));
    
    // Finally delete the video
    const result = await db.delete(videos).where(eq(videos.id, id)).returning();
    return result.length > 0;
  }

  // Platform Methods
  async getPlatform(id: number): Promise<Platform | undefined> {
    const [platform] = await db.select().from(platforms).where(eq(platforms.id, id));
    return platform;
  }

  async getAllPlatforms(): Promise<Platform[]> {
    return db.select().from(platforms);
  }

  async createPlatform(platformData: InsertPlatform): Promise<Platform> {
    const [platform] = await db.insert(platforms).values(platformData).returning();
    return platform;
  }

  // Distribution Methods
  async getDistribution(id: number): Promise<Distribution | undefined> {
    const [distribution] = await db.select().from(distributions).where(eq(distributions.id, id));
    return distribution;
  }

  async getDistributionsByVideo(videoId: number): Promise<Distribution[]> {
    return db
      .select()
      .from(distributions)
      .where(eq(distributions.videoId, videoId));
  }

  async getDistributionsByUser(userId: number): Promise<Distribution[]> {
    // Join distributions with videos to filter by user ID
    try {
      return db
        .select()
        .from(distributions)
        .innerJoin(videos, eq(distributions.videoId, videos.id))
        .where(eq(videos.userId, userId));
    } catch (error) {
      console.error("Error in getDistributionsByUser:", error);
      // Return empty array if query fails
      return [];
    }
  }

  async createDistribution(distributionData: InsertDistribution): Promise<Distribution> {
    const [distribution] = await db.insert(distributions).values(distributionData).returning();
    return distribution;
  }

  async updateDistribution(id: number, data: Partial<Distribution>): Promise<Distribution | undefined> {
    const [updatedDistribution] = await db
      .update(distributions)
      .set(data)
      .where(eq(distributions.id, id))
      .returning();
    return updatedDistribution;
  }

  // Revenue Methods
  async getRevenue(id: number): Promise<Revenue | undefined> {
    const [revenue] = await db.select().from(revenues).where(eq(revenues.id, id));
    return revenue;
  }

  async getRevenuesByVideo(videoId: number): Promise<Revenue[]> {
    return db
      .select()
      .from(revenues)
      .where(eq(revenues.videoId, videoId))
      .orderBy(desc(revenues.date));
  }

  async getRevenuesByUser(userId: number): Promise<Revenue[]> {
    // Join revenues with videos to filter by user ID
    return db
      .select({
        id: revenues.id,
        videoId: revenues.videoId,
        platformId: revenues.platformId,
        date: revenues.date,
        amount: revenues.amount,
        views: revenues.views
      })
      .from(revenues)
      .innerJoin(videos, eq(revenues.videoId, videos.id))
      .where(eq(videos.userId, userId))
      .orderBy(desc(revenues.date));
  }

  async createRevenue(revenueData: InsertRevenue): Promise<Revenue> {
    const [revenue] = await db.insert(revenues).values(revenueData).returning();
    return revenue;
  }

  async getRevenueStatsByUser(userId: number): Promise<{ total: number, byPlatform: Record<string, number> }> {
    // Calculate total revenue for user's videos
    const totalResult = await db
      .select({
        total: sql<number>`SUM(${revenues.amount})`
      })
      .from(revenues)
      .innerJoin(videos, eq(revenues.videoId, videos.id))
      .where(eq(videos.userId, userId));
    
    // Calculate revenue by platform
    const byPlatformResult = await db
      .select({
        platformId: revenues.platformId,
        amount: sql<number>`SUM(${revenues.amount})`
      })
      .from(revenues)
      .innerJoin(videos, eq(revenues.videoId, videos.id))
      .where(eq(videos.userId, userId))
      .groupBy(revenues.platformId);
    
    // Get platform names
    const platformsData = await this.getAllPlatforms();
    const platformMap: Record<number, string> = {};
    platformsData.forEach(p => platformMap[p.id] = p.name);
    
    // Create byPlatform object
    const byPlatform: Record<string, number> = {};
    byPlatformResult.forEach(row => {
      const platformName = platformMap[row.platformId] || `Platform ${row.platformId}`;
      byPlatform[platformName] = row.amount;
    });
    
    return {
      total: totalResult[0]?.total || 0,
      byPlatform
    };
  }
  
  // Filmmaker Subscription Methods
  async updateFilmmakerSubscription(userId: number, tier: string, startDate: Date, endDate: Date): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        subscriptionTier: tier,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        isActiveFilmmaker: true,
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async getActiveFilmmakers(): Promise<User[]> {
    const now = new Date();
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isActiveFilmmaker, true), 
          gt(users.subscriptionEndDate as any, now)
        )
      );
  }
  
  // Subscription Plan Methods
  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return db.select().from(subscriptionPlans);
  }
  
  async getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }
  
  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [newPlan] = await db.insert(subscriptionPlans).values(plan).returning();
    return newPlan;
  }
  
  // Revenue Statement Methods
  async getRevenueStatements(userId: number): Promise<RevenueStatement[]> {
    return db
      .select()
      .from(revenueStatements)
      .where(eq(revenueStatements.userId, userId))
      .orderBy(desc(revenueStatements.year), desc(revenueStatements.month));
  }
  
  async getRevenueStatement(id: number): Promise<RevenueStatement | undefined> {
    const [statement] = await db.select().from(revenueStatements).where(eq(revenueStatements.id, id));
    return statement;
  }
  
  async createRevenueStatement(statement: InsertRevenueStatement): Promise<RevenueStatement> {
    const [newStatement] = await db.insert(revenueStatements).values(statement).returning();
    return newStatement;
  }
  
  async updateRevenueStatementPayment(id: number, isPaid: boolean, paymentDate?: Date): Promise<RevenueStatement | undefined> {
    const [updatedStatement] = await db
      .update(revenueStatements)
      .set({
        isPaid,
        paymentDate: paymentDate || null
      })
      .where(eq(revenueStatements.id, id))
      .returning();
    return updatedStatement;
  }
  
  async getMonthlyStatementForUser(userId: number, month: number, year: number): Promise<RevenueStatement | undefined> {
    const [statement] = await db
      .select()
      .from(revenueStatements)
      .where(
        and(
          eq(revenueStatements.userId, userId),
          eq(revenueStatements.month, month),
          eq(revenueStatements.year, year)
        )
      );
    return statement;
  }

  // Content Moderation Methods
  async createContentReport(report: InsertContentReport): Promise<ContentReport> {
    try {
      const [newReport] = await db
        .insert(contentReports)
        .values(report)
        .returning();
      return newReport;
    } catch (error) {
      console.error("Error creating content report:", error);
      throw error;
    }
  }

  async getContentReportsByVideo(videoId: number): Promise<ContentReport[]> {
    try {
      return await db
        .select()
        .from(contentReports)
        .where(eq(contentReports.videoId, videoId));
    } catch (error) {
      console.error("Error getting content reports for video:", error);
      return [];
    }
  }

  async updateContentReport(id: number, data: Partial<ContentReport>): Promise<ContentReport | undefined> {
    try {
      const [updatedReport] = await db
        .update(contentReports)
        .set(data)
        .where(eq(contentReports.id, id))
        .returning();
      return updatedReport;
    } catch (error) {
      console.error("Error updating content report:", error);
      return undefined;
    }
  }

  async getPendingContentReports(): Promise<ContentReport[]> {
    try {
      return await db
        .select()
        .from(contentReports)
        .where(eq(contentReports.status, 'pending'));
    } catch (error) {
      console.error("Error getting pending content reports:", error);
      return [];
    }
  }

  // Moderation Queue Methods
  async createModerationQueue(queueItem: InsertModerationQueue): Promise<ModerationQueue> {
    try {
      const [newQueueItem] = await db
        .insert(moderationQueue)
        .values(queueItem)
        .returning();
      return newQueueItem;
    } catch (error) {
      console.error("Error creating moderation queue item:", error);
      throw error;
    }
  }

  async getModerationQueueByVideoId(videoId: number): Promise<ModerationQueue | undefined> {
    try {
      const [queueItem] = await db
        .select()
        .from(moderationQueue)
        .where(eq(moderationQueue.videoId, videoId));
      return queueItem;
    } catch (error) {
      console.error("Error getting moderation queue item by video ID:", error);
      return undefined;
    }
  }

  async updateModerationQueue(id: number, data: Partial<ModerationQueue>): Promise<ModerationQueue | undefined> {
    try {
      const [updatedQueueItem] = await db
        .update(moderationQueue)
        .set(data)
        .where(eq(moderationQueue.id, id))
        .returning();
      return updatedQueueItem;
    } catch (error) {
      console.error("Error updating moderation queue item:", error);
      return undefined;
    }
  }

  async getPendingModerationItems(limit: number = 20): Promise<ModerationQueue[]> {
    try {
      return await db
        .select()
        .from(moderationQueue)
        .where(eq(moderationQueue.status, 'pending'))
        .limit(limit);
    } catch (error) {
      console.error("Error getting pending moderation items:", error);
      return [];
    }
  }

  async assignModerationItem(queueId: number, moderatorId: number): Promise<ModerationQueue | undefined> {
    try {
      const [assignedItem] = await db
        .update(moderationQueue)
        .set({
          assignedTo: moderatorId,
          status: 'in-review'
        })
        .where(eq(moderationQueue.id, queueId))
        .returning();
      return assignedItem;
    } catch (error) {
      console.error("Error assigning moderation queue item:", error);
      return undefined;
    }
  }
  
  // Filmmaker Contact Methods
  async getFilmmakerContact(id: number): Promise<FilmmakerContact | undefined> {
    try {
      const [contact] = await db
        .select()
        .from(filmmakerContacts)
        .where(eq(filmmakerContacts.id, id));
      return contact;
    } catch (error) {
      console.error("Error getting filmmaker contact:", error);
      return undefined;
    }
  }

  async getFilmmakerContactByEmail(email: string): Promise<FilmmakerContact | undefined> {
    try {
      const [contact] = await db
        .select()
        .from(filmmakerContacts)
        .where(eq(filmmakerContacts.email, email));
      return contact;
    } catch (error) {
      console.error("Error getting filmmaker contact by email:", error);
      return undefined;
    }
  }

  async getAllFilmmakerContacts(limit: number = 100, offset: number = 0): Promise<FilmmakerContact[]> {
    try {
      const contacts = await db
        .select()
        .from(filmmakerContacts)
        .orderBy(desc(filmmakerContacts.dateAdded))
        .limit(limit)
        .offset(offset);
      return contacts;
    } catch (error) {
      console.error("Error getting all filmmaker contacts:", error);
      return [];
    }
  }

  async createFilmmakerContact(contact: InsertFilmmakerContact): Promise<FilmmakerContact> {
    try {
      const [newContact] = await db
        .insert(filmmakerContacts)
        .values(contact)
        .returning();
      return newContact;
    } catch (error) {
      console.error("Error creating filmmaker contact:", error);
      throw error;
    }
  }

  async updateFilmmakerContact(id: number, contactData: Partial<FilmmakerContact>): Promise<FilmmakerContact | undefined> {
    try {
      const [updated] = await db
        .update(filmmakerContacts)
        .set(contactData)
        .where(eq(filmmakerContacts.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating filmmaker contact:", error);
      return undefined;
    }
  }

  async deleteFilmmakerContact(id: number): Promise<boolean> {
    try {
      await db
        .delete(filmmakerContacts)
        .where(eq(filmmakerContacts.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting filmmaker contact:", error);
      return false;
    }
  }

  async markFilmmakerContactAsInvited(id: number): Promise<FilmmakerContact | undefined> {
    try {
      const now = new Date();
      const [updated] = await db
        .update(filmmakerContacts)
        .set({
          invitationSent: true,
          invitationSentAt: now,
          lastInvitationSentAt: now,
          invitationCount: sql`${filmmakerContacts.invitationCount} + 1`
        })
        .where(eq(filmmakerContacts.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error marking filmmaker contact as invited:", error);
      return undefined;
    }
  }

  async markFilmmakerContactAsRegistered(id: number, userId: number): Promise<FilmmakerContact | undefined> {
    try {
      const [updated] = await db
        .update(filmmakerContacts)
        .set({
          hasRegistered: true,
          registeredAt: new Date(),
          registeredUserId: userId
        })
        .where(eq(filmmakerContacts.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error marking filmmaker contact as registered:", error);
      return undefined;
    }
  }

  async getUnregisteredContacts(): Promise<FilmmakerContact[]> {
    try {
      const contacts = await db
        .select()
        .from(filmmakerContacts)
        .where(eq(filmmakerContacts.hasRegistered, false))
        .orderBy(desc(filmmakerContacts.dateAdded));
      return contacts;
    } catch (error) {
      console.error("Error getting unregistered contacts:", error);
      return [];
    }
  }

  async getContactsWithoutInvitation(): Promise<FilmmakerContact[]> {
    try {
      const contacts = await db
        .select()
        .from(filmmakerContacts)
        .where(eq(filmmakerContacts.invitationSent, false))
        .orderBy(desc(filmmakerContacts.dateAdded));
      return contacts;
    } catch (error) {
      console.error("Error getting contacts without invitation:", error);
      return [];
    }
  }

  async searchFilmmakerContacts(query: string): Promise<FilmmakerContact[]> {
    try {
      const searchQuery = `%${query}%`;
      const contacts = await db
        .select()
        .from(filmmakerContacts)
        .where(
          sql`${filmmakerContacts.name} ILIKE ${searchQuery} OR 
              ${filmmakerContacts.email} ILIKE ${searchQuery} OR 
              ${filmmakerContacts.filmTitle} ILIKE ${searchQuery}`
        )
        .orderBy(desc(filmmakerContacts.dateAdded));
      return contacts;
    } catch (error) {
      console.error("Error searching filmmaker contacts:", error);
      return [];
    }
  }

  async getFilmmakerContactsByTags(tags: string[]): Promise<FilmmakerContact[]> {
    try {
      // This query finds contacts where ANY of the provided tags exist in the contact's tags array
      const contacts = await db
        .select()
        .from(filmmakerContacts)
        .where(
          sql`${filmmakerContacts.tags} && ${tags}`
        )
        .orderBy(desc(filmmakerContacts.dateAdded));
      return contacts;
    } catch (error) {
      console.error("Error getting filmmaker contacts by tags:", error);
      return [];
    }
  }

  async importFilmmakerContacts(contacts: InsertFilmmakerContact[]): Promise<{ imported: number, failed: number }> {
    let imported = 0;
    let failed = 0;
    
    try {
      // Process in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        
        try {
          // Insert the batch, ignoring duplicate emails
          const result = await db
            .insert(filmmakerContacts)
            .values(batch)
            .onConflictDoNothing({ target: filmmakerContacts.email })
            .returning();
          
          imported += result.length;
          failed += batch.length - result.length;
        } catch (batchError) {
          // If the batch insert fails, try individual inserts to save as many as possible
          for (const contact of batch) {
            try {
              const [inserted] = await db
                .insert(filmmakerContacts)
                .values(contact)
                .onConflictDoNothing({ target: filmmakerContacts.email })
                .returning();
              
              if (inserted) {
                imported++;
              } else {
                failed++;
              }
            } catch {
              failed++;
            }
          }
        }
      }
      
      return { imported, failed };
    } catch (error) {
      console.error("Error importing filmmaker contacts:", error);
      return { imported, failed };
    }
  }

  // Magazine Subscription Methods
  async getMagazineSubscription(id: number): Promise<MagazineSubscription | undefined> {
    try {
      const [subscription] = await db
        .select()
        .from(magazineSubscriptions)
        .where(eq(magazineSubscriptions.id, id));
      return subscription;
    } catch (error) {
      console.error("Error getting magazine subscription:", error);
      return undefined;
    }
  }

  async getMagazineSubscriptionByUserId(userId: number): Promise<MagazineSubscription | undefined> {
    try {
      const [subscription] = await db
        .select()
        .from(magazineSubscriptions)
        .where(eq(magazineSubscriptions.userId, userId))
        .orderBy(desc(magazineSubscriptions.createdAt))
        .limit(1);
      return subscription;
    } catch (error) {
      console.error("Error getting magazine subscription by user ID:", error);
      return undefined;
    }
  }

  async getMagazineSubscriptions(limit: number = 100, offset: number = 0): Promise<MagazineSubscription[]> {
    try {
      const subscriptions = await db
        .select()
        .from(magazineSubscriptions)
        .orderBy(desc(magazineSubscriptions.createdAt))
        .limit(limit)
        .offset(offset);
      return subscriptions;
    } catch (error) {
      console.error("Error getting all magazine subscriptions:", error);
      return [];
    }
  }

  async getMagazineSubscriptionsByStatus(status: string): Promise<MagazineSubscription[]> {
    try {
      const subscriptions = await db
        .select()
        .from(magazineSubscriptions)
        .where(eq(magazineSubscriptions.status, status))
        .orderBy(desc(magazineSubscriptions.createdAt));
      return subscriptions;
    } catch (error) {
      console.error(`Error getting magazine subscriptions by status ${status}:`, error);
      return [];
    }
  }

  async createMagazineSubscription(subscription: InsertMagazineSubscription): Promise<MagazineSubscription> {
    try {
      // Use start date from subscription or now
      const startDate = subscription.startDate || new Date();

      // Create a safe object
      const { 
        userId, 
        status, 
        startDate: startDateParam, 
        endDate,
        price,
        paymentMethod,
        stripeSubscriptionId
      } = subscription;

      const [result] = await db
        .insert(magazineSubscriptions)
        .values({
          userId,
          status: status || 'active',
          startDate: startDate,
          endDate,
          price: price || 399, // $3.99 default price in cents
          paymentMethod,
          stripeSubscriptionId
        })
        .returning();

      return result;
    } catch (error) {
      console.error("Error creating magazine subscription:", error);
      throw error;
    }
  }

  async updateMagazineSubscription(id: number, data: Partial<MagazineSubscription>): Promise<MagazineSubscription | undefined> {
    try {
      const [subscription] = await db
        .update(magazineSubscriptions)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(magazineSubscriptions.id, id))
        .returning();
      return subscription;
    } catch (error) {
      console.error("Error updating magazine subscription:", error);
      return undefined;
    }
  }

  async cancelMagazineSubscription(id: number): Promise<MagazineSubscription | undefined> {
    try {
      const [subscription] = await db
        .update(magazineSubscriptions)
        .set({
          status: 'cancelled',
          // autoRenew: false, // Removed as this field doesn't exist yet
          updatedAt: new Date(),
        })
        .where(eq(magazineSubscriptions.id, id))
        .returning();
      return subscription;
    } catch (error) {
      console.error("Error cancelling magazine subscription:", error);
      return undefined;
    }
  }

  async renewMagazineSubscription(id: number): Promise<MagazineSubscription | undefined> {
    try {
      // Get the current subscription
      const subscription = await this.getMagazineSubscription(id);
      if (!subscription) return undefined;

      // Calculate the new renewal date (30 days from now)
      const now = new Date();
      const nextRenewalDate = new Date(now);
      nextRenewalDate.setDate(nextRenewalDate.getDate() + 30);

      // Update the subscription
      const [updatedSubscription] = await db
        .update(magazineSubscriptions)
        .set({
          status: 'active',
        })
        .where(eq(magazineSubscriptions.id, id))
        .returning();

      return updatedSubscription;
    } catch (error) {
      console.error("Error renewing magazine subscription:", error);
      return undefined;
    }
  }

  // Magazine Issue Methods
  async getMagazineIssue(id: number): Promise<MagazineIssue | undefined> {
    try {
      const [issue] = await db
        .select()
        .from(magazineIssues)
        .where(eq(magazineIssues.id, id));
      return issue;
    } catch (error) {
      console.error("Error getting magazine issue:", error);
      return undefined;
    }
  }

  async getAllMagazineIssues(limit: number = 100, offset: number = 0): Promise<MagazineIssue[]> {
    try {
      const issues = await db
        .select()
        .from(magazineIssues)
        .orderBy(desc(magazineIssues.issueDate))
        .limit(limit)
        .offset(offset);
      return issues;
    } catch (error) {
      console.error("Error getting all magazine issues:", error);
      return [];
    }
  }

  async getPublishedMagazineIssues(limit: number = 100, offset: number = 0): Promise<MagazineIssue[]> {
    try {
      const issues = await db
        .select()
        .from(magazineIssues)
        .where(eq(magazineIssues.isPublished, true))
        .orderBy(desc(magazineIssues.issueDate))
        .limit(limit)
        .offset(offset);
      return issues;
    } catch (error) {
      console.error("Error getting published magazine issues:", error);
      return [];
    }
  }

  async getLatestMagazineIssue(): Promise<MagazineIssue | undefined> {
    try {
      const [issue] = await db
        .select()
        .from(magazineIssues)
        .where(eq(magazineIssues.isPublished, true))
        .orderBy(desc(magazineIssues.issueDate))
        .limit(1);
      return issue;
    } catch (error) {
      console.error("Error getting latest magazine issue:", error);
      return undefined;
    }
  }

  async createMagazineIssue(issue: InsertMagazineIssue): Promise<MagazineIssue> {
    try {
      const [result] = await db
        .insert(magazineIssues)
        .values(issue)
        .returning();
      return result;
    } catch (error) {
      console.error("Error creating magazine issue:", error);
      throw error;
    }
  }

  async updateMagazineIssue(id: number, data: Partial<MagazineIssue>): Promise<MagazineIssue | undefined> {
    try {
      const [issue] = await db
        .update(magazineIssues)
        .set({
          ...data,
        })
        .where(eq(magazineIssues.id, id))
        .returning();
      return issue;
    } catch (error) {
      console.error("Error updating magazine issue:", error);
      return undefined;
    }
  }

  async publishMagazineIssue(id: number): Promise<MagazineIssue | undefined> {
    try {
      const [issue] = await db
        .update(magazineIssues)
        .set({
          isPublished: true,
        })
        .where(eq(magazineIssues.id, id))
        .returning();
      return issue;
    } catch (error) {
      console.error("Error publishing magazine issue:", error);
      return undefined;
    }
  }

  async unpublishMagazineIssue(id: number): Promise<MagazineIssue | undefined> {
    try {
      const [issue] = await db
        .update(magazineIssues)
        .set({
          isPublished: false,
        })
        .where(eq(magazineIssues.id, id))
        .returning();
      return issue;
    } catch (error) {
      console.error("Error unpublishing magazine issue:", error);
      return undefined;
    }
  }

  async incrementVisitorCount(): Promise<number> {
    try {
      // First, check if we have an existing counter
      const [existingCounter] = await db.select().from(visitorCounter);
      
      if (existingCounter) {
        // Increment the existing counter
        const [updated] = await db
          .update(visitorCounter)
          .set({ 
            count: existingCounter.count + 1,
            lastUpdated: new Date()
          })
          .where(eq(visitorCounter.id, existingCounter.id))
          .returning();
        
        return updated.count;
      } else {
        // Create a new counter starting at 1
        const [newCounter] = await db
          .insert(visitorCounter)
          .values({
            count: 1,
            lastUpdated: new Date()
          })
          .returning();
        
        return newCounter.count;
      }
    } catch (error) {
      console.error("Error incrementing visitor count:", error);
      // If there's an error, return 0 as a fallback
      return 0;
    }
  }
}

export const storage = new DatabaseStorage();