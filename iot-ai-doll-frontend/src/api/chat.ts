/**
 * AI 聊天 API - SSE 流式响应
 */
import type { ChatPayload, ChatMessage } from '../types';

const API_BASE = '/api';

/**
 * 发送聊天消息，通过 SSE 流式接收回复
 * @param payload 聊天请求体
 * @param onMessage 每收到一段文本时的回调
 * @param onDone 流结束回调
 * @param onError 错误回调
 */
export function streamChat(
  payload: ChatPayload,
  onMessage: (chunk: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): AbortController {
  const controller = new AbortController();

  const token = localStorage.getItem('token');

  fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无响应体');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // 按 SSE data: 行拆分
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              onDone();
              return;
            }
            onMessage(data);
          }
        }
      }
      onDone();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err);
      }
    });

  return controller;
}

/**
 * 非流式聊天（备选）
 */
export async function chatOnce(payload: ChatPayload): Promise<ChatMessage> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data as ChatMessage;
}
