"""
Voice API Endpoints for PSScript Manager

This module implements the FastAPI endpoints for voice synthesis and recognition.
"""

from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

from voice_service import VoiceService

# Create router
router = APIRouter(prefix="/voice", tags=["Voice"])

# Request/Response Models
class VoiceSynthesisRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize into speech")
    voice_id: Optional[str] = Field(None, description="Voice ID to use")
    output_format: str = Field("mp3", description="Output audio format")
    voice_instructions: Optional[str] = Field(None, description="Optional voice style instructions")
    speed: Optional[float] = Field(None, description="Optional synthesis speed")

class VoiceSynthesisResponse(BaseModel):
    audio_data: str = Field(..., description="Base64-encoded audio data")
    format: str = Field(..., description="Audio format")
    duration: float = Field(..., description="Audio duration in seconds")
    text: str = Field(..., description="Text that was synthesized")

class VoiceRecognitionRequest(BaseModel):
    audio_data: str = Field(..., description="Base64-encoded audio data")
    language: str = Field("en-US", description="Language code")
    audio_format: Optional[str] = Field(None, description="Optional audio format hint (mp3, wav, m4a, flac, ogg)")
    prompt: Optional[str] = Field(None, description="Optional transcription prompt")
    transcription_mode: str = Field("standard", description="Transcription mode: standard or diarize")
    include_logprobs: bool = Field(False, description="Whether to include token logprobs")
    chunking_strategy: Optional[str] = Field(None, description="Optional transcription chunking strategy")
    known_speaker_names: Optional[List[str]] = Field(None, description="Optional speaker names for diarization")
    known_speaker_references: Optional[List[str]] = Field(None, description="Optional base64 data URLs for speaker reference audio")

class VoiceRecognitionResponse(BaseModel):
    text: str = Field(..., description="Recognized text")
    confidence: float = Field(..., description="Confidence score (0-1)")
    alternatives: Optional[List[Dict[str, Any]]] = Field(None, description="Alternative transcriptions")
    segments: Optional[List[Dict[str, Any]]] = Field(None, description="Segment-level transcription metadata")
    words: Optional[List[Dict[str, Any]]] = Field(None, description="Word-level transcription metadata")
    logprobs: Optional[List[Dict[str, Any]]] = Field(None, description="Token logprobs when requested")
    language: Optional[str] = Field(None, description="Detected language")
    duration: Optional[float] = Field(None, description="Audio duration in seconds")
    usage: Optional[Dict[str, Any]] = Field(None, description="OpenAI usage metadata")
    model: Optional[str] = Field(None, description="Model used for recognition")
    mode: Optional[str] = Field(None, description="Recognition mode that was used")

# Dependency for getting the voice service
async def get_voice_service(api_key: Optional[str] = Header(None, alias="x-api-key")):
    return VoiceService(api_key=api_key)

# Endpoints
@router.post("/synthesize", response_model=VoiceSynthesisResponse)
async def synthesize_speech(
    request: VoiceSynthesisRequest,
    voice_service: VoiceService = Depends(get_voice_service)
):
    """
    Synthesize text into speech.
    
    - text: Text to synthesize
    - voice_id: Voice ID to use (optional)
    - output_format: Output audio format (default: mp3)
    - api_key: Optional API key to use for this request
    """
    try:
        result = await voice_service.synthesize_speech(
            text=request.text,
            voice_id=request.voice_id,
            output_format=request.output_format,
            voice_instructions=request.voice_instructions,
            speed=request.speed
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech synthesis failed: {str(e)}")

@router.post("/recognize", response_model=VoiceRecognitionResponse)
async def recognize_speech(
    request: VoiceRecognitionRequest,
    voice_service: VoiceService = Depends(get_voice_service)
):
    """
    Recognize speech from audio data.
    
    - audio_data: Base64-encoded audio data
    - language: Language code (default: en-US)
    - api_key: Optional API key to use for this request
    """
    try:
        result = await voice_service.recognize_speech(
            audio_data=request.audio_data,
            language=request.language,
            audio_format=request.audio_format,
            prompt=request.prompt,
            transcription_mode=request.transcription_mode,
            include_logprobs=request.include_logprobs,
            chunking_strategy=request.chunking_strategy,
            known_speaker_names=request.known_speaker_names,
            known_speaker_references=request.known_speaker_references
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech recognition failed: {str(e)}")
