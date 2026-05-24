const streamGemini = require('./gemini');
const streamOpenAI = require('./openai');

async function streamProvider({
  provider,
  messages,
  model,
  res,
}) {
  switch (provider) {
    case 'google':
      return streamGemini({
        messages,
        model,
        res,
      });

    case 'openai':
      return streamOpenAI({
        messages,
        model,
        res,
      });

    default:
      throw new Error(
        `Unsupported provider: ${provider}`
      );
  }
}

module.exports = streamProvider;