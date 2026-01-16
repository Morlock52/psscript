/**
 * Voice API Proof of Concept
 * 
 * This file demonstrates a basic implementation of the Voice API integration
 * with the PSScript Manager platform. It includes:
 * 
 * 1. Voice recording and playback components
 * 2. Integration with the chat interface
 * 3. Communication with the backend Voice API
 * 
 * This is a simplified version for demonstration purposes only.
 */

// Voice Recording Component
class VoiceRecorder {
  constructor(options = {}) {
    this.onAudioCaptured = options.onAudioCaptured || (() => {});
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    
    // Create UI elements
    this.container = document.createElement('div');
    this.container.className = 'voice-recorder';
    
    this.recordButton = document.createElement('button');
    this.recordButton.className = 'record-button';
    this.recordButton.textContent = 'Start Recording';
    this.recordButton.addEventListener('click', () => this.toggleRecording());
    
    this.statusText = document.createElement('span');
    this.statusText.className = 'status-text';
    this.statusText.textContent = 'Ready';
    
    this.container.appendChild(this.recordButton);
    this.container.appendChild(this.statusText);
  }
  
  async startRecording() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];
      
      this.mediaRecorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      });
      
      this.mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.processAudioBlob(audioBlob);
        this.stream.getTracks().forEach(track => track.stop());
      });
      
      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordButton.textContent = 'Stop Recording';
      this.statusText.textContent = 'Recording...';
    } catch (error) {
      console.error('Error starting recording:', error);
      this.statusText.textContent = 'Error: Could not access microphone';
    }
  }
  
  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.recordButton.textContent = 'Start Recording';
      this.statusText.textContent = 'Processing...';
    }
  }
  
  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }
  
  processAudioBlob(audioBlob) {
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      const base64Audio = reader.result.split(',')[1]; // Remove data URL prefix
      this.statusText.textContent = 'Ready';
      this.onAudioCaptured(base64Audio);
    };
  }
  
  mount(element) {
    element.appendChild(this.container);
    return this;
  }
}

// Voice Playback Component
class VoicePlayback {
  constructor(options = {}) {
    this.autoPlay = options.autoPlay || false;
    this.audio = new Audio();
    
    // Create UI elements
    this.container = document.createElement('div');
    this.container.className = 'voice-playback';
    
    this.playButton = document.createElement('button');
    this.playButton.className = 'play-button';
    this.playButton.textContent = 'Play';
    this.playButton.addEventListener('click', () => this.togglePlayback());
    
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'progress-bar';
    this.progressFill = document.createElement('div');
    this.progressFill.className = 'progress-fill';
    this.progressBar.appendChild(this.progressFill);
    
    this.container.appendChild(this.playButton);
    this.container.appendChild(this.progressBar);
    
    // Set up audio events
    this.audio.addEventListener('play', () => {
      this.playButton.textContent = 'Pause';
    });
    
    this.audio.addEventListener('pause', () => {
      this.playButton.textContent = 'Play';
    });
    
    this.audio.addEventListener('ended', () => {
      this.playButton.textContent = 'Play';
      this.progressFill.style.width = '0%';
    });
    
    this.audio.addEventListener('timeupdate', () => {
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      this.progressFill.style.width = `${progress}%`;
    });
  }
  
  setAudioData(base64Audio, format = 'mp3') {
    const audioBlob = this.base64ToBlob(base64Audio, `audio/${format}`);
    const audioUrl = URL.createObjectURL(audioBlob);
    
    this.audio.src = audioUrl;
    this.audio.load();
    
    if (this.autoPlay) {
      this.play();
    }
  }
  
  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    return new Blob(byteArrays, { type: mimeType });
  }
  
  play() {
    this.audio.play();
  }
  
  pause() {
    this.audio.pause();
  }
  
  togglePlayback() {
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }
  
  mount(element) {
    element.appendChild(this.container);
    return this;
  }
}

// Voice API Client
class VoiceApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:4000/api';
    this.apiKey = options.apiKey || '';
  }
  
  async synthesizeSpeech(text, voiceId = null, outputFormat = 'mp3') {
    try {
      const response = await fetch(`${this.baseUrl}/voice/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          text,
          voice_id: voiceId,
          output_format: outputFormat
        })
      });
      
      if (!response.ok) {
        throw new Error(`Voice synthesis failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      throw error;
    }
  }
  
  async recognizeSpeech(audioData, language = 'en-US') {
    try {
      const response = await fetch(`${this.baseUrl}/voice/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          audio_data: audioData,
          language
        })
      });
      
      if (!response.ok) {
        throw new Error(`Voice recognition failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error recognizing speech:', error);
      throw error;
    }
  }
}

// Chat Interface with Voice Integration
class VoiceChatInterface {
  constructor(options = {}) {
    this.apiClient = new VoiceApiClient(options.apiConfig || {});
    this.container = document.createElement('div');
    this.container.className = 'voice-chat-interface';
    
    // Create chat elements
    this.chatMessages = document.createElement('div');
    this.chatMessages.className = 'chat-messages';
    
    this.inputContainer = document.createElement('div');
    this.inputContainer.className = 'input-container';
    
    this.textInput = document.createElement('input');
    this.textInput.type = 'text';
    this.textInput.placeholder = 'Type a message...';
    this.textInput.addEventListener('keypress', event => {
      if (event.key === 'Enter') {
        this.sendTextMessage();
      }
    });
    
    this.sendButton = document.createElement('button');
    this.sendButton.className = 'send-button';
    this.sendButton.textContent = 'Send';
    this.sendButton.addEventListener('click', () => this.sendTextMessage());
    
    this.voiceButton = document.createElement('button');
    this.voiceButton.className = 'voice-button';
    this.voiceButton.textContent = 'Voice';
    this.voiceButton.addEventListener('click', () => this.toggleVoiceRecorder());
    
    this.inputContainer.appendChild(this.textInput);
    this.inputContainer.appendChild(this.sendButton);
    this.inputContainer.appendChild(this.voiceButton);
    
    this.voiceRecorderContainer = document.createElement('div');
    this.voiceRecorderContainer.className = 'voice-recorder-container';
    this.voiceRecorderContainer.style.display = 'none';
    
    this.container.appendChild(this.chatMessages);
    this.container.appendChild(this.inputContainer);
    this.container.appendChild(this.voiceRecorderContainer);
    
    // Initialize voice recorder
    this.voiceRecorder = new VoiceRecorder({
      onAudioCaptured: audioData => this.handleVoiceInput(audioData)
    });
    this.voiceRecorder.mount(this.voiceRecorderContainer);
    
    // Track state
    this.showingVoiceRecorder = false;
    this.messages = [];
  }
  
  toggleVoiceRecorder() {
    this.showingVoiceRecorder = !this.showingVoiceRecorder;
    this.voiceRecorderContainer.style.display = this.showingVoiceRecorder ? 'block' : 'none';
  }
  
  async sendTextMessage() {
    const text = this.textInput.value.trim();
    if (!text) return;
    
    this.addMessage('user', text);
    this.textInput.value = '';
    
    try {
      // In a real implementation, this would call the chat API
      // For this demo, we'll just echo the message with voice synthesis
      const synthesisResponse = await this.apiClient.synthesizeSpeech(
        `You said: ${text}`, null, 'mp3'
      );
      
      this.addMessage('assistant', `You said: ${text}`, synthesisResponse.audio_data);
    } catch (error) {
      console.error('Error sending message:', error);
      this.addMessage('assistant', 'Sorry, there was an error processing your message.');
    }
  }
  
  async handleVoiceInput(audioData) {
    try {
      // Hide voice recorder after capturing audio
      this.toggleVoiceRecorder();
      
      // Add a placeholder message
      const messageElement = this.addMessage('user', 'Processing voice message...');
      
      // Recognize speech
      const recognitionResponse = await this.apiClient.recognizeSpeech(audioData);
      
      // Update message with recognized text
      messageElement.textContent = recognitionResponse.text;
      
      // In a real implementation, this would call the chat API
      // For this demo, we'll just echo the message with voice synthesis
      const synthesisResponse = await this.apiClient.synthesizeSpeech(
        `You said: ${recognitionResponse.text}`, null, 'mp3'
      );
      
      this.addMessage('assistant', `You said: ${recognitionResponse.text}`, synthesisResponse.audio_data);
    } catch (error) {
      console.error('Error processing voice input:', error);
      this.addMessage('assistant', 'Sorry, there was an error processing your voice message.');
    }
  }
  
  addMessage(role, text, audioData = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${role}-message`;
    messageElement.textContent = text;
    
    this.chatMessages.appendChild(messageElement);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    
    // Add voice playback if audio data is provided
    if (audioData) {
      const playbackContainer = document.createElement('div');
      playbackContainer.className = 'voice-playback-container';
      messageElement.appendChild(playbackContainer);
      
      const voicePlayback = new VoicePlayback({ autoPlay: true });
      voicePlayback.mount(playbackContainer);
      voicePlayback.setAudioData(audioData);
    }
    
    // Store message
    this.messages.push({ role, text, audioData });
    
    return messageElement;
  }
  
  mount(element) {
    element.appendChild(this.container);
    return this;
  }
}

// Example usage
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  
  if (appContainer) {
    // Create and mount the voice chat interface
    const chatInterface = new VoiceChatInterface({
      apiConfig: {
        baseUrl: 'http://localhost:4000/api',
        apiKey: 'your-api-key'
      }
    });
    
    chatInterface.mount(appContainer);
    
    // Add a welcome message
    chatInterface.addMessage('assistant', 'Welcome to PSScript Manager! How can I help you today?');
  }
});

// CSS styles for the components
const styles = `
.voice-chat-interface {
  display: flex;
  flex-direction: column;
  height: 500px;
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
  font-family: Arial, sans-serif;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: #f5f5f5;
}

.message {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 70%;
  word-wrap: break-word;
}

.user-message {
  background-color: #dcf8c6;
  align-self: flex-end;
  margin-left: auto;
}

.assistant-message {
  background-color: #fff;
  align-self: flex-start;
}

.input-container {
  display: flex;
  padding: 8px;
  background-color: #fff;
  border-top: 1px solid #ccc;
}

.input-container input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 20px;
  outline: none;
}

.input-container button {
  margin-left: 8px;
  padding: 8px 16px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}

.input-container button:hover {
  background-color: #0056b3;
}

.voice-recorder-container {
  padding: 16px;
  background-color: #f9f9f9;
  border-top: 1px solid #ccc;
}

.voice-recorder {
  display: flex;
  align-items: center;
}

.record-button {
  padding: 8px 16px;
  background-color: #dc3545;
  color: #fff;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}

.status-text {
  margin-left: 12px;
  color: #666;
}

.voice-playback-container {
  margin-top: 8px;
}

.voice-playback {
  display: flex;
  align-items: center;
  background-color: #f0f0f0;
  border-radius: 16px;
  padding: 4px 8px;
}

.play-button {
  padding: 4px 8px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  font-size: 12px;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background-color: #ccc;
  border-radius: 2px;
  margin-left: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #007bff;
  width: 0%;
  transition: width 0.1s linear;
}
`;

// Add styles to the document
const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);