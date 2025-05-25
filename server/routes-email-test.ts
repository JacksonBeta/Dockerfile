import { Router } from 'express';
import { sendTestEmail } from './services/email-diagnostics';
import { log } from './vite';

// Create an express router
const emailTestRouter = Router();

// Test email endpoint
emailTestRouter.post('/test-email', async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    
    if (!to) {
      return res.status(400).json({ success: false, message: "Recipient email address is required" });
    }
    
    if (!subject) {
      return res.status(400).json({ success: false, message: "Email subject is required" });
    }
    
    if (!message) {
      return res.status(400).json({ success: false, message: "Email message is required" });
    }
    
    log(`Sending test email to: ${to}`, 'email-test');
    
    // Use our email diagnostics service to send the test email
    const result = await sendTestEmail(to, subject, message);
    
    res.json(result);
  } catch (error) {
    console.error("Error sending test email:", error);
    log(`Error sending test email: ${(error as Error).message}`, 'email-test');
    
    res.status(500).json({ 
      success: false, 
      message: `Error sending test email: ${(error as Error).message}` 
    });
  }
});

export { emailTestRouter };
