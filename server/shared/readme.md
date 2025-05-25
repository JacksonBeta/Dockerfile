import { pgTable, text, serial, integer, boolean, json, timestamp, real, varchar, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio"),
  profileImage: text("profile_image"),
  // Stripe payment fields
  stripeCustomerId: text("stripe_customer_id"),
  stripeAccountId: text("stripe_account_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // Filmmaker subscription details
  subscriptionTier: text("subscription_tier"), // "basic", "premium", "professional"
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  isActiveFilmmaker: boolean("is_active_filmmaker").default(false),
  // Content moderation and verification fields
  verificationStatus: text("verification_status").default('unverified'), // unverified, pending, verified
  verificationDocuments: json("verification_documents"), // Can store documents, ID info
  trustScore: integer("trust_score").default(0), // Score based on history, increases with good behavior
  strikes: integer("strikes").default(0), // Number of violations
  isBanned: boolean("is_banned").default(false), // Whether user is banned
  // Admin access
  isAdmin: boolean("is_admin").default(false) // Whether user has admin access
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  name: true,
  bio: true,
  profileImage: true,
  isAdmin: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Videos table
export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  userId: integer("user_id").notNull(),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"), // in seconds
  uploadDate: timestamp("upload_date").defaultNow(),
  isPublished: boolean("is_published").default(false),
  metadata: json("metadata"),
  // Content moderation fields
  moderationStatus: text("moderation_status").default('pending'), // pending, approved, rejected
  moderationNotes: text("moderation_notes"), // Notes from moderators
  aiScreeningResult: json("ai_screening_result"), // Results from AI screening
  aiScreeningScore: real("ai_screening_score"), // 0-1 confidence score
  moderatedBy: integer("moderated_by"), // User ID of moderator
  moderatedAt: timestamp("moderated_at"), // Time of moderation
  contentRating: text("content_rating"), // G, PG, PG-13, R, etc.
  contentWarnings: text("content_warnings").array(), // Array of content warnings
});

export const insertVideoSchema = createInsertSchema(videos).pick({
  title: true,
  description: true,
  userId: true,
  videoUrl: true,
  thumbnailUrl: true,
  duration: true,
  metadata: true,
});

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

// Streaming Platforms table
export const platforms = pgTable("platforms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  apiEndpoint: text("api_endpoint"),
  contentPolicies: json("content_policies"), // Platform specific content policies
  restrictedContent: text("restricted_content").array(), // List of content types not allowed
  requiredDocuments: text("required_documents").array(), // Documents required for distribution
  ratingSystem: text("rating_system"), // Rating system used by platform
});

export const insertPlatformSchema = createInsertSchema(platforms);
export type Platform = typeof platforms.$inferSelect;
export type InsertPlatform = z.infer<typeof insertPlatformSchema>;

// Video Distribution table (connecting videos with platforms)
export const distributions = pgTable("distributions", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull(),
  platformId: integer("platform_id").notNull(),
  status: text("status").default("pending"), // pending, processing, transcoding, submitted, active, rejected
  distributionDate: timestamp("distribution_date").defaultNow(),
  views: integer("views").default(0),
  revenue: real("revenue").default(0),
  externalId: text("external_id"), // ID on the external platform when assigned
  submissionDate: timestamp("submission_date"), // When it was submitted to the platform
  approvalDate: timestamp("approval_date"), // When it was approved by the platform
  rejectionReason: text("rejection_reason"), // If rejected, the reason why
  processingProgress: integer("processing_progress"), // Processing progress as percentage
  lastStatusUpdate: timestamp("last_status_update"), // Last time the status was updated
  distributionUrl: text("distribution_url"), // URL to the video on the platform when active
});

export const insertDistributionSchema = createInsertSchema(distributions).pick({
  videoId: true,
  platformId: true,
  status: true,
  externalId: true,
  submissionDate: true,
  approvalDate: true,
  rejectionReason: true,
  processingProgress: true,
  lastStatusUpdate: true,
  distributionUrl: true,
});

export type Distribution = typeof distributions.$inferSelect;
export type InsertDistribution = z.infer<typeof insertDistributionSchema>;

// Revenue Records table
export const revenues = pgTable("revenues", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull(),
  platformId: integer("platform_id").notNull(),
  date: timestamp("date").defaultNow(),
  amount: real("amount").notNull(),
  views: integer("views").notNull(),
});

export const insertRevenueSchema = createInsertSchema(revenues).pick({
  videoId: true,
  platformId: true,
  amount: true,
  views: true,
});

export type Revenue = typeof revenues.$inferSelect;
export type InsertRevenue = z.infer<typeof insertRevenueSchema>;

// Filmmaker Payment Plans
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(), // in cents
  durationMonths: integer("duration_months").notNull(),
  description: text("description").notNull(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;

// Monthly Revenue Statements
export const revenueStatements = pgTable("revenue_statements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  totalRevenue: integer("total_revenue").notNull(), // in cents
  platformFee: integer("platform_fee").notNull(), // in cents (15% of total)
  netRevenue: integer("net_revenue").notNull(), // in cents
  isPaid: boolean("is_paid").default(false),
  paymentDate: timestamp("payment_date"),
  statementUrl: text("statement_url"), // PDF statement URL
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRevenueStatementSchema = createInsertSchema(revenueStatements).pick({
  userId: true,
  month: true,
  year: true,
  totalRevenue: true,
  platformFee: true,
  netRevenue: true,
  isPaid: true,
  paymentDate: true,
  statementUrl: true,
});

export type RevenueStatement = typeof revenueStatements.$inferSelect;
export type InsertRevenueStatement = z.infer<typeof insertRevenueStatementSchema>;

// Email Templates
export const emailTemplates = pgTable("email_templates", {
  id: text("id").primaryKey().notNull(), // UUID
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by"),
  isArchived: boolean("is_archived").default(false)
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

// Email Drafts
export const emailDrafts = pgTable("email_drafts", {
  id: text("id").primaryKey().notNull(), // UUID
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(), 
  recipients: json("recipients").$type<string[]>(),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  templateId: text("template_id").references(() => emailTemplates.id)
});

export const insertEmailDraftSchema = createInsertSchema(emailDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type EmailDraft = typeof emailDrafts.$inferSelect;
export type InsertEmailDraft = z.infer<typeof insertEmailDraftSchema>;

// Sent Emails
export const emailSent = pgTable("email_sent", {
  id: text("id").primaryKey().notNull(), // UUID
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  recipients: json("recipients").$type<string[]>(),
  sentBy: integer("sent_by").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  templateId: text("template_id").references(() => emailTemplates.id),
  opens: integer("opens").default(0).notNull(),
  clicks: integer("clicks").default(0).notNull(),
  status: text("status").default("sent").notNull() // sent, delivered, failed
});

export const insertEmailSentSchema = createInsertSchema(emailSent).omit({
  id: true,
  sentAt: true,
  opens: true,
  clicks: true
});

export type EmailSent = typeof emailSent.$inferSelect;
export type InsertEmailSent = z.infer<typeof insertEmailSentSchema>;

// Extended schemas for front-end validation
export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export const uploadVideoSchema = insertVideoSchema.extend({
  title: z.string().min(3, "Title must be at least 3 characters"),
  platformIds: z.array(z.number()).optional(),
  // Extended metadata
  releaseYear: z.string().optional(),
  director: z.string().optional(),
  cast: z.string().optional(),
  mature: z.boolean().default(false),
  categories: z.array(z.string()).default([]),
  languages: z.array(z.string()).default(['en']),
});

// Content Reports table for user-submitted reports
export const contentReports = pgTable("content_reports", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull(),
  reporterId: integer("reporter_id"), // Can be null for anonymous reports
  reportReason: text("report_reason").notNull(),
  reportDetails: text("report_details"),
  reportedAt: timestamp("reported_at").defaultNow(),
  status: text("status").default('pending'), // pending, reviewed, dismissed
  reviewedBy: integer("reviewed_by"), // Admin who reviewed the report
  reviewedAt: timestamp("reviewed_at"),
  resolution: text("resolution"), // Action taken
});

export const insertContentReportSchema = createInsertSchema(contentReports).pick({
  videoId: true,
  reporterId: true,
  reportReason: true,
  reportDetails: true,
});

export type ContentReport = typeof contentReports.$inferSelect;
export type InsertContentReport = z.infer<typeof insertContentReportSchema>;

// Moderation Queue table for tracking videos that need review
export const moderationQueue = pgTable("moderation_queue", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull().unique(), // One queue entry per video
  userId: integer("user_id").notNull(), // Video owner
  addedAt: timestamp("added_at").defaultNow(),
  priority: text("priority").default('normal'), // low, normal, high, urgent
  aiScreeningCompleted: boolean("ai_screening_completed").default(false),
  humanReviewRequired: boolean("human_review_required").default(true),
  assignedTo: integer("assigned_to"), // Moderator assigned to review
  status: text("status").default('pending'), // pending, in-review, approved, rejected
  platformSpecificFlags: json("platform_specific_flags"), // Potential issues for specific platforms
});

export const insertModerationQueueSchema = createInsertSchema(moderationQueue).pick({
  videoId: true,
  userId: true,
  priority: true,
});

export type ModerationQueue = typeof moderationQueue.$inferSelect;
export type InsertModerationQueue = z.infer<typeof insertModerationQueueSchema>;

// Filmmaker Contacts table for email invitations
export const filmmakerContacts = pgTable("filmmaker_contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  filmTitle: text("film_title"),
  submissionYear: integer("submission_year"),
  filmCategory: text("film_category"),
  filmFestivalYear: integer("film_festival_year"),
  additionalInfo: json("additional_info"),
  dateAdded: timestamp("date_added").defaultNow(),
  // Invitation tracking
  invitationSent: boolean("invitation_sent").default(false),
  invitationSentAt: timestamp("invitation_sent_at"),
  lastInvitationSentAt: timestamp("last_invitation_sent_at"),
  invitationCount: integer("invitation_count").default(0),
  hasRegistered: boolean("has_registered").default(false),
  registeredAt: timestamp("registered_at"),
  registeredUserId: integer("registered_user_id"),
  notes: text("notes"),
  // Tracking
  lastEmailOpened: timestamp("last_email_opened"),
  lastEmailClicked: timestamp("last_email_clicked"),
  // Tags for organizing contacts
  tags: text("tags").array(),
});

export const insertFilmmakerContactSchema = createInsertSchema(filmmakerContacts).pick({
  name: true,
  email: true,
  filmTitle: true,
  submissionYear: true,
  filmCategory: true,
  filmFestivalYear: true,
  additionalInfo: true,
  notes: true,
  tags: true,
});

export type FilmmakerContact = typeof filmmakerContacts.$inferSelect;
export type InsertFilmmakerContact = z.infer<typeof insertFilmmakerContactSchema>;

// Magazine Subscriptions table
export const magazineSubscriptions = pgTable("magazine_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  status: text("status").notNull().default('active'), // active, cancelled, expired
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
  // Remove fields that don't exist in the database yet
  // lastRenewalDate: timestamp("last_renewal_date"),
  // nextRenewalDate: timestamp("next_renewal_date"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  paymentMethod: text("payment_method"), // stripe, paypal
  price: integer("price").notNull(), // in cents (399 for $3.99)
  // Invoice and payment tracking
  invoiceSent: boolean("invoice_sent").default(false),
  invoiceSentDate: timestamp("invoice_sent_date"),
  paymentReceived: boolean("payment_received").default(false),
  paymentReceivedDate: timestamp("payment_received_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMagazineSubscriptionSchema = createInsertSchema(magazineSubscriptions).pick({
  userId: true,
  status: true,
  startDate: true,
  endDate: true,
  // autoRenew: true, // Removed as field doesn't exist in DB yet
  price: true,
  paymentMethod: true,
  stripeSubscriptionId: true,
});

export type MagazineSubscription = typeof magazineSubscriptions.$inferSelect;
export type InsertMagazineSubscription = z.infer<typeof insertMagazineSubscriptionSchema>;

// Magazine Issues table
export const magazineIssues = pgTable("magazine_issues", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  issueDate: timestamp("issue_date").notNull(),
  coverImageUrl: text("cover_image_url"),
  // pdfUrl: text("pdf_url").notNull(), // Removed as it doesn't exist in the database yet
  issuuLink: text("issuu_link"),
  isPublished: boolean("is_published").default(false),
  // Removing timestamp fields that don't exist in the database yet
  // createdAt: timestamp("created_at").notNull().defaultNow(),
  // updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMagazineIssueSchema = createInsertSchema(magazineIssues).pick({
  title: true,
  description: true,
  issueDate: true,
  coverImageUrl: true,
  // pdfUrl: true, // Removed as it doesn't exist in the database yet
  issuuLink: true,
  isPublished: true,
});

export type MagazineIssue = typeof magazineIssues.$inferSelect;
export type InsertMagazineIssue = z.infer<typeof insertMagazineIssueSchema>;

// Magazine Subscriber Information table
export const magazineSubscriberInfo = pgTable("magazine_subscriber_info", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phoneNumber: text("phone_number").notNull(),
  mailingAddress: text("mailing_address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMagazineSubscriberInfoSchema = createInsertSchema(magazineSubscriberInfo).pick({
  subscriptionId: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  mailingAddress: true,
  city: true,
  state: true,
  zipCode: true,
});

export type MagazineSubscriberInfo = typeof magazineSubscriberInfo.$inferSelect;
export type InsertMagazineSubscriberInfo = z.infer<typeof insertMagazineSubscriberInfoSchema>;

// Visitor Counter
export const visitorCounter = pgTable("visitor_counter", {
  id: serial("id").primaryKey(),
  count: integer("count").notNull().default(0),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export type VisitorCounter = typeof visitorCounter.$inferSelect;

// Note: Email template tables are already defined elsewhere in this file
