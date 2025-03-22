/**
 * Voice Routes
 * 
 * This file defines the routes for voice-related functionality.
 */

const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route   POST /api/voice/synthesize
 * @desc    Synthesize text into speech
 * @access  Private
 */
router.post('/synthesize', authMiddleware, voiceController.synthesizeSpeech);

/**
 * @route   POST /api/voice/recognize
 * @desc    Recognize speech from audio data
 * @access  Private
 */
router.post('/recognize', authMiddleware, voiceController.recognizeSpeech);

/**
 * @route   GET /api/voice/voices
 * @desc    Get available voices
 * @access  Private
 */
router.get('/voices', authMiddleware, voiceController.getVoices);

/**
 * @route   GET /api/voice/settings
 * @desc    Get user voice settings
 * @access  Private
 */
router.get('/settings', authMiddleware, voiceController.getVoiceSettings);

/**
 * @route   PUT /api/voice/settings
 * @desc    Update user voice settings
 * @access  Private
 */
router.put('/settings', authMiddleware, voiceController.updateVoiceSettings);

module.exports = router;