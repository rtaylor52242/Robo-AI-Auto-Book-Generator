import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Chapter, BookType, BookInspiration } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateInspiration = async (bookType: BookType, bookCategory: string, tone: string): Promise<BookInspiration> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are a creative muse for authors. Your task is to generate a compelling and unique book idea based on specific criteria.
The book is a ${bookType} book in the '${bookCategory}' category with a ${tone} tone.
Based on this, generate a title, a subtitle, and a short 1-2 sentence description.
Provide the output as a single JSON object.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "The main title of the book." },
                        subtitle: { type: Type.STRING, description: "A catchy subtitle or tagline." },
                        description: { type: Type.STRING, description: "A 1-2 sentence description of the book's plot or topic." },
                    },
                    required: ['title', 'subtitle', 'description'],
                },
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        if (result && typeof result.title === 'string' && typeof result.description === 'string') {
            return result as BookInspiration;
        } else {
            throw new Error("Invalid format for book inspiration.");
        }

    } catch (error) {
        console.error("Error generating inspiration:", error);
        throw new Error("Failed to generate an idea. Please try again.");
    }
};

export const generateTableOfContents = async (description: string, numChapters: number, bookType: BookType, bookCategory: string, tone: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert author's assistant. Generate a table of contents for a ${bookType} book in the '${bookCategory}' category, based on this description: "${description}". The book's tone should be ${tone}. It must have exactly ${numChapters} chapters. Return the result as a JSON array of strings, where each string is a compelling chapter title. For example: ["The Awakening", "A Shadow Falls"]. Do not include markdown formatting or chapter numbers in the titles.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
      },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    
    if (Array.isArray(result) && result.every(item => typeof item === 'string')) {
        return result;
    } else {
        throw new Error("Invalid format for table of contents.");
    }

  } catch (error) {
    console.error("Error generating table of contents:", error);
    throw new Error("Failed to generate table of contents. Please try a different topic.");
  }
};

export const generateChapterContent = async (bookTitle: string, description: string, chapterTitle: string, wordCount: number, bookType: BookType, bookCategory: string, tone: string, previousChapterContent?: string): Promise<string> => {
  try {
    const styleInstruction = bookType === 'fiction' 
        ? "Your writing style should be narrative, creative, and engaging. Focus on storytelling, character development, and vivid descriptions."
        : "Your writing style should be informative, clear, and well-structured. Focus on facts, logical arguments, and clarity.";

    let prompt = `You are a professional author writing a ${bookType} book in the '${bookCategory}' category, titled "${bookTitle}". The book's overall description is "${description}" and the desired tone is ${tone}.
Your current task is to write the chapter titled "${chapterTitle}". ${styleInstruction} Make the chapter approximately ${wordCount} words long.`;

    if (previousChapterContent) {
      const summary = previousChapterContent.length > 1000 ? previousChapterContent.substring(previousChapterContent.length - 1000) : previousChapterContent;
      prompt += `\n\nYou must continue the story smoothly from the previous chapter. The last part of the previous chapter was:\n\n---\n${summary}\n---\n\nWrite the content for "${chapterTitle}" now, ensuring a natural transition. Do not repeat the title in the chapter content.`;
    } else {
      prompt += ` This is the first chapter, so start the book from the beginning. Do not repeat the title in the chapter content.`
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro", // Using pro for better creative writing
      contents: prompt,
       config: {
        temperature: 0.75,
        topP: 0.95,
      },
    });
    
    return response.text.trim();
  } catch (error) {
    console.error(`Error generating content for chapter "${chapterTitle}":`, error);
    throw new Error(`Failed to generate content for chapter: ${chapterTitle}`);
  }
};


export const assembleBook = async (title: string, subtitle: string, author: string, chapters: Chapter[], bookType: BookType, bookCategory: string, tone: string): Promise<string> => {
    try {
        const chapterData = chapters.map((c, i) => `## Chapter ${i + 1}: ${c.title}\n\n${c.content}`).join('\n\n---\n\n');

        const prompt = `You are a professional book editor. Your task is to assemble a complete book from the provided materials.
The book's title is: "${title}".
The book's subtitle is: "${subtitle}".
The author is: ${author}.
It is a ${bookType} book in the '${bookCategory}' category with a ${tone} tone.

Your output should be a single, cohesive document formatted with Markdown. Follow these steps precisely:
1.  **Preface:** Write a compelling and interesting preface for the book. It should be about 200-300 words and set the tone for the reader. Use the markdown heading "## Preface".
2.  **Table of Contents:** Create a "Table of Contents" section. Use the markdown heading "## Table of Contents". List all the chapter titles, formatted nicely (e.g., "Chapter 1: [Title]").
3.  **Chapters:** Include all the provided chapter content, in order. Ensure each chapter starts with a markdown heading like "## Chapter 1: [Title]".

Here is all the chapter data you need to assemble:
---
${chapterData}
---

Now, generate the complete book content starting from the Preface, following steps 1-3 above. Do NOT include a main title page with the title/author/subtitle (a single '#' heading); that information will be handled separately.
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
        });

        const assembledText = response.text.trim();
        if (!assembledText) {
             throw new Error("The AI returned an empty response while assembling the book. Please try again.");
        }
        return assembledText;

    } catch (error) {
        console.error("Error assembling book:", error);
        throw new Error("Failed to assemble the final book. Please try again.");
    }
};

export const generateBookCover = async (title: string, subtitle: string, author: string | null, bookCategory: string, prompt: string): Promise<string> => {
    try {
        let fullPrompt = `Book cover for a book titled "${title}" in the genre/category of '${bookCategory}'.`;
        if (subtitle) {
            fullPrompt += ` Subtitle: "${subtitle}".`;
        }
        if (author) {
            fullPrompt += ` By author ${author}.`;
        }
        fullPrompt += ` The cover should visually represent this description: "${prompt}". The style should be cinematic and high-quality. If the prompt includes text, a book title, or author name, ensure all text is clearly legible and has significant padding from all edges of the image; the text should not be cut off.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: fullPrompt }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return part.inlineData.data; // This is the base64 string
            }
        }
        throw new Error("Image data not found in response.");

    } catch (error) {
        console.error("Error generating book cover:", error);
        throw new Error("Failed to generate the book cover. The model may have refused the prompt. Please try a different description.");
    }
};