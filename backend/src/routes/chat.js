const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../db/schema');
const streamProvider = require('../providers');
const router = express.Router();



// Helper: Gemini streaming
async function streamGemini(messages, modelName, res, onDone) {
  console.log(process.env.GEMINI_API_KEY);
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const model = genAI.getGenerativeModel({
    model: modelName || 'gemini-2.5-flash',
  });

  // Convert chat history to Gemini format
  const systemPrompt = `
You are Ollive AI, a fast intelligent assistant inside an inference logging platform.
Be concise, smart, and helpful.
`;

const prompt =
  systemPrompt +
  '\n\n' +
  messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const result = await model.generateContentStream(prompt);

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

  // Gemini doesn't provide exact tokens easily here
  const inputTokens = Math.ceil(prompt.length / 4);
  const outputTokens = Math.ceil(fullText.length / 4);

  onDone({
    text: fullText,
    inputTokens,
    outputTokens,
  });
}

// POST /api/chat/stream
router.post('/stream', async (req, res) => {
  const {
    conversation_id,
    message,
    model = 'gemini-1.5-flash',
    provider = 'google',
  } = req.body;

  if (!conversation_id || !message) {
    return res.status(400).json({
      error: 'conversation_id and message required',
    });
  }

  // Verify conversation exists
  const conv = db
    .prepare(
      "SELECT * FROM conversations WHERE id = ? AND status = 'active'"
    )
    .get(conversation_id);

  if (!conv) {
    return res.status(404).json({
      error: 'Active conversation not found',
    });
  }

  // Save user message
  const userMsgId = uuidv4();
  const now = Date.now();

  db.prepare(
    `
    INSERT INTO messages
    (id, conversation_id, role, content, created_at)
    VALUES (?,?,?,?,?)
  `
  ).run(userMsgId, conversation_id, 'user', message, now);

  // Get history
  const history = db
    .prepare(
      `
    SELECT role, content
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
    LIMIT 20
  `
    )
    .all(conversation_id);

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.flushHeaders();

  const startTime = Date.now();
  const assistantMsgId = uuidv4();

  try {
    let finalText = '';
    let inputTokens = 0;
    let outputTokens = 0;

const result = await streamProvider({
  provider,
  messages: history.map((m) => ({
    role: m.role,
    content: m.content,
  })),
  model,
  res,
});

finalText = result.text;
inputTokens = result.inputTokens;
outputTokens = result.outputTokens;
    const latency = Date.now() - startTime;

    // Save assistant message
    db.prepare(
      `
      INSERT INTO messages
      (id, conversation_id, role, content, created_at)
      VALUES (?,?,?,?,?)
    `
    ).run(
      assistantMsgId,
      conversation_id,
      'assistant',
      finalText,
      Date.now()
    );

    // Update conversation title
    const msgCount = db
      .prepare(
        `
        SELECT COUNT(*) AS c
        FROM messages
        WHERE conversation_id = ?
      `
      )
      .get(conversation_id).c;

    if (msgCount <= 2) {
      const title =
        message.slice(0, 60) +
        (message.length > 60 ? '…' : '');

      db.prepare(
        `
        UPDATE conversations
        SET title = ?, updated_at = ?
        WHERE id = ?
      `
      ).run(title, Date.now(), conversation_id);
    } else {
      db.prepare(
        `
        UPDATE conversations
        SET updated_at = ?
        WHERE id = ?
      `
      ).run(Date.now(), conversation_id);
    }

    // Send done event
    res.write(
      `data: ${JSON.stringify({
        done: true,
        message_id: assistantMsgId,
        latency_ms: latency,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      })}\n\n`
    );

    // Insert inference log
    const logId = uuidv4();

    db.prepare(`
      INSERT INTO inference_logs
      (
        id,
        conversation_id,
        message_id,
        provider,
        model,
        input_tokens,
        output_tokens,
        total_tokens,
        latency_ms,
        status,
        input_preview,
        output_preview,
        stream,
        created_at
      )
      VALUES
      (
        ?,?,?,?,?,?,?,?,?, 'success',
        ?,?,?,?
      )
    `).run(
      logId,
      conversation_id,
      assistantMsgId,
      provider,
      model,
      inputTokens,
      outputTokens,
      inputTokens + outputTokens,
      latency,
      message.slice(0, 200),
      finalText.slice(0, 200),
      1,
      Date.now()
    );

    res.end();
  } catch (err) {
    console.error(err);

    const latency = Date.now() - startTime;

    res.write(
      `data: ${JSON.stringify({
        error: err.message,
      })}\n\n`
    );

    res.end();

    // Error logging
    try {
      db.prepare(`
        INSERT INTO inference_logs
        (
          id,
          conversation_id,
          provider,
          model,
          latency_ms,
          status,
          error_message,
          stream,
          created_at
        )
        VALUES
        (
          ?,?,?,?,?, 'error', ?,1,?
        )
      `).run(
        uuidv4(),
        conversation_id,
        provider,
        model,
        latency,
        err.message.slice(0, 500),
        Date.now()
      );
    } catch (_) {}
  }
});

module.exports = router;