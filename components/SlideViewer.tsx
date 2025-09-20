import React, { useState, useEffect } from 'react';
import type { Slide } from '../types';
import { generateImage } from '../services/geminiService';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, EditIcon, SaveIcon, DownloadIcon, GenerateIcon } from './icons';
import Loader from './Loader';

interface SlideViewerProps {
  slides: Slide[];
  onPlayVideo: () => void;
  onSlidesChange: (newSlides: Slide[]) => void;
}

const SlideViewer: React.FC<SlideViewerProps> = ({ slides, onPlayVideo, onSlidesChange }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const currentSlide = slides[currentSlideIndex];

  useEffect(() => {
    if (currentSlide) {
      setEditedTitle(currentSlide.title);
      setEditedNotes(currentSlide.speakerNotes);
      setIsEditing(false); // Exit edit mode when slide changes
      setImageError(null);
    }
  }, [currentSlideIndex, slides, currentSlide]);


  const goToPrevious = () => {
    setCurrentSlideIndex((prevIndex) => (prevIndex === 0 ? slides.length - 1 : prevIndex - 1));
  };

  const goToNext = () => {
    setCurrentSlideIndex((prevIndex) => (prevIndex === slides.length - 1 ? 0 : prevIndex + 1));
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    const newSlides = slides.map((slide, index) => {
      if (index === currentSlideIndex) {
        return { ...slide, title: editedTitle, speakerNotes: editedNotes };
      }
      return slide;
    });
    onSlidesChange(newSlides);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(currentSlide.title);
    setEditedNotes(currentSlide.speakerNotes);
    setIsEditing(false);
  };
  
  const handleDownload = () => {
    const markdownContent = slides.map(slide => {
      const title = `## ${slide.title}`;
      const content = slide.content.map(point => `- ${point}`).join('\n');
      const speakerNotes = `### Speaker Notes\n${slide.speakerNotes}`;
      return `${title}\n\n${content}\n\n${speakerNotes}`;
    }).join('\n\n---\n\n');

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    setImageError(null);
    try {
      const prompt = `Create a visually engaging and educational image for a presentation slide titled "${currentSlide.title}". The main points on the slide are: ${currentSlide.content.join('; ')}. The image should be clean, modern, and relevant to the topic, in a 16:9 aspect ratio. Avoid putting any text in the image. Style: vibrant, illustrative.`;
      const imageUrl = await generateImage(prompt);
      const newSlides = slides.map((slide, index) => {
        if (index === currentSlideIndex) {
          return { ...slide, imageUrl };
        }
        return slide;
      });
      onSlidesChange(newSlides);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsGeneratingImage(false);
    }
  };


  if (!currentSlide) {
      return null;
  }
  
  return (
    <div className="flex flex-col h-full bg-gray-800/50 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 sm:p-8 flex-grow flex items-center justify-center bg-black aspect-video">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full h-full items-center">
          {/* Image Panel */}
          <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center shadow-inner border border-gray-700 relative overflow-hidden">
            {isGeneratingImage ? (
              <Loader message="Generating image..." />
            ) : imageError ? (
               <div className="text-center text-red-400 p-4">
                 <p className="font-semibold">Image Generation Failed</p>
                 <p className="text-sm">{imageError}</p>
                 <button onClick={handleGenerateImage} className="mt-4 flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-500 transition duration-200 shadow-md">
                    Try Again
                 </button>
               </div>
            ) : currentSlide.imageUrl ? (
              <img src={currentSlide.imageUrl} alt={currentSlide.title} className="w-full h-full object-cover"/>
            ) : (
              <div className="text-center">
                <p className="text-gray-400 mb-4">No image for this slide.</p>
                <button onClick={handleGenerateImage} className="flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-500 transition duration-200 shadow-md">
                  <GenerateIcon />
                  Generate Image
                </button>
              </div>
            )}
          </div>
          {/* Text Content Panel */}
          <div className="w-full h-full p-4 sm:p-6 flex flex-col justify-center">
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-2xl md:text-3xl font-bold text-indigo-400 mb-6 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
                aria-label="Slide title editor"
              />
            ) : (
              <h2 className="text-2xl md:text-3xl font-bold text-indigo-400 mb-6">{currentSlide.title}</h2>
            )}
            <ul className="space-y-3 list-disc list-inside text-md md:text-lg text-gray-300">
              {currentSlide.content.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
      {/* Speaker Notes Section */}
      <div className="p-6 bg-gray-900 border-y border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-300">Speaker Notes</h3>
          {!isEditing ? (
            <button onClick={handleEdit} className="flex items-center gap-2 text-sm bg-gray-700 text-gray-200 font-semibold px-3 py-1 rounded-md hover:bg-gray-600 transition duration-200">
              <EditIcon />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={handleSave} className="flex items-center gap-2 text-sm bg-indigo-600 text-white font-semibold px-3 py-1 rounded-md hover:bg-indigo-500 transition duration-200">
                <SaveIcon />
                Save
              </button>
              <button onClick={handleCancel} className="text-sm text-gray-400 font-semibold px-3 py-1 rounded-md hover:bg-gray-700 hover:text-white transition duration-200">
                Cancel
              </button>
            </div>
          )}
        </div>
        <div>
          {isEditing ? (
            <textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              className="w-full h-28 bg-gray-800 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 resize-none"
              aria-label="Speaker notes editor"
            />
          ) : (
            <p className="text-gray-400 text-sm h-28 overflow-y-auto bg-gray-900/50 p-3 rounded-lg border border-transparent">
              {currentSlide.speakerNotes}
            </p>
          )}
        </div>
      </div>
      
      {/* Controls */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onPlayVideo}
            className="flex items-center gap-2 bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-500 transition duration-200"
          >
            <PlayIcon />
            Play as Video
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-500 transition duration-200"
          >
            <DownloadIcon />
            Download
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={goToPrevious} className="p-2 rounded-full hover:bg-gray-700 transition duration-200">
            <ChevronLeftIcon />
          </button>
          <span className="text-gray-400 font-mono">
            {currentSlideIndex + 1} / {slides.length}
          </span>
          <button onClick={goToNext} className="p-2 rounded-full hover:bg-gray-700 transition duration-200">
            <ChevronRightIcon />
          </button>
        </div>

        <div className="w-40"></div> {/* Spacer to balance the layout */}
      </div>
    </div>
  );
};

export default SlideViewer;