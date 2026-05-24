import React, { useEffect, useState } from 'react';
import { MessageSquare, LayoutDashboard, List, Plus, X, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

export default function Sidebar({ activeConvId, onSelect, onNewChat, onViewChange, currentView, refresh }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { conversations } = await api.listConversations();
      setConversations(conversations);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [refresh]);

  const handleCancel = async (e, id) => {
    e.stopPropagation();
    await api.cancelConversation(id);
    load();
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    await api.deleteConversation(id);
    load();
  };

  const navItems = [
    { id: 'chat',      icon: MessageSquare,  label: 'Chat' },
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'logs',      icon: List,           label: 'Logs' },
  ];

  return (
    <aside style={styles.aside}>
      {/* Logo */}
      <div style={styles.logo}>
        <span style={styles.logoText}>Ollive</span>
        <span style={styles.logoBadge}>inference</span>
      </div>

      {/* Nav */}
      <nav style={styles.nav}>
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            style={{ ...styles.navBtn, ...(currentView === id ? styles.navBtnActive : {}) }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      <div style={styles.divider} />

      {/* New chat */}
      <button onClick={onNewChat} style={styles.newChatBtn}>
        <Plus size={14} />
        New conversation
      </button>

      {/* Conversation list */}
      <div style={styles.convList}>
        <div style={styles.convListHeader}>
          <span style={styles.convListTitle}>Conversations</span>
          <button onClick={load} style={styles.iconBtn} title="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>

        {loading && <div style={styles.empty}>Loading…</div>}
        {!loading && conversations.length === 0 && (
          <div style={styles.empty}>No conversations yet</div>
        )}

        {conversations.map(conv => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            style={{
              ...styles.convItem,
              ...(activeConvId === conv.id ? styles.convItemActive : {}),
            }}
          >
            <div style={styles.convContent}>
              <div style={styles.convTitle}>
                {conv.title || 'Untitled'}
                {conv.status === 'cancelled' && (
                  <span style={styles.cancelledBadge}>cancelled</span>
                )}
              </div>
              <div style={styles.convMeta}>
                <span>{conv.message_count || 0} msgs</span>
                <span>·</span>
                <span>{formatDistanceToNow(conv.updated_at, { addSuffix: true })}</span>
              </div>
            </div>
            <div style={styles.convActions}>
              {conv.status === 'active' && (
                <button
                  onClick={(e) => handleCancel(e, conv.id)}
                  style={styles.actionBtn}
                  title="Cancel conversation"
                >
                  <X size={11} />
                </button>
              )}
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                title="Delete"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerDot} />
        <span>Backend connected</span>
      </div>
    </aside>
  );
}

const styles = {
  aside: {
    width: 240,
    background: 'var(--bg2)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  logo: {
    padding: '20px 16px 14px',
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  logoText: {
    fontFamily: 'var(--font-serif)',
    fontSize: 22,
    color: 'var(--text)',
    letterSpacing: '-0.5px',
  },
  logoBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    background: 'rgba(168,230,61,0.12)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  nav: {
    padding: '0 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text2)',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 500,
    transition: 'all .15s',
  },
  navBtnActive: {
    background: 'var(--surface)',
    color: 'var(--text)',
  },
  divider: { height: 1, background: 'var(--border)', margin: '12px 0' },
  newChatBtn: {
    margin: '0 8px 8px',
    padding: '8px 12px',
    background: 'var(--accent)',
    color: '#0d1f0f',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'opacity .15s',
  },
  convList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 8px',
  },
  convListHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 4px 6px',
  },
  convListTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text3)',
    padding: 2,
    borderRadius: 4,
    display: 'flex',
  },
  convItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '8px 8px',
    borderRadius: 7,
    cursor: 'pointer',
    transition: 'background .12s',
    marginBottom: 2,
    '&:hover': { background: 'var(--surface)' },
  },
  convItemActive: {
    background: 'var(--surface)',
    outline: '1px solid var(--border)',
  },
  convContent: { flex: 1, minWidth: 0 },
  convTitle: {
    fontSize: 13,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  cancelledBadge: {
    fontSize: 9,
    background: 'rgba(245,101,101,.15)',
    color: 'var(--error)',
    padding: '1px 4px',
    borderRadius: 3,
    flexShrink: 0,
  },
  convMeta: {
    fontSize: 11,
    color: 'var(--text3)',
    display: 'flex',
    gap: 4,
    marginTop: 2,
  },
  convActions: {
    display: 'flex',
    gap: 2,
    flexShrink: 0,
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text3)',
    fontSize: 12,
    padding: '2px 4px',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
  },
  deleteBtn: { color: 'rgba(245,101,101,.6)' },
  empty: {
    fontSize: 12,
    color: 'var(--text3)',
    padding: '12px 4px',
    textAlign: 'center',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: 'var(--text3)',
  },
  footerDot: {
    width: 6, height: 6,
    borderRadius: '50%',
    background: 'var(--accent)',
  },
};
