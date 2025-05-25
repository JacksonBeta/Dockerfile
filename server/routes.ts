import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { users, subscriptionPlans } from "@shared/schema";
import { sendPaymentConfirmationEmail } from "./email";
import express from "express";
import path from "path";
import bcrypt from "bcryptjs";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

// Initialize Stripe with API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export function registerRoutes(app: Express): Server {
  // Serve the main login page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'view-platform.html'));
  });
  
  // Ensure we can also serve static files from the root directory
  app.use(express.static(path.join(__dirname, '..')));
  
  // User Registration Endpoint
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const { username, password, email, name } = req.body;
      
      if (!username || !password || !email || !name) {
        return res.status(400).json({ message: "Username, password, email, and name are required" });
      }
      
      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.username, username));
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email already exists
      const existingEmail = await db.select().from(users).where(eq(users.email, email));
      if (existingEmail.length > 0) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Use raw SQL query to avoid issues with Drizzle ORM
      const result = await db.execute(`
        INSERT INTO users (username, password, email, name) 
        VALUES ($1, $2, $3, $4) 
        RETURNING id, username, email, name;
      `, [username, hashedPassword, email, name]);
      
      const newUser = result.rows[0];
      
      res.status(201).json(newUser);
    } catch (error: any) {
      console.error("Registration error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      if (error.code) console.error("Error code:", error.code);
      if (error.constraint) console.error("Constraint violation:", error.constraint);
      if (error.detail) console.error("Error detail:", error.detail);
      if (error.schema) console.error("Schema involved:", error.schema);
      if (error.table) console.error("Table involved:", error.table);
      if (error.column) console.error("Column involved:", error.column);
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  });
  
  // User Login Endpoint
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      // Find user
      const [user] = await db.select().from(users).where(eq(users.username, username));
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Omit password from response
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(200).json(userWithoutPassword);
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed: " + error.message });
    }
  });
  
  // Get Current User Endpoint
  app.get("/api/user", async (req: Request, res: Response) => {
    try {
      // This would typically use session or token-based authentication
      // For simplicity, we're using a basic approach here
      const userId = req.headers['user-id'];
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, Number(userId)));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Omit password from response
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(200).json(userWithoutPassword);
    } catch (error: any) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user: " + error.message });
    }
  });
  
  // Stripe payment intent creation for subscription plans
  app.post("/api/create-payment-intent", async (req: Request, res: Response) => {
    try {
      const { amount, planId, description } = req.body;
      
      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ 
          error: { message: "Invalid amount provided" } 
        });
      }

      console.log(`Creating payment intent for: $${amount}, planId: ${planId}, description: ${description}`);

      // Create a payment intent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(amount) * 100), // Stripe expects amount in cents, and ensure it's an integer
        currency: "usd",
        description: description || `Filmmaker subscription plan ${planId}`,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          planId: planId.toString(),
        },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.error("Payment intent creation error:", error);
      res.status(500).json({
        error: { message: error.message },
      });
    }
  });

  // Handle Stripe webhook for payment success
  app.post("/api/payment-webhook", async (req: Request, res: Response) => {
    const payload = req.body;
    const signature = req.headers['stripe-signature'] as string;

    let event;

    // Verify the event came from Stripe
    try {
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (endpointSecret) {
        event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      } else {
        // For development, allow events without verification
        event = payload;
      }
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        
        try {
          await handleSuccessfulPayment(paymentIntent);
        } catch (error) {
          console.error('Error handling successful payment:', error);
          // Don't return error to Stripe, just log it
        }
        break;
      
      case 'charge.succeeded':
        const charge = event.data.object;
        // Process successful charge if needed
        break;
      
      // Handle other event types as needed
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).json({ received: true });
  });

  // Manual endpoint for payment success (for testing/development)
  app.post("/api/handle-payment-success", async (req: Request, res: Response) => {
    try {
      const { paymentIntentId, userId, email, name, planName, amount } = req.body;
      
      if (!paymentIntentId || !userId || !email || !planName || !amount) {
        return res.status(400).json({ 
          error: { message: "Missing required payment information" } 
        });
      }
      
      // Verify the payment with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          error: { message: "Payment has not been completed successfully" }
        });
      }
      
      // Calculate subscription end date based on plan
      let durationMonths = 3; // Default to 3 months
      
      if (planName.includes('6 months')) {
        durationMonths = 6;
      } else if (planName.includes('1 year')) {
        durationMonths = 12;
      }
      
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + durationMonths);
      
      // Update user in database with subscription information
      await db.update(users)
        .set({
          stripeCustomerId: paymentIntent.customer as string || null,
          subscriptionTier: planName,
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
          isActiveFilmmaker: true
        })
        .where(eq(users.id, userId));
      
      // Send confirmation email
      const emailResult = await sendPaymentConfirmationEmail({
        to: email,
        name: name,
        planName: planName,
        amount: amount,
        endDate: endDate,
        sentBy: 1 // Admin user ID
      });
      
      if (!emailResult.success) {
        console.error('Failed to send confirmation email:', emailResult.error);
      }
      
      res.status(200).json({ 
        success: true, 
        subscriptionEnd: endDate
      });
      
    } catch (error: any) {
      console.error('Error handling payment success:', error);
      res.status(500).json({
        error: { message: error.message }
      });
    }
  });
  
  // Function to handle successful payment
  async function handleSuccessfulPayment(paymentIntent: any) {
    try {
      // Extract information from payment intent
      const { planName } = paymentIntent.metadata;
      const customerEmail = paymentIntent.receipt_email || '';
      const amount = paymentIntent.amount / 100; // Convert cents to dollars
      
      // Find the user by their email
      const [user] = await db.select()
        .from(users)
        .where(eq(users.email, customerEmail));
      
      if (!user) {
        console.error(`User with email ${customerEmail} not found`);
        return;
      }
      
      // Determine subscription duration based on plan name
      let durationMonths = 3; // Default
      
      if (planName.includes('6 months')) {
        durationMonths = 6;
      } else if (planName.includes('1 year') || planName.includes('Premium')) {
        durationMonths = 12;
      }
      
      // Calculate subscription dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + durationMonths);
      
      // Update user subscription information
      await db.update(users)
        .set({
          stripeCustomerId: paymentIntent.customer || null,
          subscriptionTier: planName,
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
          isActiveFilmmaker: true
        })
        .where(eq(users.id, user.id));
      
      // Send confirmation email
      await sendPaymentConfirmationEmail({
        to: user.email,
        name: user.name,
        planName: planName,
        amount: amount,
        endDate: endDate,
        sentBy: 1 // Admin user ID
      });
      
      console.log(`Successfully processed payment for user: ${user.email}, Plan: ${planName}`);
    } catch (error) {
      console.error('Error in handleSuccessfulPayment:', error);
      throw error;
    }
  }

  // Create a payment success page
  app.get("/payment-success", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Successful - Hollywood Weekly</title>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
          <style>
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }
              
              body {
                  background-color: #000000;
                  color: #ffffff;
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  text-align: center;
              }
              
              .success-container {
                  max-width: 600px;
                  padding: 40px;
              }
              
              .success-icon {
                  width: 100px;
                  height: 100px;
                  background-color: rgba(34, 197, 94, 0.2);
                  color: #22c55e;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 40px;
                  margin: 0 auto 30px;
              }
              
              .success-title {
                  font-size: 36px;
                  font-weight: 700;
                  margin-bottom: 20px;
              }
              
              .success-message {
                  font-size: 18px;
                  color: rgba(255, 255, 255, 0.8);
                  margin-bottom: 40px;
                  line-height: 1.6;
              }
              
              .success-btn {
                  display: inline-block;
                  padding: 15px 30px;
                  background-color: #4a6cf7;
                  color: white;
                  text-decoration: none;
                  border-radius: 8px;
                  font-size: 16px;
                  font-weight: 600;
                  transition: all 0.3s;
              }
              
              .success-btn:hover {
                  background-color: #395bdf;
                  transform: translateY(-2px);
                  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
              }
          </style>
      </head>
      <body>
          <div class="success-container">
              <div class="success-icon">
                  <i class="fas fa-check"></i>
              </div>
              <h1 class="success-title">Payment Successful!</h1>
              <p class="success-message">
                  Thank you for subscribing to Hollywood Weekly's distribution platform. Your payment has been processed successfully, and your account has been activated. You can now start uploading and distributing your content to major streaming platforms.
              </p>
              <a href="/dashboard.html" class="success-btn">Go to Dashboard</a>
          </div>
      </body>
      </html>
    `);
  });

  // Create a success route for Stripe redirect
  app.get("/api/payment-success", (req, res) => {
    res.redirect("/payment-success");
  });

  // Add a route for bulk emailing filmmakers
  app.post("/api/email/bulk-invite", async (req: Request, res: Response) => {
    try {
      const { filmmakerIds, message, subject, sentBy } = req.body;
      
      if (!filmmakerIds || !Array.isArray(filmmakerIds) || filmmakerIds.length === 0) {
        return res.status(400).json({ error: "No filmmakers selected" });
      }
      
      if (!sentBy) {
        return res.status(400).json({ error: "Sender ID is required" });
      }
      
      // TODO: Implement bulk email invitation to filmmakers
      // This would query the filmmaker database and send invitations
      
      res.status(200).json({ success: true, count: filmmakerIds.length });
    } catch (error: any) {
      console.error('Error sending bulk invitations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add a route to import filmmakers from CSV
  app.post("/api/filmmakers/import", async (req: Request, res: Response) => {
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: "CSV content is required" });
      }
      
      // Import the processFilmmakerCsv function from filmmakers.ts
      const { processFilmmakerCsv } = require('./filmmakers');
      
      // Process the CSV content
      const result = await processFilmmakerCsv(csvContent);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error: any) {
      console.error('Error importing filmmakers:', error);
      res.status(500).json({
        error: error.message || 'Failed to import filmmakers'
      });
    }
  });
  
  // Add a route to get filmmakers
  app.get("/api/filmmakers", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      
      // Import the getFilmmakers function from filmmakers.ts
      const { getFilmmakers } = require('./filmmakers');
      
      // Get filmmakers with pagination
      const result = await getFilmmakers(page, limit, search);
      
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error fetching filmmakers:', error);
      res.status(500).json({
        error: error.message || 'Failed to fetch filmmakers'
      });
    }
  });
  
  // Add a route to send invitations to filmmakers
  app.post("/api/filmmakers/invite", async (req: Request, res: Response) => {
    try {
      const { filmmakerIds, sentBy } = req.body;
      
      if (!filmmakerIds || !Array.isArray(filmmakerIds) || filmmakerIds.length === 0) {
        return res.status(400).json({ error: "No filmmakers selected" });
      }
      
      if (!sentBy) {
        return res.status(400).json({ error: "Sender ID is required" });
      }
      
      // Import the sendInvitationsToFilmmakers function from filmmakers.ts
      const { sendInvitationsToFilmmakers } = require('./filmmakers');
      
      // Send invitations
      const result = await sendInvitationsToFilmmakers(filmmakerIds, sentBy);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error: any) {
      console.error('Error sending invitations:', error);
      res.status(500).json({
        error: error.message || 'Failed to send invitations'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}console.error("DETAILED ERROR LOGGING ENABLED");
