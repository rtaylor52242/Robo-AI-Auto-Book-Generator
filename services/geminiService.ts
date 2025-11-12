import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Chapter, BookType } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface BookMetadata {
    title: string;
    subtitle: string;
    author: string;
    description: string;
    bookType: BookType;
    tone: string;
    numChapters: number;
}

export const generateRandomBookIdea = async (bookType: BookType, tone: string): Promise<Omit<BookMetadata, 'bookType' | 'tone' | 'numChapters'>> => {
    try {
        const prompt = `You are a creative muse. Generate a single, unique, and compelling book idea based on the following genre and tone. The author's name should sound plausible. The description should be a concise and intriguing summary.
- Type: ${bookType}
- Tone/Style: ${tone}
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        subtitle: { type: Type.STRING },
                        author: { type: Type.STRING },
                        description: { type: Type.STRING }
                    },
                    required: ["title", "subtitle", "author", "description"]
                }
            }
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        return result;

    } catch (error) {
        console.error("Error generating random book idea:", error);
        throw new Error("Failed to generate a random book idea. Please try again.");
    }
};

export const generateTableOfContents = async (metadata: BookMetadata): Promise<string[]> => {
  try {
    const prompt = `You are an expert author's assistant. Generate a table of contents for the following book:
- Title: "${metadata.title}"
- Subtitle: "${metadata.subtitle}"
- Type: ${metadata.bookType}
- Tone/Style: ${metadata.tone}
- Description: "${metadata.description}"

The book must have exactly ${metadata.numChapters} chapters. Return the result as a JSON array of strings, where each string is a compelling chapter title. For example: ["The Awakening", "A Shadow Falls"]. Do not include markdown formatting or chapter numbers in the titles.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
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

export const generateChapterContent = async (metadata: BookMetadata, chapterTitle: string, wordCount: number, previousChapterContent?: string): Promise<string> => {
  try {
    let prompt = `You are a professional author writing a ${metadata.bookType} book with the following details:
- Title: "${metadata.title}"
- Subtitle: "${metadata.subtitle}"
- Author: "${metadata.author}"
- Tone/Style: ${metadata.tone}
- Overall Topic: "${metadata.description}"

Your task is to write the chapter titled "${chapterTitle}". The writing style must be ${metadata.tone}. Make the chapter approximately ${wordCount} words long.`;

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
    
    const content = response.text.trim();
    
    // More robust check: ensures the content isn't just whitespace, punctuation, or formatting.
    const hasActualText = /[a-zA-Z0-9]/.test(content);
    // New check: ensure the content has a reasonable length. 100 chars is about 20 words.
    const isLongEnough = content.length > 100;

    if (!content || !hasActualText || !isLongEnough) {
        throw new Error(`The AI returned an empty or insufficient response (less than ~20 words) for chapter "${chapterTitle}". Please try regenerating it.`);
    }

    return content;
  } catch (error) {
    console.error(`Error generating content for chapter "${chapterTitle}":`, error);
    throw new Error(`Failed to generate content for chapter: ${chapterTitle}`);
  }
};


export const assembleBook = async (metadata: BookMetadata, chapters: Chapter[]): Promise<string> => {
    try {
        const chapterTitles = chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n');

        const prompt = `You are a professional book editor. Your task is to write a preface and create a table of contents for a book.

Book Details:
- Title: "${metadata.title}"
- Subtitle: "${metadata.subtitle}"
- Author: "${metadata.author}"
- Type: ${metadata.bookType}
- Tone/Style: ${metadata.tone}
- Overall Topic: "${metadata.description}"

Chapter List:
${chapterTitles}

Your output must be a single document formatted with Markdown. Follow these steps precisely:
1.  **Preface:** Write a compelling preface for the book (200-300 words) that sets the tone. Use the markdown heading "## Preface".
2.  **Table of Contents:** After the preface, create a "Table of Contents" section. Use the markdown heading "## Table of Contents". List all the chapter titles provided above.

Do NOT include any other content. Do not write the chapters themselves.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
        });

        const prefaceAndToc = response.text.trim();
        if (!prefaceAndToc || !prefaceAndToc.toLowerCase().includes('preface') || !prefaceAndToc.toLowerCase().includes('table of contents')) {
             throw new Error("The AI failed to generate the preface and table of contents. Please try again.");
        }

        const chapterData = chapters.map((c, i) => `## Chapter ${i + 1}: ${c.title}\n\n${c.content}`).join('\n\n---\n\n');

        // Assemble the book on the client-side for 100% reliability
        const fullBookContent = `${prefaceAndToc}\n\n---\n\n${chapterData}`;
        
        return fullBookContent;

    } catch (error) {
        console.error("Error assembling book:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to assemble the final book. Please try again.");
    }
};

export const generateBookCover = async (prompt: string, title: string, author: string, addAuthorToCover: boolean): Promise<string> => {
    try {
        const fullPrompt = `A cinematic, high-quality book cover.
- Visual Description: "${prompt}"
- Book Title: "${title}"
- Author: ${addAuthorToCover && author ? `"${author}"` : 'Do not include any author name.'}

Important rules:
- All text (title and author name, if included) must be clearly legible and well-integrated into the design.
- Ensure all text has significant padding from all edges of the image; text should not be cut off.`;
        
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