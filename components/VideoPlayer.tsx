import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Slide } from '../types';
import { PlayIcon, PauseIcon, StopIcon, SettingsIcon, MicrophoneIcon, MicrophoneOffIcon, GenerateIcon } from './icons';
import useVoiceCommands from '../hooks/useVoiceCommands';
import { generateImage } from '../services/geminiService';
import Loader from './Loader';

interface VideoPlayerProps {
  slides: Slide[];
  onClose: () => void;
  onSlidesChange: (newSlides: Slide[]) => void;
}

type TransitionType = 'fade' | 'slide' | 'vertical' | 'zoom' | 'wipe';

const VideoPlayer: React.FC<VideoPlayerProps> = ({ slides, onClose, onSlidesChange }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [transitionType, setTransitionType] = useState<TransitionType>('fade');
  const [transitionDuration, setTransitionDuration] = useState<number>(500);
  const [backgroundColor, setBackgroundColor] = useState<string>('#000000');
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  
  // Animation & Content State
  const [animationState, setAnimationState] = useState<'idle' | 'exiting' | 'entering'>('idle');
  const [slideContent, setSlideContent] = useState<Slide>(slides[0]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const isTransitioning = animationState !== 'idle';
  
  const handleSlideChange = useCallback((nextIndex: number) => {
    if (isTransitioning || nextIndex < 0 || nextIndex >= slides.length) return;

    setImageError(null);
    setAnimationState('exiting');

    setTimeout(() => {
        setCurrentSlideIndex(nextIndex);
        setSlideContent(slides[nextIndex]);
        setAnimationState('entering');

        setTimeout(() => {
            setAnimationState('idle');
        }, transitionDuration);
    }, transitionDuration);
  }, [isTransitioning, transitionDuration, slides.length]);

  const advanceSlide = useCallback(() => {
    if (currentSlideIndex < slides.length - 1) {
      handleSlideChange(currentSlideIndex + 1);
    } else {
      setIsPlaying(false);
      setIsFinished(true);
    }
  }, [currentSlideIndex, slides.length, handleSlideChange]);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    onClose();
  }, [onClose]);
  
  const handleReplay = () => {
    setIsFinished(false);
    setCurrentSlideIndex(0);
    setSlideContent(slides[0]);
    setIsPlaying(true);
    setAnimationState('idle');
  };

  const commands = useMemo(() => ({
    'play': () => setIsPlaying(true),
    'start': () => setIsPlaying(true),
    'pause': () => setIsPlaying(false),
    'hold': () => setIsPlaying(false),
    'stop': handleStop,
    'end': handleStop,
    'next': () => handleSlideChange(currentSlideIndex + 1),
    'next slide': () => handleSlideChange(currentSlideIndex + 1),
    'previous': () => handleSlideChange(currentSlideIndex - 1),
    'back': () => handleSlideChange(currentSlideIndex - 1),
    'previous slide': () => handleSlideChange(currentSlideIndex - 1),
    'open settings': () => setIsSettingsOpen(true),
    'show settings': () => setIsSettingsOpen(true),
    'close settings': () => setIsSettingsOpen(false),
    'hide settings': () => setIsSettingsOpen(false),
    'replay': () => { if (isFinished) handleReplay() },
    'restart': () => { if (isFinished) handleReplay() },
  }), [handleStop, handleSlideChange, currentSlideIndex, isFinished]);
  
  const { isListening, transcript, startListening, stopListening, error: voiceError, isSupported: voiceIsSupported } = useVoiceCommands({ commands });

  useEffect(() => {
    if (isPlaying && !isTransitioning && animationState === 'idle' && slideContent && !isFinished && !isGeneratingImage) {
      const utterance = new SpeechSynthesisUtterance(slideContent.speakerNotes);
      
      const handleEnd = () => advanceSlide();
      const handleError = (event: SpeechSynthesisErrorEvent) => {
        console.error('SpeechSynthesisUtterance.onerror', event);
        advanceSlide();
      };

      utterance.addEventListener('end', handleEnd);
      utterance.addEventListener('error', handleError);
      
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);

      return () => {
        utterance.removeEventListener('end', handleEnd);
        utterance.removeEventListener('error', handleError);
      };
    }
  }, [slideContent, isPlaying, isFinished, advanceSlide, isTransitioning, animationState, isGeneratingImage]);

  useEffect(() => {
    if (isFinished) {
      window.speechSynthesis.cancel();
      return;
    }
    if (isPlaying) {
      window.speechSynthesis.resume();
    } else {
      window.speechSynthesis.pause();
    }
  }, [isPlaying, isFinished]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      stopListening();
    };
  }, [stopListening]);
  
  const animationClass = useMemo(() => {
    if (animationState === 'idle') return 'animate-fade-in'; // Initial fade in
    const isExit = animationState === 'exiting';
    switch (transitionType) {
        case 'slide': return isExit ? 'animate-slide-out-left' : 'animate-slide-in-right';
        case 'vertical': return isExit ? 'animate-slide-out-top' : 'animate-slide-in-bottom';
        case 'zoom': return isExit ? 'animate-zoom-out' : 'animate-zoom-in';
        case 'wipe': return isExit ? 'animate-wipe-out' : 'animate-wipe-in';
        case 'fade':
        default: return isExit ? 'animate-fade-out' : 'animate-fade-in';
    }
  }, [animationState, transitionType]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleBackgroundImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateImage = async () => {
    if (!slideContent) return;
    
    setIsGeneratingImage(true);
    setImageError(null);
    if(isPlaying) setIsPlaying(false);

    try {
      const prompt = `Create a visually engaging and educational image for a presentation slide titled "${slideContent.title}". The main points on the slide are: ${slideContent.content.join('; ')}. The image should be clean, modern, and relevant to the topic, in a 16:9 aspect ratio. Avoid putting any text in the image. Style: vibrant, illustrative.`;
      const imageUrl = await generateImage(prompt);
      const newSlides = slides.map((slide, index) => {
        if (index === currentSlideIndex) {
          return { ...slide, imageUrl };
        }
        return slide;
      });
      onSlidesChange(newSlides);
      setSlideContent(newSlides[currentSlideIndex]);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const toggleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (isFinished) {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-900/80 rounded-xl p-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Presentation Finished</h2>
            <div className="flex gap-4">
                 <button onClick={handleReplay} className="flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-500 transition duration-200">Replay</button>
                 <button onClick={handleStop} className="flex items-center justify-center gap-2 bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-gray-500 transition duration-200">Close</button>
            </div>
        </div>
    );
  }

  if (!slideContent) return null;
  
  return (
    <div className="flex flex-col h-full bg-gray-800/50 rounded-xl shadow-2xl border border-gray-700 overflow-hidden relative">
      {isListening && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-1 rounded-full text-sm z-20 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          Listening...
        </div>
      )}
      {voiceError && (
         <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-red-800/80 text-white px-4 py-2 rounded-lg text-sm z-20">
            Voice Error: {voiceError}
        </div>
      )}
      <div 
        className="flex-grow flex items-center justify-center aspect-video relative overflow-hidden"
        style={{
            backgroundColor: backgroundColor,
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        }}
      >
        {isGeneratingImage ? (
            <Loader message="Generating image..." />
        ) : imageError ? (
           <div className="text-center text-red-400 p-4 bg-black/50 rounded-lg">
             <p className="font-semibold">Image Generation Failed</p>
             <p className="text-sm">{imageError}</p>
             <button onClick={handleGenerateImage} className="mt-4 flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-500 transition duration-200 shadow-md">
                Try Again
             </button>
           </div>
        ) : (
          <div 
              className={`w-full h-full p-4 sm:p-8 flex items-center justify-center ${animationClass}`}
              style={{ animationDuration: `${transitionDuration}ms` }}
          >
            {slideContent.imageUrl ? (
                <img src={slideContent.imageUrl} alt={slideContent.title} className="w-full h-full object-contain"/>
            ) : (
                <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-8">
                    <h2 className="text-4xl font-bold text-white mb-6">{slideContent.title}</h2>
                    <ul className="space-y-4 list-disc list-inside text-xl text-gray-300">
                        {slideContent.content.map((point, index) => ( <li key={index}>{point}</li> ))}
                    </ul>
                    {!isPlaying && (
                      <button
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage}
                        className="absolute bottom-8 flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-500 transition-all duration-200 shadow-lg opacity-80 hover:opacity-100 disabled:bg-indigo-800 disabled:cursor-not-allowed"
                      >
                        <GenerateIcon />
                        {isGeneratingImage ? 'Generating...' : 'Generate Image'}
                      </button>
                    )}
                </div>
            )}
          </div>
        )}
      </div>

      {isSettingsOpen && (
          <div className="absolute top-4 right-4 bg-gray-800/90 backdrop-blur-sm p-4 rounded-lg shadow-lg z-20 border border-gray-700 w-80 text-sm text-white">
              <h4 className="font-bold mb-3">Transition Settings</h4>
              <div className="mb-3">
                  <label htmlFor="transition-type" className="block mb-1 text-gray-300">Type</label>
                  <select id="transition-type" value={transitionType} onChange={e => setTransitionType(e.target.value as TransitionType)} className="w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="fade">Fade</option>
                      <option value="slide">Slide</option>
                      <option value="vertical">Vertical Slide</option>
                      <option value="zoom">Zoom</option>
                      <option value="wipe">Wipe</option>
                  </select>
              </div>
              <div className="mb-4">
                  <label htmlFor="transition-duration" className="block mb-1 text-gray-300">Duration: {transitionDuration}ms</label>
                  <input id="transition-duration" type="range" min="200" max="2000" step="100" value={transitionDuration} onChange={e => setTransitionDuration(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              <h4 className="font-bold mb-3 border-t border-gray-700 pt-3">Background Settings</h4>
                <div className="mb-3">
                  <label htmlFor="bg-color" className="block mb-1 text-gray-300">Color</label>
                  <input id="bg-color" type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="w-full h-8 p-1 bg-gray-900 border border-gray-600 rounded-md cursor-pointer"/>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="bg-image-url" className="text-gray-300">Image URL</label>
                    {backgroundImage && (
                      <button onClick={() => setBackgroundImage('')} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">Clear</button>
                    )}
                  </div>
                  <input id="bg-image-url" type="text" placeholder="https://..." value={backgroundImage.startsWith('data:') ? '' : backgroundImage} onChange={e => setBackgroundImage(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" disabled={backgroundImage.startsWith('data:')}/>
                </div>
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-600"></div>
                    <span className="flex-shrink mx-2 text-xs text-gray-400">OR</span>
                    <div className="flex-grow border-t border-gray-600"></div>
                </div>
                <div>
                    <label htmlFor="bg-image-upload" className="block mb-1 text-gray-300">Upload Image</label>
                    <input 
                      id="bg-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleBackgroundImageUpload}
                      className="w-full text-sm text-gray-400 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-600/20 file:text-indigo-300 hover:file:bg-indigo-600/40 cursor-pointer"
                    />
                </div>
          </div>
      )}

      <div className="bg-gray-900 p-4 flex items-center justify-between border-t border-gray-700">
        <div className="w-1/3">
           <button onClick={handleStop} disabled={isTransitioning} className="flex items-center gap-2 bg-red-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-red-500 transition duration-200 disabled:bg-red-800 disabled:cursor-not-allowed">
                <StopIcon /> End
            </button>
        </div>
        
        <div className="w-1/3 flex justify-center items-center gap-4">
            <button onClick={handlePlayPause} disabled={isTransitioning} className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition duration-200 disabled:bg-indigo-800 disabled:cursor-not-allowed">
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
        </div>

        <div className="w-1/3 flex justify-end items-center gap-4">
            <span className="text-gray-400 font-mono">
                {currentSlideIndex + 1} / {slides.length}
            </span>
             <button 
                onClick={toggleListen}
                disabled={!voiceIsSupported}
                title={voiceIsSupported ? (isListening ? "Stop listening" : "Listen for voice commands") : "Voice commands not supported in your browser"}
                className={`p-2 rounded-full transition duration-200 ${!voiceIsSupported ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'} ${isListening ? 'bg-red-600 text-white' : ''} ${voiceError ? 'bg-yellow-600 text-white' : ''}`}
             >
                {isListening ? <MicrophoneIcon /> : <MicrophoneOffIcon />}
            </button>
             <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-2 rounded-full hover:bg-gray-700 transition duration-200">
                <SettingsIcon />
            </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;