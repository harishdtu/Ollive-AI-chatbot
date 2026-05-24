const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const router = express.Router();

// List all conversations (newest first)
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
           COUNT(m.id)  AS message_count,
           MAX(m.created_at) AS last_message_at
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT 50
  `).all();
  res.json({ conversations: rows });
});

// Get single conversation with messages
router.get('/:id', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);

  res.json({ conversation: conv, messages });
});

// Create new conversation
router.post('/', (req, res) => {
  const { model = 'claude-sonnet-4-20250514', provider = 'gemini', title } = req.body;
  const id = uuidv4();
  const now = Date.now();
  db.prepare(`
    INSERT INTO conversations (id, title, provider, model, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(id, title || 'New conversation', provider, model, now, now);

  res.status(201).json({ id, title: title || 'New conversation', provider, model, status: 'active', created_at: now });
});

// Cancel a conversation
router.patch('/:id/cancel', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });

  db.prepare("UPDATE conversations SET status = 'cancelled', updated_at = ? WHERE id = ?")
    .run(Date.now(), req.params.id);

  res.json({ success: true, status: 'cancelled' });
});

// Delete conversation
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
