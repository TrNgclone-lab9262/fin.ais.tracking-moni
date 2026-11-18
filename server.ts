import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs/promises';
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

  // 4. POST /api/ai/financial-insights — Monthly Spending Pattern Analysis & 3 Actionable Saving Tips
  app.post('/api/ai/financial-insights', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa API trong Settings > Secrets.',
        code: 'GEMINI_API_KEY_NOT_CONFIGURED',
      });
    }

    try {
      const {
        monthLabel,
        perspectiveLabel,
        totalIncome,
        totalExpense,
        savingsRate,
        previousMonthExpense,
        categoryBreakdown,
        topMerchants,
        recurringTotal,
        discretionaryTotal,
        recentTransactions,
        budgetOverruns,
        creditCards,
      } = req.body as {
        monthLabel?: string;
        perspectiveLabel?: string;
        totalIncome?: number;
        totalExpense?: number;
        savingsRate?: number;
        previousMonthExpense?: number;
        categoryBreakdown?: { name: string; amount: number; percentage: number; prevAmount?: number }[];
        topMerchants?: { label: string; count: number; totalAmount: number }[];
        recurringTotal?: number;
        discretionaryTotal?: number;
        recentTransactions?: { date: string; amount: number; category: string; note: string; scope: string }[];
        budgetOverruns?: string[];
        creditCards?: { name: string; usagePercentage: number; usedAmount: number }[];
      };

      if (!totalExpense || totalExpense <= 0) {
        return res.status(400).json({
          error: 'Chưa có giao dịch chi tiêu trong kỳ này để Gemini phân tích.',
          code: 'NO_EXPENSE_DATA',
        });
      }

      const categoryLines = (categoryBreakdown || [])
        .slice(0, 8)
        .map((c) => {
          const prevInfo =
            typeof c.prevAmount === 'number' && c.prevAmount > 0
              ? ` (tháng trước: ${c.prevAmount.toLocaleString('vi-VN')} đ)`
              : '';
          return `- ${c.name}: ${c.amount.toLocaleString('vi-VN')} đ (${c.percentage}%)${prevInfo}`;
        })
        .join('\n');

      const merchantLines = (topMerchants || [])
        .slice(0, 8)
        .map((m) => `- "${m.label}": ${m.count} lần, tổng ${m.totalAmount.toLocaleString('vi-VN')} đ`)
        .join('\n');

      const txLines = (recentTransactions || [])
        .slice(0, 25)
        .map((t) => `- ${t.date} | ${t.category} | ${t.amount.toLocaleString('vi-VN')} đ | ${t.scope} | ${t.note}`)
        .join('\n');

      const prevTotal = typeof previousMonthExpense === 'number' ? previousMonthExpense : 0;
      const momDeltaPct =
        prevTotal > 0 ? Math.round(((totalExpense - prevTotal) / prevTotal) * 100) : null;

      const prompt = `Phân tích xu hướng chi tiêu tháng và đề xuất đúng 3 mẹo tiết kiệm cụ thể, khả thi bằng tiếng Việt cho gia đình HOME MONI.

Thông tin kỳ phân tích:
- Kỳ: ${monthLabel || 'Hiện tại'} (${perspectiveLabel || 'Cả nhà'})
- Tổng thu nhập: ${(totalIncome || 0).toLocaleString('vi-VN')} đ
- Tổng chi tiêu: ${totalExpense.toLocaleString('vi-VN')} đ${momDeltaPct !== null ? ` (thay đổi ${momDeltaPct >= 0 ? '+' : ''}${momDeltaPct}% so với tháng trước ${prevTotal.toLocaleString('vi-VN')} đ)` : ''}
- Tỷ lệ tiết kiệm: ${savingsRate ?? 0}%
- Chi cố định/định kỳ: ${(recurringTotal || 0).toLocaleString('vi-VN')} đ | Chi linh hoạt: ${(discretionaryTotal || 0).toLocaleString('vi-VN')} đ
- Thẻ tín dụng: ${(creditCards || []).map((c) => `${c.name} (${c.usagePercentage}%)`).join(', ') || 'Không có'}
- Danh mục vượt/gần ngân sách: ${(budgetOverruns || []).join(', ') || 'Không có'}

Cơ cấu chi theo danh mục:
${categoryLines || 'Chưa phân loại'}

Các khoản chi lặp lại / nổi bật:
${merchantLines || 'Không có dữ liệu'}

Mẫu giao dịch gần đây:
${txLines || 'Không có'}

Yêu cầu đầu ra JSON:
1. patternSummary: 1-2 câu súc tích chỉ ra thói quen/mô hình chi tiêu nổi bật nhất trong lịch sử giao dịch trên.
2. comparisonNote: 1 câu nhận xét ngắn về biến động chi tiêu so với tháng trước hoặc cơ cấu cố định vs linh hoạt.
3. tips: ĐÚNG 3 mẹo tiết kiệm thực tế bám sát trực tiếp các danh mục/khoản chi cụ thể ở trên. Mỗi mẹo gồm:
   - title: Tiêu đề hành động ngắn gọn (tối đa 10 từ).
   - action: Hướng dẫn cụ thể phải làm gì và cắt giảm ở khoản nào (1-2 câu).
   - targetCategory: Tên danh mục chi tiêu liên quan.
   - estimatedMonthlySavings: Số tiền ước tính tiết kiệm được mỗi tháng (VNĐ, số nguyên dương hợp lý với dữ liệu).`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'Bạn là chuyên gia phân tích tài chính cá nhân cho gia đình Việt Nam. Luôn trả về JSON đúng schema với đúng 3 mẹo tiết kiệm thực tế dựa trên dữ liệu giao dịch được cung cấp, không bịa đặt số liệu ngoài ngữ cảnh.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              patternSummary: { type: Type.STRING },
              comparisonNote: { type: Type.STRING },
              tips: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    action: { type: Type.STRING },
                    targetCategory: { type: Type.STRING },
                    estimatedMonthlySavings: { type: Type.NUMBER },
                  },
                  required: ['title', 'action', 'targetCategory', 'estimatedMonthlySavings'],
                },
              },
            },
            required: ['patternSummary', 'comparisonNote', 'tips'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
        patternSummary?: string;
        comparisonNote?: string;
        tips?: {
          title?: string;
          action?: string;
          targetCategory?: string;
          estimatedMonthlySavings?: number;
        }[];
      };

      const rawTips = Array.isArray(parsed.tips) ? parsed.tips.slice(0, 3) : [];
      if (rawTips.length === 0 || !parsed.patternSummary) {
        return res.status(502).json({
          error: 'Phản hồi từ Gemini AI chưa đầy đủ cấu trúc. Vui lòng thử phân tích lại.',
          code: 'GEMINI_INVALID_OUTPUT',
        });
      }

      return res.json({
        insights: {
          patternSummary: parsed.patternSummary,
          comparisonNote: parsed.comparisonNote || '',
          tips: rawTips.map((t) => ({
            title: String(t.title || 'Tối ưu chi tiêu'),
            action: String(t.action || ''),
            targetCategory: String(t.targetCategory || 'Chi tiêu chung'),
            estimatedMonthlySavings: Math.max(0, Math.round(Number(t.estimatedMonthlySavings) || 0)),
          })),
        },
      });
    } catch (err) {
      console.error('[AI Financial Insights Error]', err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
        return res.status(403).json({
          error: 'Khóa GEMINI_API_KEY không hợp lệ hoặc chưa được cấp quyền. Vui lòng kiểm tra trong Settings > Secrets.',
          code: 'GEMINI_AUTH_ERROR',
        });
      }
      if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
        return res.status(429).json({
          error: 'Đã chạm giới hạn lượt gọi Gemini API. Vui lòng thử lại sau ít phút.',
          code: 'GEMINI_RATE_LIMIT',
        });
      }
      return res.status(502).json({
        error: 'Không thể kết nối Gemini AI để phân tích dữ liệu chi tiêu. Vui lòng thử lại sau.',
        code: 'GEMINI_REQUEST_FAILED',
      });
    }
  });

  // 5. POST /api/ai/spending-forecast — 3-Month Spending Forecast Narrative & Recommendations
  app.post('/api/ai/spending-forecast', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa API trong Settings > Secrets.',
        code: 'GEMINI_API_KEY_NOT_CONFIGURED',
      });
    }

    try {
      const {
        anchorMonthLabel,
        perspectiveLabel,
        monthsAnalyzed,
        historicalAvgIncome,
        historicalAvgExpense,
        recurringExpenseBaseline,
        discretionaryExpenseBaseline,
        monthlyGrowthRatePct,
        forecastMonths,
        topDrivers,
        budgetWarnings,
        creditCards,
      } = req.body as {
        anchorMonthLabel?: string;
        perspectiveLabel?: string;
        monthsAnalyzed?: number;
        historicalAvgIncome?: number;
        historicalAvgExpense?: number;
        recurringExpenseBaseline?: number;
        discretionaryExpenseBaseline?: number;
        monthlyGrowthRatePct?: number;
        forecastMonths?: {
          month: string;
          monthLabel: string;
          predictedIncome: number;
          recurringExpense: number;
          discretionaryExpense: number;
          predictedExpense: number;
          projectedSavings: number;
          savingsRate: number;
          riskLabel: string;
        }[];
        topDrivers?: {
          categoryName: string;
          avgMonthlyAmount: number;
          sharePct: number;
          isRecurringDominant: boolean;
        }[];
        budgetWarnings?: string[];
        creditCards?: { name: string; usagePercentage: number; usedAmount: number }[];
      };

      if (!Array.isArray(forecastMonths) || forecastMonths.length === 0) {
        return res.status(400).json({
          error: 'Chưa có dữ liệu dự báo 3 tháng để Gemini phân tích.',
          code: 'NO_FORECAST_DATA',
        });
      }

      const forecastLines = forecastMonths
        .slice(0, 3)
        .map(
          (m) =>
            `- ${m.monthLabel} (${m.month}): Thu dự kiến ${m.predictedIncome.toLocaleString('vi-VN')} đ | Chi dự kiến ${m.predictedExpense.toLocaleString('vi-VN')} đ (Cố định: ${m.recurringExpense.toLocaleString('vi-VN')} đ, Linh hoạt: ${m.discretionaryExpense.toLocaleString('vi-VN')} đ) | Tiết kiệm dự kiến: ${m.projectedSavings.toLocaleString('vi-VN')} đ (${m.savingsRate}%) [${m.riskLabel}]`
        )
        .join('\n');

      const driverLines = (topDrivers || [])
        .slice(0, 5)
        .map(
          (d) =>
            `- ${d.categoryName}: TB ${d.avgMonthlyAmount.toLocaleString('vi-VN')} đ/tháng (${d.sharePct}%${d.isRecurringDominant ? ', có khoản định kỳ' : ''})`
        )
        .join('\n');

      const prompt = `Hãy đóng vai chuyên gia cố vấn tài chính gia đình Việt Nam, nhận xét dự báo xu hướng chi tiêu 3 tháng tiếp theo bằng tiếng Việt cho gia đình HOME MONI.

Ngữ cảnh lịch sử (từ Financial Insights):
- Kỳ neo hiện tại: ${anchorMonthLabel || 'Hiện tại'} (${perspectiveLabel || 'Cả nhà'})
- Số tháng dữ liệu lịch sử đã phân tích: ${monthsAnalyzed ?? 0} tháng
- Trung bình lịch sử: Thu ${(historicalAvgIncome || 0).toLocaleString('vi-VN')} đ/tháng | Chi ${(historicalAvgExpense || 0).toLocaleString('vi-VN')} đ/tháng
- Định kỳ cố định hàng tháng: ${(recurringExpenseBaseline || 0).toLocaleString('vi-VN')} đ | Nền chi linh hoạt: ${(discretionaryExpenseBaseline || 0).toLocaleString('vi-VN')} đ (biến động ${monthlyGrowthRatePct ?? 0}%/tháng)
- Thẻ tín dụng BIDV: ${(creditCards || []).map((c) => `${c.name} (${c.usagePercentage}%)`).join(', ') || 'Không có'}
- Danh mục ngân sách gần/vượt ngưỡng: ${(budgetWarnings || []).join(', ') || 'Không có'}

Các nhóm chi dẫn dắt từ lịch sử:
${driverLines || 'Chưa có phân bổ chi tiết'}

Số liệu dự báo 3 tháng tới:
${forecastLines}

Yêu cầu đầu ra JSON:
1. headline: 1 câu tiêu đề súc tích tóm tắt triển vọng dòng tiền 3 tháng tới.
2. overallTrend: 2 câu nhận xét ngắn gọn về xu hướng chi cố định vs linh hoạt, rủi ro bội chi hoặc cơ hội tích lũy dựa trên số liệu trên.
3. monthlyNotes: Mảng đúng 3 phần tử tương ứng từng tháng dự báo (+1, +2, +3), mỗi phần tử gồm:
   - month: mã YYYY-MM đúng như đầu vào
   - focus: 1 cụm từ ngắn (tối đa 8 từ) về trọng tâm tháng đó (VD: "Kiểm soát ăn uống cuối năm")
   - advice: 1 câu gợi ý cụ thể cho tháng đó.
4. savingActions: Mảng 2-3 gạch đầu dòng hành động cụ thể giúp tối ưu phần chi linh hoạt hoặc gia tăng tiết kiệm trong 3 tháng tới.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'Bạn là cố vấn tài chính gia đình tại Việt Nam. Luôn trả về JSON đúng schema dựa trên số liệu dự báo đã tính, không bịa đặt con số ngoài dữ liệu được cung cấp.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              overallTrend: { type: Type.STRING },
              monthlyNotes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    month: { type: Type.STRING },
                    focus: { type: Type.STRING },
                    advice: { type: Type.STRING },
                  },
                  required: ['month', 'focus', 'advice'],
                },
              },
              savingActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['headline', 'overallTrend', 'monthlyNotes', 'savingActions'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
        headline?: string;
        overallTrend?: string;
        monthlyNotes?: { month?: string; focus?: string; advice?: string }[];
        savingActions?: string[];
      };

      if (!parsed.headline || !parsed.overallTrend || !Array.isArray(parsed.monthlyNotes)) {
        return res.status(502).json({
          error: 'Phản hồi dự báo từ Gemini AI chưa đầy đủ cấu trúc. Vui lòng thử lại.',
          code: 'GEMINI_INVALID_OUTPUT',
        });
      }

      return res.json({
        forecastInsights: {
          headline: String(parsed.headline),
          overallTrend: String(parsed.overallTrend),
          monthlyNotes: parsed.monthlyNotes.slice(0, 3).map((n, idx) => ({
            month: String(n.month || forecastMonths[idx]?.month || ''),
            focus: String(n.focus || 'Theo dõi dòng tiền'),
            advice: String(n.advice || ''),
          })),
          savingActions: Array.isArray(parsed.savingActions)
            ? parsed.savingActions.slice(0, 3).map((a) => String(a))
            : [],
        },
      });
    } catch (err) {
      console.error('[AI Spending Forecast Error]', err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
        return res.status(403).json({
          error: 'Khóa GEMINI_API_KEY không hợp lệ hoặc chưa được cấp quyền. Vui lòng kiểm tra trong Settings > Secrets.',
          code: 'GEMINI_AUTH_ERROR',
        });
      }
      if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
        return res.status(429).json({
          error: 'Đã chạm giới hạn lượt gọi Gemini API. Vui lòng thử lại sau ít phút.',
          code: 'GEMINI_RATE_LIMIT',
        });
      }
      return res.status(502).json({
        error: 'Không thể kết nối Gemini AI để nhận xét dự báo 3 tháng. Vui lòng thử lại sau.',
        code: 'GEMINI_REQUEST_FAILED',
      });
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
