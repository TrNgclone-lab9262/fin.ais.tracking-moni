/**
 * @file apiSchemas.ts
 * @description Hợp đồng Zod end-to-end (Client & Express Server) cho toàn bộ tuyến /api/*
 * cùng bộ giới hạn tần suất (Rate Limiter) thuần túy và chuẩn hóa mã lỗi HTTP thống nhất.
 */

import { z } from 'zod';

export const MAX_IMAGE_BASE64_CHARS = 14_000_000; // ~10.5 MB nhị phân sau mã hóa Base64
export const MAX_DOCUMENT_BASE64_CHARS = 14_000_000;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  'application/pdf',
] as const;

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'AI_NOT_CONFIGURED'
  | 'GEMINI_AUTH_ERROR'
  | 'GEMINI_RATE_LIMIT'
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_INVALID_OUTPUT'
  | 'GEMINI_REQUEST_FAILED'
  | 'NO_TRANSACTIONS'
  | 'NO_FORECAST_DATA'
  | 'INTERNAL_ERROR';

export interface UnifiedApiError {
  ok: false;
  code: ApiErrorCode;
  message: string;
  error: string; // Alias tương thích ngược cho các client cũ đang đọc data.error
  fallbackAvailable?: boolean;
  details?: string[];
}

export function buildApiError(
  code: ApiErrorCode,
  message: string,
  options?: { fallbackAvailable?: boolean; details?: string[] }
): UnifiedApiError {
  return {
    ok: false,
    code,
    message,
    error: message,
    ...(options?.fallbackAvailable !== undefined
      ? { fallbackAvailable: options.fallbackAvailable }
      : {}),
    ...(options?.details && options.details.length > 0 ? { details: options.details } : {}),
  };
}

export function formatZodApiError(err: z.ZodError): UnifiedApiError {
  const details = err.issues
    .slice(0, 4)
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    });
  return buildApiError(
    'VALIDATION_ERROR',
    details[0] || 'Dữ liệu gửi lên API không hợp lệ.',
    { fallbackAvailable: false, details }
  );
}

const Base64PayloadSchema = z
  .string()
  .trim()
  .min(16, 'Dữ liệu tệp đính kèm quá ngắn hoặc bị rỗng.')
  .max(MAX_IMAGE_BASE64_CHARS, 'Dung lượng tệp vượt quá giới hạn cho phép (~10MB).')
  .refine(
    (val) => /^[A-Za-z0-9+/=\r\n_-]+$/.test(val.slice(0, 1024)),
    'Định dạng chuỗi Base64 không hợp lệ.'
  );

const CategoryHintSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  type: z.enum(['INCOME', 'EXPENSE']),
});

const AccountHintSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(40),
  owner: z.string().trim().min(1).max(30),
});

// 1. POST /api/ai/scan-receipt
export const ScanReceiptRequestSchema = z.object({
  imageBase64: Base64PayloadSchema,
  mimeType: z
    .enum(ALLOWED_IMAGE_MIME_TYPES)
    .optional()
    .default('image/jpeg'),
  categories: z.array(CategoryHintSchema).max(100).optional().default([]),
});
export type ScanReceiptRequest = z.infer<typeof ScanReceiptRequestSchema>;

// 2. POST /api/ai/scan-gold-invoice
export const ScanGoldInvoiceRequestSchema = z.object({
  imageBase64: Base64PayloadSchema,
  mimeType: z
    .enum(ALLOWED_DOCUMENT_MIME_TYPES)
    .optional()
    .default('image/jpeg'),
});
export type ScanGoldInvoiceRequest = z.infer<typeof ScanGoldInvoiceRequestSchema>;

// 3. POST /api/ai/parse-transaction
export const ParseTransactionRequestSchema = z.object({
  text: z.string().trim().min(2, 'Nội dung giao dịch quá ngắn.').max(1500, 'Nội dung vượt quá 1.500 ký tự.'),
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày tham chiếu phải theo chuẩn YYYY-MM-DD.')
    .optional(),
  accounts: z.array(AccountHintSchema).max(60).optional().default([]),
  categories: z.array(CategoryHintSchema).max(100).optional().default([]),
});
export type ParseTransactionRequest = z.infer<typeof ParseTransactionRequestSchema>;

// 4. POST /api/ai/monthly-digest
export const MonthlyDigestRequestSchema = z.object({
  monthLabel: z.string().trim().min(1).max(60).optional().default('Tháng hiện tại'),
  summary: z.object({
    monthlyIncome: z.number().finite().min(0),
    monthlyExpense: z.number().finite().min(0),
    savingsAmount: z.number().finite(),
    savingsRate: z.number().finite(),
    netWorth: z.number().finite(),
  }),
  topCategories: z
    .array(
      z.object({
        name: z.string().trim().max(100),
        amount: z.number().finite().min(0),
        percentage: z.number().finite(),
      })
    )
    .max(30)
    .optional()
    .default([]),
  creditCards: z
    .array(
      z.object({
        name: z.string().trim().max(100),
        usagePercentage: z.number().finite(),
        usedAmount: z.number().finite().min(0),
      })
    )
    .max(15)
    .optional()
    .default([]),
  budgetOverruns: z.array(z.string().trim().max(160)).max(30).optional().default([]),
});
export type MonthlyDigestRequest = z.infer<typeof MonthlyDigestRequestSchema>;

// 5. POST /api/ai/financial-insights
export const FinancialInsightsRequestSchema = z.object({
  monthLabel: z.string().trim().max(80).optional().default('Tháng hiện tại'),
  perspectiveLabel: z.string().trim().max(80).optional().default('Cả nhà'),
  totalIncome: z.number().finite().min(0).optional().default(0),
  totalExpense: z.number().finite().min(0).optional().default(0),
  savingsRate: z.number().finite().optional().default(0),
  previousMonthExpense: z.number().finite().min(0).optional().default(0),
  categoryBreakdown: z
    .array(
      z.object({
        name: z.string().trim().max(100),
        amount: z.number().finite().min(0),
        percentage: z.number().finite(),
        prevAmount: z.number().finite().min(0).optional(),
      })
    )
    .max(40)
    .optional()
    .default([]),
  topMerchants: z
    .array(
      z.object({
        label: z.string().trim().max(120),
        count: z.number().int().min(0),
        totalAmount: z.number().finite().min(0),
      })
    )
    .max(30)
    .optional()
    .default([]),
  recurringTotal: z.number().finite().min(0).optional().default(0),
  discretionaryTotal: z.number().finite().min(0).optional().default(0),
  recentTransactions: z
    .array(
      z.object({
        date: z.string().trim().max(30),
        amount: z.number().finite(),
        category: z.string().trim().max(100),
        note: z.string().trim().max(300),
        scope: z.string().trim().max(40),
      })
    )
    .max(120)
    .optional()
    .default([]),
  budgetOverruns: z.array(z.string().trim().max(160)).max(30).optional().default([]),
  creditCards: z
    .array(
      z.object({
        name: z.string().trim().max(100),
        usagePercentage: z.number().finite(),
        usedAmount: z.number().finite().min(0),
      })
    )
    .max(15)
    .optional()
    .default([]),
});
export type FinancialInsightsRequest = z.infer<typeof FinancialInsightsRequestSchema>;

// 6. POST /api/ai/spending-forecast
export const SpendingForecastRequestSchema = z.object({
  anchorMonthLabel: z.string().trim().max(80).optional().default('Hiện tại'),
  perspectiveLabel: z.string().trim().max(80).optional().default('Cả nhà'),
  monthsAnalyzed: z.number().int().min(0).max(120).optional().default(0),
  historicalAvgIncome: z.number().finite().min(0).optional().default(0),
  historicalAvgExpense: z.number().finite().min(0).optional().default(0),
  recurringExpenseBaseline: z.number().finite().min(0).optional().default(0),
  discretionaryExpenseBaseline: z.number().finite().min(0).optional().default(0),
  monthlyGrowthRatePct: z.number().finite().optional().default(0),
  forecastMonths: z
    .array(
      z.object({
        month: z.string().trim().max(20),
        monthLabel: z.string().trim().max(60),
        predictedIncome: z.number().finite().min(0),
        recurringExpense: z.number().finite().min(0),
        discretionaryExpense: z.number().finite().min(0),
        predictedExpense: z.number().finite().min(0),
        projectedSavings: z.number().finite(),
        savingsRate: z.number().finite(),
        riskLabel: z.string().trim().max(60),
      })
    )
    .min(1, 'Chưa có dữ liệu dự báo 3 tháng để Gemini phân tích.')
    .max(12),
  topDrivers: z
    .array(
      z.object({
        categoryName: z.string().trim().max(100),
        avgMonthlyAmount: z.number().finite().min(0),
        sharePct: z.number().finite(),
        isRecurringDominant: z.boolean(),
      })
    )
    .max(20)
    .optional()
    .default([]),
  budgetWarnings: z.array(z.string().trim().max(160)).max(30).optional().default([]),
  creditCards: z
    .array(
      z.object({
        name: z.string().trim().max(100),
        usagePercentage: z.number().finite(),
        usedAmount: z.number().finite().min(0),
      })
    )
    .max(15)
    .optional()
    .default([]),
});
export type SpendingForecastRequest = z.infer<typeof SpendingForecastRequestSchema>;

// 7. POST /api/ai/scan-loan-statement (Wave 3 — SKYONE)
export const ScanLoanStatementRequestSchema = z.object({
  imageBase64: Base64PayloadSchema,
  mimeType: z
    .enum(ALLOWED_DOCUMENT_MIME_TYPES)
    .optional()
    .default('image/jpeg'),
  currentPeriodHint: z.number().int().min(1).max(480).optional(),
  currentBalanceVnd: z.number().finite().min(0).optional(),
});
export type ScanLoanStatementRequest = z.infer<typeof ScanLoanStatementRequestSchema>;

// 8. POST /api/ai/skyone-strategy (Wave 3 — SKYONE x GOLD x FINANCE)
export const SkyOneStrategyRequestSchema = z.object({
  projectName: z.string().trim().min(1).max(160),
  remainingBalanceVnd: z.number().finite().min(0),
  currentInterestRatePct: z.number().finite().min(0).max(30),
  projectedFloatingRatePct: z.number().finite().min(0).max(30),
  remainingMonths: z.number().int().min(0).max(480),
  monthlyPaymentVnd: z.number().finite().min(0),
  prepaymentPenaltyPct: z.number().finite().min(0).max(10),
  dtiPct: z.number().finite().min(0).max(200),
  equityPct: z.number().finite().min(0).max(100),
  liquidCashVnd: z.number().finite(),
  monthlyNetSurplusVnd: z.number().finite(),
  goldBidValueVnd: z.number().finite().min(0),
  goldUnrealizedPnlVnd: z.number().finite(),
  goldTotalChi: z.number().finite().min(0),
  interiorBudgetRemainingVnd: z.number().finite().min(0),
  targetExtraPrepayVnd: z.number().finite().min(0).optional().default(100_000_000),
});
export type SkyOneStrategyRequest = z.infer<typeof SkyOneStrategyRequestSchema>;

// 9. POST /api/ai/scan-boq-quote (Wave 3 — INTERIOR)
export const ScanBoqQuoteRequestSchema = z.object({
  imageBase64: Base64PayloadSchema,
  mimeType: z
    .enum(ALLOWED_DOCUMENT_MIME_TYPES)
    .optional()
    .default('image/jpeg'),
  scenarioName: z.string().trim().max(120).optional().default('PA-B Dual Growth Studio'),
  existingItems: z
    .array(
      z.object({
        name: z.string().trim().max(160),
        roomId: z.string().trim().max(60),
        estimatedVnd: z.number().finite().min(0),
      })
    )
    .max(120)
    .optional()
    .default([]),
});
export type ScanBoqQuoteRequest = z.infer<typeof ScanBoqQuoteRequestSchema>;

// 10. GET /api/gold/reference-prices query parameters (hiệu chỉnh biên độ nội địa tùy chọn)
export const GoldReferenceQuerySchema = z.object({
  force: z.enum(['0', '1']).optional(),
  nhanPremiumPct: z.coerce.number().finite().min(-10).max(35).optional(),
  sjcPremiumPct: z.coerce.number().finite().min(-10).max(45).optional(),
  nhanSpreadVnd: z.coerce.number().finite().min(20_000).max(1_500_000).optional(),
  sjcSpreadVnd: z.coerce.number().finite().min(20_000).max(1_500_000).optional(),
});
export type GoldReferenceQuery = z.infer<typeof GoldReferenceQuerySchema>;

// ---------------------------------------------------------------------------
// Sliding-Window In-Memory Rate Limiter (Pure, Node-Testable)
// ---------------------------------------------------------------------------
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(config: RateLimitConfig) {
    this.windowMs = Math.max(1000, config.windowMs);
    this.maxRequests = Math.max(1, config.maxRequests);
  }

  check(key: string, nowMs: number = Date.now()): RateLimitDecision {
    const cutoff = nowMs - this.windowMs;
    const prev = this.buckets.get(key) || [];
    const active = prev.filter((ts) => ts > cutoff);

    if (active.length >= this.maxRequests) {
      this.buckets.set(key, active);
      const oldest = active[0] ?? nowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - nowMs) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    active.push(nowMs);
    this.buckets.set(key, active);

    // Dọn rác định kỳ để tránh phình RAM khi chạy lâu
    if (this.buckets.size > 2000) {
      for (const [k, list] of this.buckets.entries()) {
        if (list.length === 0 || list[list.length - 1] <= cutoff) {
          this.buckets.delete(k);
        }
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - active.length),
      retryAfterSeconds: 0,
    };
  }
}
