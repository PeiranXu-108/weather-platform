import { apiFetch } from '@/data/apiClient';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

function decodeChunk(chunk: string): string[] {
  return chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6));
}

export async function streamChat(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  userLocation?: { latitude: number; longitude: number }
) {
  const response = await apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, ...(userLocation ? { userLocation } : {}) }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const parts = pending.split('\n\n');
    pending = parts.pop() ?? '';

    parts.forEach((part) => {
      decodeChunk(part).forEach((payload) => {
        if (payload === '[DONE]') return;
        onChunk(payload);
      });
    });
  }
}
