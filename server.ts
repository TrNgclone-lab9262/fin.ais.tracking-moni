import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = 'gemini-4-hydrogen';

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
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    const hasKey = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY.trim() !== '' &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    res.json({ ok: true, aiConfigured: hasKey });
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

  // Vite dev middleware or static production build
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HOME MONI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
