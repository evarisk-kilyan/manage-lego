
import { GoogleGenAI, Type } from "@google/genai";
import { LegoSet } from "../types";
import { translations, Language } from "../translations";

export interface LegoSearchResult {
  name: string;
  setNumber: string;
  totalPieces: number;
  totalBags: number;
  theme: string;
  imageUrl?: string;
  sources: { title: string; uri: string }[];
}

// Analyze Lego building performance using Gemini 3 Pro
export const analyzeBuildPerformance = async (sets: LegoSet[], lang: Language = 'fr'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const summary = sets.map(s => ({
    name: s.name,
    pieces: s.totalPieces,
    bags: s.totalBags,
    totalTimeSeconds: s.sessions.reduce((acc, sess) => acc + Number(sess.durationInSeconds), 0),
    bagAverage: s.sessions.length > 0 ? (s.sessions.reduce((acc, sess) => acc + Number(sess.durationInSeconds), 0) / s.sessions.length) : 0
  }));

  const prompt = translations[lang].aiPrompt(JSON.stringify(summary));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text || "Insight error.";
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "Error analyzing stats.";
  }
};

// Identify Lego set from image using Gemini 3 Flash
export const identifySetFromImage = async (base64Image: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          { text: "Identify this Lego set. Return a JSON object with 'name', 'setNumber', 'totalPieces', 'totalBags', and 'theme'." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            setNumber: { type: Type.STRING },
            totalPieces: { type: Type.NUMBER },
            totalBags: { type: Type.NUMBER },
            theme: { type: Type.STRING }
          },
          required: ["name", "setNumber", "totalPieces", "totalBags"]
        }
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Identification error:", error);
    return null;
  }
};

// Search for Lego set details including Image URL using Google Search grounding
export const searchLegoSet = async (query: string): Promise<LegoSearchResult | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the official name, set number, piece count, number of numbered bags, and theme for Lego set "${query}". IMPORTANT: Also find a direct high-quality URL for the set's main box image (usually from lego.com or brickset). Return the details as a JSON object.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            setNumber: { type: Type.STRING },
            totalPieces: { type: Type.NUMBER },
            totalBags: { type: Type.NUMBER },
            theme: { type: Type.STRING },
            imageUrl: { type: Type.STRING, description: "URL to the official product image" }
          },
          required: ["name", "setNumber", "totalPieces", "totalBags", "theme"]
        }
      },
    });

    const data = JSON.parse(response.text || "{}");
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
      .filter(Boolean) || [];

    return { ...data, sources };
  } catch (error) {
    console.error("Search error:", error);
    return null;
  }
};
