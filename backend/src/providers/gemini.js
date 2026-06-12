const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

async function streamGemini({ messages, model, res }) {
  const geminiModel = genAI.getGenerativeModel({ model });

  // All messages except the last one = history
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  // Last message = current user input
  const lastMessage = messages[messages.length - 1].content;

  const chat = geminiModel.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage);

  let fullText = '';
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      fullText += text;
      res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
    }
  }

  const response = await result.response;
  const inputTokens = response.usageMetadata?.promptTokenCount || 0;
  const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;

  return { text: fullText, inputTokens, outputTokens };
}


module.exports = streamGemini;