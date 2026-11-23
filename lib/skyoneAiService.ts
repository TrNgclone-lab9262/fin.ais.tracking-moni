/**
 * @file skyoneAiService.ts
 * @description Client bridge cho 2 tuyến Full-Stack AI của Sub-App SKYONE:
 * - POST /api/ai/scan-loan-statement (OCR thông báo thu nợ / điều chỉnh lãi suất BIDV)
 * - POST /api/ai/skyone-strategy (Cố vấn chiến lược liên thông SKYONE × GOLD × FINANCE)
 */

import { postAiJson } from './aiFetch';

export type LoanStatementDocumentType = 'PAYMENT_RECEIPT' | 'RATE_ADJUSTMENT' | 'DISBURSEMENT';

export interface ScannedLoanStatementResult {
  documentType: LoanStatementDocumentType;
  period: number;
  paymentDate: string;
  principalPaidVnd: number;
  interestPaidVnd: number;
  totalPaidVnd: number;
  newInterestRatePct: number;
  effectiveFromDate: string;
  remainingBalanceVnd: number;
  bankNote: string;
  confidence: number;
}

export interface SkyOneStrategyPayload {
  projectName: string;
  remainingBalanceVnd: number;
  currentInterestRatePct: number;
  projectedFloatingRatePct: number;
  remainingMonths: number;
  monthlyPaymentVnd: number;
  prepaymentPenaltyPct: number;
  dtiPct: number;
  equityPct: number;
  liquidCashVnd: number;
  monthlyNetSurplusVnd: number;
  goldBidValueVnd: number;
  goldUnrealizedPnlVnd: number;
  goldTotalChi: number;
  interiorBudgetRemainingVnd: number;
  targetExtraPrepayVnd: number;
}

export interface SkyOneStrategyAllocation {
  bucket: string;
  amountVnd: number;
  reason: string;
}

export interface SkyOneStrategyResponse {
  recommendedAction:
    | 'PREPAY_SKYONE'
    | 'HOLD_GOLD_AND_CASH'
    | 'HYBRID_SPLIT'
    | 'RESERVE_FOR_INTERIOR';
  headline: string;
  rationale: string;
  allocationPlan: SkyOneStrategyAllocation[];
  riskWarnings: string[];
  nextStepChecklist: string[];
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] || '' : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Không thể đọc tệp chứng từ.'));
    reader.readAsDataURL(file);
  });
}

export async function scanLoanStatementWithGemini(
  file: File,
  hints?: { currentPeriodHint?: number; currentBalanceVnd?: number }
): Promise<ScannedLoanStatementResult> {
  const imageBase64 = await fileToBase64(file);
  const res = await postAiJson('/api/ai/scan-loan-statement', {
    imageBase64,
    mimeType: file.type || 'image/jpeg',
    currentPeriodHint: hints?.currentPeriodHint,
    currentBalanceVnd: hints?.currentBalanceVnd,
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: ScannedLoanStatementResult;
    message?: string;
    error?: string;
  };

  if (!res.ok || !data.result) {
    throw new Error(
      data.message || data.error || 'Không thể bóc tách thông báo khoản vay BIDV lúc này.'
    );
  }

  return data.result;
}

export async function requestSkyOneStrategy(
  payload: SkyOneStrategyPayload
): Promise<SkyOneStrategyResponse> {
  const res = await postAiJson('/api/ai/skyone-strategy', payload);

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    strategy?: SkyOneStrategyResponse;
    message?: string;
    error?: string;
  };

  if (!res.ok || !data.strategy) {
    throw new Error(
      data.message || data.error || 'Không thể tạo phân tích chiến lược SKYONE lúc này.'
    );
  }

  return data.strategy;
}
