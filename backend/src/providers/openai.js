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

  const completion =
  await openai.chat.completions.create({
    model,
    messages,
    stream: true,
    max_tokens: 1024,
    temperature: 0.7,
  });

  let fullText = '';

  for await (const chunk of completion) {
    const token =
      chunk.choices?.[0]?.delta?.content || '';

    if (token) {
      fullText += token;

      res.write(
        `data: ${JSON.stringify({
          token,
        })}\n\n`
      );
    }
  }

  return {
    text: fullText,
    inputTokens: 0,
    outputTokens: 0,
  };
}

module.exports = streamOpenAI;