const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

async function streamGemini({
  messages,
  model,
  res,
}) {
  const geminiModel = genAI.getGenerativeModel({
    model,
  });

  const prompt = messages
    .map(
      (m) =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    )
    .join('\n');

  const result =
    await geminiModel.generateContentStream(prompt);

  let fullText = '';

  for await (const chunk of result.stream) {
    const text = chunk.text();

    if (text) {
      fullText += text;

      res.write(
        `data: ${JSON.stringify({
          token: text,
        })}\n\n`
      );
    }
  }

  return {
    text: fullText,
    inputTokens: Math.ceil(prompt.length / 4),
    outputTokens: Math.ceil(fullText.length / 4),
  };
}

module.exports = streamGemini;