/**
 * Voice Routes
 *
 * Endpoints for speech synthesis and recognition.
 */
import express from 'express';
import {
  getVoices,
  getVoiceSettings,
  recognizeSpeech,
  synthesizeSpeech,
  updateVoiceSettings
} from '../controllers/VoiceController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = express.Router();

const requireBearerToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing' });
  }
  next();
};

/**
 * @route   POST /api/voice/synthesize
 * @desc    Synthesize text into speech
 * @access  Private
 */
router.post('/synthesize', requireBearerToken, authenticateJWT, synthesizeSpeech);

/**
 * @route   POST /api/voice/recognize
 * @desc    Recognize speech from audio data
 * @access  Private
 */
router.post('/recognize', requireBearerToken, authenticateJWT, recognizeSpeech);

/**
 * @route   GET /api/voice/voices
 * @desc    Get available voices
 * @access  Private
 */
router.get('/voices', requireBearerToken, authenticateJWT, getVoices);

/**
 * @route   GET /api/voice/settings
 * @desc    Get user voice settings
 * @access  Private
 */
router.get('/settings', requireBearerToken, authenticateJWT, getVoiceSettings);

/**
 * @route   PUT /api/voice/settings
 * @desc    Update user voice settings
 * @access  Private
 */
router.put('/settings', requireBearerToken, authenticateJWT, updateVoiceSettings);

export default router;
