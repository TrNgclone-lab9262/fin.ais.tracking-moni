/**
 * @file geminiChatService.ts
 * @description Client-side SSE bridge & local thread persistence for multi-turn Gemini Chatbot.
 * Never imports @google/genai on the client — all SDK calls happen on the server (/api/ai/chat).
 */

import {
  ChatbotModelMode,
  ChatbotRoleId,
  ChatbotThinkingLevelName,
  ChatTurnMessage,
  FinancialChatContextSnapshot,
} from './geminiChatConfig';

const STORAGE_KEY_PREFIX = 'HOME_MONI_AI_CHAT_V1_';

export interface StreamGeminiChatParams {
  message: string;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  roleId: ChatbotRoleId;
  mode: ChatbotModelMode;
  financialContext?: FinancialChatContextSnapshot | null;
  signal?: AbortSignal;
  onChunk: (chunkText: string) => void;
  onMeta?: (meta: { model: string; thinkingLevel: ChatbotThinkingLevelName }) => void;
}

export interface StreamGeminiChatResult {
  fullText: string;
  model: string;
  thinkingLevel: ChatbotThinkingLevelName;
}

export class GeminiChatRequestError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = 'GeminiChatRequestError';
    this.code = options?.code;
    this.status = options?.status;
  }
}

export async function streamGeminiChat(
  params: StreamGeminiChatParams
): Promise<StreamGeminiChatResult> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      message: params.message,
      history: params.history,
      roleId: params.roleId,
      mode: params.mode,
      financialContext: params.financialContext ?? undefined,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    let errorMessage = `Lỗi kết nối AI (${response.status}).`;
    let errorCode: string | undefined;
    try {
      const payload = (await response.json()) as { error?: string; code?: string };
      if (payload?.error) errorMessage = payload.error;
      if (payload?.code) errorCode = payload.code;
    } catch {
      // ignore json parse failure
    }
    throw new GeminiChatRequestError(errorMessage, {
      code: errorCode,
      status: response.status,
    });
  }

  if (!response.body) {
    throw new GeminiChatRequestError('Máy chủ không trả về luồng dữ liệu hội thoại.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  let usedModel = 'gemini-4-hydrogen';
  let usedThinking: ChatbotThinkingLevelName = 'MEDIUM';

  const processEventBlock = (block: string) => {
    const lines = block.split('\n');
    const dataLines = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) return;

    const rawJson = dataLines.join('\n').trim();
    if (!rawJson) return;

    const event = JSON.parse(rawJson) as
      | { type: 'meta'; model: string; thinkingLevel: ChatbotThinkingLevelName }
      | { type: 'chunk'; text: string }
      | { type: 'done'; model?: string; thinkingLevel?: ChatbotThinkingLevelName }
      | { type: 'error'; error: string; code?: string; status?: number };

    if (event.type === 'meta') {
      usedModel = event.model;
      usedThinking = event.thinkingLevel;
      params.onMeta?.({ model: event.model, thinkingLevel: event.thinkingLevel });
    } else if (event.type === 'chunk') {
      if (event.text) {
        fullText += event.text;
        params.onChunk(event.text);
      }
    } else if (event.type === 'done') {
      if (event.model) usedModel = event.model;
      if (event.thinkingLevel) usedThinking = event.thinkingLevel;
    } else if (event.type === 'error') {
      throw new GeminiChatRequestError(event.error || 'Lỗi trong quá trình Gemini phản hồi.', {
        code: event.code,
        status: event.status,
      });
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        if (block.trim()) {
          processEventBlock(block);
        }
      }
    }
    if (done) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        processEventBlock(buffer);
      }
      break;
    }
  }

  return {
    fullText,
    model: usedModel,
    thinkingLevel: usedThinking,
  };
}

export function loadChatThread(roleId: ChatbotRoleId): ChatTurnMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${roleId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ChatTurnMessage =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        (item.role === 'user' || item.role === 'model') &&
        typeof item.text === 'string'
    );
  } catch {
    return [];
  }
}

export function saveChatThread(roleId: ChatbotRoleId, messages: ChatTurnMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${roleId}`,
      JSON.stringify(messages.slice(-40))
    );
  } catch {
    // ignore storage quota errors
  }
}

export function clearChatThread(roleId: ChatbotRoleId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${STORAGE_KEY_PREFIX}${roleId}`);
  } catch {
    // ignore
  }
}
