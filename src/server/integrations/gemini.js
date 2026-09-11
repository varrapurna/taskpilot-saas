import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function enhanceComment(roughComment) {
  const prompt = `You are a professional software developer writing task comments in a project management tool.
Rewrite the following rough comment into a clear, professional, concise update suitable for a Taiga user story comment.
Keep it under 3 sentences. Do not add greetings or sign-offs.

Rough comment: "${roughComment}"

Professional version:`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
