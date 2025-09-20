import React, { useState, useCallback } from 'react';
import { Slide, ViewMode } from './types';
import { generateSlidesContent } from './services/geminiService';
import TopicInputForm from './components/TopicInputForm';
import SlideViewer from './components/SlideViewer';
import VideoPlayer from './components/VideoPlayer';
import Loader from './components/Loader';
import { LogoIcon } from './components/icons';
import JSZip from 'jszip';


const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.EDITOR);

  const handleGenerateSlides = useCallback(async (newTopic: string) => {
    if (!newTopic.trim()) {
      setError('Please enter a topic.');
      return;
    }
    setLoadingMessage("Generating your presentation... This may take a moment.");
    setIsLoading(true);
    setError(null);
    setSlides([]);
    setTopic(newTopic);

    try {
      const generatedSlides = await generateSlidesContent(newTopic);
      setSlides(generatedSlides);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const parsePptx = async (file: File): Promise<Slide[]> => {
    const parser = new DOMParser();
    const zip = await JSZip.loadAsync(file);
    
    const presentationXmlFile = zip.file("ppt/presentation.xml");
    if (!presentationXmlFile) throw new Error("Invalid PPTX file: presentation.xml not found.");
    const presentationXml = parser.parseFromString(await presentationXmlFile.async("string"), "application/xml");
    const slideIdNodes = presentationXml.getElementsByTagName("p:sldId");

    const slidePromises = Array.from(slideIdNodes).map(async (slideIdNode) => {
      const rId = slideIdNode.getAttribute("r:id");
      if (!rId) return null;

      // Get slide file path from presentation rels
      const presRelsFile = zip.file(`ppt/_rels/presentation.xml.rels`);
      if (!presRelsFile) throw new Error("presentation.xml.rels not found");
      const presRelsXml = parser.parseFromString(await presRelsFile.async("string"), "application/xml");
      const slideRelNode = presRelsXml.querySelector(`Relationship[Id="${rId}"]`);
      const slidePath = slideRelNode?.getAttribute("Target");
      if (!slidePath) return null;

      const slideFile = zip.file(`ppt/${slidePath}`);
      if (!slideFile) return null;
      const slideXml = parser.parseFromString(await slideFile.async("string"), "application/xml");

      // Extract title
      const titleShape = slideXml.querySelector('p\\:spTree p\\:sp p\\:nvSpPr p\\:nvPr p\\:ph[type="title"], p\\:spTree p\\:sp p\\:nvSpPr p\\:nvPr p\\:ph[type="ctrTitle"]');
      const titleSp = titleShape?.closest("p\\:sp");
      const title = titleSp ? Array.from(titleSp.getElementsByTagName("a:t")).map(t => t.textContent).join("") : "Untitled Slide";

      // Extract content
      const contentShape = slideXml.querySelector('p\\:spTree p\\:sp p\\:nvSpPr p\\:nvPr p\\:ph[type="body"]');
      const contentSp = contentShape?.closest("p\\:sp");
      const content = contentSp ? Array.from(contentSp.getElementsByTagName("a:p")).map(p => Array.from(p.getElementsByTagName("a:t")).map(t => t.textContent).join("")) : [];

      // Extract speaker notes
      const slideRelsFile = zip.file(`ppt/slides/_rels/${slidePath.split('/').pop()}.rels`);
      let speakerNotes = "";
      if (slideRelsFile) {
        const slideRelsXml = parser.parseFromString(await slideRelsFile.async("string"), "application/xml");
        const notesRel = slideRelsXml.querySelector('Relationship[Type*="notesSlide"]');
        const notesPath = notesRel?.getAttribute("Target");
        if (notesPath) {
          const notesFile = zip.file(`ppt/slides/${notesPath.replace('../', '')}`);
          if (notesFile) {
            const notesXml = parser.parseFromString(await notesFile.async("string"), "application/xml");
            speakerNotes = Array.from(notesXml.getElementsByTagName("a:t")).map(t => t.textContent).join("");
          }
        }
      }

      return { title, content, speakerNotes };
    });

    const parsedSlides = (await Promise.all(slidePromises)).filter((s): s is Slide => s !== null);
    if(parsedSlides.length === 0) throw new Error("Could not find any slides in the PPTX file.");
    return parsedSlides;
  };

  const handleImportSlides = useCallback(async (file: File) => {
    setLoadingMessage("Parsing your .pptx file...");
    setIsLoading(true);
    setError(null);
    setSlides([]);
    setTopic(`Imported from ${file.name}`);

    try {
      const importedSlides = await parsePptx(file);
      setSlides(importedSlides);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unknown error occurred while parsing the file.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return <Loader message={loadingMessage} />;
    }
    if (error) {
      return <div className="text-center text-red-400 mt-8 bg-red-900/20 p-4 rounded-lg">{error}</div>;
    }
    if (slides.length > 0) {
      if (viewMode === ViewMode.PLAYER) {
        return <VideoPlayer slides={slides} onClose={() => setViewMode(ViewMode.EDITOR)} onSlidesChange={setSlides} />;
      }
      return <SlideViewer slides={slides} onPlayVideo={() => setViewMode(ViewMode.PLAYER)} onSlidesChange={setSlides} />;
    }
    return (
      <div className="text-center text-gray-400 mt-12">
        <h2 className="text-2xl font-semibold mb-2">Ready to create?</h2>
        <p>Enter your topic above or import a .pptx file to generate your presentation slides.</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      <header className="bg-gray-800/50 backdrop-blur-sm shadow-lg p-4 sticky top-0 z-10 border-b border-gray-700">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <LogoIcon />
            <h1 className="text-2xl font-bold tracking-tight text-white">AI Presentation Generator</h1>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto p-4 md:p-8 flex-grow flex flex-col">
        <div className="w-full max-w-4xl mx-auto">
          <TopicInputForm onSubmit={handleGenerateSlides} onFileSubmit={handleImportSlides} isLoading={isLoading} />
        </div>
        <div className="mt-8 flex-grow w-full max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </main>

      <footer className="text-center p-4 text-gray-500 text-sm border-t border-gray-800">
        <p>Built with React, Tailwind CSS, and the Gemini API.</p>
      </footer>
    </div>
  );
};

export default App;