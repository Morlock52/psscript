/**
 * Voice Controller
 * 
 * This controller handles voice-related requests, such as voice synthesis and recognition.
 * It communicates with the AI service to process voice data.
 */

const axios = require('axios');
const logger = require('../logger');
const config = require('../config');

/**
 * Synthesize text into speech
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.synthesizeSpeech = async (req, res) => {
  try {
    const { text, voiceId, outputFormat } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    logger.info(`Synthesizing speech: "${text.substring(0, 50)}..."`);

    // Call the AI service
    const response = await axios.post(
      `${config.aiServiceUrl}/voice/synthesize`,
      {
        text,
        voice_id: voiceId,
        output_format: outputFormat || 'mp3'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.aiServiceApiKey
        }
      }
    );

    // Return the response from the AI service
    return res.status(200).json(response.data);
  } catch (error) {
    logger.error(`Error in synthesizeSpeech: ${error.message}`);
    
    // Handle specific error cases
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      logger.error(`AI service error: ${JSON.stringify(error.response.data)}`);
      return res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      logger.error('No response received from AI service');
      return res.status(503).json({ error: 'AI service unavailable' });
    } else {
      // Something happened in setting up the request that triggered an Error
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
};

/**
 * Recognize speech from audio data
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.recognizeSpeech = async (req, res) => {
  try {
    const { audioData, language } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    logger.info(`Recognizing speech with language: ${language || 'en-US'}`);

    // Call the AI service
    const response = await axios.post(
      `${config.aiServiceUrl}/voice/recognize`,
      {
        audio_data: audioData,
        language: language || 'en-US'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.aiServiceApiKey
        }
      }
    );

    // Return the response from the AI service
    return res.status(200).json(response.data);
  } catch (error) {
    logger.error(`Error in recognizeSpeech: ${error.message}`);
    
    // Handle specific error cases
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      logger.error(`AI service error: ${JSON.stringify(error.response.data)}`);
      return res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      logger.error('No response received from AI service');
      return res.status(503).json({ error: 'AI service unavailable' });
    } else {
      // Something happened in setting up the request that triggered an Error
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
};

/**
 * Get available voices
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getVoices = async (req, res) => {
  try {
    logger.info('Getting available voices');

    // This is a mock implementation
    // In a real implementation, this would call the AI service to get the available voices
    const voices = [
      {
        id: 'en-US-Standard-A',
        name: 'English US (Female)',
        language: 'en-US',
        gender: 'female'
      },
      {
        id: 'en-US-Standard-B',
        name: 'English US (Male)',
        language: 'en-US',
        gender: 'male'
      },
      {
        id: 'en-GB-Standard-A',
        name: 'English UK (Female)',
        language: 'en-GB',
        gender: 'female'
      },
      {
        id: 'en-GB-Standard-B',
        name: 'English UK (Male)',
        language: 'en-GB',
        gender: 'male'
      }
    ];

    return res.status(200).json({ voices });
  } catch (error) {
    logger.error(`Error in getVoices: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get user voice settings
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getVoiceSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    logger.info(`Getting voice settings for user ${userId}`);

    // This is a mock implementation
    // In a real implementation, this would get the user's voice settings from the database
    const settings = {
      voiceId: 'en-US-Standard-A',
      autoPlay: true,
      volume: 0.8,
      speed: 1.0
    };

    return res.status(200).json(settings);
  } catch (error) {
    logger.error(`Error in getVoiceSettings: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update user voice settings
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateVoiceSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { voiceId, autoPlay, volume, speed } = req.body;

    logger.info(`Updating voice settings for user ${userId}`);

    // This is a mock implementation
    // In a real implementation, this would update the user's voice settings in the database
    const settings = {
      voiceId: voiceId || 'en-US-Standard-A',
      autoPlay: autoPlay !== undefined ? autoPlay : true,
      volume: volume !== undefined ? volume : 0.8,
      speed: speed !== undefined ? speed : 1.0
    };

    return res.status(200).json(settings);
  } catch (error) {
    logger.error(`Error in updateVoiceSettings: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};