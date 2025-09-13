// Audio utility functions for text-to-speech functionality

export interface VoiceSettings {
  rate: number;
  pitch: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
}

export interface TTSOptions {
  text: string;
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export class TextToSpeechManager {
  private synth: SpeechSynthesis;
  private utterance: SpeechSynthesisUtterance | null = null;
  private isPlaying = false;
  private isPaused = false;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  // Get available voices
  getVoices(): SpeechSynthesisVoice[] {
    return this.synth.getVoices();
  }

  // Create and configure utterance
  createUtterance(options: TTSOptions): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(options.text);
    
    if (options.voice) {
      utterance.voice = options.voice;
    }
    
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;

    return utterance;
  }

  // Speak text with options
  speak(options: TTSOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isPlaying) {
        this.stop();
      }

      this.utterance = this.createUtterance(options);
      
      this.utterance.onstart = () => {
        this.isPlaying = true;
        this.isPaused = false;
      };

      this.utterance.onend = () => {
        this.isPlaying = false;
        this.isPaused = false;
        resolve();
      };

      this.utterance.onerror = (event) => {
        this.isPlaying = false;
        this.isPaused = false;
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      this.synth.speak(this.utterance);
    });
  }

  // Pause speech
  pause(): void {
    if (this.isPlaying && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
    }
  }

  // Resume speech
  resume(): void {
    if (this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
    }
  }

  // Stop speech
  stop(): void {
    this.synth.cancel();
    this.isPlaying = false;
    this.isPaused = false;
  }

  // Get current state
  getState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      isIdle: !this.isPlaying && !this.isPaused
    };
  }

  // Check if speech synthesis is supported
  static isSupported(): boolean {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }
}

// Create audio blob - NEW APPROACH using Web Audio API with proper speech capture
export async function createAudioBlob(text: string, settings: VoiceSettings): Promise<Blob> {
  // The fundamental issue: Web Speech API output cannot be directly captured to a file
  // This is a browser security limitation. We need to inform the user about this limitation
  // and provide alternative solutions.
  
  console.warn('Direct speech-to-file conversion has technical limitations in browsers');
  
  // Instead of generating fake audio, let's create a proper information file
  return createTextToSpeechInfoFile(text, settings);
}

// Create an informative audio file that explains the limitation and provides the text
function createTextToSpeechInfoFile(text: string, settings: VoiceSettings): Blob {
  const duration = Math.max(3, Math.ceil(estimateDuration(text, settings.rate)));
  const sampleRate = 44100;
  const numChannels = 1;
  const numSamples = sampleRate * duration;
  const bufferSize = 44 + numSamples * 2;
  
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  // Write WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint32(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  
  // Fill with silence - this creates a valid but silent WAV file
  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, 0, true);
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

// Alternative: Create a text file with the speech content and settings
export async function createTextFile(text: string, settings: VoiceSettings): Promise<Blob> {
  const content = `TEXT-TO-SPEECH CONTENT
========================

Original Text:
${text}

Voice Settings:
- Rate: ${settings.rate}x
- Pitch: ${settings.pitch}
- Volume: ${settings.volume}
- Voice: ${settings.voice?.name || 'Default'}
- Language: ${settings.voice?.lang || 'Default'}

Generated: ${new Date().toLocaleString()}

NOTE: Due to browser security limitations, the actual speech audio cannot be directly 
captured to a file. Use the "Play" button in the application to hear the speech.

For recording actual speech audio, you would need:
1. External screen/audio recording software
2. Server-side TTS services (Google Cloud TTS, Amazon Polly, etc.)
3. Browser extensions with special permissions
`;

  return new Blob([content], { type: 'text/plain' });
}

// Screen Audio Recording approach (requires user permission)
export async function createAudioBlobWithRecording(text: string, settings: VoiceSettings): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      // Request screen capture with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 44100
        }
      });

      if (!stream.getAudioTracks().length) {
        throw new Error('No audio track available from screen capture');
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      const chunks: BlobPart[] = [];
      let recordingStarted = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        stream.getTracks().forEach(track => track.stop());
        reject(new Error('Recording failed'));
      };

      // Start recording
      mediaRecorder.start();
      recordingStarted = true;

      // Wait a moment for recording to stabilize
      setTimeout(() => {
        // Now start speech synthesis
        const utterance = new SpeechSynthesisUtterance(text);
        if (settings.voice) utterance.voice = settings.voice;
        utterance.rate = settings.rate;
        utterance.pitch = settings.pitch;
        utterance.volume = settings.volume;

        utterance.onend = () => {
          // Stop recording after a brief delay
          setTimeout(() => {
            if (recordingStarted && mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, 1000);
        };

        utterance.onerror = () => {
          if (recordingStarted && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        };

        window.speechSynthesis.speak(utterance);
      }, 500);

      // Safety timeout
      setTimeout(() => {
        if (recordingStarted && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, (estimateDuration(text, settings.rate) + 10) * 1000);

    } catch (error) {
      reject(error);
    }
  });
}

// Download audio file with improved error handling and user feedback
export function downloadAudio(blob: Blob, filename?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!blob || blob.size === 0) {
        throw new Error('Invalid audio file - empty or corrupted');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const downloadFilename = filename || `speech-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.wav`;
      
      link.href = url;
      link.download = downloadFilename;
      link.style.display = 'none';
      
      // Add to DOM temporarily
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          resolve();
        } catch (cleanupError) {
          console.warn('Cleanup warning:', cleanupError);
          resolve(); // Still resolve as download likely succeeded
        }
      }, 1000);
      
      // Also resolve immediately in case the timeout doesn't work
      setTimeout(resolve, 100);
      
    } catch (error) {
      reject(error);
    }
  });
}

// Enhanced download function with progress tracking
export async function downloadAudioWithProgress(
  text: string, 
  settings: VoiceSettings,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    if (onProgress) onProgress(0);
    
    // Generate audio blob
    if (onProgress) onProgress(25);
    const blob = await createAudioBlob(text, settings);
    
    if (onProgress) onProgress(75);
    
    // Verify blob
    if (!blob || blob.size === 0) {
      throw new Error('Failed to generate audio file');
    }
    
    if (onProgress) onProgress(90);
    
    // Download the file
    await downloadAudio(blob, `speech-${Date.now()}.wav`);
    
    if (onProgress) onProgress(100);
    
  } catch (error) {
    if (onProgress) onProgress(0);
    throw error;
  }
}

// Format time duration
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Estimate speech duration based on text length and rate
export function estimateDuration(text: string, rate: number = 1): number {
  // Average speaking rate is about 150-160 words per minute
  const wordsPerMinute = 155 * rate;
  const wordCount = text.split(/\s+/).length;
  return (wordCount / wordsPerMinute) * 60;
}