export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export type AccountType = 'BANK' | 'CASH' | 'E_WALLET' | 'CREDIT_CARD';

export type DebtType = 'BORROW' | 'LEND';

export type InvestmentType = 'GOLD' | 'SAVINGS' | 'STOCK' | 'OTHER';

export type ThemeColor = 'blue' | 'purple' | 'pink' | 'green' | 'orange';

export type ThemeMode = 'light' | 'dark';

export type FamilyMember = 'HUSBAND' | 'WIFE' | 'SHARED';

export type ExpenseScope = 'FAMILY' | 'PERSONAL';

export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  color: string;
  icon?: string;
  isDefault?: boolean;
  isHidden?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  owner: FamilyMember;       // Chồng | Vợ | Chung
  isSalaryAccount?: boolean; // Tài khoản nhận lương chính
  creditLimit?: number;      // Hạn mức thẻ tín dụng (50tr Chồng, 20tr Vợ)
  statementDay?: number;     // Ngày chốt sao kê (mặc định 20)
  dueDay?: number;           // Ngày đến hạn thanh toán (mặc định 6)
  initialBalance: number;
  currentBalance: number;    // Với thẻ tín dụng: dư nợ đang dùng
  accountNumber?: string;
  icon?: string;
  color?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  date: string;               // YYYY-MM-DD
  type: TransactionType;
  categoryId: string;
  accountId: string;          // Ví nguồn
  toAccountId?: string;       // Ví đích
  memberId: FamilyMember;     // Ai là người thực hiện (Chồng hay Vợ)
  scope: ExpenseScope;        // Chi cho việc chung gia đình hay cá nhân
  note?: string;
  tag?: 'NORMAL' | 'DEBT' | 'INVESTMENT' | 'RECURRING';
  createdAt: string;
  updatedAt: string;
}

export interface RecurringRule {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  memberId: FamilyMember;
  scope: ExpenseScope;
  dayOfMonth: number;
  isActive: boolean;
  autoPost?: boolean;
  lastAppliedMonth?: string;
  lastSkippedDuplicateMonth?: string;
  note?: string;
}

export interface CategoryBudget {
  categoryId: string;
  month: string;              // YYYY-MM
  limitAmount: number;
}

export interface BudgetProgressItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon?: string;
  isCompleted: boolean;
  memberId?: FamilyMember;
}

export interface DebtItem {
  id: string;
  name: string;
  type: DebtType;
  totalAmount: number;
  paidAmount: number;
  interestRate: number;
  startDate: string;
  dueDate: string;
  status: 'ACTIVE' | 'PAID';
  memberId?: FamilyMember;
}

export interface InvestmentItem {
  id: string;
  name: string;
  type: InvestmentType;
  amount: number;
  currentValue?: number;
  expectedProfitRate: number;
  startDate: string;
  status: 'ACTIVE' | 'CLOSED';
  memberId?: FamilyMember;
}

export type AuthMemberId = 'HUSBAND' | 'WIFE';

export interface MemberAuthConfig {
  passcodeHash?: string;
  passcodeSalt?: string;
  webauthnCredentialId?: string;
  webauthnDeviceLabel?: string;
  wallpaperBlur?: number;  // 0 | 8 | 16 px
  wallpaperDim?: number;   // 35 | 55 | 75 %
  updatedAt?: string;
}

export type QuickAuthViewId = 'accounts' | 'debts_invest' | 'data_admin';

export interface QuickAuthSettings {
  enabled: boolean;
  protectedViews: QuickAuthViewId[];
}

export interface AppSettings {
  themeColor: ThemeColor;
  themeMode?: ThemeMode;
  currency: 'VND';
  notificationsEnabled: boolean;
  husbandName: string;
  wifeName: string;
  sharedSplitRatioHusband?: number; // % đóng góp quỹ chung của Chồng (mặc định 50)
  privacyMode?: boolean;            // Ẩn số tiền nhạy cảm
  pinCode?: string;                 // Legacy PIN 4 số (tự động nâng cấp sang passcodeHash)
  requireAuthOnOpen?: boolean;      // Yêu cầu xác thực /login mỗi khi mở ứng dụng
  autoLockMinutes?: number;         // Tự động khóa sau X phút không thao tác (0 = tắt)
  lockOnBackground?: boolean;       // Tự động khóa khi ẩn ứng dụng xuống nền
  authActiveProfile?: AuthMemberId; // Hồ sơ đăng nhập gần nhất trên /login
  husbandAuth?: MemberAuthConfig;   // Cấu hình Code, Face ID & nền khóa của Anh Chuột
  wifeAuth?: MemberAuthConfig;      // Cấu hình Code, Face ID & nền khóa của Bé Mèo
  requireAuthForDangerActions?: boolean; // Hỏi mã Code / Face ID cho thao tác nguy hiểm (Reset, xóa hàng loạt, ghi đè)
  quickAuth?: QuickAuthSettings;    // Xác thực nhanh Face ID / Mã Code độc lập cho các mục nhạy cảm
  dismissedRecurringSuggestionKeys?: string[]; // Các mẫu gợi ý định kỳ từ lịch sử đã ẩn
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'danger';
  date: string;
  read: boolean;
  actionType?: 'APPLY_RECURRING' | 'PAY_INSTALLMENT';
  recurringRuleId?: string;
  monthKey?: string;
  installmentPeriod?: number;
  installmentDueDate?: string;
  installmentAmount?: number;
}

export type MortgageStage = 'FIXED' | 'FLOATING';

export type MortgagePrepayStrategy = 'SHORTEN_TERM' | 'REDUCE_MONTHLY';

export type MortgageInstallmentStatus = 'PAID' | 'DUE_SOON' | 'OVERDUE' | 'UPCOMING';

export type MortgageInterestBasis = 'ACTUAL_365' | 'THIRTY_360';

export interface MortgagePrepaymentPenaltyTier {
  fromYear: number;
  toYear: number;
  feePercent: number;
}

export interface MortgageRateAdjustment {
  id: string;
  effectiveFromPeriod: number;
  annualRate: number;
  effectiveDate: string;
  note?: string;
}

export interface MortgagePaidInstallmentRecord {
  period: number;
  paidAt: string;
  paidPrincipal: number;
  paidInterest: number;
  appliedRate: number;
  linkedTransactionId?: string;
  note?: string;
  isVerified?: boolean;
  verifiedSource?: string;
}

export interface MortgagePrepaymentEvent {
  id: string;
  date: string;
  afterPeriod: number;
  amount: number;
  penaltyAmount: number;
  feePercent: number;
  strategy: MortgagePrepayStrategy;
  linkedTransactionId?: string;
  note?: string;
}

export interface MortgagePlannedDisbursement {
  id: string;
  afterPeriod: number;
  date: string;
  amount: number;
  note?: string;
}

export interface MortgagePeriodCashflowOverride {
  period: number;
  principal?: number;
  interest?: number;
  appliedRate?: number;
  paidAt?: string;
  note?: string;
}

export interface MortgageContract {
  id: string;
  projectName: string;
  unitCode: string;
  bankName: string;
  accountNumber?: string;
  branchName?: string;
  propertyValue: number;
  currentMarketValue: number;
  downPayment: number;
  creditLimit?: number;
  loanAmount: number;
  termMonths: number;
  disbursementDate: string;
  paymentDayOfMonth: number;
  fixedRateMonths: number;
  fixedInterestRate: number;
  floatingBaseRate: number;
  floatingSpread: number;
  monthlyPrincipalOverride?: number;
  interestBasis?: MortgageInterestBasis;
  prepayStrategyDefault: MortgagePrepayStrategy;
  prepaymentPenaltyTiers: MortgagePrepaymentPenaltyTier[];
  rateAdjustments: MortgageRateAdjustment[];
  paidRecords: MortgagePaidInstallmentRecord[];
  prepayments: MortgagePrepaymentEvent[];
  plannedDisbursements?: MortgagePlannedDisbursement[];
  cashflowLocked?: boolean;
  periodOverrides?: MortgagePeriodCashflowOverride[];
  updatedAt: string;
}

export type SavingsChallengeMode = 'AUTO_SURPLUS' | 'MANUAL';

export interface SavingsChallenge {
  id: string;
  name: string;
  month: string; // YYYY-MM
  targetAmount: number;
  manualSavedAmount: number;
  trackingMode: SavingsChallengeMode;
  color: string;
  memberId?: FamilyMember;
  icon?: string;
  createdAt: string;
}

export type GoldCategory =
  | 'NHAN_9999'
  | 'SJC_BAR'
  | 'GOLD_24K_JEWELRY'
  | 'GOLD_18K'
  | 'DIGITAL_GOLD';

export type GoldStorageLocation = 'HOME_SAFE' | 'BANK_VAULT' | 'STORE_KEEP' | 'PARENTS';

export type GoldLotStatus = 'HOLDING' | 'PARTIAL_SOLD' | 'SOLD';

export type GoldSalePurpose = 'INTERIOR_HANDOVER' | 'SKYONE_PREPAY' | 'REBALANCE' | 'OTHER';

export type GoldLiquidationStrategy = 'MIN_SPREAD_FIRST' | 'HIGHEST_PROFIT_FIRST' | 'FIFO';

export interface GoldLot {
  id: string;
  category: GoldCategory;
  brand: string;
  purchaseDate: string;          // YYYY-MM-DD
  quantityChi: number;           // Chuẩn hóa về Chỉ (1 Lượng = 10 Chỉ)
  remainingChi: number;          // Số chỉ còn nắm giữ
  unitBuyPricePerChi: number;    // Giá mua thực tế (VND / chỉ)
  makingFee: number;             // Phí gia công / công chế tác (VND)
  memberId: FamilyMember;
  storageLocation: GoldStorageLocation;
  serialNumber?: string;         // Số seri vỉ / miếng SJC, PNJ
  certificateCode?: string;      // Mã hóa đơn / giấy đảm bảo vàng
  storeName?: string;            // Cửa hàng / chi nhánh mua
  purityLabel?: string;          // VD: 999.9 (24K), 750 (18K)
  invoiceNote?: string;
  linkedTransactionId?: string;
  status: GoldLotStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GoldSaleAllocation {
  lotId: string;
  soldChi: number;
  costBasisAllocated: number;
}

export interface GoldSaleEvent {
  id: string;
  saleDate: string;              // YYYY-MM-DD
  category: GoldCategory;
  allocations: GoldSaleAllocation[];
  totalSoldChi: number;
  unitSellPricePerChi: number;   // Giá tiệm mua lại thực nhận (Bid VND/chỉ)
  totalProceeds: number;
  costBasisAllocated: number;
  realizedPnl: number;
  purpose: GoldSalePurpose;
  linkedTransactionId?: string;
  note?: string;
  createdAt: string;
}

export interface GoldPriceQuote {
  category: GoldCategory;
  brandLabel: string;
  buyPricePerChi: number;        // Giá tiệm MUA VÀO (Bid — dùng tính Liquidation Value)
  sellPricePerChi: number;       // Giá tiệm BÁN RA (Ask — dùng tính Spread & Breakeven)
  updatedAt: string;
  source: 'MANUAL' | 'SERVER_REFERENCE';
}

export interface GoldMacroContext {
  worldXauUsdPerOz: number;      // Giá vàng thế giới (USD / Troy Ounce)
  usdVndRate: number;            // Tỷ giá USD/VND tham chiếu
  updatedAt: string;
}

export interface GoldDcaPlan {
  enabled: boolean;
  targetCategory: GoldCategory;
  monthlyTargetChi: number;
  monthlyBudgetVnd: number;
  targetAllocationPercentOfNetWorth: number;
  targetReserveChiFor2027: number;
}

export interface GoldPriceSnapshot {
  date: string;                  // YYYY-MM-DD
  recordedAt: string;            // ISO timestamp
  nhan9999BidPerChi: number;
  nhan9999AskPerChi: number;
  sjcBidPerChi: number;
  sjcAskPerChi: number;
  worldXauUsdPerOz: number;
  usdVndRate: number;
  portfolioBidValueVnd: number;
  portfolioCostBasisVnd: number;
  totalRemainingChi: number;
}

export type GoldAlertCondition =
  | 'TARGET_BID_ABOVE'
  | 'WORLD_PREMIUM_BELOW_PCT'
  | 'SPREAD_ABOVE_PCT'
  | 'UNREALIZED_PNL_PCT_ABOVE';

export interface GoldAlertRule {
  id: string;
  label: string;
  category: GoldCategory;
  condition: GoldAlertCondition;
  threshold: number;             // VND/chỉ cho TARGET_BID_ABOVE, % cho các điều kiện còn lại
  enabled: boolean;
  createdAt: string;
}

export interface GoldPortfolioState {
  lots: GoldLot[];
  sales: GoldSaleEvent[];
  quotes: Record<GoldCategory, GoldPriceQuote>;
  macro: GoldMacroContext;
  dcaPlan: GoldDcaPlan;
  includeInNetWorth: boolean;
  priceHistory?: GoldPriceSnapshot[];
  alerts?: GoldAlertRule[];
  updatedAt: string;
}

export type InteriorStylePreset =
  | 'MODERN_WARM'
  | 'JAPANDI'
  | 'MINIMALIST_SLATE'
  | 'WARM_SCANDINAVIAN';

export type InteriorTimeOfDay = 'MORNING_08' | 'NOON_12' | 'AFTERNOON_1630' | 'EVENING_20';

export type InteriorCameraMode = 'ORBIT' | 'WALKTHROUGH';

export type InteriorCameraPresetId =
  | 'DOLLHOUSE'
  | 'ENTRANCE'
  | 'LIVING_BALCONY'
  | 'KITCHEN_DINING'
  | 'MASTER_BEDROOM'
  | 'ROOM_05_STUDIO';

export type InteriorViewMode = '3D' | '2D' | 'SPLIT';

export type InteriorBoqGroup =
  | 'WOOD_FURNITURE'
  | 'APPLIANCES'
  | 'FINISHING_DECOR'
  | 'DEVELOPER_INCLUDED';

export type InteriorItemSource = 'DEVELOPER_INCLUDED' | 'NEW_PURCHASE';

export type InteriorProcurementStatus = 'PLANNED' | 'QUOTED' | 'DEPOSITED' | 'INSTALLED';

export type InteriorPricingRule = 'FIXED_UNIT' | 'PER_LINEAR_METER' | 'PER_SQUARE_METER';

export type InteriorExecutionPhase = 'PHASE_1_MOVE_IN' | 'PHASE_2_UPGRADE';

export type InteriorCatalogKey =
  | 'sofa_3seat'
  | 'accent_armchair'
  | 'coffee_table'
  | 'area_rug'
  | 'tv_console_slat'
  | 'shoe_cabinet_tall'
  | 'dining_set_4'
  | 'kitchen_l_hafele'
  | 'fridge_inverter'
  | 'bed_master_160'
  | 'bed_compact_140'
  | 'nightstand'
  | 'wardrobe_tall'
  | 'wardrobe_compact'
  | 'dual_workstation_desk'
  | 'single_desk'
  | 'ergonomic_chair'
  | 'tall_bookshelf_led'
  | 'pegboard_goal_wall'
  | 'reading_lounge_chair'
  | 'washer_dryer'
  | 'ac_inverter'
  | 'smart_tv'
  | 'floor_plant'
  | 'balcony_planter'
  | 'wc_hafele_set'
  // Ưu tiên 3: ~20 mẫu thông minh, Studio Phòng 05, Decor & Tiện ích + Cổng nạp GLB
  | 'sofa_bed_smart'
  | 'tatami_podium_bed'
  | 'folding_dining_table'
  | 'vanity_desk_mirror'
  | 'mini_kitchen_island'
  | 'fridge_top_cabinet'
  | 'dual_monitor_arm'
  | 'pc_tower_stand'
  | 'desk_lamp_screenbar'
  | 'rolling_file_cabinet'
  | 'pendant_dining_light'
  | 'floor_arc_lamp'
  | 'wall_art_duo'
  | 'arch_full_mirror'
  | 'air_purifier'
  | 'robot_vacuum_dock'
  | 'dishwasher_compact'
  | 'balcony_bistro_set'
  | 'beanbag_lounger'
  | 'loggia_drying_rack'
  | 'custom_glb_model';

export type InteriorMaterialFinish =
  | 'WARM_OAK'
  | 'LIGHT_WALNUT'
  | 'CREAM_BOUCLE'
  | 'SAGE_LINEN'
  | 'MATTE_CREAM'
  | 'CHARCOAL_SLATE'
  | 'WHITE_MARBLE'
  | 'BRUSHED_TITANIUM';

export type InteriorMountType = 'FLOOR' | 'WALL' | 'SURFACE';

export type InteriorWallMode = 'SOLID' | 'OPEN' | 'GLASS_PARTITION' | 'WOOD_SLAT';

export type InteriorWallAccentFinish =
  | 'DEFAULT'
  | 'CONCRETE_EFFECT'
  | 'WOOD_SLAT_PANEL'
  | 'MARBLE_PVC'
  | 'TINTED_MIRROR'
  | 'SAGE_PAINT'
  | 'WARM_BEIGE_PAINT';

export interface InteriorWallOverride {
  mode?: InteriorWallMode;
  accentFinish?: InteriorWallAccentFinish;
}

export type InteriorDoorMode = 'SWING_90' | 'SLIDING_POCKET' | 'OPEN_ARCH';

export type InteriorFloorPattern = 'STRAIGHT' | 'HERRINGBONE';

export interface InteriorLightingZones {
  living: boolean;
  kitchen: boolean;
  master: boolean;
  room05: boolean;
}

export interface InteriorDimensionsCm {
  width: number;
  depth: number;
  height: number;
}

export type InteriorBoqPaymentStage = 'DEPOSIT' | 'DELIVERY' | 'ACCEPTANCE' | 'OTHER';

export interface InteriorBoqPaymentRecord {
  id: string;
  stage: InteriorBoqPaymentStage;
  amountVnd: number;
  date: string;
  accountId: string;
  memberId: FamilyMember;
  linkedTransactionId?: string;
  note?: string;
}

export type InteriorMepPointKind =
  | 'OUTLET_DOUBLE'
  | 'NETWORK_LAN'
  | 'AC_DRAIN'
  | 'WATER_DRAIN'
  | 'LIGHT_SWITCH';

export interface InteriorMepPoint {
  id: string;
  kind: InteriorMepPointKind;
  label: string;
  roomId: string;
  x: number;
  z: number;
  heightCm: number;
  note?: string;
}

export interface InteriorFurnitureItem {
  id: string;
  catalogKey: InteriorCatalogKey;
  name: string;
  roomId: string;
  source: InteriorItemSource;
  position: { x: number; z: number }; // Mét, gốc tọa độ tâm căn hộ
  rotationDeg: number;
  dimensionsCm: InteriorDimensionsCm;
  materialFinish: InteriorMaterialFinish;
  mountType?: InteriorMountType;
  elevationCm?: number; // Cao độ đáy vật thể so với mặt sàn (cm)
  customGlbId?: string; // Tham chiếu khóa file .glb lưu trong IndexedDB
  customGlbName?: string;
  isLocked?: boolean;
  isHidden?: boolean; // Ẩn tạm trên 3D/2D để soi góc kỹ thuật, vẫn giữ trong BOQ
  pricingRule: InteriorPricingRule;
  unitPriceVnd: number;
  boqGroup: InteriorBoqGroup;
  executionPhase?: InteriorExecutionPhase; // Value Engineering: Giai đoạn 1 (Nhận nhà) / Giai đoạn 2 (Nâng cấp sau)
  procurementStatus: InteriorProcurementStatus;
  linkedTransactionId?: string;
  payments?: InteriorBoqPaymentRecord[];
  vendorName?: string;
  leadTimeDays?: number;
  warrantyMonths?: number;
  note?: string;
}

export interface InteriorExtraBoqItem {
  id: string;
  name: string;
  roomId: string;
  boqGroup: InteriorBoqGroup;
  executionPhase?: InteriorExecutionPhase;
  source: InteriorItemSource;
  unit: string;
  quantity: number;
  unitPriceVnd: number;
  procurementStatus: InteriorProcurementStatus;
  linkedTransactionId?: string;
  payments?: InteriorBoqPaymentRecord[];
  vendorName?: string;
  leadTimeDays?: number;
  warrantyMonths?: number;
  note?: string;
}

export interface InteriorCameraSnapshot {
  position: [number, number, number];
  target: [number, number, number];
  preset?: 'DOLLHOUSE' | 'ENTRANCE' | 'LIVING_BALCONY' | 'KITCHEN_DINING' | 'MASTER_BEDROOM' | 'ROOM_05_STUDIO';
  navMode?: 'ORBIT' | 'WALKTHROUGH';
  timeOfDay?: 'MORNING_08' | 'NOON_12' | 'AFTERNOON_1630' | 'EVENING_20';
  fov?: number;
  autoCutaway?: boolean;
}

export interface InteriorDesignScenario {
  id: string;
  code: 'A' | 'B' | string;
  name: string;
  shortLabel: string;
  description: string;
  stylePreset: InteriorStylePreset;
  targetBudgetMinVnd: number;
  targetBudgetMaxVnd: number;
  contingencyPercent: number;
  items: InteriorFurnitureItem[];
  extraBoqItems: InteriorExtraBoqItem[];
  mepPoints?: InteriorMepPoint[];
  wallOverrides?: Record<string, InteriorWallOverride>;
  doorOverrides?: Record<string, InteriorDoorMode>;
  roomFloorOverrides?: Record<string, InteriorFloorPattern>;
  lightingZones?: InteriorLightingZones;
  curtainOpenRatio?: number; // 0 = đóng rèm, 1 = mở thoáng hoàn toàn
  lastCameraView?: InteriorCameraSnapshot;
  updatedAt: string;
}

export interface HandoverChecklistItem {
  id: string;
  zoneCode: string;              // '01' .. '08'
  zoneName: string;
  title: string;
  specDetail: string;
  checked: boolean;
  note?: string;
}

export interface InteriorStudioState {
  apartmentCode: string;         // 'A.12A.07 · Loại A2 (2PN 1WC)'
  usableAreaSqm: number;         // 51.0 (CAD A2) / 51.9 (HĐMB)
  builtUpAreaSqm: number;        // 55.3 (CAD A2)
  orientation: 'EAST_SOUTHEAST' | 'EAST' | 'SOUTH' | 'WEST';
  activeScenarioId: string;
  scenarios: InteriorDesignScenario[];
  handoverChecklist: HandoverChecklistItem[];
  updatedAt: string;
}

export interface AppDataBackup {
  version: '3.0' | '4.0';
  exportedAt: string;
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  budgets: CategoryBudget[];
  goals: SavingsGoal[];
  debts: DebtItem[];
  investments: InvestmentItem[];
  recurringRules?: RecurringRule[];
  savingsChallenges?: SavingsChallenge[];
  settings: AppSettings;
  skyoneLoan?: MortgageContract;
  goldPortfolio?: GoldPortfolioState;
  interiorStudio?: InteriorStudioState;
}

export interface FinancialSummary {
  currentBalance: number;   // Số dư khả dụng (Tiền trong các ví ngân hàng + tiền mặt)
  netWorth: number;         // Tài sản ròng = Số dư ví + Đầu tư + Vàng (Bid) - Nợ - Dư nợ thẻ tín dụng
  monthlyIncome: number;    // Tổng thu nhập gia đình
  monthlyExpense: number;   // Tổng chi tiêu gia đình
  savingsAmount: number;    // Tiết kiệm tháng = Thu - Chi
  savingsRate: number;      // % Tiết kiệm
  totalDebt: number;        // Nợ ngoài
  totalInvested: number;    // Tiền đang đầu tư

  // Phân tích thành viên
  husbandIncome: number;
  wifeIncome: number;
  husbandExpense: number;
  wifeExpense: number;
  familySharedExpense: number;
  totalCreditDebt: number;  // Tổng dư nợ thẻ BIDV Credit của cả 2
}

export interface CategoryExpenseStat {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalAmount: number;
  percentage: number;
}

export type SubAppId = 'LAUNCHER' | 'FINANCE' | 'SKYONE' | 'GOLD' | 'INTERIOR';

export type FinanceTab =
  | 'overview'
  | 'transactions'
  | 'accounts'
  | 'planning'
  | 'debts_invest'
  | 'data_admin'
  | 'guide'
  | 'settings';

export type SkyOneSubTab = 'OVERVIEW' | 'ADVISOR' | 'SCHEDULE' | 'PREPAYMENT' | 'CONTRACT';

export type SkyOneRouteTab = SkyOneSubTab | 'DATA_ADMIN' | 'SETTINGS';

export type GoldRouteTab = 'OVERVIEW' | 'LOTS' | 'PRICES' | 'DCA' | 'SIMULATOR';

export type InteriorRouteTab = 'STUDIO' | 'BOQ' | 'READINESS' | 'CHECKLIST';

export interface SkyOneTransactionLink {
  kind: 'INSTALLMENT' | 'PREPAYMENT';
  period?: number;
  prepaymentId?: string;
  label: string;
}


