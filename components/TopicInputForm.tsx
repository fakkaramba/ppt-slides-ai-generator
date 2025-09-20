import React, { useState } from 'react';
import { GenerateIcon } from './icons';

interface TopicInputFormProps {
  onSubmit: (topic: string) => void;
  onFileSubmit: (file: File) => void;
  isLoading: boolean;
}

const TopicInputForm: React.FC<TopicInputFormProps> = ({ onSubmit, onFileSubmit, isLoading }) => {
  const [topic, setTopic] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(topic);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSubmit(file);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700">
      <form onSubmit={handleSubmit}>
        <label htmlFor="topic-input" className="block text-lg font-medium text-gray-300 mb-2">
          Enter Course Topic
        </label>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            id="topic-input"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., The History of Ancient Rome"
            className="flex-grow bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !topic.trim()}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed transition duration-200 shadow-md disabled:shadow-none"
          >
            <GenerateIcon />
            {isLoading ? 'Generating...' : 'Generate Slides'}
          </button>
        </div>
      </form>

      <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-gray-600"></div>
          <span className="flex-shrink mx-4 text-gray-400">OR</span>
          <div className="flex-grow border-t border-gray-600"></div>
      </div>

      <div>
        <label htmlFor="file-upload" className="block text-lg font-medium text-gray-300 mb-2">
          Import from .pptx file
        </label>
        <input 
          id="file-upload"
          type="file"
          accept=".pptx"
          onChange={handleFileChange}
          disabled={isLoading}
          className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600/20 file:text-indigo-300 hover:file:bg-indigo-600/40"
        />
      </div>
    </div>
  );
};

export default TopicInputForm;