import nodemailer from 'nodemailer';
import { insertEmailSentSchema, type InsertEmailSent } from '@shared/schema';
import { db } from './db';
import { emailSent } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
  throw new Error('Missing email credentials. Please set EMAIL_USER and EMAIL_PASSWORD environment variables.');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',  // Using Gmail service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send email using nodemailer
 */
export async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  sentBy: number;  // User ID of sender
  templateId?: string;
}): Promise<{ success: boolean; messageId?: string; error?: any }> {
  const {
    to,
    subject,
    html,
    text,
    from = `Hollywood Weekly <${process.env.EMAIL_USER}>`,
    replyTo = process.env.EMAIL_USER,
    sentBy,
    templateId,
  } = options;

  try {
    // Convert to array if single email
    const recipients = Array.isArray(to) ? to : [to];

    // Send the email
    const info = await transporter.sendMail({
      from,
      to: recipients.join(','),
      replyTo,
      subject,
      text: text || convertHtmlToText(html),
      html,
    });

    // Record the email in the database
    const emailId = uuidv4();
    const emailData: InsertEmailSent = {
      id: emailId,
      subject,
      content: html,
      recipients: recipients,
      sentBy,
      templateId,
      status: 'sent'
    };

    // Insert email record into the database
    await db.insert(emailSent).values(emailData);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error,
    };
  }
}

/**
 * Send a welcome email to new filmmakers
 */
export async function sendWelcomeEmail(options: {
  to: string;
  name: string;
  sentBy: number;
}): Promise<{ success: boolean; messageId?: string; error?: any }> {
  const { to, name, sentBy } = options;

  const subject = `Welcome to Hollywood Weekly Distribution Platform, ${name}!`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <div style="background-color: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0;">Welcome to Hollywood Weekly</h1>
        <p style="color: #4a6cf7; margin: 5px 0 0;">Distribution Platform</p>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
        <p>Dear ${name},</p>
        
        <p>Welcome to the Hollywood Weekly Distribution Platform! We're thrilled to have you join our community of talented filmmakers.</p>
        
        <p>Our platform allows you to distribute your content to major streaming services including Google TV, Amazon Prime, Apple TV, and Peacock, helping you reach a global audience and monetize your creative work.</p>
        
        <h3 style="color: #4a6cf7;">Next Steps:</h3>
        <ol>
          <li>Complete your filmmaker profile</li>
          <li>Upload your first video for distribution</li>
          <li>Select your target platforms</li>
          <li>Track your performance and revenue</li>
        </ol>
        
        <p>If you have any questions or need assistance, don't hesitate to reach out to our support team at <a href="mailto:info@hollywoodweekly.tv" style="color: #4a6cf7;">info@hollywoodweekly.tv</a> or call us at (323) 456-5004.</p>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://hollywoodweekly.tv/dashboard" style="background-color: #4a6cf7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Dashboard</a>
        </div>
        
        <p style="margin-top: 30px;">Best regards,<br>The Hollywood Weekly Team</p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #777; font-size: 12px;">
        <p>© 2025 Hollywood Weekly. All rights reserved.</p>
        <p>Phone: (323) 456-5004 | Email: info@hollywoodweekly.tv</p>
      </div>
    </div>
  `;

  return await sendEmail({
    to,
    subject,
    html,
    sentBy,
  });
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmationEmail(options: {
  to: string;
  name: string;
  planName: string;
  amount: number;
  endDate: Date;
  sentBy: number;
}): Promise<{ success: boolean; messageId?: string; error?: any }> {
  const { to, name, planName, amount, endDate, sentBy } = options;

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);

  const formattedEndDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(endDate);

  const subject = `Payment Confirmation - Hollywood Weekly ${planName}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <div style="background-color: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0;">Payment Confirmation</h1>
        <p style="color: #4a6cf7; margin: 5px 0 0;">Hollywood Weekly Distribution Platform</p>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
        <p>Dear ${name},</p>
        
        <p>Thank you for subscribing to the Hollywood Weekly Distribution Platform. Your payment has been successfully processed.</p>
        
        <div style="background-color: #eee; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #4a6cf7; margin-top: 0;">Payment Details:</h3>
          <p><strong>Plan:</strong> ${planName}</p>
          <p><strong>Amount:</strong> ${formattedAmount}</p>
          <p><strong>Subscription Active Until:</strong> ${formattedEndDate}</p>
        </div>
        
        <p>You now have full access to all distribution features included in your plan. You can start uploading your content and distributing it to major streaming platforms right away.</p>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://hollywoodweekly.tv/dashboard" style="background-color: #4a6cf7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Dashboard</a>
        </div>
        
        <p style="margin-top: 30px;">If you have any questions about your subscription or need assistance, please contact our support team at <a href="mailto:info@hollywoodweekly.tv" style="color: #4a6cf7;">info@hollywoodweekly.tv</a> or call (323) 456-5004.</p>
        
        <p>Thank you for choosing Hollywood Weekly!</p>
        
        <p>Best regards,<br>The Hollywood Weekly Team</p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #777; font-size: 12px;">
        <p>© 2025 Hollywood Weekly. All rights reserved.</p>
        <p>Phone: (323) 456-5004 | Email: info@hollywoodweekly.tv</p>
      </div>
    </div>
  `;

  return await sendEmail({
    to,
    subject,
    html,
    sentBy,
  });
}

/**
 * Send invitation to filmmakers in your database
 */
export async function sendFilmmakerInvitation(options: {
  to: string;
  name: string;
  filmTitle?: string;
  sentBy: number;
}): Promise<{ success: boolean; messageId?: string; error?: any }> {
  const { to, name, filmTitle, sentBy } = options;

  const filmReference = filmTitle ? ` for your film "${filmTitle}"` : '';
  const subject = `Exclusive Invitation: Distribute Your Film with Hollywood Weekly`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <div style="background-color: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0;">Exclusive Filmmaker Invitation</h1>
        <p style="color: #4a6cf7; margin: 5px 0 0;">Hollywood Weekly Distribution Platform</p>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
        <p>Dear ${name},</p>
        
        <p>We are excited to invite you${filmReference} to join the Hollywood Weekly Distribution Platform - a new service designed exclusively for independent filmmakers like you.</p>
        
        <h3 style="color: #4a6cf7;">What We Offer:</h3>
        <ul>
          <li><strong>Multi-Platform Distribution</strong> - Get your films on Google TV, Amazon Prime, Apple TV, and Peacock</li>
          <li><strong>Revenue Generation</strong> - Earn from various monetization models (SVOD, TVOD, AVOD)</li>
          <li><strong>Analytics Dashboard</strong> - Track your performance across all platforms</li>
          <li><strong>Marketing Support</strong> - Increase visibility and audience reach</li>
          <li><strong>Revenue Sharing</strong> - Fair 85/15 split with monthly statements</li>
        </ul>
        
        <h3 style="color: #4a6cf7;">Our Subscription Plans:</h3>
        <div style="background-color: #eee; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Basic Plan:</strong> $99 for 3 months</p>
          <p><strong>Pro Plan:</strong> $599 for 6 months</p>
          <p><strong>Premium Plan:</strong> $999 for 1 year</p>
        </div>
        
        <p>As a filmmaker already in our network, you qualify for our special launch offer. Join now to be among the first to take advantage of this revolutionary distribution opportunity.</p>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://hollywoodweekly.tv/signup" style="background-color: #4a6cf7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Join Now</a>
        </div>
        
        <p style="margin-top: 30px;">If you have any questions, please contact us at <a href="mailto:info@hollywoodweekly.tv" style="color: #4a6cf7;">info@hollywoodweekly.tv</a> or call (323) 456-5004.</p>
        
        <p>We look forward to welcoming you to our platform!</p>
        
        <p>Best regards,<br>The Hollywood Weekly Team</p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #777; font-size: 12px;">
        <p>© 2025 Hollywood Weekly. All rights reserved.</p>
        <p>Phone: (323) 456-5004 | Email: info@hollywoodweekly.tv</p>
        <p>To unsubscribe from these emails, <a href="https://hollywoodweekly.tv/unsubscribe?email=${encodeURIComponent(to)}" style="color: #777;">click here</a>.</p>
      </div>
    </div>
  `;

  return await sendEmail({
    to,
    subject,
    html,
    sentBy,
  });
}

/**
 * Send bulk email to filmmakers
 */
export async function sendBulkEmail(options: {
  recipients: Array<{ email: string; name: string; filmTitle?: string }>;
  subject: string;
  htmlTemplate: string;
  sentBy: number;
}): Promise<{ 
  success: boolean; 
  sentCount: number; 
  failedCount: number;
  results: Array<{ email: string; success: boolean; error?: any }>
}> {
  const { recipients, subject, htmlTemplate, sentBy } = options;
  
  const results: Array<{ email: string; success: boolean; error?: any }> = [];
  let sentCount = 0;
  let failedCount = 0;
  
  // Process emails in batches to avoid overloading the email service
  const batchSize = 50;
  
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    // Send emails in parallel but limit concurrency
    const batchResults = await Promise.all(
      batch.map(async (recipient) => {
        try {
          // Replace placeholders in the template
          const personalizedHtml = htmlTemplate
            .replace(/{{name}}/g, recipient.name)
            .replace(/{{email}}/g, recipient.email)
            .replace(/{{filmTitle}}/g, recipient.filmTitle || 'your film');
          
          const result = await sendEmail({
            to: recipient.email,
            subject,
            html: personalizedHtml,
            sentBy,
          });
          
          if (result.success) {
            sentCount++;
            return { email: recipient.email, success: true };
          } else {
            failedCount++;
            return { email: recipient.email, success: false, error: result.error };
          }
        } catch (error) {
          failedCount++;
          return { email: recipient.email, success: false, error };
        }
      })
    );
    
    results.push(...batchResults);
    
    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return {
    success: failedCount === 0,
    sentCount,
    failedCount,
    results
  };
}

// Helper to convert HTML to plain text (simple version)
function convertHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>.*<\/style>/gm, '')
    .replace(/<script[^>]*>.*<\/script>/gm, '')
    .replace(/<[^>]+>/gm, '')
    .replace(/([\r\n]+ +)+/gm, '\n')
    .trim();
}
