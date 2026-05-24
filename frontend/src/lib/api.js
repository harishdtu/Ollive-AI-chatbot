const BASE = import.meta.env.VITE_API_URL || '/api';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Conversations
  listConversations: ()           => req('/conversations'),
  getConversation:   (id)         => req(`/conversations/${id}`),
  createConversation:(body)       => req('/conversations', { method: 'POST', body }),
  cancelConversation:(id)         => req(`/conversations/${id}/cancel`, { method: 'PATCH' }),
  deleteConversation:(id)         => req(`/conversations/${id}`, { method: 'DELETE' }),

  // Metrics
  getMetrics: (since) => req(`/metrics${since ? `?since=${since}` : ''}`),

  // Logs
  getLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req(`/logs${qs ? '?' + qs : ''}`);
  },
};

/**
 * Stream a chat message via SSE.
 * @returns AbortController (call .abort() to cancel)
 */
export function streamChat({ conversationId, message, model, provider, onToken, onDone, onError }) {
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, message, model, provider }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        onError?.(err.error || `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.token)  onToken?.(evt.token);
            if (evt.done)   onDone?.(evt);
            if (evt.error)  onError?.(evt.error);
          } catch (_) {}
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') onError?.(e.message);
    }
  })();

  return ctrl;
}
