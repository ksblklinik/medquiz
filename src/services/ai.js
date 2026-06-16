/**
 * MedQuiz AI Service for calling Groq or OpenRouter Chat Completion APIs
 */

export async function queryAI({
  provider,
  apiKey,
  model,
  specialty,
  difficulty,
  tone,
  mode,
  messages, // Array of { role: 'user' | 'assistant', content: string }
  quizHistory, // Array of topics/questions already asked to avoid repetition
}) {
  if (!apiKey) {
    throw new Error('API Key belum diisi. Silakan masukkan API Key Anda di panel pengaturan.');
  }

  const url = provider === 'groq' 
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  let systemPrompt = '';
  let userPrompt = '';

  if (mode === 'quiz') {
    systemPrompt = `You are a professional medical quiz generator. Generate ONE multiple-choice question.
Specialty: ${specialty}
Difficulty level: ${difficulty}
Explanation Tone: ${tone}

IMPORTANT: You must respond ONLY with a valid JSON object. Do not include markdown formatting like \`\`\`json or any other text.
The JSON structure MUST be exactly:
{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": 0,
  "explanation": "Detailed explanation in the specified tone"
}
Make sure correct_answer is an integer representing the index of the correct choice (0, 1, 2, or 3).
Ensure the question is medically accurate and appropriate for the selected difficulty level (${difficulty}).
Write the question, options, and explanation in Indonesian, as the user is Indonesian.`;
    
    userPrompt = `Generate a new question. ${quizHistory && quizHistory.length > 0 ? `Avoid asking about the following topics or questions: ${quizHistory.join(', ')}.` : ''}`;
  } else {
    systemPrompt = `You are a medical study assistant chatbot.
Specialty focus: ${specialty}
Expertise/Difficulty level: ${difficulty}
Conversation Tone: ${tone}

Help the user learn about medical concepts, explain topics clearly, and answer questions. Keep your answers accurate, professional yet conforming to the selected tone.
Always reply in Indonesian.`;
  }

  const requestBody = {
    model: model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'google/gemini-2.5-flash'),
    messages: mode === 'quiz' 
      ? [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      : [
          { role: 'system', content: systemPrompt },
          ...messages
        ]
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/ceoks/medquiz';
    headers['X-Title'] = 'MedQuiz AI';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();

  if (mode === 'quiz') {
    try {
      // Sometimes models wrap JSON in markdown blocks even if told not to
      const cleanContent = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      return JSON.parse(cleanContent);
    } catch (e) {
      console.error('Failed to parse JSON response:', content);
      throw new Error('Gagal memproses soal kuis dari AI. Silakan coba lagi.');
    }
  }

  return content;
}
