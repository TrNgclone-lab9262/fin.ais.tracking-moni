/**
 * @file geminiReceiptService.ts
 * @description Client-side bridge calling server-side /api/ai/* endpoints (Gemini Vision OCR, NL parser, Monthly Digest)
 */

import { Account, Category, ExpenseScope, FamilyMember, TransactionType } from '@/types/finance';
import { resolveCategorySlugToId } from './financeEngine';

export interface ParsedReceiptItem {
  name: string;
  price: number;
  suggestedCategoryId?: string;
}

export interface ParsedReceiptResult {
  amount: number;
  date: string; // YYYY-MM-DD
  merchantName: string;
  suggestedCategoryId: string;
  items?: ParsedReceiptItem[];
  notes?: string;
  confidence: number;
  isDemoFallback?: boolean;
}

export interface ParsedNaturalTransaction {
  amount: number;
  date: string;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  memberId: FamilyMember;
  scope: ExpenseScope;
  note: string;
  isOfflineFallback?: boolean;
}

export interface MonthlyAIDigest {
  headline: string;
  highlights: string[];
  actionTip: string;
  source: 'gemini' | 'offline';
}

export interface FinancialInsightTip {
  title: string;
  action: string;
  targetCategory: string;
  estimatedMonthlySavings: number;
}

export interface FinancialInsightsResponse {
  patternSummary: string;
  comparisonNote: string;
  tips: FinancialInsightTip[];
}

export interface FinancialInsightsPayload {
  monthLabel: string;
  perspectiveLabel: string;
  totalIncome: number;
  totalExpense: number;
  savingsRate: number;
  previousMonthExpense: number;
  categoryBreakdown: { name: string; amount: number; percentage: number; prevAmount?: number }[];
  topMerchants: { label: string; count: number; totalAmount: number }[];
  recurringTotal: number;
  discretionaryTotal: number;
  recentTransactions: {
    date: string;
    amount: number;
    category: string;
    note: string;
    scope: string;
  }[];
  budgetOverruns: string[];
  creditCards: { name: string; usagePercentage: number; usedAmount: number }[];
}

async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1] || '';
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Bóc tách hóa đơn qua server-side /api/ai/scan-receipt
 */
export async function parseReceiptWithGemini(
  file: File | Blob,
  categories: Category[] = []
): Promise<ParsedReceiptResult> {
  try {
    const base64Image = await fileToBase64(file);
    const res = await fetch('/api/ai/scan-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64Image,
        mimeType: file.type || 'image/jpeg',
        categories: categories.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.source === 'gemini' && data.result) {
        const raw = data.result as ParsedReceiptResult;
        return {
          ...raw,
          suggestedCategoryId: resolveCategorySlugToId(raw.suggestedCategoryId, categories),
          items: (raw.items || []).map((item) => ({
            ...item,
            suggestedCategoryId: item.suggestedCategoryId
              ? resolveCategorySlugToId(item.suggestedCategoryId, categories)
              : undefined,
          })),
          isDemoFallback: false,
        };
      }
    }
  } catch (err) {
    console.warn('[AI Receipt Bridge] Server unavailable, using offline sample:', err);
  }

  // Fallback mẫu thông minh khi chưa cấu hình GEMINI_API_KEY trên server
  await new Promise((r) => setTimeout(r, 600));
  const today = new Date().toISOString().slice(0, 10);
  const mockSamples: ParsedReceiptResult[] = [
    {
      amount: 325000,
      date: today,
      merchantName: 'Siêu thị WinMart+',
      suggestedCategoryId: resolveCategorySlugToId('cat_expense_food', categories),
      items: [
        { name: 'Thịt heo & rau củ tươi', price: 215000, suggestedCategoryId: 'cat_expense_food' },
        { name: 'Nước rửa chén & khăn giấy', price: 110000, suggestedCategoryId: 'cat_expense_shopping' },
      ],
      notes: 'Đi chợ tuần & đồ gia dụng (Chế độ mẫu offline)',
      confidence: 0.94,
      isDemoFallback: true,
    },
    {
      amount: 500000,
      date: today,
      merchantName: 'Cửa hàng Xăng dầu Petrolimex',
      suggestedCategoryId: resolveCategorySlugToId('cat_expense_transport', categories),
      items: [{ name: 'Xăng RON 95-V', price: 500000, suggestedCategoryId: 'cat_expense_transport' }],
      notes: 'Đổ xăng xe gia đình (Chế độ mẫu offline)',
      confidence: 0.96,
      isDemoFallback: true,
    },
  ];
  return mockSamples[Math.floor(Math.random() * mockSamples.length)];
}

/**
 * Parser nội dung tự nhiên tiếng Việt (Offline heuristic fallback nếu không có AI server)
 */
export function parseNaturalLanguageOffline(
  rawText: string,
  accounts: Account[],
  categories: Category[],
  defaultMember: FamilyMember = 'HUSBAND'
): ParsedNaturalTransaction[] {
  const today = new Date().toISOString().slice(0, 10);
  const segments = rawText
    .split(/\s*(?:,|;|\bvà\b|\b&\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const lowerAll = rawText.toLowerCase();
  let detectedMember: FamilyMember = defaultMember === 'SHARED' ? 'HUSBAND' : defaultMember;
  if (/(mèo|vợ|bx|meo)/i.test(lowerAll)) detectedMember = 'WIFE';
  else if (/(chuột|chồng|ox|chuot)/i.test(lowerAll)) detectedMember = 'HUSBAND';

  let detectedAccountId =
    accounts.find((a) => a.owner === detectedMember)?.id || accounts[0]?.id || 'acc_husband_bidv';
  if (/bidv\s*credit|thẻ\s*tín\s*dụng|quẹt\s*thẻ|credit/i.test(lowerAll)) {
    const credit =
      accounts.find((a) => a.type === 'CREDIT_CARD' && a.owner === detectedMember) ||
      accounts.find((a) => a.type === 'CREDIT_CARD');
    if (credit) detectedAccountId = credit.id;
  } else if (/tiền\s*mặt|cash/i.test(lowerAll)) {
    const cash = accounts.find((a) => a.type === 'CASH');
    if (cash) detectedAccountId = cash.id;
  } else if (/vcb|vietcombank/i.test(lowerAll)) {
    const vcb = accounts.find((a) => a.name.toLowerCase().includes('vcb') || a.name.toLowerCase().includes('vietcombank'));
    if (vcb) detectedAccountId = vcb.id;
  } else if (/acb/i.test(lowerAll)) {
    const acb = accounts.find((a) => a.name.toLowerCase().includes('acb'));
    if (acb) detectedAccountId = acb.id;
  } else if (/vietin/i.test(lowerAll)) {
    const vtb = accounts.find((a) => a.name.toLowerCase().includes('vietin'));
    if (vtb) detectedAccountId = vtb.id;
  }

  const scope: ExpenseScope = /(riêng|cá nhân)/i.test(lowerAll) ? 'PERSONAL' : 'FAMILY';

  const results: ParsedNaturalTransaction[] = [];

  for (const seg of segments.length > 0 ? segments : [rawText]) {
    const amountMatch = seg.match(/(\d+(?:[.,]\d+)?)\s*(tr|triệu|m|k|nghìn|ngàn|đ|d|vnđ)?/i);
    if (!amountMatch) continue;

    let num = parseFloat(amountMatch[1].replace(',', '.'));
    const unit = (amountMatch[2] || '').toLowerCase();
    if (unit === 'tr' || unit === 'triệu' || unit === 'm') {
      num = Math.round(num * 1_000_000);
    } else if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') {
      num = Math.round(num * 1_000);
    } else if (num < 1000) {
      num = Math.round(num * 1_000);
    } else {
      num = Math.round(num);
    }

    if (num <= 0) continue;

    const lowerSeg = seg.toLowerCase();
    let txType: TransactionType = 'EXPENSE';
    let categoryId = 'cat_expense_food';

    if (/(lương|thưởng|thu\s*nhập|nhận\s*tiền|hoàn\s*tiền|freelance)/i.test(lowerSeg)) {
      txType = 'INCOME';
      categoryId = /thưởng/i.test(lowerSeg)
        ? 'cat_income_bonus'
        : /freelance/i.test(lowerSeg)
        ? 'cat_income_freelance'
        : 'cat_income_salary';
    } else if (/(xăng|grab|taxi|gửi\s*xe|bảo\s*dưỡng|ô\s*tô)/i.test(lowerSeg)) {
      categoryId = 'cat_expense_transport';
    } else if (/(điện|nước|internet|cáp\s*quang|hóa\s*đơn|wifi)/i.test(lowerSeg)) {
      categoryId = 'cat_expense_bills';
    } else if (/(thuê\s*nhà|chung\s*cư|tiền\s*nhà|phí\s*dịch\s*vụ)/i.test(lowerSeg)) {
      categoryId = 'cat_expense_rent';
    } else if (/(thuốc|khám|bệnh|sức\s*khỏe|nha\s*khoa)/i.test(lowerSeg)) {
      categoryId = 'cat_expense_health';
    } else if (/(phim|cà\s*phê|cafe|du\s*lịch|giải\s*trí|trà\s*sữa)/i.test(lowerSeg)) {
      categoryId = 'cat_expense_entertainment';
    } else if (/(mua\s*sắm|shopee|quần\s*áo|mỹ\s*phẩm|bột\s*giặt|đồ\s*dùng)/i.test(lowerSeg)) {
      categoryId = 'cat_expense_shopping';
    }

    const validCat = categories.find((c) => c.id === categoryId) ? categoryId : 'cat_expense_other';

    results.push({
      amount: num,
      date: today,
      type: txType,
      categoryId: validCat,
      accountId: detectedAccountId,
      memberId: detectedMember,
      scope,
      note: seg.trim(),
      isOfflineFallback: true,
    });
  }

  return results;
}

export async function parseNaturalLanguageTransactions(
  text: string,
  accounts: Account[],
  categories: Category[],
  defaultMember: FamilyMember = 'HUSBAND'
): Promise<ParsedNaturalTransaction[]> {
  try {
    const res = await fetch('/api/ai/parse-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        today: new Date().toISOString().slice(0, 10),
        accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, owner: a.owner })),
        categories: categories.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.source === 'gemini' && Array.isArray(data.transactions) && data.transactions.length > 0) {
        return data.transactions.map((t: Partial<ParsedNaturalTransaction>) => ({
          amount: Math.abs(Number(t.amount) || 0),
          date: t.date || new Date().toISOString().slice(0, 10),
          type: t.type || 'EXPENSE',
          categoryId: resolveCategorySlugToId(t.categoryId, categories),
          accountId: accounts.some((a) => a.id === t.accountId)
            ? (t.accountId as string)
            : accounts[0]?.id || 'acc_husband_bidv',
          memberId: t.memberId || defaultMember,
          scope: t.scope || 'FAMILY',
          note: t.note || text.trim(),
          isOfflineFallback: false,
        }));
      }
    }
  } catch {
    // fallback below
  }

  return parseNaturalLanguageOffline(text, accounts, categories, defaultMember);
}

export async function generateMonthlyDigest(payload: {
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
}): Promise<MonthlyAIDigest> {
  try {
    const res = await fetch('/api/ai/monthly-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.source === 'gemini' && data.digest) {
        return {
          headline: data.digest.headline,
          highlights: data.digest.highlights || [],
          actionTip: data.digest.actionTip,
          source: 'gemini',
        };
      }
    }
  } catch {
    // fallback below
  }

  const topCat = payload.topCategories[0];
  const highCards = payload.creditCards.filter((c) => c.usagePercentage > 30);

  return {
    headline:
      payload.summary.savingsRate >= 30
        ? `Tuyệt vời! Gia đình đang duy trì tỷ lệ tiết kiệm ${payload.summary.savingsRate}% trong ${payload.monthLabel}.`
        : `Tỷ lệ tích lũy ${payload.monthLabel} hiện đạt ${payload.summary.savingsRate}%, cần kiểm soát thêm nhóm chi lớn.`,
    highlights: [
      topCat
        ? `Nhóm chi lớn nhất: ${topCat.name} chiếm ${topCat.percentage}% tổng chi tiêu.`
        : 'Chưa có nhiều khoản chi tiêu được ghi nhận trong kỳ này.',
      highCards.length > 0
        ? `Lưu ý thẻ tín dụng: ${highCards.map((c) => `${c.name} (${c.usagePercentage}%)`).join(', ')} đã vượt mốc an toàn 30%.`
        : 'Cả 2 thẻ tín dụng BIDV đang nằm trong vùng an toàn ≤ 30% hạn mức.',
      payload.budgetOverruns.length > 0
        ? `Ngân sách cần chú ý: ${payload.budgetOverruns.join(', ')}.`
        : 'Toàn bộ hũ ngân sách tháng đang đi đúng quỹ đạo kiểm soát.',
    ],
    actionTip:
      highCards.length > 0
        ? 'Ưu tiên tất toán bớt dư nợ thẻ vượt 30% trước ngày chốt sao kê 20 để tối ưu điểm tín dụng.'
        : 'Duy trì nhịp chi tiêu hiện tại và trích phần thặng dư vào Quỹ Mua Nhà Tổ Ấm 2028.',
    source: 'offline',
  };
}

/**
 * Phân tích mô hình chi tiêu tháng & gợi ý 3 mẹo tiết kiệm từ lịch sử giao dịch qua /api/ai/financial-insights
 */
export async function analyzeFinancialInsights(
  payload: FinancialInsightsPayload
): Promise<FinancialInsightsResponse> {
  const res = await fetch('/api/ai/financial-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as {
    insights?: FinancialInsightsResponse;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      data.error || 'Không thể phân tích dữ liệu chi tiêu với Gemini AI lúc này.'
    );
  }

  if (!data.insights || !Array.isArray(data.insights.tips) || data.insights.tips.length === 0) {
    throw new Error('Dữ liệu phân tích trả về chưa hợp lệ. Vui lòng thử lại.');
  }

  return data.insights;
}

export interface SpendingForecastAIPayload {
  anchorMonthLabel: string;
  perspectiveLabel: string;
  monthsAnalyzed: number;
  historicalAvgIncome: number;
  historicalAvgExpense: number;
  recurringExpenseBaseline: number;
  discretionaryExpenseBaseline: number;
  monthlyGrowthRatePct: number;
  forecastMonths: {
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
  topDrivers: {
    categoryName: string;
    avgMonthlyAmount: number;
    sharePct: number;
    isRecurringDominant: boolean;
  }[];
  budgetWarnings: string[];
  creditCards: { name: string; usagePercentage: number; usedAmount: number }[];
}

export interface SpendingForecastAIResponse {
  headline: string;
  overallTrend: string;
  monthlyNotes: {
    month: string;
    focus: string;
    advice: string;
  }[];
  savingActions: string[];
}

/**
 * Gọi Gemini AI nhận xét xu hướng dự báo chi tiêu 3 tháng tới từ dữ liệu Financial Insights
 */
export async function generateSpendingForecastInsights(
  payload: SpendingForecastAIPayload
): Promise<SpendingForecastAIResponse> {
  const res = await fetch('/api/ai/spending-forecast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as {
    forecastInsights?: SpendingForecastAIResponse;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      data.error || 'Không thể lấy nhận xét dự báo 3 tháng từ Gemini AI lúc này.'
    );
  }

  if (!data.forecastInsights || !data.forecastInsights.headline) {
    throw new Error('Dữ liệu nhận xét dự báo trả về chưa hợp lệ. Vui lòng thử lại.');
  }

  return data.forecastInsights;
}
