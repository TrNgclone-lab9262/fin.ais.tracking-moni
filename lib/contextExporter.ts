import {
  Account,
  AppSettings,
  Category,
  CategoryBudget,
  DebtItem,
  InvestmentItem,
  MortgageContract,
  RecurringRule,
  SavingsChallenge,
  SavingsGoal,
  Transaction,
} from "@/types/finance";
import { SKYONE_A12A07_VERIFIED_FACTS, SYSTEM_CONTEXT } from "@/system_context";
import { generateMortgageSchedule } from "@/lib/mortgageEngine";
import { formatDateVN, getCurrentMonthKey, getMonthDisplayLabel } from "@/lib/formatters";

export interface AiContextExportInput {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: CategoryBudget[];
  goals: SavingsGoal[];
  savingsChallenges: SavingsChallenge[];
  debts: DebtItem[];
  investments: InvestmentItem[];
  recurringRules: RecurringRule[];
  skyoneLoan: MortgageContract;
  settings: AppSettings;
  selectedMonth?: string;
  generatedAt?: Date;
}

export interface AiContextExportOptions {
  /** Mặc định true: ẩn họ tên thật & che số tài khoản ngân hàng còn 4 số cuối */
  maskSensitiveInfo?: boolean;
  /** Số giao dịch gần nhất đưa vào bảng mẫu (mặc định 12) */
  recentTransactionLimit?: number;
}

function fmtVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")} đ`;
}

export function maskAccountNumber(accountNumber?: string, maskSensitive = true): string {
  if (!accountNumber) return "Chưa khai báo";
  const digits = accountNumber.replace(/[^0-9A-Za-z]/g, "");
  if (!maskSensitive) return accountNumber;
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
}

function formatOwnerLabel(owner: string, settings: AppSettings): string {
  if (owner === "HUSBAND") return settings.husbandName || "Anh Chuột";
  if (owner === "WIFE") return settings.wifeName || "Bé Mèo";
  return "Chung gia đình";
}

function getAccountTypeLabel(type: Account["type"]): string {
  switch (type) {
    case "BANK":
      return "Ngân hàng";
    case "CASH":
      return "Tiền mặt";
    case "E_WALLET":
      return "Ví điện tử";
    case "CREDIT_CARD":
      return "Thẻ tín dụng";
  }
}

/**
 * Sinh nội dung file context.md chuẩn hóa từ trạng thái dữ liệu thực tế của HOME MONI & SKYONE.
 * Thiết kế để dán hoặc đính kèm trực tiếp cho AI trong các phiên làm việc tiếp theo.
 */
export function generateAiContextMarkdown(
  input: AiContextExportInput,
  options: AiContextExportOptions = {}
): string {
  const maskSensitive = options.maskSensitiveInfo ?? true;
  const recentLimit = options.recentTransactionLimit ?? 12;
  const now = input.generatedAt ?? new Date();
  const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  const activeMonth =
    input.selectedMonth && input.selectedMonth !== "ALL"
      ? input.selectedMonth
      : getCurrentMonthKey();

  const categoryMap = new Map(input.categories.map((c) => [c.id, c]));
  const accountMap = new Map(input.accounts.map((a) => [a.id, a]));

  // Financial aggregates
  const liquidAccounts = input.accounts.filter((a) => a.type !== "CREDIT_CARD");
  const creditCards = input.accounts.filter((a) => a.type === "CREDIT_CARD");
  const totalLiquidBalance = liquidAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const totalCreditDebt = creditCards.reduce((s, a) => s + Math.max(0, a.currentBalance), 0);

  const activeInvestments = input.investments.filter((i) => i.status === "ACTIVE");
  const totalInvested = activeInvestments.reduce(
    (s, i) => s + (i.currentValue ?? i.amount),
    0
  );

  const activeDebts = input.debts.filter((d) => d.status === "ACTIVE" && d.type !== "LEND");
  const totalExternalDebt = activeDebts.reduce(
    (s, d) => s + Math.max(0, d.totalAmount - d.paidAmount),
    0
  );
  const netWorth = totalLiquidBalance + totalInvested - totalExternalDebt - totalCreditDebt;

  // Monthly cashflow
  const monthTxs = input.transactions.filter((tx) => tx.date.startsWith(activeMonth));
  const monthIncome = monthTxs
    .filter((tx) => tx.type === "INCOME")
    .reduce((s, tx) => s + tx.amount, 0);
  const monthExpense = monthTxs
    .filter((tx) => tx.type === "EXPENSE")
    .reduce((s, tx) => s + tx.amount, 0);
  const monthSurplus = monthIncome - monthExpense;
  const savingsRate =
    monthIncome > 0 ? Math.round((monthSurplus / monthIncome) * 1000) / 10 : 0;

  // Top expense categories in active month
  const expenseByCat = new Map<string, number>();
  for (const tx of monthTxs) {
    if (tx.type !== "EXPENSE") continue;
    expenseByCat.set(tx.categoryId, (expenseByCat.get(tx.categoryId) || 0) + tx.amount);
  }
  const topExpenseCategories = Array.from(expenseByCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // SKYONE schedule snapshot
  const skyoneSchedule = generateMortgageSchedule(input.skyoneLoan, isoDate);
  const facts = SKYONE_A12A07_VERIFIED_FACTS;

  const maskedLoanAccount = maskAccountNumber(
    input.skyoneLoan.accountNumber,
    maskSensitive
  );

  const activeCategories = input.categories.filter((c) => !c.isHidden);
  const hiddenCategories = input.categories.filter((c) => c.isHidden);

  const lines: string[] = [];

  lines.push(`# HOME MONI & Phú Đông SKYONE — Context Dữ Liệu Tài Chính (Snapshot ${isoDate})`);
  lines.push("");
  lines.push(
    `> Tài liệu ngữ cảnh chuẩn hóa dùng làm **Nguồn Sự Thật Duy Nhất (Single Source of Truth)** cho các phiên làm việc AI tiếp theo. Schema chi tiết & luật nghiệp vụ tham chiếu tại \`system_context.ts\`.`
  );
  lines.push("");
  lines.push("## 1. Bối Cảnh Gia Đình & Quy Ước Dữ Liệu");
  lines.push("");
  lines.push(
    `- **Ứng dụng**: \`${SYSTEM_CONTEXT.appName}\` (v${SYSTEM_CONTEXT.storageVersion} · Lưu cục bộ \`${SYSTEM_CONTEXT.localStorageKey}\` + đồng bộ tùy chọn).`
  );
  const husbandSplitRatio = input.settings.sharedSplitRatioHusband ?? 50;
  lines.push(
    `- **Thành viên**: \`${input.settings.husbandName}\` (HUSBAND) & \`${input.settings.wifeName}\` (WIFE) · Tỷ lệ chia quỹ chung: **${husbandSplitRatio}% / ${100 - husbandSplitRatio}%**.`
  );
  lines.push(
    `- **Chính sách bảo mật áp dụng**: ${
      maskSensitive
        ? "Đang BẬT ẩn danh — Giữ nguyên mã căn `A.12A.07`, tên chi nhánh và toàn bộ số tiền/mốc ngày; ẩn họ tên pháp lý và che số tài khoản dạng `****XXXX`."
        : "Đang TẮT ẩn danh — Xuất đầy đủ số tài khoản lưu trong ứng dụng."
    }`
  );
  lines.push(
    `- **Kỳ báo cáo đang chọn**: ${getMonthDisplayLabel(activeMonth)} (\`${activeMonth}\`) · Ngày xuất snapshot: \`${isoDate}\`.`
  );
  lines.push("");

  // Section 2: SKYONE verified profile
  lines.push("## 2. Hồ Sơ Pháp Lý & Dòng Tiền Thực Tế — Sub-app Phú Đông SKYONE (A.12A.07)");
  lines.push("");
  lines.push("### 2.1. Thông số Cứng từ HĐMB & Thông báo BIDV (Facts — Không tự suy diễn lại)");
  lines.push("");
  lines.push("| Hạng mục | Giá trị chuẩn | Ghi chú đối chiếu |");
  lines.push("| :--- | ---: | :--- |");
  lines.push(
    `| Dự án & Mã căn | **${input.skyoneLoan.projectName} · ${facts.property.unitCode}** | ${input.skyoneLoan.unitCode} |`
  );
  lines.push(
    `| Giá bán chưa VAT (chưa PBT) | ${fmtVnd(facts.pricing.priceBeforeVat)} | Gồm tiền sử dụng đất tạm tính ${fmtVnd(facts.pricing.landUseFeeEstimated)} |`
  );
  lines.push(
    `| Thuế GTGT (VAT tạm tính) | ${fmtVnd(facts.pricing.vatEstimated)} | Tạm tính theo Điều 3.1 HĐMB |`
  );
  lines.push(
    `| **Tổng giá bán HĐMB (gồm VAT)** | **${fmtVnd(input.skyoneLoan.propertyValue)}** | Mốc chuẩn giá trị hợp đồng (HĐMB: ${fmtVnd(facts.pricing.totalContractPriceWithVat)}) |`
  );
  lines.push(
    `| Kinh phí bảo trì 2% (chưa gồm trong giá) | ${fmtVnd(facts.pricing.maintenanceFee2Pct)} | Nộp 1 lần trước bàn giao (Quý III/2027) |`
  );
  lines.push(
    `| Giá thị trường ước tính hiện tại | ${fmtVnd(input.skyoneLoan.currentMarketValue)} | Giả định tham khảo để tính LTV/Equity |`
  );
  lines.push(
    `| **Tổng vốn tự có thực chi (5 đợt 2024)** | **${fmtVnd(input.skyoneLoan.downPayment)}** | Thực chi 5 đợt (HĐMB Đợt 1: ${fmtVnd(facts.hdmbPaymentSchedule[0].totalAmount)}, chênh +${fmtVnd(facts.downPaymentVarianceVsHdmbStage1)}) |`
  );
  lines.push(
    `| **Tổng hạn mức giải ngân chuẩn (70% HĐMB)** | **${fmtVnd(input.skyoneLoan.creditLimit ?? facts.bidvLoan.totalPlannedDisbursementCap)}** | Đ1 ${fmtVnd(facts.bidvLoan.tranche1DisbursedAmount)} + Đ2 ${fmtVnd(facts.bidvLoan.tranche2PlannedAmount)} (Trần Thông báo BIDV: ${fmtVnd(facts.bidvLoan.noticeLetterMaxCeiling)}) |`
  );
  lines.push(
    `| Ngân hàng & Tài khoản thu nợ | ${input.skyoneLoan.bankName} | TK \`${maskedLoanAccount}\` · Tính lãi \`${input.skyoneLoan.interestBasis ?? "ACTUAL_365"}\` |`
  );
  lines.push(
    `| Lãi suất & Thời hạn ưu đãi | **${input.skyoneLoan.fixedInterestRate}%/năm · ${input.skyoneLoan.fixedRateMonths} tháng** | Giải ngân ${formatDateVN(input.skyoneLoan.disbursementDate)} · Hết cố định ${formatDateVN(facts.bidvLoan.fixedEndDate)} |`
  );
  lines.push(
    `| Gốc cố định hàng tháng | ${fmtVnd(input.skyoneLoan.monthlyPrincipalOverride ?? facts.bidvLoan.monthlyFixedPrincipal)} | Ngày thu nợ cố định: **ngày ${input.skyoneLoan.paymentDayOfMonth} hàng tháng** |`
  );
  lines.push(
    `| **Dư nợ thực tế hiện tại** | **${fmtVnd(skyoneSchedule.remainingBalance)}** | Đã đóng ${skyoneSchedule.paidCount} kỳ (${skyoneSchedule.verifiedCount} kỳ xác thực sao kê BIDV) |`
  );
  lines.push(
    `| Kỳ trả nợ kế tiếp | Kỳ #${skyoneSchedule.nextUnpaidInstallment?.period ?? "-"} (${skyoneSchedule.nextUnpaidInstallment ? formatDateVN(skyoneSchedule.nextUnpaidInstallment.dueDate) : "Đã tất toán"}) | Dự kiến ${skyoneSchedule.nextUnpaidInstallment ? fmtVnd(skyoneSchedule.nextUnpaidInstallment.totalPayment) : "0 đ"} |`
  );
  lines.push("");

  lines.push("### 2.2. Đối Chiếu 5 Đợt Vốn Tự Có (2024) & Các Mốc Thanh Toán Sắp Tới (Q3/2027)");
  lines.push("");
  for (const item of facts.actualSelfFundedTranches2024) {
    lines.push(
      `- Đợt ${item.tranche} (${formatDateVN(item.date)} · ${item.label}): **${fmtVnd(item.amount)}**`
    );
  }
  lines.push(
    `- **Đối chiếu khớp toán học Giải ngân Đợt 1**: ${fmtVnd(facts.bidvLoan.tranche1DisbursedAmount)} trừ 3 kỳ gốc chuyển tiếp (\`3 × 3.056.000 = 9.168.000 đ\`) = **698.898.194 đ**, khớp sát dư nợ mở sổ sao kê BIDV trước kỳ #4 (10/12/2025) là **${fmtVnd(facts.bidvLoan.openingBalanceBeforeDec2025Statement)}** (chênh 1đ làm tròn).`
  );
  if (input.skyoneLoan.plannedDisbursements && input.skyoneLoan.plannedDisbursements.length > 0) {
    for (const d of input.skyoneLoan.plannedDisbursements) {
      lines.push(
        `- **Lịch giải ngân bổ sung đang cài trong app**: Sau kỳ #${d.afterPeriod} (${formatDateVN(d.date)}) cộng **+${fmtVnd(d.amount)}** — ${d.note || "Giải ngân theo tiến độ"}.`
      );
    }
  } else {
    lines.push(
      `- **Giải ngân Đợt 2 (Dự kiến Quý III/2027 — nhận bàn giao)**: **+${fmtVnd(facts.bidvLoan.tranche2PlannedAmount)}** (chưa gắn vào lịch tự động của hợp đồng hiện tại).`
    );
  }
  lines.push(
    `- **Mốc tiền mặt & Sổ hồng (Quý III/2027)**: Kinh phí bảo trì 2% (**${fmtVnd(facts.pricing.maintenanceFee2Pct)}**) + Đợt 4 nhận Giấy chứng nhận 5% (**${fmtVnd(facts.bidvLoan.pinkBook5PctAmount)}**) = **${fmtVnd(facts.bidvLoan.handoverAndPinkBookCashNeed)}** (chưa gồm lệ phí trước bạ & phí hành chính).`
  );
  lines.push(
    `- **Giả định thả nổi sau 08/2028 (Assumptions)**: Lãi cơ sở ${input.skyoneLoan.floatingBaseRate}% + biên độ ${input.skyoneLoan.floatingSpread}% = **${(input.skyoneLoan.floatingBaseRate + input.skyoneLoan.floatingSpread).toFixed(2)}%/năm** · Trần vay tối đa ${Math.round(input.skyoneLoan.termMonths / 12)} năm.`
  );
  lines.push("");

  // Section 3: Balance Sheet & Accounts
  lines.push("## 3. Tài Sản, Ví Ngân Hàng & Thẻ Tín Dụng");
  lines.push("");
  lines.push(
    `- **Tổng tài sản ròng (Net Worth)**: **${fmtVnd(netWorth)}**`
  );
  lines.push(
    `- **Tiền mặt & Ngân hàng khả dụng**: ${fmtVnd(totalLiquidBalance)} · **Đầu tư đang mở**: ${fmtVnd(totalInvested)} · **Dư nợ thẻ tín dụng**: ${fmtVnd(totalCreditDebt)} · **Nợ ngoài SKYONE**: ${fmtVnd(totalExternalDebt)}`
  );
  lines.push("");
  lines.push("| Tài khoản / Ví | Loại | Chủ sở hữu | Số TK | Số dư / Dư nợ | Mốc thẻ |");
  lines.push("| :--- | :--- | :--- | :--- | ---: | :--- |");
  for (const acc of input.accounts) {
    const cardInfo =
      acc.type === "CREDIT_CARD"
        ? `Chốt ngày ${acc.statementDay ?? "-"} · Hạn ngày ${acc.dueDay ?? "-"} (HM ${fmtVnd(acc.creditLimit ?? 0)})`
        : acc.isSalaryAccount
        ? "TK nhận lương"
        : "-";
    lines.push(
      `| ${acc.name} | ${getAccountTypeLabel(acc.type)} | ${formatOwnerLabel(acc.owner, input.settings)} | \`${maskAccountNumber(acc.accountNumber, maskSensitive)}\` | ${fmtVnd(acc.currentBalance)} | ${cardInfo} |`
    );
  }
  lines.push("");

  // Section 4: Cashflow, Budgets & Categories
  lines.push(`## 4. Dòng Tiền ${getMonthDisplayLabel(activeMonth)}, Ngân Sách & Danh Mục`);
  lines.push("");
  lines.push(
    `- **Thu nhập tháng**: ${fmtVnd(monthIncome)} · **Chi tiêu tháng**: ${fmtVnd(monthExpense)} · **Thặng dư**: ${fmtVnd(monthSurplus)} (**${savingsRate}%**)`
  );
  lines.push(
    `- **Danh mục đang hoạt động**: ${activeCategories.length} danh mục (${activeCategories.filter((c) => c.type === "EXPENSE").length} chi, ${activeCategories.filter((c) => c.type === "INCOME").length} thu)` +
      (hiddenCategories.length > 0
        ? ` · **Đang ẩn (giữ lịch sử)**: ${hiddenCategories.map((c) => c.name).join(", ")}`
        : " · Không có danh mục ẩn")
  );
  lines.push("");

  if (topExpenseCategories.length > 0) {
    const monthBudgetMap = new Map(
      input.budgets
        .filter((b) => b.month === activeMonth)
        .map((b) => [b.categoryId, b.limitAmount])
    );
    lines.push("| Danh mục chi chính | Đã chi tháng | Hạn mức ngân sách | Tỷ lệ |");
    lines.push("| :--- | ---: | ---: | ---: |");
    for (const [catId, spent] of topExpenseCategories) {
      const cat = categoryMap.get(catId);
      const limit = monthBudgetMap.get(catId) || 0;
      const pct = limit > 0 ? `${Math.round((spent / limit) * 100)}%` : "Chưa đặt";
      lines.push(
        `| ${cat?.name || catId}${cat?.isHidden ? " (Đã ẩn)" : ""} | ${fmtVnd(spent)} | ${limit > 0 ? fmtVnd(limit) : "-"} | ${pct} |`
      );
    }
    lines.push("");
  }

  // Section 5: Recurring Rules, Goals, Debts & Investments
  lines.push("## 5. Khoản Cố Định Tự Động, Mục Tiêu, Nợ Ngoài & Đầu Tư");
  lines.push("");
  if (input.recurringRules.length > 0) {
    lines.push("### Quy tắc Thu/Chi định kỳ");
    for (const r of input.recurringRules) {
      const catName = categoryMap.get(r.categoryId)?.name || r.categoryId;
      const accName = accountMap.get(r.accountId)?.name || r.accountId;
      lines.push(
        `- **${r.name}** (${r.type === "INCOME" ? "Thu" : "Chi"}): ${fmtVnd(r.amount)} · Ngày ${r.dayOfMonth} hàng tháng · ${catName} · ${accName} · Trạng thái: ${r.isActive ? "Đang bật" : "Tạm tắt"} · Tự ghi: ${r.autoPost ? "BẬT" : "Tắt"}${r.lastAppliedMonth ? ` · Kỳ ghi gần nhất: ${r.lastAppliedMonth}` : ""}`
      );
    }
    lines.push("");
  }

  if (input.goals.length > 0) {
    lines.push("### Mục tiêu tiết kiệm");
    for (const g of input.goals) {
      const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
      lines.push(
        `- **${g.name}**: ${fmtVnd(g.currentAmount)} / ${fmtVnd(g.targetAmount)} (${pct}%)${g.deadline ? ` · Hạn ${formatDateVN(g.deadline)}` : ""}`
      );
    }
    lines.push("");
  }

  if (input.debts.length > 0 || input.investments.length > 0) {
    lines.push("### Nợ ngoài SKYONE & Danh mục đầu tư");
    for (const d of input.debts) {
      const rem = Math.max(0, d.totalAmount - d.paidAmount);
      lines.push(
        `- [${d.type === "LEND" ? "Cho vay" : "Nợ"}] **${d.name}**: Còn ${fmtVnd(rem)} / ${fmtVnd(d.totalAmount)} (${d.interestRate}%/năm · Hạn ${formatDateVN(d.dueDate)} · ${d.status})`
      );
    }
    for (const inv of input.investments) {
      lines.push(
        `- [Đầu tư · ${inv.type}] **${inv.name}**: Vốn ${fmtVnd(inv.amount)} · Hiện tại ${fmtVnd(inv.currentValue ?? inv.amount)} (Kỳ vọng ${inv.expectedProfitRate}%/năm · ${inv.status})`
      );
    }
    lines.push("");
  }

  // Recent transactions slice
  const recentTxs = [...input.transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, recentLimit);
  if (recentTxs.length > 0) {
    lines.push(`## 6. ${recentTxs.length} Giao Dịch Gần Nhất`);
    lines.push("");
    lines.push("| Ngày | Loại | Danh mục | Ví | Thành viên / Phạm vi | Số tiền | Ghi chú |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | ---: | :--- |");
    for (const tx of recentTxs) {
      const catName = categoryMap.get(tx.categoryId)?.name || (tx.type === "TRANSFER" ? "Chuyển khoản" : tx.categoryId);
      const accName = accountMap.get(tx.accountId)?.name || tx.accountId;
      const sign = tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : "⇄";
      const safeNote = (tx.note || "-").replace(/\|/g, "/").replace(/\n/g, " ");
      lines.push(
        `| ${tx.date} | ${tx.type} | ${catName} | ${accName} | ${formatOwnerLabel(tx.memberId, input.settings)} · ${tx.scope} | ${sign}${fmtVnd(tx.amount)} | ${safeNote} |`
      );
    }
    lines.push("");
  }

  lines.push("## 7. Quy Tắc Bắt Buộc Khi AI Đọc Context Này");
  lines.push("");
  lines.push("1. **Phân tách Số Cứng (Facts) và Giả Định (Assumptions)**: Tuyệt đối không tự sửa hay làm tròn 12 kỳ sao kê BIDV (`662.226.193 đ`), giá HĐMB (`1.573.480.430 đ`), vốn tự có (`323.655.950 đ`), Đợt 2 Q3/2027 (`393.370.110 đ`), PBT 2% (`28.925.479 đ`) và 5% Sổ hồng (`72.313.698 đ`).");
  lines.push("2. **Tuân thủ Schema `system_context.ts`**: Mọi tính năng mới phải giữ bất biến Event Sourcing số dư (`recalculateAccountBalances`), giữ lịch sử danh mục ẩn (`isHidden`), và chống trùng tự động ghi sổ.");
  lines.push("3. **Bảo vệ dữ liệu người dùng**: Không ghi đè chỉnh sửa dòng tiền thủ công (`periodOverrides`) hoặc các kỳ trả góp SKYONE đã xác nhận.");
  lines.push("");

  return lines.join("\n");
}

/**
 * Tải xuống tệp context.md chuẩn UTF-8 trực tiếp trên trình duyệt.
 */
export function downloadAiContextMarkdown(content: string, customFilename?: string): void {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const filename = customFilename || `home_moni_context_${stamp}.md`;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
