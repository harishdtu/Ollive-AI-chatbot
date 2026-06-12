const OpenAI = require('openai');

async function streamOpenAI({
  messages,
  model,
  res,
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });

 const completion = await openai.chat.completions.create({
  model,
  messages,
  stream: true,
  stream_options: { include_usage: true },  // add this
  max_tokens: 1024,
  temperature: 0.7,
});

let fullText = '';
let inputTokens = 0;
let outputTokens = 0;

for await (const chunk of completion) {
  const token = chunk.choices?.[0]?.delta?.content || '';
  if (token) {
    fullText += token;
    res.write(`data: ${JSON.stringify({ token })}\n\n`);
  }
  // usage arrives in the final chunk
  if (chunk.usage) {
    inputTokens = chunk.usage.prompt_tokens || 0;
    outputTokens = chunk.usage.completion_tokens || 0;
  }
}

return { text: fullText, inputTokens, outputTokens };
}

module.exports = streamOpenAI;