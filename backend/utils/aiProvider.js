const MODEL_DEFAULTS = {
  openai: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  gemini: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
};

const cleanJson = (text = '') => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

const parseJsonResponse = (text, fallback) => {
  try {
    return JSON.parse(cleanJson(text));
  } catch (_) {
    return fallback(text);
  }
};

const callOpenAI = async ({ system, prompt, json = false }) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL_DEFAULTS.openai,
      temperature: 0.4,
      response_format: json ? { type: 'json_object' } : undefined,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    provider: 'openai',
    model: MODEL_DEFAULTS.openai,
    text: data.choices?.[0]?.message?.content || '',
  };
};

const callGemini = async ({ system, prompt, json = false }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_DEFAULTS.gemini}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.4,
        responseMimeType: json ? 'application/json' : 'text/plain',
      },
      contents: [{
        role: 'user',
        parts: [{ text: `${system}\n\n${prompt}` }],
      }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    provider: 'gemini',
    model: MODEL_DEFAULTS.gemini,
    text: data.candidates?.[0]?.content?.parts?.map(part => part.text).join('\n') || '',
  };
};

const callAI = async (request) => {
  if (process.env.OPENAI_API_KEY) return callOpenAI(request);
  if (process.env.GEMINI_API_KEY) return callGemini(request);
  return null;
};

module.exports = { callAI, parseJsonResponse };
