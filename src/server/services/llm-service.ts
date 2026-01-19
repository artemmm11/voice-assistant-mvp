import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { config } from '../config';
import { LLMResponseSchema, type LLMResponse } from '../../shared/types';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseUrl,
});

const MAX_INPUT_LENGTH = 2000;

export async function generateLLMResponse(userInput: string): Promise<LLMResponse> {
  if (!userInput.trim()) {
    throw new Error('Empty input provided');
  }

  const truncatedInput = userInput.slice(0, MAX_INPUT_LENGTH);

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that provides structured responses. 
Given the user's spoken input, provide:
1. A brief summary (1-2 sentences)
2. Up to 3 key bullet points
3. A suggested next action or follow-up

Be concise and actionable. The user spoke this message aloud, so be conversational but helpful.`,
        },
        {
          role: 'user',
          content: truncatedInput,
        },
      ],
      response_format: zodResponseFormat(LLMResponseSchema, 'response'),
      max_tokens: 500,
      temperature: 0.7,
    });

    const parsed = completion.choices[0]?.message?.parsed;
    
    if (!parsed) {
      throw new Error('Failed to parse LLM response');
    }

    return parsed;
  } catch (error) {
    console.error('LLM service error:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}
