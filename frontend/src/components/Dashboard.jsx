import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../lib/api';
import { format } from 'date-fns';

const ACCENT = '#a8e63d';
const PIE_COLORS = ['#a8e63d', '#4aed8c', '#34c0a0', '#2a9d8f', '#e9c46a'];

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ ...card.wrap, ...(accent ? card.accentWrap : {}) }}>
      <div style={card.label}>{label}</div>
      <div style={{ ...card.value, ...(accent ? card.accentValue : {}) }}>{value ?? '—'}</div>
      {sub && <div style={card.sub}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = Date.now() - range * 24 * 60 * 60 * 1000;
    const data = await api.getMetrics(since);
    setMetrics(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [range]);

  if (loading) return <div style={styles.loading}>Loading metrics…</div>;
  if (!metrics) return null;

  const { totals, byProvider, byModel, hourly, daily, convStats } = metrics;

  const errorRate = totals.total_requests > 0
    ? ((totals.errors / totals.total_requests) * 100).toFixed(1)
    : '0.0';

  const dailyChartData = daily.map(d => ({
    name: format(d.day_ts, 'MMM d'),
    requests: d.requests,
    errors: d.errors,
    latency: Math.round(d.avg_latency_ms || 0),
    tokens: d.tokens,
  }));

  const hourlyChartData = hourly.map(h => ({
    name: format(h.hour_ts, 'HH:mm'),
    latency: Math.round(h.avg_latency_ms || 0),
    requests: h.requests,
    errors: h.errors,
  }));

  const providerData = byProvider.map(p => ({
    name: p.provider,
    value: p.requests,
  }));

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Dashboard</h2>
          <p style={styles.subtitle}>Latency · Throughput · Errors</p>
        </div>
        <div style={styles.rangePicker}>
          {[1, 7, 30].map(d => (
            <button
              key={d}
              onClick={() => setRange(d)}
              style={{ ...styles.rangeBtn, ...(range === d ? styles.rangeBtnActive : {}) }}
            >{d}d</button>
          ))}
          <button onClick={load} style={styles.rangeBtn}>↻</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={styles.stats}>
        <StatCard label="Total Requests"   value={totals.total_requests?.toLocaleString()}  accent />
        <StatCard label="Avg Latency"      value={totals.avg_latency_ms ? `${Math.round(totals.avg_latency_ms)}ms` : '—'} />
        <StatCard label="Error Rate"       value={`${errorRate}%`} sub={`${totals.errors} errors`} />
        <StatCard label="Total Tokens"     value={totals.total_tokens?.toLocaleString()} sub={`↑${totals.total_input_tokens?.toLocaleString()} ↓${totals.total_output_tokens?.toLocaleString()}`} />
        <StatCard label="Conversations"    value={convStats.total} sub={`${convStats.active} active · ${convStats.cancelled} cancelled`} />
        <StatCard label="Max Latency"      value={totals.max_latency_ms ? `${totals.max_latency_ms}ms` : '—'} />
      </div>

      {/* Charts */}
      <div style={styles.charts}>
        {/* Requests + Errors over time */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>Requests & Errors (daily)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gErr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f56565" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f56565" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={chartTick} axisLine={false} tickLine={false} />
              <YAxis tick={chartTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="requests" stroke={ACCENT} fill="url(#gReq)" strokeWidth={2} name="Requests" />
              <Area type="monotone" dataKey="errors" stroke="#f56565" fill="url(#gErr)" strokeWidth={1.5} name="Errors" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Latency heatmap (hourly) */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>Avg Latency (last 24h, ms)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={chartTick} axisLine={false} tickLine={false} />
              <YAxis tick={chartTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="latency" fill={ACCENT} radius={[3, 3, 0, 0]} name="Latency (ms)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Token throughput */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>Token Throughput (daily)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={chartTick} axisLine={false} tickLine={false} />
              <YAxis tick={chartTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="tokens" fill="#4aed8c" radius={[3, 3, 0, 0]} name="Tokens" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Provider breakdown */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>Requests by Provider</div>
          {providerData.length === 0 ? (
            <div style={styles.noData}>No data</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={providerData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                    {providerData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {providerData.map((p, i) => (
                  <div key={p.name} style={styles.legendItem}>
                    <div style={{ ...styles.legendDot, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span style={styles.legendLabel}>{p.name}</span>
                    <span style={styles.legendVal}>{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top models table */}
      {byModel.length > 0 && (
        <div style={styles.tableCard}>
          <div style={styles.chartTitle}>Top Models</div>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Model', 'Requests', 'Avg Latency', 'Tokens'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byModel.map(m => (
                <tr key={m.model} style={styles.tr}>
                  <td style={styles.td}><span style={styles.modelPill}>{m.model}</span></td>
                  <td style={styles.td}>{m.requests}</td>
                  <td style={styles.td}>{m.avg_latency_ms ? `${Math.round(m.avg_latency_ms)}ms` : '—'}</td>
                  <td style={styles.td}>{m.tokens?.toLocaleString() || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const chartTick = { fill: '#6a8b6c', fontSize: 11 };
const tooltipStyle = {
  background: '#1e3421', border: '1px solid #2e4d31',
  borderRadius: 8, fontSize: 12, color: '#f0ede6',
};

const card = {
  wrap: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '14px 16px',
  },
  accentWrap: { borderColor: 'rgba(168,230,61,.3)', background: 'rgba(168,230,61,.05)' },
  label: { fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 },
  value: { fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1 },
  accentValue: { color: 'var(--accent)' },
  sub: { fontSize: 11, color: 'var(--text3)', marginTop: 4 },
};

const styles = {
  wrap: { flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--bg)' },
  loading: { padding: 40, color: 'var(--text3)', textAlign: 'center' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--text)', lineHeight: 1.1 },
  subtitle: { fontSize: 12, color: 'var(--text3)', marginTop: 4 },
  rangePicker: { display: 'flex', gap: 4 },
  rangeBtn: {
    padding: '5px 10px', border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text2)',
    borderRadius: 7, fontSize: 12, cursor: 'pointer',
  },
  rangeBtnActive: { background: 'var(--accent)', color: '#0d1f0f', border: '1px solid var(--accent)', fontWeight: 700 },
  stats: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12, marginBottom: 20,
  },
  charts: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: 16, marginBottom: 20,
  },
  chartCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '14px 16px',
  },
  chartTitle: { fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 12 },
  noData: { fontSize: 12, color: 'var(--text3)', padding: '20px 0', textAlign: 'center' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  legendDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  legendLabel: { flex: 1, fontSize: 12, color: 'var(--text2)' },
  legendVal: { fontSize: 12, color: 'var(--text)', fontWeight: 600 },
  tableCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '14px 16px', marginBottom: 20,
  },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 10 },
  th: { fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '.06em' },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { fontSize: 13, color: 'var(--text)', padding: '9px 8px' },
  modelPill: { background: 'var(--surface)', borderRadius: 4, padding: '2px 6px', fontSize: 11, fontFamily: 'monospace', color: 'var(--accent)' },
};
