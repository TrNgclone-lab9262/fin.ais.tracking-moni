import { z } from "zod";
import type {
  GoldAlertRule,
  GoldCategory,
  GoldLot,
  GoldPortfolioState,
  GoldPriceSnapshot,
  GoldSaleEvent,
} from "@/types/finance";

/**
 * Chuẩn hóa chuỗi tùy chọn: tự động trim, chuyển null / "" / chỉ khoảng trắng thành undefined
 * để tương thích 100% với bản ghi cũ từ localStorage và Supabase JSONB.
 */
export function optionalTrimmedString(maxLen: number) {
  return z.preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }
    return val;
  }, z.string().max(maxLen).optional());
}

export const FamilyMemberSchema = z.enum(["HUSBAND", "WIFE", "SHARED"]);
export const ExpenseScopeSchema = z.enum(["FAMILY", "PERSONAL"]);

export const TransactionInputSchema = z.object({
  amount: z
    .number()
    .positive("Số tiền phải lớn hơn 0")
    .max(1_000_000_000_000, "Số tiền quá lớn"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày giao dịch phải có định dạng YYYY-MM-DD"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  categoryId: z.string().min(1, "Vui lòng chọn danh mục"),
  accountId: z.string().min(1, "Vui lòng chọn tài khoản nguồn"),
  toAccountId: z.string().optional(),
  memberId: FamilyMemberSchema,
  scope: ExpenseScopeSchema,
  note: z.string().max(255, "Ghi chú không vượt quá 255 ký tự").optional(),
  tag: z.enum(["NORMAL", "DEBT", "INVESTMENT", "RECURRING"]).optional(),
});

export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().min(1),
  icon: z.string().optional(),
  isDefault: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const AccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["BANK", "CASH", "E_WALLET", "CREDIT_CARD"]),
  owner: FamilyMemberSchema,
  isSalaryAccount: z.boolean().optional(),
  creditLimit: z.number().optional(),
  statementDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  initialBalance: z.number(),
  currentBalance: z.number(),
  accountNumber: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const TransactionSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  categoryId: z.string().min(1),
  accountId: z.string().min(1),
  toAccountId: z.string().optional(),
  memberId: FamilyMemberSchema,
  scope: ExpenseScopeSchema,
  note: z.string().optional(),
  tag: z.enum(["NORMAL", "DEBT", "INVESTMENT", "RECURRING"]).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RecurringRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  categoryId: z.string().min(1),
  accountId: z.string().min(1),
  toAccountId: z.string().optional(),
  memberId: FamilyMemberSchema,
  scope: ExpenseScopeSchema,
  dayOfMonth: z.number().int().min(1).max(31),
  isActive: z.boolean(),
  autoPost: z.boolean().optional(),
  lastAppliedMonth: z.string().optional(),
  lastSkippedDuplicateMonth: z.string().optional(),
  note: z.string().optional(),
});

export const BudgetSchema = z.object({
  categoryId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  limitAmount: z.number().positive(),
});

export const SavingsGoalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  currentAmount: z.number().nonnegative(),
  deadline: z.string().optional(),
  icon: z.string().optional(),
  isCompleted: z.boolean(),
  memberId: FamilyMemberSchema.optional(),
});

export const DebtItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["BORROW", "LEND"]),
  totalAmount: z.number().positive(),
  paidAmount: z.number().nonnegative(),
  interestRate: z.number().nonnegative(),
  startDate: z.string(),
  dueDate: z.string(),
  status: z.enum(["ACTIVE", "PAID"]),
  memberId: FamilyMemberSchema.optional(),
});

export const InvestmentItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["GOLD", "SAVINGS", "STOCK", "OTHER"]),
  amount: z.number().positive(),
  currentValue: z.number().optional(),
  expectedProfitRate: z.number(),
  startDate: z.string(),
  status: z.enum(["ACTIVE", "CLOSED"]),
  memberId: FamilyMemberSchema.optional(),
});

export const MemberAuthConfigSchema = z.object({
  passcodeHash: z.string().optional(),
  passcodeSalt: z.string().optional(),
  webauthnCredentialId: z.string().optional(),
  webauthnDeviceLabel: z.string().optional(),
  wallpaperBlur: z.number().min(0).max(24).optional(),
  wallpaperDim: z.number().min(10).max(90).optional(),
  updatedAt: z.string().optional(),
});

export const QuickAuthViewIdSchema = z.enum(["accounts", "debts_invest", "data_admin"]);

export const QuickAuthSettingsSchema = z.object({
  enabled: z.boolean(),
  protectedViews: z.array(QuickAuthViewIdSchema),
});

export const AppSettingsSchema = z.object({
  themeColor: z.enum(["blue", "purple", "pink", "green", "orange"]),
  themeMode: z.enum(["light", "dark"]).optional(),
  currency: z.literal("VND"),
  notificationsEnabled: z.boolean(),
  husbandName: z.string(),
  wifeName: z.string(),
  sharedSplitRatioHusband: z.number().min(0).max(100).optional(),
  privacyMode: z.boolean().optional(),
  pinCode: z.string().optional(),
  requireAuthOnOpen: z.boolean().optional(),
  autoLockMinutes: z.number().min(0).max(120).optional(),
  lockOnBackground: z.boolean().optional(),
  authActiveProfile: z.enum(["HUSBAND", "WIFE"]).optional(),
  husbandAuth: MemberAuthConfigSchema.optional(),
  wifeAuth: MemberAuthConfigSchema.optional(),
  requireAuthForDangerActions: z.boolean().optional(),
  quickAuth: QuickAuthSettingsSchema.optional(),
  dismissedRecurringSuggestionKeys: z.array(z.string()).optional(),
});

export const MortgagePrepaymentPenaltyTierSchema = z.object({
  fromYear: z.number().int().min(1),
  toYear: z.number().int().min(1),
  feePercent: z.number().min(0).max(20),
});

export const MortgageRateAdjustmentSchema = z.object({
  id: z.string().min(1),
  effectiveFromPeriod: z.number().int().min(1),
  annualRate: z.number().min(0).max(50),
  effectiveDate: z.string(),
  note: z.string().optional(),
});

export const MortgagePaidInstallmentRecordSchema = z.object({
  period: z.number().int().min(1),
  paidAt: z.string(),
  paidPrincipal: z.number().nonnegative(),
  paidInterest: z.number().nonnegative(),
  appliedRate: z.number().min(0).max(50),
  linkedTransactionId: z.string().optional(),
  note: z.string().optional(),
  isVerified: z.boolean().optional(),
  verifiedSource: z.string().optional(),
});

export const MortgagePrepaymentEventSchema = z.object({
  id: z.string().min(1),
  date: z.string(),
  afterPeriod: z.number().int().min(0),
  amount: z.number().positive(),
  penaltyAmount: z.number().nonnegative(),
  feePercent: z.number().min(0).max(20),
  strategy: z.enum(["SHORTEN_TERM", "REDUCE_MONTHLY"]),
  linkedTransactionId: z.string().optional(),
  note: z.string().optional(),
});

export const MortgagePlannedDisbursementSchema = z.object({
  id: z.string().min(1),
  afterPeriod: z.number().int().min(0),
  date: z.string(),
  amount: z.number().nonnegative(),
  note: z.string().optional(),
});

export const MortgagePeriodCashflowOverrideSchema = z.object({
  period: z.number().int().min(1).max(360),
  principal: z.number().nonnegative().optional(),
  interest: z.number().nonnegative().optional(),
  appliedRate: z.number().min(0).max(50).optional(),
  paidAt: z.string().optional(),
  note: z.string().optional(),
});

export const MortgageContractSchema = z.object({
  id: z.string().min(1),
  projectName: z.string().min(1),
  unitCode: z.string().min(1),
  bankName: z.string().min(1),
  accountNumber: z.string().optional(),
  branchName: z.string().optional(),
  propertyValue: z.number().positive(),
  currentMarketValue: z.number().positive(),
  downPayment: z.number().nonnegative(),
  creditLimit: z.number().positive().optional(),
  loanAmount: z.number().positive(),
  termMonths: z.number().int().min(1).max(360),
  disbursementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentDayOfMonth: z.number().int().min(1).max(31),
  fixedRateMonths: z.number().int().min(0).max(360),
  fixedInterestRate: z.number().min(0).max(50),
  floatingBaseRate: z.number().min(0).max(50),
  floatingSpread: z.number().min(0).max(30),
  monthlyPrincipalOverride: z.number().nonnegative().optional(),
  interestBasis: z.enum(["ACTUAL_365", "THIRTY_360"]).optional(),
  prepayStrategyDefault: z.enum(["SHORTEN_TERM", "REDUCE_MONTHLY"]),
  prepaymentPenaltyTiers: z.array(MortgagePrepaymentPenaltyTierSchema),
  rateAdjustments: z.array(MortgageRateAdjustmentSchema),
  paidRecords: z.array(MortgagePaidInstallmentRecordSchema),
  prepayments: z.array(MortgagePrepaymentEventSchema),
  plannedDisbursements: z.array(MortgagePlannedDisbursementSchema).optional(),
  cashflowLocked: z.boolean().optional(),
  periodOverrides: z.array(MortgagePeriodCashflowOverrideSchema).optional(),
  updatedAt: z.string(),
});

export const SavingsChallengeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  targetAmount: z.number().positive(),
  manualSavedAmount: z.number().nonnegative(),
  trackingMode: z.enum(["AUTO_SURPLUS", "MANUAL"]),
  color: z.string().min(1),
  memberId: z.enum(["HUSBAND", "WIFE", "SHARED"]).optional(),
  icon: z.string().optional(),
  createdAt: z.string(),
});

export const GoldCategorySchema = z.enum([
  "NHAN_9999",
  "SJC_BAR",
  "GOLD_24K_JEWELRY",
  "GOLD_18K",
  "DIGITAL_GOLD",
]);

export const GoldStorageLocationSchema = z.enum([
  "HOME_SAFE",
  "BANK_VAULT",
  "STORE_KEEP",
  "PARENTS",
]);

export const GoldLotSchema = z
  .object({
    id: z.string().min(1),
    category: GoldCategorySchema,
    brand: z.string().trim().min(1),
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    quantityChi: z.number().finite().positive(),
    remainingChi: z.number().finite().nonnegative(),
    unitBuyPricePerChi: z.number().finite().positive(),
    makingFee: z.number().finite().nonnegative().default(0),
    memberId: FamilyMemberSchema,
    storageLocation: GoldStorageLocationSchema,
    serialNumber: optionalTrimmedString(64),
    certificateCode: optionalTrimmedString(64),
    storeName: optionalTrimmedString(120),
    purityLabel: optionalTrimmedString(40),
    invoiceNote: optionalTrimmedString(500),
    linkedTransactionId: optionalTrimmedString(128),
    status: z.enum(["HOLDING", "PARTIAL_SOLD", "SOLD"]),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .refine((lot) => lot.remainingChi <= lot.quantityChi + 0.0001, {
    message: "Số chỉ còn nắm giữ không được vượt quá số chỉ mua gốc",
    path: ["remainingChi"],
  })
  .refine(
    (lot) => {
      if (lot.status === "SOLD") return lot.remainingChi <= 0.0001;
      if (lot.status === "HOLDING") return Math.abs(lot.remainingChi - lot.quantityChi) <= 0.0001;
      return lot.remainingChi > 0.0001 && lot.remainingChi < lot.quantityChi - 0.0001;
    },
    {
      message: "Trạng thái lô vàng (HOLDING/PARTIAL_SOLD/SOLD) không khớp với số chỉ còn nắm giữ",
      path: ["status"],
    }
  );

export const GoldSaleAllocationModeSchema = z.enum(["FIFO", "SPECIFIC_LOT", "WAC"]);

export const GoldSaleAllocationSchema = z.object({
  lotId: z.string().min(1),
  soldChi: z.number().finite().positive(),
  costBasisAllocated: z.number().finite().nonnegative(),
});

export const GoldSaleEventSchema = z.object({
  id: z.string().min(1),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: GoldCategorySchema,
  allocationMode: GoldSaleAllocationModeSchema.optional(),
  allocations: z.array(GoldSaleAllocationSchema),
  totalSoldChi: z.number().finite().positive(),
  unitSellPricePerChi: z.number().finite().positive(),
  totalProceeds: z.number().finite().nonnegative(),
  costBasisAllocated: z.number().finite().nonnegative(),
  realizedPnl: z.number().finite(),
  purpose: z.enum(["INTERIOR_HANDOVER", "SKYONE_PREPAY", "REBALANCE", "OTHER"]),
  linkedTransactionId: optionalTrimmedString(128),
  note: optionalTrimmedString(500),
  createdAt: z.string(),
});

export const GoldPriceQuoteSchema = z
  .object({
    category: GoldCategorySchema,
    brandLabel: z.string().trim().min(1),
    buyPricePerChi: z.number().finite().positive(),
    sellPricePerChi: z.number().finite().positive(),
    updatedAt: z.string(),
    source: z.enum(["MANUAL", "SERVER_REFERENCE"]),
  })
  .refine((q) => q.buyPricePerChi <= q.sellPricePerChi, {
    message: "Giá mua vào (Bid) không được cao hơn giá bán ra (Ask)",
    path: ["buyPricePerChi"],
  });

export const GoldMacroContextSchema = z.object({
  worldXauUsdPerOz: z.number().finite().nonnegative(),
  usdVndRate: z.number().finite().positive(),
  updatedAt: z.string(),
});

export const GoldDcaPlanSchema = z.object({
  enabled: z.boolean(),
  targetCategory: GoldCategorySchema,
  monthlyTargetChi: z.number().finite().nonnegative(),
  monthlyBudgetVnd: z.number().finite().nonnegative(),
  targetAllocationPercentOfNetWorth: z.number().finite().min(0).max(100),
  targetReserveChiFor2027: z.number().finite().nonnegative(),
});

export const GoldPriceSnapshotSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    recordedAt: z.string(),
    nhan9999BidPerChi: z.number().finite().nonnegative(),
    nhan9999AskPerChi: z.number().finite().nonnegative(),
    sjcBidPerChi: z.number().finite().nonnegative(),
    sjcAskPerChi: z.number().finite().nonnegative(),
    worldXauUsdPerOz: z.number().finite().nonnegative(),
    usdVndRate: z.number().finite().nonnegative(),
    portfolioBidValueVnd: z.number().finite().nonnegative().default(0),
    portfolioCostBasisVnd: z.number().finite().nonnegative().default(0),
    totalRemainingChi: z.number().finite().nonnegative().default(0),
  })
  .refine(
    (s) =>
      (s.nhan9999AskPerChi === 0 || s.nhan9999BidPerChi <= s.nhan9999AskPerChi) &&
      (s.sjcAskPerChi === 0 || s.sjcBidPerChi <= s.sjcAskPerChi),
    {
      message: "Giá mua vào (Bid) trong lịch sử giá không được cao hơn giá bán ra (Ask)",
      path: ["nhan9999BidPerChi"],
    }
  );

export const GoldAlertConditionSchema = z.enum([
  "TARGET_BID_ABOVE",
  "WORLD_PREMIUM_BELOW_PCT",
  "SPREAD_ABOVE_PCT",
  "UNREALIZED_PNL_PCT_ABOVE",
]);

export const GoldAlertRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(160),
  category: GoldCategorySchema,
  condition: GoldAlertConditionSchema,
  threshold: z.number().finite(),
  enabled: z.boolean().default(true),
  createdAt: z.string(),
});

export const GoldPortfolioStateSchema = z.object({
  lots: z.array(GoldLotSchema),
  sales: z.array(GoldSaleEventSchema),
  quotes: z.object({
    NHAN_9999: GoldPriceQuoteSchema,
    SJC_BAR: GoldPriceQuoteSchema,
    GOLD_24K_JEWELRY: GoldPriceQuoteSchema,
    GOLD_18K: GoldPriceQuoteSchema,
    DIGITAL_GOLD: GoldPriceQuoteSchema,
  }),
  macro: GoldMacroContextSchema,
  dcaPlan: GoldDcaPlanSchema,
  includeInNetWorth: z.boolean().default(true),
  priceHistory: z.array(GoldPriceSnapshotSchema).default([]),
  alerts: z.array(GoldAlertRuleSchema).default([]),
  updatedAt: z.string(),
});

const GOLD_CATEGORIES: readonly GoldCategory[] = [
  "NHAN_9999",
  "SJC_BAR",
  "GOLD_24K_JEWELRY",
  "GOLD_18K",
  "DIGITAL_GOLD",
];

function toMicroChiValidation(chi: number): number {
  if (!Number.isFinite(chi) || chi === 0) return 0;
  return Math.round(Number(`${Number(chi.toPrecision(12))}e4`));
}

function fromMicroChiValidation(micro: number): number {
  if (!Number.isFinite(micro) || micro === 0) return 0;
  return Number(`${Math.round(micro)}e-4`);
}

function deriveLotStatus(quantityChi: number, remainingChi: number): GoldLot["status"] {
  if (remainingChi <= 0.0001) return "SOLD";
  if (Math.abs(remainingChi - quantityChi) <= 0.0001) return "HOLDING";
  return "PARTIAL_SOLD";
}

function reconcileLotsAgainstSales(
  lots: GoldLot[],
  sales: GoldSaleEvent[],
  repairedItems: string[]
): { lots: GoldLot[]; changed: boolean } {
  const soldMicroByLotId = new Map<string, number>();
  for (const sale of sales) {
    for (const alloc of sale.allocations) {
      soldMicroByLotId.set(
        alloc.lotId,
        (soldMicroByLotId.get(alloc.lotId) ?? 0) + toMicroChiValidation(alloc.soldChi)
      );
    }
  }

  let changed = false;
  const reconciled = lots.map((lot) => {
    const hasAllocatedSale = soldMicroByLotId.has(lot.id);
    if (!hasAllocatedSale) return lot;
    const expectedRemainingMicro = Math.max(
      0,
      toMicroChiValidation(lot.quantityChi) - (soldMicroByLotId.get(lot.id) ?? 0)
    );
    const expectedRemaining = fromMicroChiValidation(expectedRemainingMicro);
    const expectedStatus = deriveLotStatus(lot.quantityChi, expectedRemaining);
    if (
      Math.abs(toMicroChiValidation(lot.remainingChi) - expectedRemainingMicro) > 1 ||
      lot.status !== expectedStatus
    ) {
      changed = true;
      repairedItems.push(`lots[${lot.id}]:repaired_ledger_balance`);
      return {
        ...lot,
        remainingChi: expectedRemaining,
        status: expectedStatus,
      };
    }
    return lot;
  });

  return { lots: reconciled, changed };
}

function deduplicatePriceHistory(
  history: GoldPriceSnapshot[],
  repairedItems: string[]
): { history: GoldPriceSnapshot[]; changed: boolean } {
  if (history.length <= 1) return { history, changed: false };
  const byDate = new Map<string, GoldPriceSnapshot>();
  let changed = false;
  for (const snap of history) {
    const prev = byDate.get(snap.date);
    if (!prev) {
      byDate.set(snap.date, snap);
    } else {
      changed = true;
      if (snap.recordedAt.localeCompare(prev.recordedAt) > 0) {
        byDate.set(snap.date, snap);
      }
      if (!repairedItems.includes(`priceHistory[${snap.date}]:deduplicated`)) {
        repairedItems.push(`priceHistory[${snap.date}]:deduplicated`);
      }
    }
  }
  const deduped = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { history: deduped, changed };
}

/**
 * Phục hồi dữ liệu cục bộ an toàn (Graceful 3-Layer Auto-Repair) cho Kho Vàng:
 * - Lớp 1 (Quotes): Tự sửa nhẹ báo giá cũ bị ngược Bid > Ask (Ask = Bid) thay vì xóa về mặc định.
 * - Lớp 2 (Price History): Tự sửa nhẹ snapshot lịch sử ngược Bid > Ask và khử trùng ngày.
 * - Lớp 3 (Lots & Ledger): Tự sửa nhẹ lô cũ lệch trạng thái / lệch tồn kho theo sổ phân bổ bán gốc.
 */
export function parseGoldPortfolioSafely(
  raw: unknown,
  fallbackFactory: () => GoldPortfolioState
): {
  data: GoldPortfolioState;
  recovered: boolean;
  droppedItems: string[];
  repairedItems: string[];
} {
  const fullParsed = GoldPortfolioStateSchema.safeParse(raw);
  if (fullParsed.success) {
    const repairedItems: string[] = [];
    const lotCheck = reconcileLotsAgainstSales(
      fullParsed.data.lots,
      fullParsed.data.sales,
      repairedItems
    );
    const historyCheck = deduplicatePriceHistory(
      fullParsed.data.priceHistory ?? [],
      repairedItems
    );
    const changed = lotCheck.changed || historyCheck.changed;
    return {
      data: changed
        ? {
            ...fullParsed.data,
            lots: lotCheck.lots,
            priceHistory: historyCheck.history,
          }
        : fullParsed.data,
      recovered: changed,
      droppedItems: [],
      repairedItems,
    };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      data: fallbackFactory(),
      recovered: true,
      droppedItems: ["goldPortfolio:root"],
      repairedItems: [],
    };
  }

  const obj = raw as Record<string, unknown>;
  const base = fallbackFactory();
  const droppedItems: string[] = [];
  const repairedItems: string[] = [];

  // 1. Sales trước để làm căn cứ đối soát tồn kho cho từng lô cũ
  let sales: GoldSaleEvent[] = base.sales;
  if (Array.isArray(obj.sales)) {
    sales = [];
    obj.sales.forEach((item, idx) => {
      const parsed = GoldSaleEventSchema.safeParse(item);
      if (parsed.success) {
        sales.push(parsed.data);
      } else {
        const rawId =
          item && typeof item === "object" && "id" in item && typeof (item as { id: unknown }).id === "string"
            ? (item as { id: string }).id
            : String(idx);
        droppedItems.push(`sales[${rawId}]`);
      }
    });
  } else if (obj.sales !== undefined) {
    droppedItems.push("sales");
  }

  const soldMicroByLotId = new Map<string, number>();
  for (const sale of sales) {
    for (const alloc of sale.allocations) {
      soldMicroByLotId.set(
        alloc.lotId,
        (soldMicroByLotId.get(alloc.lotId) ?? 0) + toMicroChiValidation(alloc.soldChi)
      );
    }
  }

  // 2. Lots (Lớp 3: Tự sửa nhẹ lô cũ lệch trạng thái / remainingChi vượt biên hoặc lệch phân bổ bán)
  let lots: GoldLot[] = base.lots;
  if (Array.isArray(obj.lots)) {
    lots = [];
    obj.lots.forEach((item, idx) => {
      const parsed = GoldLotSchema.safeParse(item);
      if (parsed.success) {
        lots.push(parsed.data);
        return;
      }

      const rawId =
        item && typeof item === "object" && "id" in item && typeof (item as { id: unknown }).id === "string"
          ? (item as { id: string }).id
          : String(idx);

      let repaired = false;
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const lotObj = item as Record<string, unknown>;
        const qty = lotObj.quantityChi;
        const rem = lotObj.remainingChi;
        if (typeof qty === "number" && Number.isFinite(qty) && qty > 0) {
          const soldMicro = soldMicroByLotId.get(rawId) ?? 0;
          const expectedRemMicro =
            soldMicro > 0
              ? Math.max(0, toMicroChiValidation(qty) - soldMicro)
              : typeof rem === "number" && Number.isFinite(rem) && rem >= 0 && rem <= qty
                ? toMicroChiValidation(rem)
                : toMicroChiValidation(qty);
          const repairedRemaining = fromMicroChiValidation(expectedRemMicro);
          const repairedStatus = deriveLotStatus(qty, repairedRemaining);
          const repairedAttempt = GoldLotSchema.safeParse({
            ...lotObj,
            remainingChi: repairedRemaining,
            status: repairedStatus,
          });
          if (repairedAttempt.success) {
            lots.push(repairedAttempt.data);
            repairedItems.push(`lots[${rawId}]:repaired_status_or_balance`);
            repaired = true;
          }
        }
      }

      if (!repaired) {
        droppedItems.push(`lots[${rawId}]`);
      }
    });
  } else {
    droppedItems.push("lots");
  }

  lots = reconcileLotsAgainstSales(lots, sales, repairedItems).lots;

  // 3. Quotes (Lớp 1: per-category recovery + tự sửa nhẹ Bid > Ask từ dữ liệu cũ)
  const quotes = { ...base.quotes };
  const rawQuotes =
    obj.quotes && typeof obj.quotes === "object" && !Array.isArray(obj.quotes)
      ? (obj.quotes as Record<string, unknown>)
      : null;
  if (rawQuotes) {
    for (const cat of GOLD_CATEGORIES) {
      const rawQuote = rawQuotes[cat];
      const parsedQuote = GoldPriceQuoteSchema.safeParse(rawQuote);
      if (parsedQuote.success) {
        quotes[cat] = parsedQuote.data;
      } else if (rawQuote !== undefined) {
        let repaired = false;
        if (rawQuote && typeof rawQuote === "object" && !Array.isArray(rawQuote)) {
          const qObj = rawQuote as Record<string, unknown>;
          const bid = qObj.buyPricePerChi;
          const ask = qObj.sellPricePerChi;
          if (
            typeof bid === "number" &&
            typeof ask === "number" &&
            Number.isFinite(bid) &&
            Number.isFinite(ask) &&
            bid > 0 &&
            ask > 0 &&
            bid > ask
          ) {
            const repairedAttempt = GoldPriceQuoteSchema.safeParse({
              ...qObj,
              sellPricePerChi: bid,
            });
            if (repairedAttempt.success) {
              quotes[cat] = repairedAttempt.data;
              repairedItems.push(`quotes.${cat}:repaired_inverted_spread`);
              repaired = true;
            }
          }
        }
        if (!repaired) {
          droppedItems.push(`quotes.${cat}`);
        }
      }
    }
  } else if (obj.quotes !== undefined) {
    droppedItems.push("quotes");
  }

  // 4. Macro & DCA Plan
  const parsedMacro = GoldMacroContextSchema.safeParse(obj.macro);
  const macro = parsedMacro.success ? parsedMacro.data : base.macro;
  if (!parsedMacro.success && obj.macro !== undefined) {
    droppedItems.push("macro");
  }

  const parsedDca = GoldDcaPlanSchema.safeParse(obj.dcaPlan);
  const dcaPlan = parsedDca.success ? parsedDca.data : base.dcaPlan;
  if (!parsedDca.success && obj.dcaPlan !== undefined) {
    droppedItems.push("dcaPlan");
  }

  // 5. Price History (Lớp 2: Tự sửa nhẹ snapshot ngược Bid > Ask + khử trùng mốc ngày)
  let priceHistory: GoldPriceSnapshot[] = base.priceHistory ?? [];
  if (Array.isArray(obj.priceHistory)) {
    priceHistory = [];
    obj.priceHistory.forEach((item, idx) => {
      const parsed = GoldPriceSnapshotSchema.safeParse(item);
      if (parsed.success) {
        priceHistory.push(parsed.data);
        return;
      }

      let repaired = false;
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const sObj = item as Record<string, unknown>;
        const nBid = sObj.nhan9999BidPerChi;
        const nAsk = sObj.nhan9999AskPerChi;
        const sBid = sObj.sjcBidPerChi;
        const sAsk = sObj.sjcAskPerChi;
        const nextNhanAsk =
          typeof nBid === "number" && typeof nAsk === "number" && nAsk > 0 && nBid > nAsk
            ? nBid
            : nAsk;
        const nextSjcAsk =
          typeof sBid === "number" && typeof sAsk === "number" && sAsk > 0 && sBid > sAsk
            ? sBid
            : sAsk;
        if (nextNhanAsk !== nAsk || nextSjcAsk !== sAsk) {
          const repairedAttempt = GoldPriceSnapshotSchema.safeParse({
            ...sObj,
            nhan9999AskPerChi: nextNhanAsk,
            sjcAskPerChi: nextSjcAsk,
          });
          if (repairedAttempt.success) {
            priceHistory.push(repairedAttempt.data);
            const dateTag =
              typeof sObj.date === "string" && sObj.date.length > 0 ? sObj.date : String(idx);
            repairedItems.push(`priceHistory[${dateTag}]:repaired_inverted_spread`);
            repaired = true;
          }
        }
      }

      if (!repaired) {
        droppedItems.push(`priceHistory[${idx}]`);
      }
    });
    priceHistory = deduplicatePriceHistory(priceHistory, repairedItems).history;
  } else if (obj.priceHistory !== undefined) {
    droppedItems.push("priceHistory");
  }

  // 6. Alerts
  let alerts: GoldAlertRule[] = base.alerts ?? [];
  if (Array.isArray(obj.alerts)) {
    alerts = [];
    obj.alerts.forEach((item, idx) => {
      const parsed = GoldAlertRuleSchema.safeParse(item);
      if (parsed.success) {
        alerts.push(parsed.data);
      } else {
        droppedItems.push(`alerts[${idx}]`);
      }
    });
  } else if (obj.alerts !== undefined) {
    droppedItems.push("alerts");
  }

  const includeInNetWorth =
    typeof obj.includeInNetWorth === "boolean"
      ? obj.includeInNetWorth
      : base.includeInNetWorth;

  const updatedAt =
    typeof obj.updatedAt === "string" && obj.updatedAt.trim().length > 0
      ? obj.updatedAt
      : base.updatedAt;

  return {
    data: {
      lots,
      sales,
      quotes,
      macro,
      dcaPlan,
      includeInNetWorth,
      priceHistory,
      alerts,
      updatedAt,
    },
    recovered: true,
    droppedItems,
    repairedItems,
  };
}

export const InteriorStylePresetSchema = z.enum([
  "MODERN_WARM",
  "JAPANDI",
  "MINIMALIST_SLATE",
  "WARM_SCANDINAVIAN",
]);

export const InteriorBoqGroupSchema = z.enum([
  "WOOD_FURNITURE",
  "APPLIANCES",
  "FINISHING_DECOR",
  "DEVELOPER_INCLUDED",
]);

export const InteriorCatalogKeySchema = z.enum([
  "sofa_3seat",
  "accent_armchair",
  "coffee_table",
  "area_rug",
  "tv_console_slat",
  "shoe_cabinet_tall",
  "dining_set_4",
  "kitchen_l_hafele",
  "fridge_inverter",
  "bed_master_160",
  "bed_compact_140",
  "nightstand",
  "wardrobe_tall",
  "wardrobe_compact",
  "dual_workstation_desk",
  "single_desk",
  "ergonomic_chair",
  "tall_bookshelf_led",
  "pegboard_goal_wall",
  "reading_lounge_chair",
  "washer_dryer",
  "ac_inverter",
  "smart_tv",
  "floor_plant",
  "balcony_planter",
  "wc_hafele_set",
  "sofa_bed_smart",
  "tatami_podium_bed",
  "folding_dining_table",
  "vanity_desk_mirror",
  "mini_kitchen_island",
  "fridge_top_cabinet",
  "dual_monitor_arm",
  "pc_tower_stand",
  "desk_lamp_screenbar",
  "rolling_file_cabinet",
  "pendant_dining_light",
  "floor_arc_lamp",
  "wall_art_duo",
  "arch_full_mirror",
  "air_purifier",
  "robot_vacuum_dock",
  "dishwasher_compact",
  "balcony_bistro_set",
  "beanbag_lounger",
  "loggia_drying_rack",
  "custom_glb_model",
]);

export const InteriorMaterialFinishSchema = z.enum([
  "WARM_OAK",
  "LIGHT_WALNUT",
  "CREAM_BOUCLE",
  "SAGE_LINEN",
  "MATTE_CREAM",
  "CHARCOAL_SLATE",
  "WHITE_MARBLE",
  "BRUSHED_TITANIUM",
]);

export const InteriorMountTypeSchema = z.enum(["FLOOR", "WALL", "SURFACE"]);

export const InteriorWallModeSchema = z.enum([
  "SOLID",
  "OPEN",
  "GLASS_PARTITION",
  "WOOD_SLAT",
]);

export const InteriorWallAccentFinishSchema = z.enum([
  "DEFAULT",
  "CONCRETE_EFFECT",
  "WOOD_SLAT_PANEL",
  "MARBLE_PVC",
  "TINTED_MIRROR",
  "SAGE_PAINT",
  "WARM_BEIGE_PAINT",
]);

export const InteriorWallOverrideSchema = z.object({
  mode: InteriorWallModeSchema.optional(),
  accentFinish: InteriorWallAccentFinishSchema.optional(),
});

export const InteriorDoorModeSchema = z.enum([
  "SWING_90",
  "SLIDING_POCKET",
  "OPEN_ARCH",
]);

export const InteriorFloorPatternSchema = z.enum(["STRAIGHT", "HERRINGBONE"]);

export const InteriorLightingZonesSchema = z.object({
  living: z.boolean(),
  kitchen: z.boolean(),
  master: z.boolean(),
  room05: z.boolean(),
});

export const InteriorBoqPaymentStageSchema = z.enum([
  "DEPOSIT",
  "DELIVERY",
  "ACCEPTANCE",
  "OTHER",
]);

export const InteriorBoqPaymentRecordSchema = z.object({
  id: z.string().min(1),
  stage: InteriorBoqPaymentStageSchema,
  amountVnd: z.number().positive(),
  date: z.string().min(1),
  accountId: z.string().min(1),
  memberId: FamilyMemberSchema,
  linkedTransactionId: z.string().optional(),
  note: z.string().optional(),
});

export const InteriorMepPointKindSchema = z.enum([
  "OUTLET_DOUBLE",
  "NETWORK_LAN",
  "AC_DRAIN",
  "WATER_DRAIN",
  "LIGHT_SWITCH",
]);

export const InteriorMepPointSchema = z.object({
  id: z.string().min(1),
  kind: InteriorMepPointKindSchema,
  label: z.string().min(1),
  roomId: z.string().min(1),
  x: z.number(),
  z: z.number(),
  heightCm: z.number().min(0).max(300),
  note: z.string().optional(),
});

export const InteriorExecutionPhaseSchema = z.enum([
  "PHASE_1_MOVE_IN",
  "PHASE_2_UPGRADE",
]);

export const InteriorFurnitureItemSchema = z.object({
  id: z.string().min(1),
  catalogKey: InteriorCatalogKeySchema,
  name: z.string().min(1),
  roomId: z.string().min(1),
  source: z.enum(["DEVELOPER_INCLUDED", "NEW_PURCHASE"]),
  position: z.object({
    x: z.number(),
    z: z.number(),
  }),
  rotationDeg: z.number(),
  dimensionsCm: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive(),
  }),
  materialFinish: InteriorMaterialFinishSchema,
  mountType: InteriorMountTypeSchema.optional(),
  elevationCm: z.number().min(0).max(300).optional(),
  customGlbId: z.string().optional(),
  customGlbName: z.string().optional(),
  isLocked: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  pricingRule: z.enum(["FIXED_UNIT", "PER_LINEAR_METER", "PER_SQUARE_METER"]),
  unitPriceVnd: z.number().nonnegative(),
  boqGroup: InteriorBoqGroupSchema,
  executionPhase: InteriorExecutionPhaseSchema.optional(),
  procurementStatus: z.enum(["PLANNED", "QUOTED", "DEPOSITED", "INSTALLED"]),
  linkedTransactionId: z.string().optional(),
  payments: z.array(InteriorBoqPaymentRecordSchema).optional(),
  vendorName: z.string().optional(),
  leadTimeDays: z.number().nonnegative().optional(),
  warrantyMonths: z.number().nonnegative().optional(),
  note: z.string().optional(),
});

export const InteriorExtraBoqItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  roomId: z.string().min(1),
  boqGroup: InteriorBoqGroupSchema,
  executionPhase: InteriorExecutionPhaseSchema.optional(),
  source: z.enum(["DEVELOPER_INCLUDED", "NEW_PURCHASE"]),
  unit: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceVnd: z.number().nonnegative(),
  procurementStatus: z.enum(["PLANNED", "QUOTED", "DEPOSITED", "INSTALLED"]),
  linkedTransactionId: z.string().optional(),
  payments: z.array(InteriorBoqPaymentRecordSchema).optional(),
  vendorName: z.string().optional(),
  leadTimeDays: z.number().nonnegative().optional(),
  warrantyMonths: z.number().nonnegative().optional(),
  note: z.string().optional(),
});

export const InteriorCameraSnapshotSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  target: z.tuple([z.number(), z.number(), z.number()]),
  preset: z
    .enum([
      "DOLLHOUSE",
      "ENTRANCE",
      "LIVING_BALCONY",
      "KITCHEN_DINING",
      "MASTER_BEDROOM",
      "ROOM_05_STUDIO",
    ])
    .optional(),
  navMode: z.enum(["ORBIT", "WALKTHROUGH"]).optional(),
  timeOfDay: z.enum(["MORNING_08", "NOON_12", "AFTERNOON_1630", "EVENING_20"]).optional(),
  fov: z.number().min(20).max(90).optional(),
  autoCutaway: z.boolean().optional(),
});

export const InteriorCameraBookmarkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  position: z.tuple([z.number(), z.number(), z.number()]),
  target: z.tuple([z.number(), z.number(), z.number()]),
  createdAt: z.string(),
});

export const InteriorDesignScenarioSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  shortLabel: z.string().min(1),
  description: z.string(),
  stylePreset: InteriorStylePresetSchema,
  targetBudgetMinVnd: z.number().nonnegative(),
  targetBudgetMaxVnd: z.number().positive(),
  contingencyPercent: z.number().min(0).max(50),
  isLockedBaseline: z.boolean().optional(),
  items: z.array(InteriorFurnitureItemSchema),
  extraBoqItems: z.array(InteriorExtraBoqItemSchema),
  mepPoints: z.array(InteriorMepPointSchema).optional(),
  wallOverrides: z.record(z.string(), InteriorWallOverrideSchema).optional(),
  doorOverrides: z.record(z.string(), InteriorDoorModeSchema).optional(),
  roomFloorOverrides: z.record(z.string(), InteriorFloorPatternSchema).optional(),
  lightingZones: InteriorLightingZonesSchema.optional(),
  curtainOpenRatio: z.number().min(0).max(1).optional(),
  lastCameraView: InteriorCameraSnapshotSchema.optional(),
  cameraBookmarks: z.array(InteriorCameraBookmarkSchema).optional(),
  updatedAt: z.string(),
});

export const HandoverChecklistStatusSchema = z.enum([
  "PENDING",
  "PASSED",
  "DEFECT_MINOR",
  "DEFECT_CRITICAL",
]);

export const HandoverChecklistItemSchema = z.object({
  id: z.string().min(1),
  zoneCode: z.string().min(1),
  zoneName: z.string().min(1),
  title: z.string().min(1),
  specDetail: z.string(),
  checked: z.boolean(),
  status: HandoverChecklistStatusSchema.optional(),
  isCustom: z.boolean().optional(),
  localPhotoKey: z.string().optional(),
  note: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const InteriorStudioStateSchema = z.object({
  apartmentCode: z.string().min(1),
  usableAreaSqm: z.number().positive(),
  builtUpAreaSqm: z.number().positive(),
  orientation: z.enum(["EAST_SOUTHEAST", "EAST", "SOUTH", "WEST"]),
  targetHandoverDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  activeScenarioId: z.string().min(1),
  scenarios: z.array(InteriorDesignScenarioSchema).min(1),
  handoverChecklist: z.array(HandoverChecklistItemSchema),
  updatedAt: z.string(),
});

export const AppDataBackupSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  categories: z.array(CategorySchema),
  accounts: z.array(AccountSchema).optional(),
  transactions: z.array(TransactionSchema),
  budgets: z.array(BudgetSchema).optional(),
  goals: z.array(SavingsGoalSchema).optional(),
  debts: z.array(DebtItemSchema).optional(),
  investments: z.array(InvestmentItemSchema).optional(),
  recurringRules: z.array(RecurringRuleSchema).optional(),
  savingsChallenges: z.array(SavingsChallengeSchema).optional(),
  settings: AppSettingsSchema.optional(),
  skyoneLoan: MortgageContractSchema.optional(),
  goldPortfolio: GoldPortfolioStateSchema.optional(),
  interiorStudio: InteriorStudioStateSchema.optional(),
});

export type TransactionInput = z.infer<typeof TransactionInputSchema>;
export type AppDataBackupValid = z.infer<typeof AppDataBackupSchema>;
