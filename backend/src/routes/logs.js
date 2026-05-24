const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { redactPII } = require('../services/pii');
const router = express.Router();

// Zod schema — validates every inbound log payload
const LogSchema = z.object({
  conversation_id:  z.string().uuid(),
  message_id:       z.string().uuid().optional(),
  provider:         z.enum(['anthropic', 'openai', 'google', 'deepseek', 'xai', 'other']),
  model:            z.string().min(1).max(120),
  input_tokens:     z.number().int().min(0).optional(),
  output_tokens:    z.number().int().min(0).optional(),
  latency_ms:       z.number().int().min(0).optional(),
  status:           z.enum(['success', 'error', 'cancelled']).default('success'),
  error_message:    z.string().max(500).optional(),
  input_preview:    z.string().max(500).optional(),
  output_preview:   z.string().max(500).optional(),
  stream:           z.boolean().default(false),
});

// POST /api/logs  — ingest a single inference log
router.post('/', (req, res) => {
  const parse = LogSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
  }

  const data = parse.data;

  // Verify conversation exists
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ?').get(data.conversation_id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  // PII redaction on previews
  const { redacted: safeInput,  wasRedacted: inputRedacted  } = redactPII(data.input_preview  || '');
  const { redacted: safeOutput, wasRedacted: outputRedacted } = redactPII(data.output_preview || '');
  const piiRedacted = inputRedacted || outputRedacted ? 1 : 0;

  const total_tokens = (data.input_tokens || 0) + (data.output_tokens || 0) || null;

  const id = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO inference_logs
      (id, conversation_id, message_id, provider, model,
       input_tokens, output_tokens, total_tokens,
       latency_ms, status, error_message,
       input_preview, output_preview, pii_redacted, stream, created_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.conversation_id, data.message_id || null,
    data.provider, data.model,
    data.input_tokens || null, data.output_tokens || null, total_tokens,
    data.latency_ms || null, data.status, data.error_message || null,
    safeInput || null, safeOutput || null,
    piiRedacted, data.stream ? 1 : 0, now
  );

  // Update conversation timestamp
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, data.conversation_id);

  res.status(201).json({ id, pii_redacted: piiRedacted === 1 });
});

// GET /api/logs?conversation_id=&limit=&offset=
router.get('/', (req, res) => {
  const { conversation_id, limit = 100, offset = 0 } = req.query;
  let rows;
  if (conversation_id) {
    rows = db.prepare(
      'SELECT * FROM inference_logs WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(conversation_id, Number(limit), Number(offset));
  } else {
    rows = db.prepare(
      'SELECT * FROM inference_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(Number(limit), Number(offset));
  }
  res.json({ logs: rows });
});

module.exports = router;
