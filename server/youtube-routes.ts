import express, { Request, Response } from 'express';
import multer from 'multer';
import { youtubeService, YouTubeCredentials } from '../services/youtube-service';

const router = express.Router();

// Set up multer for file uploads 
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB file size limit
  },
});

// Middleware to check if user is authenticated
// Temporarily allowing all access for testing
const checkAuth = (req: Request, res: Response, next: express.NextFunction) => {
  // Always allow access for testing
  next();
};

// Start YouTube authentication process
router.get('/auth', checkAuth, (req, res) => {
  try {
    // Generate the auth URL
    const authUrl = youtubeService.getAuthUrl();
    
    // Redirect the user to Google's OAuth consent screen
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error starting YouTube auth:', error);
    res.status(500).json({ error: 'Failed to start YouTube authentication' });
  }
});

// Handle OAuth callback
router.get('/auth/callback', checkAuth, async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      throw new Error('Invalid or missing authorization code');
    }
    
    // Exchange the code for tokens
    const credentials = await youtubeService.getTokensFromCode(code);
    
    // Store the credentials in the user's session
    if (req.session) {
      req.session.youtubeCredentials = credentials;
    }
    
    // For the YouTubeTest page
    if (req.query.from === 'test') {
      return res.redirect('/youtube-test?youtube_connected=true');
    }
    
    // Default: Redirect back to the Google TV distribution page with success parameter
    res.redirect('/distribution/google-tv?youtube_connected=true');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error handling YouTube auth callback:', errorMsg);
    
    // For the YouTubeTest page
    if (req.query.from === 'test') {
      return res.redirect('/youtube-test?error=auth_failed');
    }
    
    res.redirect('/distribution/google-tv?error=auth_failed');
  }
});

// Check if user has connected their YouTube account
router.get('/status', checkAuth, async (req, res) => {
  try {
    // Check if credentials exist in session
    if (!req.session?.youtubeCredentials) {
      return res.json({ connected: false });
    }
    
    // Validate the credentials
    const credentials = req.session.youtubeCredentials as YouTubeCredentials;
    const isValid = await youtubeService.validateCredentials(credentials);
    
    if (!isValid && req.session) {
      // Clear invalid credentials
      delete req.session.youtubeCredentials;
      return res.json({ connected: false });
    }
    
    return res.json({ connected: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error checking YouTube status:', errorMsg);
    res.status(500).json({ error: 'Failed to check YouTube connection status' });
  }
});

// Upload a video to YouTube
router.post('/upload', checkAuth, upload.single('video'), async (req, res) => {
  try {
    // Check if user has YouTube credentials
    if (!req.session?.youtubeCredentials) {
      return res.status(401).json({ error: 'YouTube account not connected' });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    
    // Get metadata from request body
    const { title, description, tags, privacyStatus } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Parse tags if they exist
    const parsedTags = tags ? tags.split(',').map((tag: string) => tag.trim()) : [];
    
    const credentials = req.session.youtubeCredentials as YouTubeCredentials;
    
    // Upload the video
    const videoId = await youtubeService.uploadVideo(
      credentials,
      req.file.buffer,
      {
        title,
        description: description || '',
        tags: parsedTags,
        privacyStatus: (privacyStatus as 'private' | 'public' | 'unlisted') || 'private'
      }
    );
    
    // Return the video ID
    res.json({ videoId });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error uploading video to YouTube:', errorMsg);
    res.status(500).json({ error: 'Failed to upload video to YouTube' });
  }
});

// Get YouTube channel information
router.get('/channel', checkAuth, async (req, res) => {
  try {
    // Check if user has YouTube credentials
    if (!req.session?.youtubeCredentials) {
      return res.status(401).json({ error: 'YouTube account not connected' });
    }
    
    const credentials = req.session.youtubeCredentials as YouTubeCredentials;
    
    // Get channel info
    const channelInfo = await youtubeService.getChannelInfo(credentials);
    
    res.json(channelInfo);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting YouTube channel info:', errorMsg);
    res.status(500).json({ error: 'Failed to get YouTube channel information' });
  }
});

// Get user's YouTube videos
router.get('/videos', checkAuth, async (req, res) => {
  try {
    // Check if user has YouTube credentials
    if (!req.session?.youtubeCredentials) {
      return res.status(401).json({ error: 'YouTube account not connected' });
    }
    
    const credentials = req.session.youtubeCredentials as YouTubeCredentials;
    
    // Get videos
    const videos = await youtubeService.getUserVideos(credentials);
    
    res.json(videos);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting YouTube videos:', errorMsg);
    res.status(500).json({ error: 'Failed to get YouTube videos' });
  }
});

// Get details for a specific video
router.get('/videos/:videoId', checkAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    
    // Check if user has YouTube credentials
    if (!req.session?.youtubeCredentials) {
      return res.status(401).json({ error: 'YouTube account not connected' });
    }
    
    const credentials = req.session.youtubeCredentials as YouTubeCredentials;
    
    // Get video details
    const videoDetails = await youtubeService.getVideoDetails(
      credentials,
      videoId
    );
    
    res.json(videoDetails);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting YouTube video details:', errorMsg);
    res.status(500).json({ error: 'Failed to get YouTube video details' });
  }
});

// Disconnect YouTube account
router.post('/disconnect', checkAuth, (req, res) => {
  try {
    // Remove YouTube credentials from session
    if (req.session?.youtubeCredentials) {
      delete req.session.youtubeCredentials;
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
        }
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error disconnecting YouTube account:', errorMsg);
    res.status(500).json({ error: 'Failed to disconnect YouTube account' });
  }
});

export default router;
