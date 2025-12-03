import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

// Initialize Gemini Client
// Note: API Key is managed via process.env.API_KEY as per runtime environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Converts a File object to a Base64 string usable by Gemini
 */
const fileToGenerativePart = async (file: File | Blob): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data URL prefix (e.g., "data:video/mp4;base64,")
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type || 'video/mp4',
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Analyzes the video to extract highlights and summary
 */
export const analyzeVideo = async (file: File | Blob): Promise<AnalysisResult> => {
  try {
    const videoPart = await fileToGenerativePart(file);

    // Schema for structured output
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        videoTitle: { type: Type.STRING, description: "为视频内容起一个吸引人的标题" },
        markdownSummary: { type: Type.STRING, description: "视频内容的详细 Markdown 摘要，包含关键点和主题。" },
        clips: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "该片段的简短标题" },
              startTime: { type: Type.NUMBER, description: "开始时间戳（秒）" },
              endTime: { type: Type.NUMBER, description: "结束时间戳（秒）" },
              description: { type: Type.STRING, description: "该片段发生了什么" },
              reasoning: { type: Type.STRING, description: "为什么选择这个片段作为精彩部分" }
            },
            required: ["title", "startTime", "endTime", "description", "reasoning"]
          }
        }
      },
      required: ["videoTitle", "markdownSummary", "clips"]
    };

    const prompt = `
      你是一位专业的视频剪辑师。请分析这段视频内容。
      识别出 3 到 6 个最吸引人、最重要或最有趣的片段（高光时刻）。
      
      对于每个高光时刻：
      1. 确定精确的开始和结束时间（秒）。
      2. 提供一个标题和描述。
      3. 解释你选择这个片段作为高光时刻的理由。
      
      此外，请生成整个视频的详细 Markdown 摘要。
      请全部使用中文回复。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Using Gemini 3 Pro as requested
      contents: {
        parts: [
          videoPart,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 2048 } // Allow some thinking for video analysis
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const parsed = JSON.parse(text);
    
    // Add IDs to clips for React keys
    const result: AnalysisResult = {
      ...parsed,
      clips: parsed.clips.map((clip: any, index: number) => ({
        ...clip,
        id: `clip-${index}-${Date.now()}`
      }))
    };

    return result;

  } catch (error) {
    console.error("Error analyzing video:", error);
    throw error;
  }
};