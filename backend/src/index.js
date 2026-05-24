require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Security & logging
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

// Rate limiting — generous for demo, tighten in prod
app.use('/api/', rateLimit({ windowMs: 60_000, max: 300 }));

// Routes
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/logs',          require('./routes/logs'));
app.use('/api/metrics',       require('./routes/metrics'));
app.use('/api/chat',          require('./routes/chat'));

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🫒 Ollive backend running on http://localhost:${PORT}`);
});

module.exports = app;
