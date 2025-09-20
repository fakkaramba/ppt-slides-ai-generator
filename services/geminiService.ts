import { GoogleGenAI, Type } from "@google/genai";
import type { Slide } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


const slideSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "The main title of the slide. Keep it concise."
    },
    content: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "An array of 2 to 4 bullet points summarizing the key information for the slide. Each bullet point should be a string."
    },
    speakerNotes: {
      type: Type.STRING,
      description: "Detailed speaker notes for the presenter. This should be a paragraph or two that elaborates on the bullet points, providing context and deeper explanation. This will be used for the audio narration."
    },
  },
  required: ["title", "content", "speakerNotes"],
};

const presentationSchema = {
  type: Type.ARRAY,
  items: slideSchema,
  description: "An array of 5 to 7 slides for the presentation."
};


export const generateSlidesContent = async (topic: string): Promise<Slide[]> => {
  const prompt = `Create a presentation about "${topic}". The presentation should be engaging and informative for a general audience. Generate content for 5 to 7 slides. For each slide, provide a title, a few bullet points for the main content, and detailed speaker notes for narration. The speaker notes should elaborate on the bullet points in a clear, narrative style.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: presentationSchema,
        temperature: 0.7,
      },
    });
    
    const jsonText = response.text.trim();
    const slidesData = JSON.parse(jsonText);

    if (!Array.isArray(slidesData) || slidesData.length === 0) {
        throw new Error("AI returned an invalid or empty slide structure.");
    }

    return slidesData as Slide[];
  } catch (error) {
    console.error("Error generating content from Gemini API:", error);
    throw new Error("Failed to generate presentation slides. The AI model may be temporarily unavailable or the topic could not be processed.");
  }
};

export const generateImage = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '16:9',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        throw new Error("No image was generated.");
    } catch (error) {
        console.error("Error generating image from Gemini API:", error);
        throw new Error("Failed to generate image. The model may be unavailable or the prompt was rejected.");
    }
};