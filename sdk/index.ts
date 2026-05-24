/**
 * Ollive Inference SDK
 * ─────────────────────────────────────────────────────────
 * Lightweight wrapper around LLM API calls that captures
 * inference metadata and ships logs to the ingestion endpoint.
 *
 * Usage:
 *   import { OlliveSDK } from '@ollive/sdk';
 *   const sdk = new OlliveSDK({ ingestUrl: 'http://localhost:3001' });
 *   const result = await sdk.chat({ conversationId, messages, model, provider });
 */

export interface InferenceLog {
  conversation_id: string;
  message_id?: string;
  provider: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'xai' | 'other';
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms?: number;
  status: 'success' | 'error' | 'cancelled';
  error_message?: string;
  input_preview?: string;
  output_preview?: string;
  stream?: boolean;
}

export interface SDKOptions {
  ingestUrl: string;       // Base URL of the Ollive backend
  apiKey?: string;         // LLM provider API key (forwarded to provider)
  provider?: string;
  model?: string;
  onLog?: (log: InferenceLog) => void;  // Optional callback for each log
  debug?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  conversationId: string;
  messages: ChatMessage[];
  model?: string;
  provider?: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'xai' | 'other';
  messageId?: string;
}

export class OlliveSDK {
  private opts: SDKOptions;
  private queue: InferenceLog[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: SDKOptions) {
    this.opts = { provider: 'anthropic', model: 'claude-sonnet-4-20250514', ...opts };
  }

  /**
   * Wrap an arbitrary async LLM call with automatic metadata capture.
   */
  async wrap<T>(
    fn: () => Promise<{ result: T; inputTokens?: number; outputTokens?: number; messageId?: string }>,
    meta: Omit<InferenceLog, 'latency_ms' | 'status'>
  ): Promise<T> {
    const start = performance.now();
    try {
      const { result, inputTokens, outputTokens, messageId } = await fn();
      const latency = Math.round(performance.now() - start);

      const log: InferenceLog = {
        ...meta,
        message_id: messageId || meta.message_id,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_ms: latency,
        status: 'success',
      };
      this._enqueue(log);
      return result;
    } catch (err: any) {
      const latency = Math.round(performance.now() - start);
      const log: InferenceLog = {
        ...meta,
        latency_ms: latency,
        status: 'error',
        error_message: err?.message?.slice(0, 500),
      };
      this._enqueue(log);
      throw err;
    }
  }

  /**
   * Send a log immediately (fire-and-forget).
   */
  async sendLog(log: InferenceLog): Promise<void> {
    if (this.opts.debug) console.debug('[OlliveSDK] Sending log', log);
    try {
      await fetch(`${this.opts.ingestUrl}/api/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
    } catch (e) {
      if (this.opts.debug) console.warn('[OlliveSDK] Failed to send log', e);
    }
  }

  // Queue with 500ms debounce flush — batches rapid logs
  private _enqueue(log: InferenceLog) {
    this.opts.onLog?.(log);
    this.queue.push(log);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this._flush(), 500);
  }

  private async _flush() {
    const batch = this.queue.splice(0);
    if (!batch.length) return;
    for (const log of batch) await this.sendLog(log);
  }
}

/**
 * Convenience: parse Anthropic SSE stream and forward tokens to a callback.
 * Returns { fullText, inputTokens, outputTokens }.
 */
export async function parseAnthropicStream(
  response: Response,
  onToken: (token: string) => void
): Promise<{ fullText: string; inputTokens: number; outputTokens: number }> {
  let fullText = '';
  let inputTokens = 0, outputTokens = 0;

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const evt = JSON.parse(raw);
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          fullText += evt.delta.text;
          onToken(evt.delta.text);
        }
        if (evt.type === 'message_start') inputTokens = evt.message?.usage?.input_tokens || 0;
        if (evt.type === 'message_delta')  outputTokens = evt.usage?.output_tokens || 0;
      } catch (_) {}
    }
  }

  return { fullText, inputTokens, outputTokens };
}
