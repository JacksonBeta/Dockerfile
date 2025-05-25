/**
 * Send email to filmmakers from the direct HTML interface
 */
import nodemailer from 'nodemailer';
import { Request, Response } from 'express';

export async function sendFilmmakerEmail(req: Request, res: Response) {
  try {
    const { subject, body, recipients } = req.body;
    
    // Validate input
    if (!subject || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: subject, body, or recipients' 
      });
    }
    
    // Create a test account for development if needed
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let testAccount: any = null;
    let transportConfig: any;
    
    // In development, use ethereal.email for testing
    if (isDevelopment) {
      testAccount = await nodemailer.createTestAccount();
      transportConfig = {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      };
    } 
    // In production, use real credentials
    else {
      // Check if email credentials exist
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        return res.status(500).json({ 
          success: false, 
          message: 'Email service is not properly configured. Missing credentials.' 
        });
      }
      
      transportConfig = {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      };
    }
    
    // Create transport
    const transporter = nodemailer.createTransport(transportConfig);
    
    // Prepare email options
    const mailOptions = {
      from: isDevelopment && testAccount
        ? `"Hollywood Weekly" <${testAccount.user}>` 
        : `"Hollywood Weekly" <${process.env.EMAIL_USER}>`,
      to: recipients.join(', '),
      subject: subject,
      html: body,
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    // For development, provide the preview URL
    let previewUrl = null;
    if (isDevelopment && testAccount) {
      // @ts-ignore - ignore the type issue with getTestMessageUrl
      previewUrl = nodemailer.getTestMessageUrl(info);
    }
    
    res.status(200).json({
      success: true,
      messageId: info.messageId,
      previewUrl,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}
