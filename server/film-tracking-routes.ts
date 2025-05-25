import { Router } from "express";
import { 
  getFilmTracking, 
  getFilmAnalytics, 
  refreshFilmStatus,
  submitToPlatform,
  createFilmSubmission
} from "../controllers/film-tracking-controller";

const router = Router();

// Admin endpoints for film tracking portal
router.get("/admin/film-tracking", getFilmTracking);
router.get("/admin/film-analytics/:filmId", getFilmAnalytics);
router.post("/admin/refresh-film-status/:filmId", refreshFilmStatus);
router.post("/admin/submit-to-platform/:distributionId", submitToPlatform);
router.post("/admin/create-film-submission", createFilmSubmission);

export default router;
