"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AudioPlayer from "./AudioPlayer";
import VoiceSettings from "./VoiceSettings";
import { 
  TextToSpeechManager, 
  VoiceSettings as VoiceSettingsType, 
  createAudioBlob, 
  downloadAudio,
  downloadAudioWithProgress,
  createTextFile,
  createAudioBlobWithRecording
} from "@/lib/audio-utils";

const SAMPLE_TEXTS = [
  "Hello! Welcome to our text-to-speech application. This tool converts your written text into natural-sounding speech that you can play and download.",
  "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the English alphabet and is perfect for testing speech synthesis.",
  "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat.",
  "To be or not to be, that is the question. Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles."
];

const MAX_CHARACTER_LIMIT = 5000;

export default function TextToSpeechApp() {
  // Text and UI state
  const [text, setText] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Voice settings state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsType>({
    rate: 1,
    pitch: 1,
    volume: 1,
    voice: null
  });

  // TTS manager and playback state
  const [ttsManager, setTtsManager] = useState<TextToSpeechManager | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Initialize TTS manager
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (TextToSpeechManager.isSupported()) {
        setTtsManager(new TextToSpeechManager());
        setIsSupported(true);
      } else {
        setIsSupported(false);
        setError("Text-to-speech is not supported in this browser. Please try Chrome, Firefox, Safari, or Edge.");
      }
    }
  }, []);

  // Update playback state
  const updatePlaybackState = useCallback(() => {
    if (ttsManager) {
      const state = ttsManager.getState();
      setIsPlaying(state.isPlaying);
      setIsPaused(state.isPaused);
    }
  }, [ttsManager]);

  // Polling for playback state updates
  useEffect(() => {
    const interval = setInterval(updatePlaybackState, 100);
    return () => clearInterval(interval);
  }, [updatePlaybackState]);

  const handleTextChange = (value: string) => {
    if (value.length <= MAX_CHARACTER_LIMIT) {
      setText(value);
      setError(null);
    }
  };

  const handleSampleTextSelect = (sampleText: string) => {
    setText(sampleText);
  };

  const handleClearText = () => {
    setText("");
    if (ttsManager) {
      ttsManager.stop();
    }
  };

  const handlePlay = async () => {
    if (!ttsManager || !text.trim()) return;

    try {
      setError(null);
      await ttsManager.speak({
        text: text.trim(),
        voice: voiceSettings.voice,
        rate: voiceSettings.rate,
        pitch: voiceSettings.pitch,
        volume: voiceSettings.volume
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to play speech");
    }
  };

  const handlePause = () => {
    if (!ttsManager) return;
    
    if (isPaused) {
      ttsManager.resume();
    } else {
      ttsManager.pause();
    }
  };

  const handleStop = () => {
    if (!ttsManager) return;
    ttsManager.stop();
  };

  const handleDownload = async () => {
    if (!text.trim() || isDownloading) return;

    setIsDownloading(true);
    setError(null);

    try {
      // Inform user about browser limitations
      const userChoice = await new Promise<string>((resolve) => {
        const choice = window.confirm(
          `📢 IMPORTANT: Browser Security Limitation\n\n` +
          `Due to web browser security restrictions, the Web Speech API output cannot be directly saved to an audio file.\n\n` +
          `Available options:\n` +
          `✅ Click "OK" to download a text file with your content and settings\n` +
          `✅ Click "Cancel" to try experimental screen recording (requires permission)\n\n` +
          `For actual speech recording, please:\n` +
          `• Use the "Play" button to hear the speech\n` +
          `• Use screen recording software to capture the audio\n` +
          `• Consider server-side TTS services for production apps`
        );
        resolve(choice ? 'text' : 'recording');
      });

      let blob: Blob;
      let filename: string;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');

      if (userChoice === 'text') {
        // Download text file with speech content and settings
        const { createTextFile } = await import('@/lib/audio-utils');
        blob = await createTextFile(text.trim(), voiceSettings);
        filename = `speech-content-${timestamp}.txt`;
        
        await downloadAudio(blob, filename);
        
        // Show informative message
        setTimeout(() => {
          alert('✅ Text file downloaded successfully!\n\nThe file contains your text content and voice settings. Use the "Play" button in the app to hear the actual speech.');
        }, 100);
        
      } else {
        // Try experimental screen recording approach
        try {
          const { createAudioBlobWithRecording } = await import('@/lib/audio-utils');
          
          alert('🎤 Screen Recording Setup:\n\n1. Click "Share" in the next dialog\n2. Select "Share audio" checkbox\n3. Choose your browser tab\n4. The recording will start automatically\n5. Speech will play and be recorded');
          
          blob = await createAudioBlobWithRecording(text.trim(), voiceSettings);
          filename = `speech-recorded-${timestamp}.webm`;
          
          await downloadAudio(blob, filename);
          
          alert('✅ Audio recording completed!\n\nYour speech has been recorded and downloaded as a WebM audio file.');
          
        } catch (recordingError) {
          console.error('Recording error:', recordingError);
          
          // Fallback to text file
          const { createTextFile } = await import('@/lib/audio-utils');
          blob = await createTextFile(text.trim(), voiceSettings);
          filename = `speech-content-${timestamp}.txt`;
          
          await downloadAudio(blob, filename);
          
          alert('⚠️ Recording failed, downloaded text file instead.\n\nError: Screen recording requires permission and audio sharing.\n\nPlease use the "Play" button to hear the speech or use external recording software.');
        }
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Download process failed";
      console.error('Download error:', err);
      setError(`Download Error: ${errorMessage}\n\nTip: Use the "Play" button to hear the speech directly in the browser.`);
    } finally {
      setIsDownloading(false);
    }
  };

  const characterCount = text.length;
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const isTextValid = text.trim().length > 0;

  if (!isSupported) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert className="max-w-md">
          <AlertDescription>
            Text-to-speech is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Text to Audio
            </h1>
            <p className="text-gray-600 text-lg">
              Convert your text to natural-sounding speech with customizable voice settings
            </p>
          </div>
          
          {/* Features badges */}
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary">🎵 Natural Speech</Badge>
            <Badge variant="secondary">⚙️ Voice Controls</Badge>
            <Badge variant="secondary">⬇️ Download Audio</Badge>
            <Badge variant="secondary">📱 Responsive</Badge>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Text Input */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Text Input</CardTitle>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span>{wordCount} words</span>
                    <span>•</span>
                    <span className={characterCount > MAX_CHARACTER_LIMIT * 0.9 ? "text-orange-500" : ""}>
                      {characterCount}/{MAX_CHARACTER_LIMIT} characters
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="text-input">Enter text to convert to speech</Label>
                  <Textarea
                    id="text-input"
                    placeholder="Type or paste your text here..."
                    value={text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    className="min-h-[200px] resize-y"
                    maxLength={MAX_CHARACTER_LIMIT}
                  />
                </div>

                {/* Sample Texts and Actions */}
                <Tabs defaultValue="samples" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="samples">Sample Texts</TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="samples" className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {SAMPLE_TEXTS.map((sample, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSampleTextSelect(sample)}
                          className="text-left h-auto p-3 justify-start"
                        >
                          <span className="truncate">
                            {sample.substring(0, 60)}...
                          </span>
                        </Button>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="actions" className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearText}
                        disabled={!text}
                      >
                        Clear Text
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const words = text.split(/\s+/);
                          setText(words.slice(0, Math.ceil(words.length / 2)).join(' '));
                        }}
                        disabled={!text}
                      >
                        Keep First Half
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setText(text.toUpperCase())}
                        disabled={!text}
                      >
                        UPPERCASE
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setText(text.toLowerCase())}
                        disabled={!text}
                      >
                        lowercase
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Audio Player */}
            <AudioPlayer
              isPlaying={isPlaying}
              isPaused={isPaused}
              text={text}
              rate={voiceSettings.rate}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onDownload={handleDownload}
              isDownloading={isDownloading}
              disabled={!isTextValid}
            />
          </div>

          {/* Voice Settings Sidebar */}
          <div className="lg:col-span-1">
            <VoiceSettings
              settings={voiceSettings}
              onSettingsChange={setVoiceSettings}
              disabled={isPlaying && !isPaused}
            />
          </div>
        </div>

        {/* Important Information */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm space-y-2">
            <div className="flex items-start space-x-2">
              <span className="text-blue-600 mt-0.5">ℹ️</span>
              <div className="text-blue-800">
                <strong>About Audio Downloads:</strong>
                <p className="mt-1">Due to browser security restrictions, Web Speech API output cannot be directly saved as audio files. The "Export" button provides:</p>
                <ul className="list-disc ml-4 mt-1 space-y-1">
                  <li><strong>Text Export:</strong> Download your content with voice settings</li>
                  <li><strong>Screen Recording:</strong> Experimental audio capture (requires permission)</li>
                  <li><strong>Live Playback:</strong> Use the "Play" button for immediate speech</li>
                </ul>
                <p className="mt-2 text-blue-700">
                  💡 <strong>Tip:</strong> For production applications, consider server-side TTS services like Google Cloud TTS, Amazon Polly, or Azure Speech Services.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 pt-4">
          <p>Built with Web Speech API • Works best in Chrome, Firefox, Safari & Edge</p>
        </div>
      </div>
    </div>
  );
}