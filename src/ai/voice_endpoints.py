"""
Voice API Endpoints for PSScript Manager

This module implements the FastAPI endpoints for voice synthesis and recognition.
"""

from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

from .voice_service import VoiceService

# Create router
router = APIRouter(prefix="/voice", tags=["Voice"])

# Request/Response Models
class VoiceSynthesisRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize into speech")
    voice_id: Optional[str] = Field(None, description="Voice ID to use")
    output_format: str = Field("mp3", description="Output audio format")

class VoiceSynthesisResponse(BaseModel):
    audio_data: str = Field(..., description="Base64-encoded audio data")
    format: str = Field(..., description="Audio format")
    duration: float = Field(..., description="Audio duration in seconds")
    text: str = Field(..., description="Text that was synthesized")

class VoiceRecognitionRequest(BaseModel):
    audio_data: str = Field(..., description="Base64-encoded audio data")
    language: str = Field("en-US", description="Language code")

class VoiceRecognitionResponse(BaseModel):
    text: str = Field(..., description="Recognized text")
    confidence: float = Field(..., description="Confidence score (0-1)")
    alternatives: Optional[List[Dict[str, Any]]] = Field(None, description="Alternative transcriptions")

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
            output_format=request.output_format
        )
        return result
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
            language=request.language
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech recognition failed: {str(e)}")