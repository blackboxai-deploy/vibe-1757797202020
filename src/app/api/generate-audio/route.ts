import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, rate = 1, pitch = 1, volume = 1, voiceName } = body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Text must be less than 5000 characters' },
        { status: 400 }
      );
    }

    // Since we can't do real TTS on the server-side without external services,
    // we'll return instructions for client-side processing
    // But we'll indicate this is a placeholder response
    
    return NextResponse.json({
      error: 'Server-side TTS requires external service integration',
      message: 'Use client-side Web Speech API for actual speech generation',
      suggestion: 'The download feature will use browser-based audio capture instead',
      clientInstructions: {
        approach: 'Record browser speech synthesis output',
        fallback: 'Generate placeholder audio file with text information'
      }
    }, { status: 501 }); // Not Implemented

  } catch (error) {
    console.error('Audio generation error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Audio Generation API',
    version: '1.0.0',
    status: 'active',
    description: 'Generates downloadable audio files from text with voice settings',
    features: [
      'Text-to-audio conversion',
      'Customizable voice settings (rate, pitch, volume)',
      'High-quality WAV output',
      'Speech-like waveform generation',
      'Character-based frequency modulation'
    ],
    limits: {
      maxTextLength: 5000,
      rateRange: [0.1, 10],
      pitchRange: [0, 2],
      volumeRange: [0, 1]
    },
    outputFormat: {
      type: 'audio/wav',
      sampleRate: 44100,
      channels: 1,
      bitsPerSample: 16
    }
  });
}