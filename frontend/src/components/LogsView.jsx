import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { format } from 'date-fns';

const STATUS_COLORS = { success: '#a8e63d', error: '#f56565', cancelled: '#f6ad55' };

export default function LogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE = 50;

  const load = async () => {
    setLoading(true);
    const { logs } = await api.getLogs({ limit: PAGE, offset: page * PAGE });
    setLogs(logs);
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Inference Logs</h2>
          <p style={styles.subtitle}>Raw log entries from the ingestion pipeline</p>
        </div>
        <button onClick={load} style={styles.refreshBtn}>↻ Refresh</button>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Time', 'Provider', 'Model', 'Status', 'Latency', 'Tokens', 'Input preview', 'PII'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={styles.loadingCell}>Loading…</td></tr>
            )}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={8} style={styles.loadingCell}>No logs yet. Send a chat message to generate logs.</td></tr>
            )}
            {logs.map(log => (
              <tr key={log.id} style={styles.row}>
                <td style={styles.td}>{format(log.created_at, 'MMM d HH:mm:ss')}</td>
                <td style={styles.td}>
                  <span style={styles.providerBadge}>{log.provider}</span>
                </td>
                <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)' }}>
                  {log.model.length > 24 ? log.model.slice(0, 22) + '…' : log.model}
                </td>
                <td style={styles.td}>
                  <span style={{ ...styles.statusDot, background: STATUS_COLORS[log.status] || '#888' }} />
                  <span style={{ color: STATUS_COLORS[log.status] || 'var(--text2)', fontSize: 12 }}>
                    {log.status}
                  </span>
                </td>
                <td style={styles.td}>{log.latency_ms != null ? `${log.latency_ms}ms` : '—'}</td>
                <td style={styles.td}>{log.total_tokens ?? '—'}</td>
                <td style={{ ...styles.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)', fontSize: 12 }}>
                  {log.input_preview || '—'}
                </td>
                <td style={styles.td}>
                  {log.pii_redacted
                    ? <span style={styles.piiBadge}>redacted</span>
                    : <span style={styles.cleanBadge}>clean</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.pagination}>
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={styles.pageBtn}>← Prev</button>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>Page {page + 1}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE} style={styles.pageBtn}>Next →</button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: 24, overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--text)', lineHeight: 1.1 },
  subtitle: { fontSize: 12, color: 'var(--text3)', marginTop: 4 },
  refreshBtn: {
    padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
    color: 'var(--text2)', borderRadius: 7, fontSize: 13,
  },
  tableWrap: { flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg2)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    fontSize: 11, fontWeight: 600, color: 'var(--text3)', textAlign: 'left',
    padding: '10px 12px', borderBottom: '1px solid var(--border)',
    textTransform: 'uppercase', letterSpacing: '.06em',
    position: 'sticky', top: 0, background: 'var(--bg2)',
  },
  row: { borderBottom: '1px solid rgba(46,77,49,.5)', transition: 'background .1s' },
  td: { fontSize: 13, color: 'var(--text)', padding: '9px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' },
  providerBadge: {
    background: 'rgba(168,230,61,.1)', color: 'var(--accent)',
    border: '1px solid rgba(168,230,61,.2)',
    borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600,
  },
  statusDot: { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', marginRight: 5 },
  piiBadge: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    background: 'rgba(246,173,85,.12)', color: 'var(--warn)',
    borderRadius: 3, padding: '2px 5px',
  },
  cleanBadge: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    background: 'rgba(168,230,61,.08)', color: 'var(--accent)',
    borderRadius: 3, padding: '2px 5px',
  },
  loadingCell: { textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 16 },
  pageBtn: {
    padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
    color: 'var(--text2)', borderRadius: 7, fontSize: 12,
  },
};
