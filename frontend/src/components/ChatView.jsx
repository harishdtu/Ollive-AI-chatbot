import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, StopCircle, Plus, ChevronDown } from 'lucide-react';
import { api, streamChat } from '../lib/api';

const MODELS = [
  {
    value: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'google',
  },
  {
    value: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'google',
  },
  {
    value: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'google',
  },
  {
    value: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    provider: 'openai',
  },
   {
    value: 'google/gemini-2.5-flash-preview',
    label: 'Gemini 2.5 Flash',
    provider: 'google',
  },
  {
    value: 'openai/gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'openai',
  },
];

export default function ChatView({ conversationId, onCreated, onCancelled }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [model, setModel] = useState(MODELS[0].value);
  const [convStatus, setConvStatus] = useState('active');
  const [latestMeta, setLatestMeta] = useState(null);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Load existing conversation
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setConvStatus('active');
      setLatestMeta(null);
      return;
    }
    api.getConversation(conversationId).then(({ conversation, messages }) => {
      setMessages(messages);
      setConvStatus(conversation.status);
    });
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    let convId = conversationId;

    // Create conversation if needed
    if (!convId) {
      const conv = await api.createConversation({
        model,
        provider: MODELS.find(m => m.value === model)?.provider || 'gemini',
        title: text.slice(0, 60),
      });
      convId = conv.id;
      onCreated?.(convId);
    }

    setInput('');
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: text, created_at: Date.now() }]);
    setStreaming(true);
    setStreamingText('');

    abortRef.current = streamChat({
      conversationId: convId,
      message: text,
      model,
      provider: MODELS.find(m => m.value === model)?.provider || 'gemini',
      onToken: (token) => setStreamingText(prev => prev + token),
      onDone: (meta) => {
        setLatestMeta(meta);
        setStreaming(false);
        setMessages(prev => [
          ...prev,
          { id: meta.message_id, role: 'assistant', content: streamingText + (meta.token || ''), created_at: Date.now() },
        ]);
        setStreamingText('');
        // Re-fetch to get actual saved content
        api.getConversation(convId).then(({ messages }) => setMessages(messages));
      },
      onError: (err) => {
        setStreaming(false);
        setStreamingText('');
        setMessages(prev => [...prev, {
          id: Date.now(), role: 'assistant', content: `Error: ${err}`, created_at: Date.now(), isError: true,
        }]);
      },
    });
  }, [input, streaming, conversationId, model, onCreated, streamingText]);

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
    if (streamingText) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: streamingText, created_at: Date.now() }]);
    }
    setStreamingText('');
  };

  const handleCancel = async () => {
    if (!conversationId) return;
    await api.cancelConversation(conversationId);
    setConvStatus('cancelled');
    onCancelled?.();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isCancelled = convStatus === 'cancelled';

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <span style={styles.headerTitle}>
            {conversationId ? 'Conversation' : 'New chat'}
          </span>
          {conversationId && (
            <span style={{ ...styles.statusBadge, ...(isCancelled ? styles.cancelledBadge : styles.activeBadge) }}>
              {isCancelled ? 'cancelled' : 'active'}
            </span>
          )}
        </div>
        <div style={styles.headerActions}>
          {/* Model selector */}
          <div style={styles.modelSelect}>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              style={styles.select}
            >
              {MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <ChevronDown size={12} style={styles.selectArrow} />
          </div>

          {conversationId && !isCancelled && (
            <button onClick={handleCancel} style={styles.cancelBtn}>
              <StopCircle size={13} />
              Cancel conversation
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && !streaming && (
          <div style={styles.emptyState}>
            <div style={styles.emptyLogo}>Ollive</div>
            <div style={styles.emptyTagline}>is looking for builders.</div>
            <div style={styles.emptyHints}>
              {['Own the product.', 'Ship fast.', 'Cutting-edge work.'].map(h => (
                <span key={h} style={styles.emptyHint}>{h}</span>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={msg.id || i} message={msg} />
        ))}

        {streaming && streamingText && (
          <MessageBubble
            message={{ role: 'assistant', content: streamingText }}
            isStreaming
          />
        )}

        {streaming && !streamingText && (
          <div style={styles.thinking}>
            <span className="blink">●</span>
            <span className="blink" style={{ animationDelay: '.2s' }}>●</span>
            <span className="blink" style={{ animationDelay: '.4s' }}>●</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Latency bar */}
      {latestMeta && (
        <div style={styles.metaBar}>
          <span>⚡ {latestMeta.latency_ms}ms</span>
          <span>↑ {latestMeta.input_tokens} tokens in</span>
          <span>↓ {latestMeta.output_tokens} tokens out</span>
        </div>
      )}

      {/* Input */}
      <div style={styles.inputWrap}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onInput={(e) => {
  e.target.style.height = 'auto';
  e.target.style.height = `${e.target.scrollHeight}px`;
}}
          onKeyDown={onKeyDown}
          placeholder={isCancelled ? 'This conversation was cancelled.' : 'Ask Ollive anything…'}
          disabled={isCancelled || streaming}
          style={styles.textarea}
          rows={1}
        />
        {streaming ? (
          <button onClick={handleStop} style={{ ...styles.sendBtn, ...styles.stopBtn }}>
            <StopCircle size={16} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || isCancelled}
            style={{ ...styles.sendBtn, ...(!input.trim() || isCancelled ? styles.sendBtnDisabled : {}) }}
          >
            <Send size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === 'user';

  const content =
    typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content, null, 2);

  return (
    <div
      style={{
        ...bubbleStyles.wrap,
        ...(isUser ? bubbleStyles.userWrap : {}),
      }}
      className="fade-in"
    >
      <div
        style={{
          ...bubbleStyles.bubble,
          ...(isUser
            ? bubbleStyles.userBubble
            : bubbleStyles.aiBubble),
          ...(message.isError
            ? bubbleStyles.errorBubble
            : {}),
          position: 'relative',
        }}
      >
       

        <ReactMarkdown>
          {content}
        </ReactMarkdown>

        {isStreaming && (
          <span
            className="blink"
            style={{ marginLeft: 2 }}
          >
            ▋
          </span>
        )}
      </div>
    </div>
  );
}
const styles = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: {
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg2)',
    gap: 12,
  },
  headerTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  statusBadge: {
    marginLeft: 8,
    fontSize: 11,
    padding: '2px 7px',
    borderRadius: 4,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  activeBadge: { background: 'rgba(168,230,61,.15)', color: 'var(--accent)' },
  cancelledBadge: { background: 'rgba(245,101,101,.12)', color: 'var(--error)' },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  modelSelect: { position: 'relative', display: 'flex', alignItems: 'center' },
  select: {
    appearance: 'none',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    borderRadius: 7,
    padding: '5px 26px 5px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  selectArrow: { position: 'absolute', right: 8, pointerEvents: 'none', color: 'var(--text3)' },
  cancelBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', border: '1px solid rgba(245,101,101,.3)',
    background: 'rgba(245,101,101,.08)', color: 'var(--error)',
    borderRadius: 7, fontSize: 12, fontWeight: 500,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center',
  },
  emptyLogo: {
    fontFamily: 'var(--font-serif)',
    fontSize: 48,
    color: 'var(--accent)',
    lineHeight: 1.1,
  },
  emptyTagline: {
    fontFamily: 'var(--font-serif)',
    fontSize: 28,
    color: 'var(--text)',
    marginTop: 4,
    marginBottom: 24,
  },
  emptyHints: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  emptyHint: {
    fontSize: 12,
    color: 'var(--text2)',
    background: 'var(--surface)',
    padding: '4px 10px',
    borderRadius: 20,
    border: '1px solid var(--border)',
  },
  thinking: {
    display: 'flex', gap: 4, padding: '12px 20px',
    color: 'var(--accent)', fontSize: 18,
  },
  metaBar: {
    display: 'flex', gap: 16,
    padding: '6px 20px',
    background: 'var(--bg2)',
    borderTop: '1px solid var(--border)',
    fontSize: 11,
    color: 'var(--text3)',
  },
  inputWrap: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg2)',
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
  },
  textarea: {
    flex: 1,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 14px',
    color: 'var(--text)',
    fontSize: 14,
    resize: 'none',
    minHeight: 42,
    maxHeight: 160,
    lineHeight: 1.5,
    outline: 'none',
    transition: 'border-color .15s',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 10,
    background: 'var(--accent)', color: '#0d1f0f',
    border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'opacity .15s',
  },
  sendBtnDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  stopBtn: { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--error)' },
};

const bubbleStyles = {
  wrap: { padding: '3px 20px', display: 'flex' },
  userWrap: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '72%',
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  userBubble: {
    background: 'var(--surface2)',
    color: 'var(--text)',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    background: 'transparent',
    color: 'var(--text)',
    borderBottomLeftRadius: 4,
  },
  errorBubble: {
    background: 'rgba(245,101,101,.08)',
    color: 'var(--error)',
    border: '1px solid rgba(245,101,101,.2)',
  },
};
