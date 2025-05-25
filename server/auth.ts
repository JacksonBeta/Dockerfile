import { Request, Response, NextFunction } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { registerSchema, loginSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

const scryptAsync = promisify(scrypt);

// Password hashing & verification
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function verifyPassword(stored: string, supplied: string): Promise<boolean> {
  try {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

// Middleware
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.isAdmin) {
    return next();
  }
  res.status(403).json({ message: "Administrator access required" });
}

// Auth routes handler registration
export function registerAuthRoutes(app: any) {
  // Registration route
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      // Validate request data
      const validData = registerSchema.parse(req.body);
      
      // Check if username exists
      const existingUser = await storage.getUserByUsername(validData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email exists
      const existingEmail = await storage.getUserByEmail(validData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }

      // Hash password
      const hashedPassword = await hashPassword(validData.password);

      // Create user
      const newUser = await storage.createUser({
        ...validData,
        password: hashedPassword,
      });

      // Sanitize user data before sending to client
      const { password, ...safeUser } = newUser;

      // Create session
      req.session.userId = newUser.id;
      req.session.isAdmin = newUser.isAdmin || false;

      return res.status(201).json(safeUser);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      console.error("Error during registration:", error);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login route
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      // Validate request data
      const validData = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByUsername(validData.username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Verify password
      const isValid = await verifyPassword(user.password, validData.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Sanitize user data
      const { password, ...safeUser } = user;

      // Create session
      req.session.userId = user.id;
      req.session.isAdmin = user.isAdmin || false;

      return res.status(200).json(safeUser);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      console.error("Error during login:", error);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout route
  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error during logout:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      return res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Get current user route
  app.get("/api/user", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }

      // Sanitize user data
      const { password, ...safeUser } = user;
      return res.status(200).json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user data" });
    }
  });
}
