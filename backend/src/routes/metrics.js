const express = require('express');
const db = require('../db/schema');
const router = express.Router();

// GET /api/metrics — aggregated stats for dashboards
router.get('/', (req, res) => {
  const { since } = req.query;
  const sinceTs = since ? Number(since) : Date.now() - 7 * 24 * 60 * 60 * 1000; // default 7 days

  // Overall totals
  const totals = db.prepare(`
    SELECT
      COUNT(*)                          AS total_requests,
      SUM(CASE WHEN status='success' THEN 1 ELSE 0 END)  AS successful,
      SUM(CASE WHEN status='error'   THEN 1 ELSE 0 END)  AS errors,
      SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
      AVG(latency_ms)                   AS avg_latency_ms,
      MAX(latency_ms)                   AS max_latency_ms,
      MIN(latency_ms)                   AS min_latency_ms,
      SUM(total_tokens)                 AS total_tokens,
      SUM(input_tokens)                 AS total_input_tokens,
      SUM(output_tokens)                AS total_output_tokens
    FROM inference_logs
    WHERE created_at >= ?
  `).get(sinceTs);

  // By provider
  const byProvider = db.prepare(`
    SELECT provider,
           COUNT(*)         AS requests,
           AVG(latency_ms)  AS avg_latency_ms,
           SUM(total_tokens) AS tokens
    FROM inference_logs WHERE created_at >= ?
    GROUP BY provider
  `).all(sinceTs);

  // By model
  const byModel = db.prepare(`
    SELECT model,
           COUNT(*)          AS requests,
           AVG(latency_ms)   AS avg_latency_ms,
           SUM(total_tokens) AS tokens
    FROM inference_logs WHERE created_at >= ?
    GROUP BY model ORDER BY requests DESC LIMIT 10
  `).all(sinceTs);

  // Hourly latency buckets (last 24h)
  const hourly = db.prepare(`
    SELECT
      (created_at / 3600000) * 3600000  AS hour_ts,
      COUNT(*)                          AS requests,
      AVG(latency_ms)                   AS avg_latency_ms,
      SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errors
    FROM inference_logs
    WHERE created_at >= ?
    GROUP BY hour_ts ORDER BY hour_ts ASC
  `).all(Date.now() - 24 * 60 * 60 * 1000);

  // Error rate over time (daily)
  const daily = db.prepare(`
    SELECT
      (created_at / 86400000) * 86400000  AS day_ts,
      COUNT(*)                            AS requests,
      SUM(CASE WHEN status='error' THEN 1 ELSE 0 END)   AS errors,
      AVG(latency_ms)                     AS avg_latency_ms,
      SUM(total_tokens)                   AS tokens
    FROM inference_logs
    WHERE created_at >= ?
    GROUP BY day_ts ORDER BY day_ts ASC
  `).all(sinceTs);

  // Conversation count
  const convStats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='active'    THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
    FROM conversations WHERE created_at >= ?
  `).get(sinceTs);

  res.json({ totals, byProvider, byModel, hourly, daily, convStats });
});

module.exports = router;
