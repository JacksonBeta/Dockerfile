import { Request, Response } from 'express';
import Stripe from 'stripe';
import { log } from '../vite';
import { storage } from '../storage';
import { sendGridService } from '../services/sendgrid-service';
import { invoiceService } from '../services/invoice-service';

// Initialize Stripe with the secret key
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    // Verify webhook signature if a secret is available
    if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      // For development, just parse the JSON payload without verification
      log('Warning: STRIPE_WEBHOOK_SECRET is not set. Webhook validation will be skipped.', 'stripe-webhook');
      event = req.body as Stripe.Event;
    }

    // Handle the event based on its type
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        log(`Unhandled Stripe event type: ${event.type}`, 'stripe-webhook');
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).json({ received: true });
  } catch (err: any) {
    log(`Webhook Error: ${err.message}`, 'stripe-webhook');
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
}

/**
 * Handle payment intent succeeded event
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  log(`Payment succeeded: ${paymentIntent.id} for ${paymentIntent.amount} ${paymentIntent.currency}`, 'stripe-webhook');
  
  // Extract the user ID from the payment intent metadata
  const userId = paymentIntent.metadata?.userId;
  if (userId) {
    // If this is related to a subscription plan purchase
    const planId = paymentIntent.metadata?.planId;
    if (planId) {
      // Get user and plan information
      const user = await storage.getUser(parseInt(userId));
      const plan = await storage.getSubscriptionPlan(parseInt(planId));
      
      if (user && plan) {
        // Send a confirmation email
        if (user.email) {
          await sendGridService.sendNotification(
            user.email,
            'Your Hollywood Weekly Subscription is Active',
            `
            <p>Hello ${user.name || user.username},</p>
            <p>Your payment was successful, and your ${plan.name} subscription is now active.</p>
            <p>Your subscription will expire on ${new Date(user.subscriptionEndDate || '').toLocaleDateString()}.</p>
            <p>Thank you for becoming a part of Hollywood Weekly!</p>
            `
          );
        }
      }
    }
  }
}

/**
 * Handle payment intent failed event
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  log(`Payment failed: ${paymentIntent.id}`, 'stripe-webhook');
  
  // Extract the user ID from the payment intent metadata
  const userId = paymentIntent.metadata?.userId;
  if (userId) {
    const user = await storage.getUser(parseInt(userId));
    
    if (user && user.email) {
      // Send a notification about the failed payment
      await sendGridService.sendNotification(
        user.email,
        'Payment Failed - Hollywood Weekly',
        `
        <p>Hello ${user.name || user.username},</p>
        <p>We were unable to process your recent payment.</p>
        <p>Error: ${paymentIntent.last_payment_error?.message || 'Unknown error'}</p>
        <p>Please update your payment information in your account settings and try again.</p>
        <p>If you need assistance, please contact our support team.</p>
        `
      );
    }
  }
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  log(`Subscription created: ${subscription.id}`, 'stripe-webhook');
  
  // Get the customer ID to find the user
  const customerId = subscription.customer as string;
  if (customerId) {
    try {
      // Try to find the user with this Stripe customer ID
      const users = await storage.getUserByStripeCustomerId(customerId);
      
      if (users && users.length > 0) {
        const user = users[0];
        
        // Update the user's subscription ID
        await storage.updateUserStripeInfo(user.id, {
          stripeSubscriptionId: subscription.id
        });
        
        // Get subscription period for the user's records
        const subscriptionData = await stripe.subscriptions.retrieve(subscription.id);
        
        const startDate = new Date(subscriptionData.current_period_start * 1000);
        const endDate = new Date(subscriptionData.current_period_end * 1000);
        
        // Update user's subscription dates
        await storage.updateFilmmakerSubscription(
          user.id,
          'premium', // This might need to be derived from the actual plan
          startDate,
          endDate
        );
        
        // Send confirmation email
        if (user.email) {
          await sendGridService.sendNotification(
            user.email,
            'Your Subscription Has Been Activated',
            `
            <p>Hello ${user.name || user.username},</p>
            <p>Your subscription has been successfully activated.</p>
            <p>Subscription ID: ${subscription.id}</p>
            <p>Start Date: ${startDate.toLocaleDateString()}</p>
            <p>Next Billing Date: ${endDate.toLocaleDateString()}</p>
            <p>Thank you for subscribing to Hollywood Weekly!</p>
            `
          );
        }
      }
    } catch (error) {
      log(`Error processing subscription created event: ${(error as Error).message}`, 'stripe-webhook');
    }
  }
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  log(`Subscription updated: ${subscription.id}`, 'stripe-webhook');
  
  // Check for status changes
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    // Subscription is active, ensure user has access
    await activateUserSubscription(subscription);
  } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    // Subscription is no longer active, revoke access
    await deactivateUserSubscription(subscription);
  }
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  log(`Subscription deleted: ${subscription.id}`, 'stripe-webhook');
  await deactivateUserSubscription(subscription);
}

/**
 * Handle invoice payment succeeded event
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  log(`Invoice payment succeeded: ${invoice.id}`, 'stripe-webhook');
  
  // If this is a subscription invoice
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    await activateUserSubscription(subscription);
  }
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  log(`Invoice payment failed: ${invoice.id}`, 'stripe-webhook');
  
  // If this is a subscription invoice
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const customerId = subscription.customer as string;
    
    // Find the user with this customer ID
    try {
      const users = await storage.getUserByStripeCustomerId(customerId);
      
      if (users && users.length > 0) {
        const user = users[0];
        
        // Send notification about failed payment
        if (user.email) {
          await sendGridService.sendNotification(
            user.email,
            'Subscription Payment Failed',
            `
            <p>Hello ${user.name || user.username},</p>
            <p>We were unable to process your subscription payment.</p>
            <p>Please update your payment information in your account settings to avoid service interruption.</p>
            <p>If you need assistance, please contact our support team.</p>
            `
          );
        }
      }
    } catch (error) {
      log(`Error processing invoice payment failed event: ${(error as Error).message}`, 'stripe-webhook');
    }
  }
}

/**
 * Helper to activate a user's subscription
 */
async function activateUserSubscription(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  try {
    // Find user with this customer ID
    const users = await storage.getUserByStripeCustomerId(customerId);
    
    if (users && users.length > 0) {
      const user = users[0];
      
      // Update subscription ID and dates
      await storage.updateUserStripeInfo(user.id, {
        stripeSubscriptionId: subscription.id
      });
      
      // Update subscription dates
      const startDate = new Date(subscription.current_period_start * 1000);
      const endDate = new Date(subscription.current_period_end * 1000);
      
      await storage.updateFilmmakerSubscription(
        user.id,
        'premium', // This needs to be derived from the plan
        startDate,
        endDate
      );
    }
  } catch (error) {
    log(`Error activating user subscription: ${(error as Error).message}`, 'stripe-webhook');
  }
}

/**
 * Helper to deactivate a user's subscription
 */
async function deactivateUserSubscription(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  try {
    // Find user with this customer ID
    const users = await storage.getUserByStripeCustomerId(customerId);
    
    if (users && users.length > 0) {
      const user = users[0];
      
      // Update user record to reflect canceled subscription
      // We keep the stripeSubscriptionId for reference, but mark end date as now
      const now = new Date();
      
      await storage.updateFilmmakerSubscription(
        user.id,
        'none', // No active subscription
        user.subscriptionStartDate || now,
        now // End date is now
      );
      
      // Send notification about subscription ending
      if (user.email) {
        await sendGridService.sendNotification(
          user.email,
          'Your Subscription Has Ended',
          `
          <p>Hello ${user.name || user.username},</p>
          <p>Your Hollywood Weekly subscription has ended.</p>
          <p>If this was not intentional, please visit your account page to renew your subscription.</p>
          <p>Thank you for being a part of Hollywood Weekly!</p>
          `
        );
      }
    }
  } catch (error) {
    log(`Error deactivating user subscription: ${(error as Error).message}`, 'stripe-webhook');
  }
}
