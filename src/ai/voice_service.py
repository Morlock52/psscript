"""
Voice Service for PSScript Manager

This module implements the voice synthesis and recognition services for the PSScript Manager platform.
It provides endpoints for converting text to speech and speech to text, with integration with
third-party voice APIs.
"""

import os
import base64
import logging
import asyncio
from typing import Dict, Any, Optional, List
import io
import uuid
import hashlib
import json
from google.cloud import texttospeech
from google.cloud import speech
import boto3
import azure.cognitiveservices.speech as speechsdk
from fastapi import HTTPException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("voice_service")

class VoiceService:
    """
    Service for voice synthesis and recognition.
    
    This service provides methods for converting text to speech and speech to text,
    with integration with third-party voice APIs.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the voice service.
        
        Args:
            api_key: API key for third-party voice services
        """
        self.api_key = api_key or os.environ.get("VOICE_API_KEY")
        self.tts_service = os.environ.get("TTS_SERVICE", "google")  # google, amazon, microsoft
        self.tts_cache_dir = os.environ.get("TTS_CACHE_DIR", "voice_cache")
        self.tts_cache_ttl = int(os.environ.get("TTS_CACHE_TTL", "86400"))  # 24 hours in seconds
        self.tts_cache = {}  # In-memory cache
        self.ensure_cache_dir()
        self.stt_service = os.environ.get("STT_SERVICE", "google")  # google, amazon, microsoft
        
        logger.info(f"Voice Service initialized with TTS service: {self.tts_service}, STT service: {self.stt_service}")
    
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
        logger.info(f"Synthesizing speech: '{text[:50]}...' with voice: {voice_id}")
        
        # Generate cache key
        cache_key = self._generate_cache_key(text, voice_id, output_format)
        
        # Check cache
        cached_result = self._get_from_cache(cache_key)
        if cached_result:
            logger.info(f"Cache hit for text: '{text[:50]}...'")
            return cached_result
        
        # Not in cache, proceed with synthesis
        try:
            # Select the appropriate TTS service
            if self.tts_service == "google":
                audio_data, duration = await self._synthesize_google(text, voice_id, output_format)
            elif self.tts_service == "amazon":
                audio_data, duration = await self._synthesize_amazon(text, voice_id, output_format)
            elif self.tts_service == "microsoft":
                audio_data, duration = await self._synthesize_microsoft(text, voice_id, output_format)
            else:
                # Use mock implementation for testing
                audio_data, duration = await self._synthesize_mock(text, voice_id, output_format)
            
            # Store result in cache
            result = {
                "audio_data": audio_data,
                "format": output_format,
                "duration": duration,
                "text": text
            }
            self._store_in_cache(cache_key, result)
            
            return {
                "audio_data": audio_data,
                "format": output_format,
                "duration": duration,
                "text": text
            }
        except Exception as e:
            logger.error(f"Error in speech synthesis: {e}")
            raise HTTPException(status_code=500, detail=f"Speech synthesis failed: {str(e)}")
    
    def ensure_cache_dir(self):
        """Ensure the cache directory exists."""
        if not os.path.exists(self.tts_cache_dir):
            os.makedirs(self.tts_cache_dir, exist_ok=True)
            logger.info(f"Created cache directory: {self.tts_cache_dir}")
    
    def _generate_cache_key(self, text: str, voice_id: Optional[str], output_format: str) -> str:
        """Generate a cache key for the given parameters."""
        # Create a string representation of the parameters
        params = {
            "text": text,
            "voice_id": voice_id or "",
            "output_format": output_format,
            "service": self.tts_service
        }
        
        # Convert to JSON and hash
        params_str = json.dumps(params, sort_keys=True)
        return hashlib.md5(params_str.encode()).hexdigest()
    
    def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get a result from the cache."""
        # Check in-memory cache first
        if cache_key in self.tts_cache:
            return self.tts_cache[cache_key]
        
        # Check disk cache
        cache_file = os.path.join(self.tts_cache_dir, f"{cache_key}.json")
        if os.path.exists(cache_file):
            # Check if the cache entry is still valid
            file_age = time.time() - os.path.getmtime(cache_file)
            if file_age < self.tts_cache_ttl:
                try:
                    with open(cache_file, 'r') as f:
                        result = json.load(f)
                        # Store in memory cache for faster access next time
                        self.tts_cache[cache_key] = result
                        return result
                except Exception as e:
                    logger.error(f"Error reading cache file {cache_file}: {e}")
            else:
                # Cache entry is too old, remove it
                try:
                    os.remove(cache_file)
                except Exception as e:
                    logger.error(f"Error removing old cache file {cache_file}: {e}")
        
        return None
    
    def _store_in_cache(self, cache_key: str, result: Dict[str, Any]):
        """Store a result in the cache."""
        # Store in memory cache
        self.tts_cache[cache_key] = result
        
        # Store in disk cache
        cache_file = os.path.join(self.tts_cache_dir, f"{cache_key}.json")
        try:
            with open(cache_file, 'w') as f:
                json.dump(result, f)
        except Exception as e:
            logger.error(f"Error writing to cache file {cache_file}: {e}")
    
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
            # Select the appropriate STT service
            if self.stt_service == "google":
                text, confidence, alternatives = await self._recognize_google(audio_data, language)
            elif self.stt_service == "amazon":
                text, confidence, alternatives = await self._recognize_amazon(audio_data, language)
            elif self.stt_service == "microsoft":
                text, confidence, alternatives = await self._recognize_microsoft(audio_data, language)
            else:
                # Use mock implementation for testing
                text, confidence, alternatives = await self._recognize_mock(audio_data, language)
            
            return {
                "text": text,
                "confidence": confidence,
                "alternatives": alternatives
            }
        except Exception as e:
            logger.error(f"Error in speech recognition: {e}")
            raise HTTPException(status_code=500, detail=f"Speech recognition failed: {str(e)}")
    
    # Google Cloud TTS implementation
    async def _synthesize_google(
        self,
        text: str,
        voice_id: Optional[str] = None,
        output_format: str = "mp3"
    ) -> tuple[str, float]:
        """
        Synthesize text using Google Cloud Text-to-Speech.
        
        Args:
            text: Text to synthesize
            voice_id: Voice ID to use
            output_format: Output audio format
            
        Returns:
            Tuple of (base64-encoded audio data, duration in seconds)
        """
        try:
            logger.info("Using Google Cloud TTS")
            
            # Initialize the client
            client = texttospeech.TextToSpeechClient()
            
            # Set the text input
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            # Set the voice parameters
            language_code = "en-US"
            if voice_id and "-" in voice_id:
                language_code = "-".join(voice_id.split("-")[:2])
                
            voice = texttospeech.VoiceSelectionParams(
                language_code=language_code,
                name=voice_id or "en-US-Standard-A"
            )
            
            # Select the audio encoding
            audio_encoding = texttospeech.AudioEncoding.MP3
            if output_format.lower() == "wav":
                audio_encoding = texttospeech.AudioEncoding.LINEAR16
            
            audio_config = texttospeech.AudioConfig(
                audio_encoding=audio_encoding
            )
            
            # Perform the synthesis
            response = client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
            # Encode the audio content as base64
            audio_data = base64.b64encode(response.audio_content).decode()
            
            # Estimate duration (approximately 100ms per character)
            duration = len(text) * 0.1
            
            return audio_data, duration
        except Exception as e:
            logger.error(f"Error in Google TTS: {e}")
            raise
    
    # Amazon Polly implementation
    async def _synthesize_amazon(
        self,
        text: str,
        voice_id: Optional[str] = None,
        output_format: str = "mp3"
    ) -> tuple[str, float]:
        """
        Synthesize text using Amazon Polly.
        
        Args:
            text: Text to synthesize
            voice_id: Voice ID to use
            output_format: Output audio format
            
        Returns:
            Tuple of (base64-encoded audio data, duration in seconds)
        """
        try:
            logger.info("Using Amazon Polly")
            
            # Initialize the Polly client
            polly_client = boto3.client('polly', region_name='us-east-1')
            
            # Set default voice if not provided
            if not voice_id:
                voice_id = "Joanna"  # Default female voice
            
            # Set output format
            output_format_polly = "mp3"
            if output_format.lower() == "wav":
                output_format_polly = "pcm"
            elif output_format.lower() == "ogg":
                output_format_polly = "ogg_vorbis"
            
            # Call Amazon Polly to synthesize speech
            response = polly_client.synthesize_speech(
                Text=text,
                OutputFormat=output_format_polly,
                VoiceId=voice_id,
                Engine="neural"  # Use neural engine for better quality
            )
            
            # Get audio stream and convert to base64
            audio_stream = response['AudioStream'].read()
            audio_data = base64.b64encode(audio_stream).decode()
            
            # Get duration from response or estimate
            duration = response.get('ContentLength', len(text) * 0.1) / 1024 / 16  # Rough estimate
            
            return audio_data, duration
        except Exception as e:
            logger.error(f"Error in Amazon Polly: {e}")
            raise
    
    # Microsoft Azure TTS implementation
    async def _synthesize_microsoft(
        self,
        text: str,
        voice_id: Optional[str] = None,
        output_format: str = "mp3"
    ) -> tuple[str, float]:
        """
        Synthesize text using Microsoft Azure Text-to-Speech.
        
        Args:
            text: Text to synthesize
            voice_id: Voice ID to use
            output_format: Output audio format
            
        Returns:
            Tuple of (base64-encoded audio data, duration in seconds)
        """
        try:
            logger.info("Using Microsoft Azure TTS")
            
            # Get subscription key and region from environment variables
            subscription_key = os.environ.get("AZURE_SPEECH_KEY")
            region = os.environ.get("AZURE_SPEECH_REGION", "eastus")
            
            if not subscription_key:
                raise ValueError("Azure Speech subscription key not found in environment variables")
            
            # Set default voice if not provided
            if not voice_id:
                voice_id = "en-US-AriaNeural"
            
            # Create a speech config
            speech_config = speechsdk.SpeechConfig(subscription=subscription_key, region=region)
            
            # Set the voice
            speech_config.speech_synthesis_voice_name = voice_id
            
            # Create an audio output config that writes to a memory stream
            memory_stream = io.BytesIO()
            audio_output_config = speechsdk.audio.AudioOutputConfig(stream=memory_stream)
            
            # Create a speech synthesizer
            synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=audio_output_config)
            
            # Synthesize the text
            result = synthesizer.speak_text_async(text).get()
            
            # Check the result
            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                # Get the audio data from the memory stream
                memory_stream.seek(0)
                audio_data = base64.b64encode(memory_stream.read()).decode()
                
                # Estimate duration (approximately 100ms per character)
                duration = len(text) * 0.1
                
                return audio_data, duration
            else:
                if result.reason == speechsdk.ResultReason.Canceled:
                    cancellation_details = speechsdk.SpeechSynthesisCancellationDetails(result)
                    raise Exception(f"Speech synthesis canceled: {cancellation_details.reason}. Error details: {cancellation_details.error_details}")
                else:
                    raise Exception(f"Speech synthesis failed with reason: {result.reason}")
            
        except Exception as e:
            logger.error(f"Error in Microsoft Azure TTS: {e}")
            raise
    
    # Mock implementation for testing
    async def _synthesize_mock(
        self,
        text: str,
        voice_id: Optional[str] = None,
        output_format: str = "mp3"
    ) -> tuple[str, float]:
        """
        Mock implementation of text-to-speech for testing.
        
        Args:
            text: Text to synthesize
            voice_id: Voice ID to use
            output_format: Output audio format
            
        Returns:
            Tuple of (base64-encoded audio data, duration in seconds)
        """
        logger.info("Using mock TTS implementation")
        await asyncio.sleep(0.5)  # Simulate processing time
        
        # Mock audio data (1x1 transparent GIF)
        audio_data = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        duration = len(text) * 0.1  # Rough estimate: 100ms per character
        
        return audio_data, duration
    
    # Google Cloud STT implementation
    async def _recognize_google(
        self,
        audio_data: str,
        language: str = "en-US"
    ) -> tuple[str, float, List[Dict[str, Any]]]:
        """
        Recognize speech using Google Cloud Speech-to-Text.
        
        Args:
            audio_data: Base64-encoded audio data
            language: Language code
            
        Returns:
            Tuple of (recognized text, confidence score, alternatives)
        """
        try:
            logger.info("Using Google Cloud STT")
            
            # Initialize the client
            client = speech.SpeechClient()
            
            # Decode the base64 audio data
            audio_content = base64.b64decode(audio_data)
            
            # Create the audio object
            audio = speech.RecognitionAudio(content=audio_content)
            
            # Configure the request
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=16000,  # Assuming 16kHz audio
                language_code=language,
                enable_automatic_punctuation=True,
                model="default",
                max_alternatives=3
            )
            
            # Perform the speech recognition
            response = client.recognize(config=config, audio=audio)
            
            # Process the response
            if not response.results:
                return "", 0.0, []
                
            result = response.results[0]
            alternatives = []
            
            for alt in result.alternatives:
                alternatives.append({
                    "text": alt.transcript,
                    "confidence": alt.confidence
                })
            
            text = result.alternatives[0].transcript
            confidence = result.alternatives[0].confidence
            
            return text, confidence, alternatives
        except Exception as e:
            logger.error(f"Error in Google STT: {e}")
            raise
    
    # Amazon Transcribe implementation
    async def _recognize_amazon(
        self,
        audio_data: str,
        language: str = "en-US"
    ) -> tuple[str, float, List[Dict[str, Any]]]:
        """
        Recognize speech using Amazon Transcribe.
        
        Args:
            audio_data: Base64-encoded audio data
            language: Language code
            
        Returns:
            Tuple of (recognized text, confidence score, alternatives)
        """
        try:
            logger.info("Using Amazon Transcribe")
            
            # Initialize the S3 and Transcribe clients
            s3_client = boto3.client('s3', region_name='us-east-1')
            transcribe_client = boto3.client('transcribe', region_name='us-east-1')
            
            # Create a unique job name and file name
            job_name = f"transcribe-{uuid.uuid4()}"
            file_name = f"{job_name}.wav"
            bucket_name = "psscript-voice-api"  # Replace with your actual bucket name
            
            # Decode the base64 audio data
            audio_content = base64.b64decode(audio_data)
            
            # Upload the audio file to S3
            s3_client.put_object(
                Bucket=bucket_name,
                Key=file_name,
                Body=audio_content
            )
            
            # Start the transcription job
            transcribe_client.start_transcription_job(
                TranscriptionJobName=job_name,
                Media={'MediaFileUri': f"s3://{bucket_name}/{file_name}"},
                MediaFormat='wav',
                LanguageCode=language
            )
            
            # Wait for the job to complete
            while True:
                status = transcribe_client.get_transcription_job(TranscriptionJobName=job_name)
                if status['TranscriptionJob']['TranscriptionJobStatus'] in ['COMPLETED', 'FAILED']:
                    break
                await asyncio.sleep(0.5)
            
            # Check if the job completed successfully
            if status['TranscriptionJob']['TranscriptionJobStatus'] == 'COMPLETED':
                # Get the transcript
                transcript_uri = status['TranscriptionJob']['Transcript']['TranscriptFileUri']
                
                # Use httpx to get the transcript
                import httpx
                async with httpx.AsyncClient() as client:
                    response = await client.get(transcript_uri)
                    transcript_data = response.json()
                
                # Extract the transcript text
                text = transcript_data['results']['transcripts'][0]['transcript']
                confidence = 0.9  # Amazon Transcribe doesn't provide a confidence score
                
                # Clean up the S3 file
                s3_client.delete_object(Bucket=bucket_name, Key=file_name)
                
                alternatives = [{"text": text, "confidence": confidence}]
                return text, confidence, alternatives
            else:
                # Clean up the S3 file
                s3_client.delete_object(Bucket=bucket_name, Key=file_name)
                raise Exception(f"Transcription job failed: {status['TranscriptionJob']['FailureReason']}")
            
        except Exception as e:
            logger.error(f"Error in Amazon Transcribe: {e}")
            raise
    
    # Microsoft Azure STT implementation
    async def _recognize_microsoft(
        self,
        audio_data: str,
        language: str = "en-US"
    ) -> tuple[str, float, List[Dict[str, Any]]]:
        """
        Recognize speech using Microsoft Azure Speech-to-Text.
        
        Args:
            audio_data: Base64-encoded audio data
            language: Language code
            
        Returns:
            Tuple of (recognized text, confidence score, alternatives)
        """
        try:
            logger.info("Using Microsoft Azure STT")
            
            # Get subscription key and region from environment variables
            subscription_key = os.environ.get("AZURE_SPEECH_KEY")
            region = os.environ.get("AZURE_SPEECH_REGION", "eastus")
            
            if not subscription_key:
                raise ValueError("Azure Speech subscription key not found in environment variables")
            
            # Create a speech config
            speech_config = speechsdk.SpeechConfig(subscription=subscription_key, region=region)
            
            # Set the language
            speech_config.speech_recognition_language = language
            
            # Decode the base64 audio data
            audio_content = base64.b64decode(audio_data)
            
            # Create an audio stream from the decoded audio data
            audio_stream = speechsdk.audio.PushAudioInputStream()
            audio_stream.write(audio_content)
            audio_stream.close()
            
            # Create an audio config from the audio stream
            audio_config = speechsdk.audio.AudioConfig(stream=audio_stream)
            
            # Create a speech recognizer
            recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
            
            # Start speech recognition
            result = recognizer.recognize_once_async().get()
            
            # Check the result
            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                text = result.text
                confidence = 0.9  # Azure doesn't provide confidence scores directly
                
                alternatives = [{"text": text, "confidence": confidence}]
                
                # Add alternatives if available
                if hasattr(result, 'best_alternatives'):
                    for alt in result.best_alternatives:
                        alternatives.append({
                            "text": alt.text,
                            "confidence": alt.confidence
                        })
                
                return text, confidence, alternatives
            else:
                if result.reason == speechsdk.ResultReason.NoMatch:
                    raise Exception("No speech could be recognized")
                elif result.reason == speechsdk.ResultReason.Canceled:
                    cancellation_details = speechsdk.CancellationDetails(result)
                    raise Exception(f"Speech recognition canceled: {cancellation_details.reason}. Error details: {cancellation_details.error_details}")
                else:
                    raise Exception(f"Speech recognition failed with reason: {result.reason}")
            
        except Exception as e:
            logger.error(f"Error in Microsoft Azure STT: {e}")
            raise
    
    # Mock implementation for testing
    async def _recognize_mock(
        self,
        audio_data: str,
        language: str = "en-US"
    ) -> tuple[str, float, List[Dict[str, Any]]]:
        """
        Mock implementation of speech-to-text for testing.
        
        Args:
            audio_data: Base64-encoded audio data
            language: Language code
            
        Returns:
            Tuple of (recognized text, confidence score, alternatives)
        """
        logger.info("Using mock STT implementation")
        await asyncio.sleep(0.5)  # Simulate processing time
        
        # Mock recognition result
        text = "How do I analyze PowerShell scripts?"
        confidence = 0.95
        alternatives = [
            {"text": "How do I analyze PowerShell scripts?", "confidence": 0.95},
            {"text": "How to analyze PowerShell scripts?", "confidence": 0.85}
        ]
        
        return text, confidence, alternatives