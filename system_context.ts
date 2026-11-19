/**
 * HOME MONI — System Context & Financial Domain Schema Registry
 *
 * Single Source of Truth (compile-time checked) cho AI và kỹ sư khi phát triển tính năng mới
 * hoặc phân tích tài chính trên HOME MONI & Sub-app Phú Đông SKYONE.
 *
 * Quy ước bảo mật:
 * - Giữ nguyên mã căn hộ A.12A.07, chi nhánh ngân hàng và toàn bộ số liệu tài chính/mốc ngày.
 * - Ẩn họ tên cá nhân thực tế (dùng biệt danh trong app: Anh Chuột / Bé Mèo / Bên Mua).
 * - Che số tài khoản ngân hàng khi xuất ngữ cảnh (chỉ hiển thị 4 số cuối, VD: ****2943).
 */

import type {
  Account,
  AccountType,
  AppDataBackup,
  AppSettings,
  Category,
  CategoryBudget,
  DebtItem,
  ExpenseScope,
  FamilyMember,
  InvestmentItem,
  MortgageContract,
  RecurringRule,
  SavingsChallenge,
  SavingsGoal,
  Transaction,
  TransactionType,
} from "@/types/finance";

export interface SchemaFieldSpec {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
  readonly businessRule?: string;
}

export interface EntitySchemaSpec<T extends object> {
  readonly entityName: string;
  readonly storageKey: string;
  readonly primaryKey: string;
  readonly summary: string;
  readonly fields: ReadonlyArray<
    Omit<SchemaFieldSpec, "name"> & { readonly name: keyof T & string }
  >;
  readonly invariants: readonly string[];
}

/**
 * 1. HỒ SƠ PHÁP LÝ & TÀI CHÍNH CHUẨN — CĂN HỘ PHÚ ĐÔNG SKYONE (A.12A.07)
 * Trích xuất chuẩn xác từ:
 * - Hợp đồng mua bán căn hộ Phú Đông SkyOne A.12A.07 (Điều 3: Giá bán, Tiến độ, PBT 2%)
 * - Thông báo cho vay chính thức BIDV PGD Nguyễn Đình Chiểu
 * - 12 kỳ sao kê thực tế BIDV SmartBanking (10/12/2025 – 10/11/2026)
 */
export const SKYONE_A12A07_VERIFIED_FACTS = {
  property: {
    projectName: "Phú Đông SKYONE",
    unitCode: "A.12A.07",
    unitDisplayLabel: "Căn hộ A.12A.07 · Tầng 12A · ~51,9m² thông thủy (55,9m² tim tường) · Tháp A",
    floor: "12A",
    tower: "Tháp A",
    location:
      "Đường ĐT 743A, khu phố Chiêu Liêu, P. Tân Đông Hiệp, TP. Dĩ An, Bình Dương (nay là Phường Dĩ An, TP.HCM)",
    developerName: "Công ty TNHH Đầu Tư Phú Đông 5",
    guaranteeBank: "Ngân hàng TMCP Quân Đội (MB Bank) – Chi nhánh Sài Gòn",
    guaranteeContractNo: "176405.23.110.31220283.BL (30/01/2024)",
    eligibilityNotice: "Văn bản số 3744/SXD-QLN ngày 28/06/2025 (Sở Xây dựng tỉnh Bình Dương)",
    areaApproxSqm: {
      usableTT05_2024: 51.9, // 1.446.273.971 / 27.866.551
      usableND02_2022: 51.5, // 1.446.273.971 / 28.082.990
      builtUpFloor: 55.9, // 1.446.273.971 / 25.872.522
    },
    unitPriceVndPerSqm: {
      usableTT05_2024: 27_866_551,
      usableND02_2022: 28_082_990,
      builtUpFloor: 25_872_522,
    },
  },

  pricing: {
    /** Giá bán căn hộ chưa VAT, chưa PBT 2% (đã gồm quyền sử dụng đất tạm tính) */
    priceBeforeVat: 1_446_273_971,
    /** Tiền sử dụng đất tạm tính nằm trong giá bán chưa VAT */
    landUseFeeEstimated: 174_209_381,
    /** Thuế GTGT (VAT) tạm tính */
    vatEstimated: 127_206_459,
    /** Tổng giá bán HĐMB (đã gồm VAT tạm tính, chưa gồm PBT 2%) — Mốc chuẩn giá trị tài sản */
    totalContractPriceWithVat: 1_573_480_430,
    /** Kinh phí bảo trì phần sở hữu chung 2% (nộp 1 lần trước bàn giao Q3/2027) */
    maintenanceFee2Pct: 28_925_479,
    /** Tổng nghĩa vụ gồm VAT + PBT 2% (chưa gồm lệ phí trước bạ & phí làm sổ hồng) */
    totalWithMaintenanceFee: 1_602_405_909,
    /** Giá thị trường ước tính tham khảo (giả định, có thể chỉnh trong app) */
    estimatedMarketValue: 1_680_000_000,
  },

  /** Lịch thanh toán 4 đợt theo Điều 3.3 HĐMB (không gồm PBT 2%) */
  hdmbPaymentSchedule: [
    {
      stage: 1,
      label: "Đợt 1 (20% + VAT)",
      timing: "Trong vòng 03 ngày kể từ ngày ký HĐMB",
      principalPart: 289_254_794,
      vatPart: 25_441_292,
      totalAmount: 314_696_086,
      fundingSource: "SELF_EQUITY" as const,
      status: "PAID" as const,
    },
    {
      stage: 2,
      label: "Đợt 2 (50% + VAT)",
      timing: "Trong vòng 07 ngày kể từ ngày ký HĐMB",
      principalPart: 723_136_986,
      vatPart: 63_603_230,
      totalAmount: 786_740_216,
      fundingSource: "BIDV_LOAN_AND_ADJUSTMENT" as const,
      status: "PAID" as const,
    },
    {
      stage: 3,
      label: "Đợt 3 (25% + VAT đợt 3 & 4)",
      timing: "Khi CĐT thông báo bàn giao căn hộ (Dự kiến Quý III/2027)",
      principalPart: 361_568_493,
      vatPart: 38_161_937,
      totalAmount: 399_730_430,
      fundingSource: "BIDV_TRANCHE_2" as const,
      status: "UPCOMING" as const,
      extraCashRequiredNote:
        "Đồng thời nộp PBT 2% (28.925.479 đ) + lệ phí trước bạ & phí hành chính làm sổ",
    },
    {
      stage: 4,
      label: "Đợt 4 (5% nhận Giấy chứng nhận / Sổ hồng)",
      timing: "Khi CĐT thông báo bàn giao Giấy chứng nhận QSHNƠ (Dự kiến từ Q3/2027)",
      principalPart: 72_313_698,
      vatPart: 0,
      totalAmount: 72_313_698,
      fundingSource: "CASH_OR_FINAL_DISBURSEMENT" as const,
      status: "UPCOMING" as const,
    },
  ],

  /** 5 đợt vốn tự có vợ chồng đã thanh toán thực tế trong năm 2024 (~20% HĐMB) */
  actualSelfFundedTranches2024: [
    { tranche: 1, date: "2024-03-04", label: "Đặt cọc", amount: 25_000_000 },
    { tranche: 2, date: "2024-05-20", label: "Mở bán", amount: 55_913_950 },
    { tranche: 3, date: "2024-06-14", label: "Thanh toán ~5%", amount: 80_914_000 },
    { tranche: 4, date: "2024-07-11", label: "Thanh toán ~5%", amount: 80_914_000 },
    { tranche: 5, date: "2024-07-11", label: "Thanh toán ~5%", amount: 80_914_000 },
  ],

  /** Tổng vốn tự có thực chi chuẩn (người dùng xác nhận làm mốc chuẩn) */
  totalActualDownPayment: 323_655_950,
  /** Chênh lệch so với Đợt 1 trên HĐMB (323.655.950 - 314.696.086 = +8.959.864 đ) */
  downPaymentVarianceVsHdmbStage1: 8_959_864,

  /** Thông báo cho vay BIDV PGD Nguyễn Đình Chiểu & đối chiếu sao kê */
  bidvLoan: {
    bankName: "BIDV · PGD Nguyễn Đình Chiểu",
    branchAddress: "181 Nguyễn Đình Chiểu, TP.HCM",
    accountMasked: "****2943",
    maxLtvPercent: 70,
    /** Trần dự kiến ghi trên Thông báo cho vay (để đối chiếu pháp lý) */
    noticeLetterMaxCeiling: 1_246_000_000,
    /** 70% giá trị HĐMB (đã gồm VAT, không gồm PBT) = 1.101.436.301 đ */
    exact70PctHdmbCap: 1_101_436_301,
    /** Tổng hạn mức giải ngân chuẩn theo 2 đợt (Đ1 708.066.194 + Đ2 393.370.110) */
    totalPlannedDisbursementCap: 1_101_436_304,
    /** Giải ngân Đợt 1 thực tế (bắt đầu trả gốc cố định 3.056.000 đ/tháng từ T09-10/2025) */
    tranche1DisbursedAmount: 708_066_194,
    /**
     * Đối chiếu toán học khớp sao kê BIDV SmartBanking:
     * 708.066.194 - (3 kỳ gốc đầu × 3.056.000 = 9.168.000) = 698.898.194 đ
     * Khớp sát dư nợ mở sổ sao kê trước kỳ #4 (10/12/2025) là 698.898.193 đ (lệch 1đ làm tròn).
     */
    openingBalanceBeforeDec2025Statement: 698_898_193,
    verifiedRemainingBalanceNov2026: 662_226_193,
    monthlyFixedPrincipal: 3_056_000,
    fixedRatePercent: 5.5,
    fixedRateMonths: 36,
    disbursementDate: "2025-08-26",
    fixedEndDate: "2028-08-10",
    paymentDayOfMonth: 10,
    interestBasis: "ACTUAL_365" as const,
    /** Giải ngân Đợt 2 khi bàn giao căn hộ Quý III/2027 (ước tính sau kỳ #24 — 10/08/2027) */
    tranche2PlannedAmount: 393_370_110,
    tranche2PlannedAfterPeriod: 24,
    tranche2PlannedDate: "2027-08-10",
    tranche2TimingLabel: "Quý III/2027 (Bàn giao căn hộ A.12A.07)",
    /** Khoản 5% nhận Sổ hồng (có thể dùng tiền mặt hoặc giải ngân bổ sung nếu được duyệt) */
    pinkBook5PctAmount: 72_313_698,
    /** Tổng tiền mặt cần chuẩn bị khi nhận nhà & sổ hồng (nếu tự trả PBT 2% + 5% Sổ hồng) */
    handoverAndPinkBookCashNeed: 101_239_177, // 28.925.479 + 72.313.698
  },
} as const;

/**
 * 2. CẤU TRÚC SCHEMA DỮ LIỆU CỐT LÕI CỦA HOME MONI (Compile-Time Checked)
 */
const ACCOUNT_SCHEMA: EntitySchemaSpec<Account> = {
  entityName: "Account",
  storageKey: "HOME_MONI_DATA_V4.accounts",
  primaryKey: "id",
  summary: "Ví tiền mặt, tài khoản ngân hàng, ví điện tử và thẻ tín dụng BIDV của vợ chồng.",
  fields: [
    { name: "id", type: "string", required: true, description: "Định danh duy nhất của ví/thẻ." },
    { name: "name", type: "string", required: true, description: "Tên hiển thị tài khoản." },
    {
      name: "type",
      type: "'BANK' | 'CASH' | 'E_WALLET' | 'CREDIT_CARD'",
      required: true,
      description: "Phân loại tài khoản; CREDIT_CARD có cơ chế tính dư nợ ngược chiều.",
    },
    {
      name: "owner",
      type: "'HUSBAND' | 'WIFE' | 'SHARED'",
      required: true,
      description: "Chủ sở hữu tài khoản để lọc theo góc nhìn thành viên.",
    },
    { name: "isSalaryAccount", type: "boolean", required: false, description: "Đánh dấu tài khoản nhận lương." },
    { name: "creditLimit", type: "number", required: false, description: "Hạn mức tín dụng (VND) với CREDIT_CARD." },
    { name: "statementDay", type: "number", required: false, description: "Ngày chốt sao kê thẻ (1–28), hiển thị trên Lịch tài chính." },
    { name: "dueDay", type: "number", required: false, description: "Ngày hạn thanh toán thẻ (1–28), hiển thị trên Lịch tài chính." },
    { name: "initialBalance", type: "number", required: true, description: "Số dư/dư nợ gốc đầu kỳ dùng cho Event Sourcing." },
    {
      name: "currentBalance",
      type: "number",
      required: true,
      description: "Số dư khả dụng (hoặc dư nợ hiện tại nếu là CREDIT_CARD), luôn tính lại từ initialBalance + transactions.",
    },
    { name: "accountNumber", type: "string", required: false, description: "Số tài khoản (ẩn thành ****XXXX khi xuất ngữ cảnh)." },
    { name: "color", type: "string", required: false, description: "Màu nhận diện thẻ/ví." },
    { name: "icon", type: "string", required: false, description: "Icon hiển thị." },
  ],
  invariants: [
    "Event Sourcing: currentBalance KHÔNG được sửa rời rạc; luôn tính lại qua recalculateAccountBalances(accounts, transactions).",
    "Tài khoản thường (BANK/CASH/E_WALLET): currentBalance = initialBalance + INCOME - EXPENSE - TRANSFER_OUT + TRANSFER_IN.",
    "Thẻ tín dụng (CREDIT_CARD): currentBalance là DƯ NỢ = initialBalance + EXPENSE_ON_CARD - TRANSFER_INTO_CARD.",
    "Net Worth = Tổng số dư khả dụng (không tính thẻ tín dụng) + Đầu tư đang mở - Nợ ngoài - Tổng dư nợ thẻ tín dụng.",
  ],
};

const CATEGORY_SCHEMA: EntitySchemaSpec<Category> = {
  entityName: "Category",
  storageKey: "HOME_MONI_DATA_V4.categories",
  primaryKey: "id",
  summary: "Danh mục Thu nhập & Chi tiêu tùy biến cho gia đình (hỗ trợ ẩn mà không mất lịch sử).",
  fields: [
    { name: "id", type: "string", required: true, description: "Mã danh mục (VD: cat_expense_food)." },
    { name: "name", type: "string", required: true, description: "Tên danh mục tiếng Việt." },
    { name: "type", type: "'INCOME' | 'EXPENSE'", required: true, description: "Phân nhóm thu hoặc chi." },
    { name: "color", type: "string", required: true, description: "Mã màu HEX cho biểu đồ & thẻ." },
    { name: "icon", type: "string", required: false, description: "Tên icon Lucide." },
    { name: "isDefault", type: "boolean", required: false, description: "Đánh dấu danh mục mặc định hệ thống." },
    {
      name: "isHidden",
      type: "boolean",
      required: false,
      description: "Ẩn khỏi form ghi sổ mới nhưng GIỮ NGUYÊN trong lịch sử báo cáo & so sánh cùng kỳ.",
    },
  ],
  invariants: [
    "Khi isHidden = true: danh mục bị ẩn khỏi bộ chọn ghi sổ mới (getSelectableCategories), nhưng vẫn hiển thị khi sửa giao dịch cũ đã dùng danh mục đó và giữ nguyên số liệu báo cáo/biểu đồ lịch sử.",
  ],
};

const TRANSACTION_SCHEMA: EntitySchemaSpec<Transaction> = {
  entityName: "Transaction",
  storageKey: "HOME_MONI_DATA_V4.transactions",
  primaryKey: "id",
  summary: "Bút toán thu, chi hoặc chuyển khoản nội bộ (bao gồm trả thẻ tín dụng, nạp quỹ mục tiêu, trả góp SKYONE).",
  fields: [
    { name: "id", type: "string", required: true, description: "Mã giao dịch dạng TXYYMMDDxxxxxx." },
    { name: "amount", type: "number", required: true, description: "Số tiền nguyên dương (VND)." },
    { name: "date", type: "string", required: true, description: "Ngày giao dịch chuẩn ISO YYYY-MM-DD." },
    { name: "type", type: "'INCOME' | 'EXPENSE' | 'TRANSFER'", required: true, description: "Loại dòng tiền." },
    { name: "categoryId", type: "string", required: true, description: "Liên kết Category.id (có thể rỗng/chuyển khoản với TRANSFER)." },
    { name: "accountId", type: "string", required: true, description: "Tài khoản nguồn hoặc tài khoản nhận thu nhập." },
    { name: "toAccountId", type: "string", required: false, description: "Tài khoản đích khi type === 'TRANSFER'." },
    { name: "memberId", type: "'HUSBAND' | 'WIFE' | 'SHARED'", required: true, description: "Thành viên thực hiện bút toán." },
    { name: "scope", type: "'FAMILY' | 'PERSONAL'", required: true, description: "Phạm vi chi chung gia đình (tính quyết toán vợ chồng) hay cá nhân." },
    { name: "note", type: "string", required: false, description: "Diễn giải giao dịch (dùng cho tìm kiếm & nhận diện trùng lặp định kỳ)." },
    { name: "tag", type: "'NORMAL' | 'DEBT' | 'INVESTMENT' | 'RECURRING'", required: false, description: "Nhãn nguồn gốc nghiệp vụ." },
    { name: "createdAt", type: "string", required: true, description: "ISO timestamp lúc tạo." },
    { name: "updatedAt", type: "string", required: true, description: "ISO timestamp cập nhật cuối." },
  ],
  invariants: [
    "TRANSFER không làm tăng/giảm tổng Thu nhập hay tổng Chi tiêu trong báo cáo tháng.",
    "Quyết toán vợ chồng (calculateCoupleSettlement) chỉ cộng các giao dịch EXPENSE có scope === 'FAMILY' và chia theo settings.sharedSplitRatioHusband.",
  ],
};

const BUDGET_SCHEMA: EntitySchemaSpec<CategoryBudget> = {
  entityName: "CategoryBudget",
  storageKey: "HOME_MONI_DATA_V4.budgets",
  primaryKey: "categoryId + month",
  summary: "Hạn mức ngân sách chi tiêu theo từng danh mục và từng tháng YYYY-MM.",
  fields: [
    { name: "categoryId", type: "string", required: true, description: "Liên kết Category.id (type EXPENSE)." },
    { name: "month", type: "string", required: true, description: "Tháng áp dụng định dạng YYYY-MM." },
    { name: "limitAmount", type: "number", required: true, description: "Hạn mức tối đa trong tháng (VND)." },
  ],
  invariants: [
    "Ngưỡng cảnh báo ngân sách: < 80% an toàn, 80%–99% cảnh báo vàng (WARNING), >= 100% vượt trần (DANGER).",
  ],
};

const RECURRING_RULE_SCHEMA: EntitySchemaSpec<RecurringRule> = {
  entityName: "RecurringRule",
  storageKey: "HOME_MONI_DATA_V4.recurringRules",
  primaryKey: "id",
  summary: "Quy tắc Thu/Chi cố định hàng tháng hỗ trợ nhắc trước 3 ngày, tự động ghi sổ & chống trùng nhập tay.",
  fields: [
    { name: "id", type: "string", required: true, description: "Mã quy tắc." },
    { name: "name", type: "string", required: true, description: "Tên khoản cố định (VD: Tiền nhà, Internet, Netflix)." },
    { name: "amount", type: "number", required: true, description: "Số tiền định kỳ (VND)." },
    { name: "type", type: "'INCOME' | 'EXPENSE' | 'TRANSFER'", required: true, description: "Loại giao dịch tạo ra." },
    { name: "categoryId", type: "string", required: true, description: "Danh mục áp dụng." },
    { name: "accountId", type: "string", required: true, description: "Ví/tài khoản áp dụng." },
    { name: "toAccountId", type: "string", required: false, description: "Ví đích nếu là TRANSFER." },
    { name: "memberId", type: "'HUSBAND' | 'WIFE' | 'SHARED'", required: true, description: "Người thực hiện." },
    { name: "scope", type: "'FAMILY' | 'PERSONAL'", required: true, description: "Phạm vi chung/cá nhân." },
    { name: "dayOfMonth", type: "number", required: true, description: "Ngày cố định hàng tháng (1–28)." },
    { name: "isActive", type: "boolean", required: true, description: "Trạng thái kích hoạt." },
    { name: "autoPost", type: "boolean", required: false, description: "Bật tự động ghi sổ khi đến ngày cố định." },
    { name: "lastAppliedMonth", type: "string", required: false, description: "Tháng YYYY-MM gần nhất đã ghi sổ (hoặc đã bỏ qua trùng)." },
    { name: "lastSkippedDuplicateMonth", type: "string", required: false, description: "Tháng YYYY-MM đã tự bỏ qua do phát hiện giao dịch nhập tay trùng khớp." },
    { name: "note", type: "string", required: false, description: "Ghi chú kèm theo." },
  ],
  invariants: [
    "Khi autoPost = true và ngày hiện tại >= dayOfMonth: kiểm tra hasMatchingManualTransactionForRule trước. Nếu tháng đó đã có giao dịch khớp từ khóa/danh mục & số tiền gần đúng -> bỏ qua không tạo trùng và ghi nhận lastSkippedDuplicateMonth.",
    "Hoàn tác (Undo) một khoản vừa tự ghi hoặc ghi nhanh sẽ tạm dừng autoPost cho cặp (ruleId, monthKey) trong phiên để không lặp tự ghi.",
    "Bộ phát hiện lịch sử (detectRecurringSuggestionsFromHistory) quét các giao dịch lặp >= 2 tháng ổn định số tiền (±20%) và ngày (±4 ngày) để gợi ý tạo quy tắc mới.",
  ],
};

const GOAL_SCHEMA: EntitySchemaSpec<SavingsGoal> = {
  entityName: "SavingsGoal",
  storageKey: "HOME_MONI_DATA_V4.goals",
  primaryKey: "id",
  summary: "Mục tiêu tích lũy dài hạn (Quỹ dự phòng, Quỹ Đệm SKYONE 08/2028, Du lịch...).",
  fields: [
    { name: "id", type: "string", required: true, description: "Mã mục tiêu." },
    { name: "name", type: "string", required: true, description: "Tên hũ mục tiêu." },
    { name: "targetAmount", type: "number", required: true, description: "Số tiền đích (VND)." },
    { name: "currentAmount", type: "number", required: true, description: "Số tiền đã tích lũy." },
    { name: "deadline", type: "string", required: false, description: "Hạn hoàn thành YYYY-MM-DD." },
    { name: "icon", type: "string", required: false, description: "Icon hiển thị." },
    { name: "isCompleted", type: "boolean", required: true, description: "Tự động true khi currentAmount >= targetAmount." },
    { name: "memberId", type: "'HUSBAND' | 'WIFE' | 'SHARED'", required: false, description: "Thành viên phụ trách." },
  ],
  invariants: [
    "Nạp hũ mục tiêu từ một tài khoản cụ thể sẽ tạo giao dịch liên kết tương ứng để giữ nhất quán số dư.",
  ],
};

const CHALLENGE_SCHEMA: EntitySchemaSpec<SavingsChallenge> = {
  entityName: "SavingsChallenge",
  storageKey: "HOME_MONI_DATA_V4.savingsChallenges",
  primaryKey: "id",
  summary: "Thử thách tiết kiệm theo tháng (tự động bám theo thặng dư tháng hoặc nạp thủ công).",
  fields: [
    { name: "id", type: "string", required: true, description: "Mã thử thách." },
    { name: "name", type: "string", required: true, description: "Tên thử thách." },
    { name: "month", type: "string", required: true, description: "Tháng áp dụng YYYY-MM." },
    { name: "targetAmount", type: "number", required: true, description: "Số tiền mục tiêu tháng." },
    { name: "manualSavedAmount", type: "number", required: true, description: "Số tiền ghi nhận thủ công." },
    { name: "trackingMode", type: "'AUTO_SURPLUS' | 'MANUAL'", required: true, description: "Chế độ theo dõi tự động từ thặng dư hay nạp tay." },
    { name: "color", type: "string", required: true, description: "Màu vòng tiến độ." },
    { name: "memberId", type: "'HUSBAND' | 'WIFE' | 'SHARED'", required: false, description: "Thành viên tham gia." },
    { name: "icon", type: "string", required: false, description: "Biểu tượng." },
    { name: "createdAt", type: "string", required: true, description: "ISO timestamp tạo." },
  ],
  invariants: [
    "Biểu đồ vòng đồng tâm hiển thị tối đa 5 thử thách tiêu biểu mỗi tháng (còn lại gộp overflowCount).",
  ],
};

const DEBT_SCHEMA: EntitySchemaSpec<DebtItem> = {
  entityName: "DebtItem",
  storageKey: "HOME_MONI_DATA_V4.debts",
  primaryKey: "id",
  summary: "Các khoản vay/cho vay ngoài hợp đồng thế chấp căn hộ SKYONE.",
  fields: [
    { name: "id", type: "string", required: true, description: "Mã khoản nợ." },
    { name: "name", type: "string", required: true, description: "Tên khoản nợ/cho vay." },
    { name: "type", type: "'LOAN' | 'MORTGAGE' | 'LEND'", required: true, description: "Vay, thế chấp hoặc cho vay." },
    { name: "totalAmount", type: "number", required: true, description: "Tổng giá trị gốc." },
    { name: "paidAmount", type: "number", required: true, description: "Phần đã thanh toán." },
    { name: "interestRate", type: "number", required: true, description: "Lãi suất %/năm." },
    { name: "startDate", type: "string", required: true, description: "Ngày bắt đầu YYYY-MM-DD." },
    { name: "dueDate", type: "string", required: true, description: "Ngày đáo hạn YYYY-MM-DD." },
    { name: "status", type: "'ACTIVE' | 'PAID'", required: true, description: "Trạng thái tất toán." },
    { name: "memberId", type: "'HUSBAND' | 'WIFE' | 'SHARED'", required: false, description: "Người chịu trách nhiệm." },
  ],
  invariants: [
    "totalDebt trong FinancialSummary chỉ cộng phần còn lại (totalAmount - paidAmount) của các khoản ACTIVE có type !== 'LEND'.",
  ],
};

const INVESTMENT_SCHEMA: EntitySchemaSpec<InvestmentItem> = {
  entityName: "InvestmentItem",
  storageKey: "HOME_MONI_DATA_V4.investments",
  primaryKey: "id",
  summary: "Danh mục tài sản sinh lời (Tiết kiệm ngân hàng, Vàng, Chứng khoán, Quỹ mở, BĐS).",
  fields: [
    { name: "id", type: "string", required: true, description: "Mã khoản đầu tư." },
    { name: "name", type: "string", required: true, description: "Tên tài sản/kênh đầu tư." },
    { name: "type", type: "'STOCK' | 'GOLD' | 'SAVINGS' | 'FUND' | 'REAL_ESTATE' | 'CRYPTO'", required: true, description: "Loại kênh đầu tư." },
    { name: "amount", type: "number", required: true, description: "Vốn gốc đầu tư (VND)." },
    { name: "currentValue", type: "number", required: false, description: "Giá trị thị trường hiện tại (mặc định dùng amount nếu trống)." },
    { name: "expectedProfitRate", type: "number", required: true, description: "Tỷ suất lợi nhuận kỳ vọng %/năm." },
    { name: "startDate", type: "string", required: true, description: "Ngày bắt đầu YYYY-MM-DD." },
    { name: "status", type: "'ACTIVE' | 'CLOSED'", required: true, description: "Trạng thái nắm giữ." },
    { name: "memberId", type: "'HUSBAND' | 'WIFE' | 'SHARED'", required: false, description: "Người nắm giữ." },
  ],
  invariants: [
    "totalInvested trong FinancialSummary cộng (currentValue ?? amount) của các khoản ACTIVE.",
  ],
};

const MORTGAGE_CONTRACT_SCHEMA: EntitySchemaSpec<MortgageContract> = {
  entityName: "MortgageContract",
  storageKey: "HOME_MONI_DATA_V4.skyoneLoan",
  primaryKey: "id",
  summary: "Hợp đồng vay mua căn hộ Phú Đông SKYONE A.12A.07 (BIDV) kèm lịch trả nợ, trả trước hạn, giải ngân đợt 2 và dòng tiền khóa/mở.",
  fields: [
    { name: "id", type: "string", required: true, description: "Định danh hợp đồng (skyone_apartment_loan)." },
    { name: "projectName", type: "string", required: true, description: "Tên dự án (Phú Đông SKYONE)." },
    { name: "unitCode", type: "string", required: true, description: "Mã căn & diện tích (A.12A.07 · ~51,9m² thông thủy / 55,9m² tim tường)." },
    { name: "bankName", type: "string", required: true, description: "Ngân hàng giải ngân (BIDV · PGD Nguyễn Đình Chiểu)." },
    { name: "accountNumber", type: "string", required: false, description: "Số tài khoản thu nợ BIDV (ẩn còn ****2943 khi xuất ngữ cảnh)." },
    { name: "branchName", type: "string", required: false, description: "Địa chỉ phòng giao dịch." },
    { name: "propertyValue", type: "number", required: true, description: "Giá bán HĐMB đã gồm VAT (1.573.480.430 đ)." },
    { name: "currentMarketValue", type: "number", required: true, description: "Giá thị trường ước tính hiện tại." },
    { name: "downPayment", type: "number", required: true, description: "Tổng vốn tự có thực chi (323.655.950 đ qua 5 đợt 2024)." },
    { name: "creditLimit", type: "number", required: false, description: "Tổng hạn mức giải ngân chuẩn 70% HĐMB (1.101.436.304 đ)." },
    { name: "loanAmount", type: "number", required: true, description: "Dư nợ mở sổ lịch trả nợ trước sao kê T12/2025 (698.898.193 đ)." },
    { name: "termMonths", type: "number", required: true, description: "Thời hạn vay tối đa (trần 360 tháng / 30 năm)." },
    { name: "disbursementDate", type: "string", required: true, description: "Ngày giải ngân gốc (2025-08-26)." },
    { name: "paymentDayOfMonth", type: "number", required: true, description: "Ngày thu nợ hàng tháng (ngày 10)." },
    { name: "fixedRateMonths", type: "number", required: true, description: "Số tháng ưu đãi lãi suất cố định (36 tháng đến 10/08/2028)." },
    { name: "fixedInterestRate", type: "number", required: true, description: "Lãi suất cố định %/năm (5.5%)." },
    { name: "floatingBaseRate", type: "number", required: true, description: "Lãi suất cơ sở thả nổi giả định (%/năm)." },
    { name: "floatingSpread", type: "number", required: true, description: "Biên độ thả nổi giả định (%/năm)." },
    { name: "monthlyPrincipalOverride", type: "number", required: false, description: "Gốc trả đều hàng tháng theo sao kê BIDV (3.056.000 đ)." },
    { name: "interestBasis", type: "'ACTUAL_365' | 'THIRTY_360'", required: false, description: "Quy ước tính lãi (BIDV áp dụng ACTUAL_365)." },
    { name: "prepayStrategyDefault", type: "'SHORTEN_TERM' | 'REDUCE_MONTHLY'", required: true, description: "Chiến lược mặc định khi trả trước gốc." },
    { name: "prepaymentPenaltyTiers", type: "MortgagePrepaymentPenaltyTier[]", required: true, description: "Biểu phí phạt trả nợ trước hạn theo năm vay." },
    { name: "rateAdjustments", type: "MortgageRateAdjustment[]", required: true, description: "Các mốc điều chỉnh lãi suất thực tế theo kỳ." },
    { name: "paidRecords", type: "MortgagePaidInstallmentRecord[]", required: true, description: "Danh sách kỳ đã đóng (gồm 12 kỳ isVerified = true từ sao kê BIDV)." },
    { name: "prepayments", type: "MortgagePrepaymentEvent[]", required: true, description: "Lịch sử trả trước gốc." },
    { name: "plannedDisbursements", type: "MortgagePlannedDisbursement[]", required: false, description: "Các đợt giải ngân tiếp theo (Đợt 2 Q3/2027: +393.370.110 đ)." },
    { name: "cashflowLocked", type: "boolean", required: false, description: "Khóa/mở chế độ sửa dòng tiền thủ công từng kỳ." },
    { name: "periodOverrides", type: "MortgagePeriodCashflowOverride[]", required: false, description: "Ghi đè gốc/lãi/lãi suất thủ công từng kỳ (được reconcile bảo toàn tuyệt đối)." },
    { name: "updatedAt", type: "string", required: true, description: "ISO timestamp cập nhật cuối." },
  ],
  invariants: [
    "Trần thời hạn vay tối đa: MAX_MORTGAGE_TERM_YEARS = 30 (360 tháng).",
    "12 kỳ sao kê BIDV (kỳ #4 10/12/2025 -> kỳ #15 10/11/2026) là dữ liệu xác thực cứng (isVerified = true), dư nợ sau kỳ #15 chính xác 662.226.193 đ.",
    "reconcileBidvSkyOneContract TUYỆT ĐỐI không ghi đè nếu người dùng đã chỉnh periodOverrides hoặc đang mở cashflowLocked === false, và luôn bảo toàn các kỳ đã đóng >= 16.",
    "DTI an toàn <= 30%, Cảnh báo 31–40%, Áp lực cao > 40% thu nhập gia đình.",
  ],
};

const SETTINGS_SCHEMA: EntitySchemaSpec<AppSettings> = {
  entityName: "AppSettings",
  storageKey: "HOME_MONI_DATA_V4.settings",
  primaryKey: "singleton",
  summary: "Cấu hình giao diện Sáng/Tối, tên vợ chồng, tỷ lệ chia quỹ chung, bảo mật Passcode/WebAuthn và tùy chọn tự động hóa.",
  fields: [
    { name: "themeColor", type: "'blue' | 'emerald' | 'indigo' | 'rose'", required: true, description: "Tông màu nhấn chủ đạo." },
    { name: "themeMode", type: "'light' | 'dark'", required: false, description: "Chế độ sáng/tối (đồng bộ qua @custom-variant dark)." },
    { name: "currency", type: "'VND'", required: true, description: "Đơn vị tiền tệ chuẩn (VND)." },
    { name: "notificationsEnabled", type: "boolean", required: true, description: "Bật/tắt nhắc nhở nội bộ." },
    { name: "husbandName", type: "string", required: true, description: "Biệt danh thành viên HUSBAND (mặc định: Anh Chuột)." },
    { name: "wifeName", type: "string", required: true, description: "Biệt danh thành viên WIFE (mặc định: Bé Mèo)." },
    { name: "sharedSplitRatioHusband", type: "number", required: false, description: "Tỷ lệ % đóng góp quỹ chung của HUSBAND (0–100, mặc định 50)." },
    { name: "privacyMode", type: "boolean", required: false, description: "Ẩn toàn bộ số tiền trên giao diện bằng •••." },
    { name: "dismissedRecurringSuggestionKeys", type: "string[]", required: false, description: "Danh sách chữ ký gợi ý định kỳ từ lịch sử mà người dùng đã bấm Bỏ qua." },
  ],
  invariants: [
    "Thông tin bảo mật cục bộ (passcode hash SHA-256, WebAuthn credential, ảnh nền khóa, themeMode) KHÔNG bị ghi đè khi đồng bộ Cloud hay gộp JSON với keepLocalSecurity = true.",
  ],
};

export const SYSTEM_CONTEXT = {
  appName: "HOME MONI",
  subApps: ["FINANCE", "SKYONE"] as const,
  storageVersion: "4.0" as AppDataBackup["version"],
  localStorageKey: "HOME_MONI_DATA_V4",
  defaultCurrency: "VND",
  perspectives: ["ALL", "HUSBAND", "WIFE"] as const,
  accountTypes: ["BANK", "CASH", "E_WALLET", "CREDIT_CARD"] as readonly AccountType[],
  transactionTypes: ["INCOME", "EXPENSE", "TRANSFER"] as readonly TransactionType[],
  familyMembers: ["HUSBAND", "WIFE", "SHARED"] as readonly FamilyMember[],
  expenseScopes: ["FAMILY", "PERSONAL"] as readonly ExpenseScope[],

  entities: {
    Account: ACCOUNT_SCHEMA,
    Category: CATEGORY_SCHEMA,
    Transaction: TRANSACTION_SCHEMA,
    CategoryBudget: BUDGET_SCHEMA,
    RecurringRule: RECURRING_RULE_SCHEMA,
    SavingsGoal: GOAL_SCHEMA,
    SavingsChallenge: CHALLENGE_SCHEMA,
    DebtItem: DEBT_SCHEMA,
    InvestmentItem: INVESTMENT_SCHEMA,
    MortgageContract: MORTGAGE_CONTRACT_SCHEMA,
    AppSettings: SETTINGS_SCHEMA,
  },

  crossCuttingBusinessRules: [
    "Event Sourcing số dư: Mọi thay đổi giao dịch đều kích hoạt recalculateAccountBalances để tính lại toàn bộ ví và dư nợ thẻ tín dụng từ initialBalance.",
    "Lịch tài chính hợp nhất (FinancialCalendarCard): Gộp 3 nguồn mốc thời gian theo tháng (Thu/Chi định kỳ, Kỳ trả góp SKYONE, Ngày chốt sao kê & hạn thanh toán thẻ tín dụng BIDV) và hỗ trợ Ghi sổ nhanh + Hoàn tác 1 chạm.",
    "So sánh cùng kỳ (OverviewView): Hỗ trợ chuyển đổi Tháng trước (MoM) và Cùng kỳ năm ngoái (YoY), luôn giữ số liệu lịch sử của các danh mục đã ẩn (isHidden = true).",
    "Nhắc nhở định kỳ & Tự động ghi sổ: Nhắc trước 3 ngày đến hạn và các khoản quá hạn chưa ghi; khoản bật autoPost tự tạo giao dịch khi đến ngày và tự bỏ qua nếu tháng đó đã có giao dịch nhập tay trùng khớp.",
    "Chế độ Riêng tư & Bảo mật: Tất cả số tiền hiển thị qua formatVNDMasked / formatShortVNDMasked; tài liệu ngữ cảnh AI mặc định ẩn họ tên thật và che số tài khoản (****XXXX).",
  ],

  skyoneVerifiedFacts: SKYONE_A12A07_VERIFIED_FACTS,
} as const;

export type SystemContextDefinition = typeof SYSTEM_CONTEXT;
