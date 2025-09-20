import { useState, useEffect, useRef, useCallback } from 'react';

interface Command {
  [key: string]: () => void;
}

interface UseVoiceCommandsArgs {
  commands: Command;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

// Extend the Window interface to include SpeechRecognition for different browsers
declare global {
  interface Window {
    // FIX: Correctly type the SpeechRecognition constructors on the window object.
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const useVoiceCommands = ({ commands }: UseVoiceCommandsArgs) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const processResult = useCallback((event: any) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }
    
    const processedTranscript = finalTranscript.trim().toLowerCase();
    setTranscript(processedTranscript);

    // Find and execute a command
    const commandKeys = Object.keys(commands);
    for (const key of commandKeys) {
        if (processedTranscript.includes(key)) {
            commands[key]();
            break; // Execute only the first matched command
        }
    }
  }, [commands]);
  
  const startListening = useCallback(() => {
    if (!isSupported || isListening) return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
        setError("Speech Recognition API not found in this browser.");
        return;
    }

    recognitionRef.current = new (SpeechRecognitionAPI)();
    const recognition = recognitionRef.current;
    
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = processResult;

    recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setError('Permission denied.');
        } else if (event.error === 'no-speech') {
            // This can happen often, so we might not want to show a persistent error.
            // Let's just log it for now.
            console.warn('No speech detected.');
        } else {
          setError(event.error);
        }
        setIsListening(false);
    };
    
    recognition.onend = () => {
        // If it stops but we still want it to be listening, restart it.
        if (isListening) {
           recognition.start();
        }
    };
    
    recognition.start();
    setIsListening(true);
    setError(null);
  }, [isSupported, isListening, processResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    isSupported,
  };
};

export default useVoiceCommands;
