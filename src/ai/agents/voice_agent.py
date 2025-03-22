"""
Voice Agent for PSScript Manager

This module implements the Voice Agent for the PSScript Manager platform.
The Voice Agent is responsible for handling voice-related tasks, such as
voice synthesis and recognition.
"""

import logging
import json
from typing import Dict, Any, List, Optional

from .multi_agent_system import Agent, AgentRole, AgentCapability
from ..voice_service import VoiceService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("voice_agent")

class VoiceAgent(Agent):
    """
    Agent for handling voice-related tasks.
    
    This agent is responsible for voice synthesis and recognition,
    and integrates with the Voice Service to provide these capabilities.
    """
    
    def __init__(
        self,
        agent_id: str,
        name: str,
        api_key: Optional[str] = None,
        model: str = "o3-mini"
    ):
        """
        Initialize the Voice Agent.
        
        Args:
            agent_id: Unique identifier for the agent
            name: Display name for the agent
            api_key: API key for third-party services
            model: Model to use for AI operations
        """
        super().__init__(
            agent_id=agent_id,
            name=name,
            role=AgentRole.INTERFACE,
            capabilities=[
                AgentCapability.VOICE_SYNTHESIS,
                AgentCapability.VOICE_RECOGNITION,
                AgentCapability.TOOL_USE
            ],
            api_key=api_key,
            model=model
        )
        
        # Initialize the Voice Service
        self.voice_service = VoiceService(api_key=api_key)
        
        logger.info(f"Voice Agent initialized: {name} ({agent_id})")
    
    async def process_task(self, task_id: str, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a task assigned to the Voice Agent.
        
        Args:
            task_id: Unique identifier for the task
            task_data: Data for the task
            
        Returns:
            Task result
        """
        logger.info(f"Processing task {task_id}: {task_data.get('name', 'Unknown task')}")
        
        task_type = task_data.get("type", "unknown")
        
        if task_type == "voice_synthesis":
            return await self._process_synthesis_task(task_id, task_data)
        elif task_type == "voice_recognition":
            return await self._process_recognition_task(task_id, task_data)
        else:
            logger.warning(f"Unknown task type: {task_type}")
            return {
                "success": False,
                "error": f"Unknown task type: {task_type}"
            }
    
    async def _process_synthesis_task(self, task_id: str, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a voice synthesis task.
        
        Args:
            task_id: Unique identifier for the task
            task_data: Data for the task
            
        Returns:
            Task result
        """
        logger.info(f"Processing voice synthesis task {task_id}")
        
        try:
            # Extract task parameters
            text = task_data.get("text", "")
            voice_id = task_data.get("voice_id")
            output_format = task_data.get("output_format", "mp3")
            
            if not text:
                return {
                    "success": False,
                    "error": "Text is required for voice synthesis"
                }
            
            # Call the Voice Service
            result = await self.voice_service.synthesize_speech(
                text=text,
                voice_id=voice_id,
                output_format=output_format
            )
            
            return {
                "success": True,
                "result": result
            }
        except Exception as e:
            logger.error(f"Error in voice synthesis task: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _process_recognition_task(self, task_id: str, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a voice recognition task.
        
        Args:
            task_id: Unique identifier for the task
            task_data: Data for the task
            
        Returns:
            Task result
        """
        logger.info(f"Processing voice recognition task {task_id}")
        
        try:
            # Extract task parameters
            audio_data = task_data.get("audio_data", "")
            language = task_data.get("language", "en-US")
            
            if not audio_data:
                return {
                    "success": False,
                    "error": "Audio data is required for voice recognition"
                }
            
            # Call the Voice Service
            result = await self.voice_service.recognize_speech(
                audio_data=audio_data,
                language=language
            )
            
            return {
                "success": True,
                "result": result
            }
        except Exception as e:
            logger.error(f"Error in voice recognition task: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def synthesize_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        output_format: str = "mp3"
    ) -> Dict[str, Any]:
        """
        Synthesize text into speech.
        
        Args:
            text: Text to synthesize
            voice_id: Voice ID to use
            output_format: Output audio format
            
        Returns:
            Dictionary containing the audio data and metadata
        """
        logger.info(f"Synthesizing speech: '{text[:50]}...'")
        
        try:
            # Call the Voice Service directly
            result = await self.voice_service.synthesize_speech(
                text=text,
                voice_id=voice_id,
                output_format=output_format
            )
            
            return result
        except Exception as e:
            logger.error(f"Error in speech synthesis: {e}")
            raise
    
    async def recognize_speech(
        self,
        audio_data: str,
        language: str = "en-US"
    ) -> Dict[str, Any]:
        """
        Recognize speech from audio data.
        
        Args:
            audio_data: Base64-encoded audio data
            language: Language code
            
        Returns:
            Dictionary containing the recognized text and metadata
        """
        logger.info(f"Recognizing speech with language: {language}")
        
        try:
            # Call the Voice Service directly
            result = await self.voice_service.recognize_speech(
                audio_data=audio_data,
                language=language
            )
            
            return result
        except Exception as e:
            logger.error(f"Error in speech recognition: {e}")
            raise