import express from 'express';
import session from 'express-session';
import { registerRoutes } from './routes';
import { createServer } from 'http';

async function startServer() {
  const app = express();
  
  // JSON body parser
  app.use(express.json());
  
  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'hollywood-weekly-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      domain: process.env.NODE_ENV === 'production' ? '.hollywoodweekly.tv' : undefined
    }
  }));
  
  // Register API routes
  const server = await registerRoutes(app);
  
  // Start server
  const PORT = parseInt(process.env.PORT || '3000');
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});