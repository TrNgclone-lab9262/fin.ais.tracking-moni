import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, GenerateContentResponse, Type } from '@google/genai';
import {
  buildChatbotSystemInstruction,
  buildGeminiChatHistory,
  ChatbotModelMode,
  ChatbotRoleId,
  ChatbotThinkingLevelName,
  FinancialChatContextSnapshot,
  resolveChatbotModelRoute,
} from './lib/geminiChatConfig';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = 'gemini-4-hydrogen';

function mapThinkingLevel(level: ChatbotThinkingLevelName): ThinkingLevel {
  switch (level) {
    case 'MINIMAL':
      return ThinkingLevel.MINIMAL;
    case 'LOW':
      return ThinkingLevel.LOW;
    case 'MEDIUM':
      return ThinkingLevel.MEDIUM;
    case 'XHIGH':
      return ThinkingLevel.XHIGH;
    case 'HIGH':
    default:
      return ThinkingLevel.HIGH;
  }
}

function formatGeminiError(err: unknown): { status: number; code: string; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err || 'Lỗi không xác định từ Gemini API');
  const anyErr = err as { status?: number; code?: string | number } | undefined;
  const status = typeof anyErr?.status === 'number' ? anyErr.status : 500;

  if (status === 400 || /API_KEY_INVALID|API key not valid/i.test(rawMessage)) {
    return {
      status: 400,
      code: 'API_KEY_INVALID',
      message:
        'API key Gemini không hợp lệ (400). Vui lòng kiểm tra hoặc chọn lại API key trong bảng Settings > Secrets.',
    };
  }
  if (status === 403 || /PERMISSION_DENIED/i.test(rawMessage)) {
    return {
      status: 403,
      code: 'PERMISSION_DENIED',
      message:
        'API key không đủ quyền truy cập Gemini API (403). Vui lòng kiểm tra API key trong bảng Settings > Secrets.',
    };
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(rawMessage)) {
    return {
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      message:
        'Đã vượt giới hạn hạn mức Gemini API (429). Vui lòng chờ một lát hoặc kiểm tra API key trong Settings > Secrets.',
    };
  }
  if (status === 404 || /NOT_FOUND/i.test(rawMessage)) {
    return {
      status: 404,
      code: 'MODEL_NOT_FOUND',
      message: 'Model Gemini được yêu cầu hiện không khả dụng (404). Vui lòng thử chuyển sang chế độ Tổng quát.',
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    code: 'GEMINI_UPSTREAM_ERROR',
    message: `Không thể kết nối Gemini AI: ${rawMessage}`,
  };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface CategoryHint {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

interface AccountHint {
  id: string;
  name: string;
  type: string;
  owner: string;
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    const hasKey = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY.trim() !== '' &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    res.json({ ok: true, aiConfigured: hasKey });
  });

  // PWA Version Manifest Endpoint (luôn bỏ qua cache để thiết bị di động nhận biết bản mới tức thì)
  app.get('/api/app-version', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const candidates = [
      path.resolve(__dirname, 'public', 'version.json'),
      path.resolve(__dirname, 'dist', 'version.json'),
    ];

    for (const filePath of candidates) {
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return res.json(parsed);
      } catch {
        // Thử đường dẫn tiếp theo
      }
    }

    return res.json({
      version: '1.5.0',
      buildId: 'v1.5.0-mobile-iphone-parity',
      releasedAt: '2026-11-13',
      title: 'Tối ưu /login mọi dòng iPhone, Parity Mobile, Privacy 100% & Đồng bộ 2 máy',
      mandatory: false,
      highlights: [],
    });
  });

  // Đảm bảo tệp Service Worker và version.json không bao giờ bị browser/CDN cache cứng
  app.use((req, res, next) => {
    if (req.path === '/sw.js' || req.path === '/version.json') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // 1. POST /api/ai/scan-receipt — Multimodal Receipt OCR + Itemized Split Suggestions
  app.post('/api/ai/scan-receipt', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        source: 'fallback',
        reason: 'GEMINI_API_KEY_NOT_CONFIGURED',
      });
    }

    try {
      const { imageBase64, mimeType, categories } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        categories?: CategoryHint[];
      };

      if (!imageBase64) {
        return res.status(400).json({ error: 'Thiếu dữ liệu ảnh hóa đơn (imageBase64).' });
      }

      const categoryList = (categories || [])
        .filter((c) => c.type === 'EXPENSE')
        .map((c) => `- "${c.id}": ${c.name}`)
        .join('\n');

      const prompt = `Bạn là chuyên gia kế toán gia đình Việt Nam cho HOME MONI.
Hãy đọc ảnh hóa đơn/biên lai đính kèm và trích xuất thông tin tài chính chuẩn xác:
- amount: Tổng số tiền thanh toán cuối cùng (số nguyên dương VNĐ).
- date: Ngày thanh toán YYYY-MM-DD (nếu thiếu năm thì dùng năm hiện tại).
- merchantName: Tên cửa hàng/nhà hàng/siêu thị.
- suggestedCategoryId: Chọn mã ID phù hợp nhất từ danh sách danh mục sau:
${categoryList || '- "cat_expense_food": Ăn uống\n- "cat_expense_shopping": Mua sắm\n- "cat_expense_transport": Đi lại\n- "cat_expense_bills": Hóa đơn\n- "cat_expense_health": Sức khỏe\n- "cat_expense_rent": Tiền nhà\n- "cat_expense_entertainment": Giải trí\n- "cat_expense_other": Chi phí khác'}
- items: Danh sách các mặt hàng chính nếu đọc được (tên món, giá tiền VNĐ, và gợi ý suggestedCategoryId cho từng món để người dùng có thể tách hóa đơn).
- notes: Tóm tắt ngắn gọn bằng tiếng Việt.
- confidence: Độ tin cậy từ 0.0 đến 1.0.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING },
              merchantName: { type: Type.STRING },
              suggestedCategoryId: { type: Type.STRING },
              notes: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    suggestedCategoryId: { type: Type.STRING },
                  },
                  required: ['name', 'price'],
                },
              },
            },
            required: ['amount', 'date', 'merchantName', 'suggestedCategoryId', 'confidence'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        source: 'gemini',
        result: {
          amount: Math.abs(Number(parsed.amount) || 0),
          date: parsed.date || new Date().toISOString().slice(0, 10),
          merchantName: parsed.merchantName || 'Hóa đơn tiêu dùng',
          suggestedCategoryId: parsed.suggestedCategoryId || 'cat_expense_food',
          items: Array.isArray(parsed.items) ? parsed.items : [],
          notes: parsed.notes || '',
          confidence: Number(parsed.confidence) || 0.9,
        },
      });
    } catch (err) {
      console.error('[AI Scan Receipt Error]', err);
      return res.json({
        source: 'fallback',
        reason: 'GEMINI_REQUEST_FAILED',
      });
    }
  });

  // 2. POST /api/ai/parse-transaction — Natural Language Quick Entry Parser
  app.post('/api/ai/parse-transaction', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        source: 'fallback',
        reason: 'GEMINI_API_KEY_NOT_CONFIGURED',
      });
    }

    try {
      const { text, accounts, categories, today } = req.body as {
        text?: string;
        accounts?: AccountHint[];
        categories?: CategoryHint[];
        today?: string;
      };

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập nội dung giao dịch.' });
      }

      const accLines = (accounts || [])
        .map((a) => `- "${a.id}": ${a.name} (owner=${a.owner}, type=${a.type})`)
        .join('\n');
      const catLines = (categories || [])
        .map((c) => `- "${c.id}": ${c.name} (${c.type})`)
        .join('\n');

      const prompt = `Phân tích câu mô tả giao dịch tiếng Việt của gia đình Anh Chuột (HUSBAND) & Bé Mèo (WIFE).
Hôm nay là ${today || new Date().toISOString().slice(0, 10)}.
Câu nhập: "${text.trim()}"

Danh sách tài khoản:
${accLines}

Danh sách danh mục:
${catLines}

Trả về mảng các giao dịch bóc tách được (hỗ trợ nhiều giao dịch trong 1 câu nếu có, ví dụ "ăn phở 100k và đổ xăng 50k"). Quy đổi k = 1.000, tr/m = 1.000.000.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transactions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    amount: { type: Type.NUMBER },
                    date: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['INCOME', 'EXPENSE', 'TRANSFER'] },
                    categoryId: { type: Type.STRING },
                    accountId: { type: Type.STRING },
                    memberId: { type: Type.STRING, enum: ['HUSBAND', 'WIFE', 'SHARED'] },
                    scope: { type: Type.STRING, enum: ['FAMILY', 'PERSONAL'] },
                    note: { type: Type.STRING },
                  },
                  required: ['amount', 'type', 'categoryId', 'memberId', 'scope', 'note'],
                },
              },
            },
            required: ['transactions'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        source: 'gemini',
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      });
    } catch (err) {
      console.error('[AI Parse Transaction Error]', err);
      return res.json({
        source: 'fallback',
        reason: 'GEMINI_REQUEST_FAILED',
      });
    }
  });

  // 3. POST /api/ai/monthly-digest — Couple Monthly Financial Advisor Digest
  app.post('/api/ai/monthly-digest', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        source: 'fallback',
        reason: 'GEMINI_API_KEY_NOT_CONFIGURED',
      });
    }

    try {
      const { monthLabel, summary, topCategories, creditCards, budgetOverruns } = req.body as {
        monthLabel: string;
        summary: {
          monthlyIncome: number;
          monthlyExpense: number;
          savingsAmount: number;
          savingsRate: number;
          netWorth: number;
        };
        topCategories: { name: string; amount: number; percentage: number }[];
        creditCards: { name: string; usagePercentage: number; usedAmount: number }[];
        budgetOverruns: string[];
      };

      const prompt = `Bạn là cố vấn tài chính thân thiện của gia đình trẻ Anh Chuột & Bé Mèo.
Dữ liệu kỳ ${monthLabel}:
- Thu nhập: ${summary.monthlyIncome.toLocaleString('vi-VN')} đ
- Chi tiêu: ${summary.monthlyExpense.toLocaleString('vi-VN')} đ
- Tiết kiệm: ${summary.savingsAmount.toLocaleString('vi-VN')} đ (${summary.savingsRate}%)
- Tài sản ròng: ${summary.netWorth.toLocaleString('vi-VN')} đ
- Top danh mục chi: ${topCategories.map((c) => `${c.name} (${c.percentage}%)`).join(', ') || 'Chưa có'}
- Thẻ tín dụng BIDV: ${creditCards.map((c) => `${c.name}: ${c.usagePercentage}%`).join(', ')}
- Danh mục vượt/gần trần: ${budgetOverruns.join(', ') || 'Không có'}

Hãy viết nhận xét ngắn gọn, thực tế, mang tính động viên bằng tiếng Việt gồm: headline (1 câu), highlights (2-3 gạch đầu dòng ngắn), actionTip (1 lời khuyên hành động cụ thể cho 2 vợ chồng).`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              highlights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              actionTip: { type: Type.STRING },
            },
            required: ['headline', 'highlights', 'actionTip'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        source: 'gemini',
        digest: parsed,
      });
    } catch (err) {
      console.error('[AI Monthly Digest Error]', err);
      return res.json({
        source: 'fallback',
        reason: 'GEMINI_REQUEST_FAILED',
      });
    }
  });

  // 4. POST /api/ai/chat — Multi-turn Streaming Chatbot (SSE)
  app.post('/api/ai/chat', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        code: 'GEMINI_API_KEY_NOT_CONFIGURED',
        error:
          'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập hoặc chọn API key trong Settings > Secrets để sử dụng Trợ lý AI.',
      });
    }

    const { message, history, roleId, mode, financialContext } = (req.body || {}) as {
      message?: string;
      history?: Array<{ role: string; text: string }>;
      roleId?: ChatbotRoleId;
      mode?: ChatbotModelMode;
      financialContext?: FinancialChatContextSnapshot;
    };

    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    if (!trimmedMessage) {
      return res.status(400).json({
        code: 'EMPTY_MESSAGE',
        error: 'Vui lòng nhập nội dung câu hỏi cho Chatbot.',
      });
    }

    const route = resolveChatbotModelRoute(mode);
    const resolvedRole: ChatbotRoleId = roleId || 'family_advisor';
    const systemInstruction = buildChatbotSystemInstruction(resolvedRole, financialContext);
    const geminiHistory = buildGeminiChatHistory(Array.isArray(history) ? history : []);
    const thinkingLevel = mapThinkingLevel(route.thinkingLevel);

    const abortController = new AbortController();
    req.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    try {
      const chat = ai.chats.create({
        model: route.model,
        history: geminiHistory,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel },
        },
      });

      const streamResponse = await chat.sendMessageStream({
        message: trimmedMessage,
      });

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      res.write(
        `data: ${JSON.stringify({
          type: 'meta',
          model: route.model,
          thinkingLevel: route.thinkingLevel,
        })}\n\n`
      );

      for await (const chunk of streamResponse) {
        if (abortController.signal.aborted) break;
        const c = chunk as GenerateContentResponse;
        const text = c.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
        }
      }

      if (!abortController.signal.aborted) {
        res.write(
          `data: ${JSON.stringify({
            type: 'done',
            model: route.model,
            thinkingLevel: route.thinkingLevel,
          })}\n\n`
        );
      }
      return res.end();
    } catch (err) {
      console.error('[AI Chat Stream Error]', err);
      const formatted = formatGeminiError(err);
      if (!res.headersSent) {
        return res.status(formatted.status).json({
          code: formatted.code,
          error: formatted.message,
        });
      }
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          code: formatted.code,
          status: formatted.status,
          error: formatted.message,
        })}\n\n`
      );
      return res.end();
    }
  });

  // Vite dev middleware or static production build
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`HOME MONI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
