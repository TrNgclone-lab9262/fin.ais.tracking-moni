import { z } from "zod";

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

export const GoldLotSchema = z.object({
  id: z.string().min(1),
  category: GoldCategorySchema,
  brand: z.string().min(1),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantityChi: z.number().positive(),
  remainingChi: z.number().nonnegative(),
  unitBuyPricePerChi: z.number().positive(),
  makingFee: z.number().nonnegative(),
  memberId: FamilyMemberSchema,
  storageLocation: GoldStorageLocationSchema,
  invoiceNote: z.string().optional(),
  linkedTransactionId: z.string().optional(),
  status: z.enum(["HOLDING", "PARTIAL_SOLD", "SOLD"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const GoldSaleAllocationSchema = z.object({
  lotId: z.string().min(1),
  soldChi: z.number().positive(),
  costBasisAllocated: z.number().nonnegative(),
});

export const GoldSaleEventSchema = z.object({
  id: z.string().min(1),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: GoldCategorySchema,
  allocations: z.array(GoldSaleAllocationSchema),
  totalSoldChi: z.number().positive(),
  unitSellPricePerChi: z.number().positive(),
  totalProceeds: z.number().nonnegative(),
  costBasisAllocated: z.number().nonnegative(),
  realizedPnl: z.number(),
  purpose: z.enum(["INTERIOR_HANDOVER", "SKYONE_PREPAY", "REBALANCE", "OTHER"]),
  linkedTransactionId: z.string().optional(),
  note: z.string().optional(),
  createdAt: z.string(),
});

export const GoldPriceQuoteSchema = z.object({
  category: GoldCategorySchema,
  brandLabel: z.string().min(1),
  buyPricePerChi: z.number().positive(),
  sellPricePerChi: z.number().positive(),
  updatedAt: z.string(),
  source: z.enum(["MANUAL", "SERVER_REFERENCE"]),
});

export const GoldMacroContextSchema = z.object({
  worldXauUsdPerOz: z.number().nonnegative(),
  usdVndRate: z.number().positive(),
  updatedAt: z.string(),
});

export const GoldDcaPlanSchema = z.object({
  enabled: z.boolean(),
  targetCategory: GoldCategorySchema,
  monthlyTargetChi: z.number().nonnegative(),
  monthlyBudgetVnd: z.number().nonnegative(),
  targetAllocationPercentOfNetWorth: z.number().min(0).max(100),
  targetReserveChiFor2027: z.number().nonnegative(),
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
  includeInNetWorth: z.boolean(),
  updatedAt: z.string(),
});

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
  pricingRule: z.enum(["FIXED_UNIT", "PER_LINEAR_METER", "PER_SQUARE_METER"]),
  unitPriceVnd: z.number().nonnegative(),
  boqGroup: InteriorBoqGroupSchema,
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
  items: z.array(InteriorFurnitureItemSchema),
  extraBoqItems: z.array(InteriorExtraBoqItemSchema),
  mepPoints: z.array(InteriorMepPointSchema).optional(),
  wallOverrides: z.record(z.string(), InteriorWallOverrideSchema).optional(),
  doorOverrides: z.record(z.string(), InteriorDoorModeSchema).optional(),
  roomFloorOverrides: z.record(z.string(), InteriorFloorPatternSchema).optional(),
  lightingZones: InteriorLightingZonesSchema.optional(),
  curtainOpenRatio: z.number().min(0).max(1).optional(),
  updatedAt: z.string(),
});

export const HandoverChecklistItemSchema = z.object({
  id: z.string().min(1),
  zoneCode: z.string().min(1),
  zoneName: z.string().min(1),
  title: z.string().min(1),
  specDetail: z.string(),
  checked: z.boolean(),
  note: z.string().optional(),
});

export const InteriorStudioStateSchema = z.object({
  apartmentCode: z.string().min(1),
  usableAreaSqm: z.number().positive(),
  builtUpAreaSqm: z.number().positive(),
  orientation: z.enum(["EAST_SOUTHEAST", "EAST", "SOUTH", "WEST"]),
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
