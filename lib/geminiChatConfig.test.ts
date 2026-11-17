import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChatbotSystemInstruction,
  buildGeminiChatHistory,
  CHATBOT_ROLES,
  getChatbotRolePreset,
  resolveChatbotModelRoute,
} from './geminiChatConfig.ts';

test('resolveChatbotModelRoute routes speed and reasoning modes to valid non-paid models', () => {
  const fast = resolveChatbotModelRoute('fast');
  assert.equal(fast.model, 'gemini-3.1-flash-lite');
  assert.equal(fast.thinkingLevel, 'MINIMAL');

  const general = resolveChatbotModelRoute('general');
  assert.equal(general.model, 'gemini-4-hydrogen');
  assert.equal(general.thinkingLevel, 'MEDIUM');

  const complex = resolveChatbotModelRoute('complex');
  assert.equal(complex.model, 'gemini-4-hydrogen');
  assert.equal(complex.thinkingLevel, 'HIGH');

  const deep = resolveChatbotModelRoute('deep');
  assert.equal(deep.model, 'gemini-4-hydrogen');
  assert.equal(deep.thinkingLevel, 'XHIGH');

  const fallback = resolveChatbotModelRoute('unknown_mode');
  assert.equal(fallback.mode, 'general');
  assert.equal(fallback.model, 'gemini-4-hydrogen');
});

test('getChatbotRolePreset returns matching role or default family_advisor', () => {
  assert.equal(CHATBOT_ROLES.length, 4);
  assert.equal(getChatbotRolePreset('skyone_strategist').id, 'skyone_strategist');
  assert.equal(getChatbotRolePreset('non_existent').id, 'family_advisor');
});

test('buildChatbotSystemInstruction includes role prompt and optional financial snapshot', () => {
  const basePrompt = buildChatbotSystemInstruction('budget_coach', null);
  assert.match(basePrompt, /Huấn luyện viên Kiểm soát Ngân sách/);
  assert.doesNotMatch(basePrompt, /Bối cảnh số liệu hiện tại/);

  const contextualPrompt = buildChatbotSystemInstruction('family_advisor', {
    husbandName: 'Anh Chuột',
    wifeName: 'Bé Mèo',
    monthlyIncome: 50_000_000,
    monthlyExpense: 28_000_000,
    savingsAmount: 22_000_000,
    savingsRate: 44,
    skyoneSummary: 'Phú Đông SKYONE Căn B12',
  });
  assert.match(contextualPrompt, /Bối cảnh số liệu hiện tại/);
  assert.match(contextualPrompt, /Anh Chuột & Bé Mèo/);
  assert.match(contextualPrompt, /44%/);
  assert.match(contextualPrompt, /Phú Đông SKYONE Căn B12/);
});

test('buildGeminiChatHistory sanitizes messages, enforces leading user turn, and caps length', () => {
  const sanitized = buildGeminiChatHistory([
    { role: 'model', text: 'Lời chào đầu không hợp lệ ở đầu history' },
    { role: 'user', text: '   ' },
    { role: 'user', text: 'Tháng này nên tiết kiệm bao nhiêu?' },
    { role: 'model', text: 'Khoảng 30-40% thu nhập là tối ưu.' },
    { role: 'system', text: 'ignore me' },
  ]);

  assert.equal(sanitized.length, 2);
  assert.equal(sanitized[0].role, 'user');
  assert.deepEqual(sanitized[0].parts, [{ text: 'Tháng này nên tiết kiệm bao nhiêu?' }]);
  assert.equal(sanitized[1].role, 'model');

  const manyTurns = Array.from({ length: 30 }, (_, idx) => ({
    role: idx % 2 === 0 ? 'user' : 'model',
    text: `Turn ${idx}`,
  }));
  const capped = buildGeminiChatHistory(manyTurns);
  assert.ok(capped.length <= 24);
  assert.equal(capped[0].role, 'user');
});
