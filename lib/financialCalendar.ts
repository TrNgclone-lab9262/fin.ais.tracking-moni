import {
  Account,
  MortgageContract,
  RecurringRule,
  Transaction,
} from "@/types/finance";
import {
  evaluateRecurringRuleDueStatus,
} from "./browserNotifications";
import { generateMortgageSchedule } from "./mortgageEngine";
import {
  formatMonthKeyFromDate,
  hasMatchingManualTransactionForRule,
} from "./recurringAutomation";

export type FinancialCalendarEventKind =
  | "RECURRING"
  | "INSTALLMENT"
  | "CREDIT_STATEMENT"
  | "CREDIT_DUE";

export type FinancialCalendarEventStatus =
  | "APPLIED"
  | "OVERDUE"
  | "DUE_TODAY"
  | "DUE_SOON"
  | "UPCOMING"
  | "CARD_INFO";

export interface FinancialCalendarEvent {
  id: string;
  dateIso: string; // YYYY-MM-DD
  day: number;
  monthKey: string;
  kind: FinancialCalendarEventKind;
  title: string;
  subtitle: string;
  amount: number;
  transactionType: "INCOME" | "EXPENSE" | "TRANSFER";
  status: FinancialCalendarEventStatus;
  accountId?: string;
  canQuickRecord: boolean;
  recurringRuleId?: string;
  autoPostEnabled?: boolean;
  isSkippedDuplicate?: boolean;
  installmentPeriod?: number;
}

export interface FinancialCalendarDayCell {
  day: number;
  dateIso: string;
  isToday: boolean;
  events: FinancialCalendarEvent[];
  hasOverdue: boolean;
  hasDueSoon: boolean;
  hasPending: boolean;
  hasPaid: boolean;
  hasCardEvent: boolean;
}

export interface FinancialCalendarMonthData {
  monthKey: string;
  year: number;
  monthNumber: number;
  daysInMonth: number;
  firstWeekdayOffset: number; // 0 = Mon .. 6 = Sun
  cells: FinancialCalendarDayCell[];
  events: FinancialCalendarEvent[];
  summary: {
    totalScheduledExpense: number;
    totalScheduledIncome: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
    cardEventCount: number;
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function getDaysInMonth(year: number, monthNumber: number): number {
  return new Date(year, monthNumber, 0).getDate();
}

function buildDateIso(monthKey: string, day: number): string {
  return `${monthKey}-${pad2(day)}`;
}

function computeDaysDiff(targetDateIso: string, todayDate: Date): number {
  const [y, m, d] = targetDateIso.split("-").map(Number);
  const targetStart = new Date(y, (m || 1) - 1, d || 1);
  const todayStart = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate()
  );
  return Math.round((targetStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildFinancialCalendarMonth(params: {
  monthKey: string;
  rules: RecurringRule[];
  contract?: MortgageContract | null;
  accounts: Account[];
  transactions: Transaction[];
  now?: Date;
  defaultInstallmentAccountId?: string;
}): FinancialCalendarMonthData {
  const {
    monthKey,
    rules,
    contract,
    accounts,
    transactions,
    now = new Date(),
    defaultInstallmentAccountId,
  } = params;

  const [yStr, mStr] = monthKey.split("-");
  const year = parseInt(yStr, 10) || now.getFullYear();
  const monthNumber = parseInt(mStr, 10) || now.getMonth() + 1;
  const normalizedMonthKey = `${year}-${pad2(monthNumber)}`;
  const daysInMonth = getDaysInMonth(year, monthNumber);

  // Convert JS getDay() (0=Sun..6=Sat) into Monday-first offset (0=Mon..6=Sun)
  const jsFirstDay = new Date(year, monthNumber - 1, 1).getDay();
  const firstWeekdayOffset = (jsFirstDay + 6) % 7;

  const todayIso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
  const currentMonthKey = formatMonthKeyFromDate(now);

  const events: FinancialCalendarEvent[] = [];

  // 1. Recurring Rules
  for (const rule of rules) {
    if (!rule.isActive) continue;
    const day = Math.min(daysInMonth, Math.max(1, rule.dayOfMonth));
    const dateIso = buildDateIso(normalizedMonthKey, day);

    const matchedTx = hasMatchingManualTransactionForRule(
      rule,
      normalizedMonthKey,
      transactions
    );
    const isApplied = rule.lastAppliedMonth === normalizedMonthKey || Boolean(matchedTx);

    let status: FinancialCalendarEventStatus = "UPCOMING";
    if (isApplied) {
      status = "APPLIED";
    } else if (rule.type === "INCOME") {
      const diff = computeDaysDiff(dateIso, now);
      if (diff < 0) status = "OVERDUE";
      else if (diff === 0) status = "DUE_TODAY";
      else if (diff <= 3) status = "DUE_SOON";
      else status = "UPCOMING";
    } else {
      const evalStatus = evaluateRecurringRuleDueStatus(
        rule,
        normalizedMonthKey,
        now,
        3
      );
      status = evalStatus.status as FinancialCalendarEventStatus;
    }

    const isSkippedDuplicate = rule.lastSkippedDuplicateMonth === normalizedMonthKey;
    const subtitleParts = [
      rule.type === "INCOME" ? "Thu định kỳ" : "Chi định kỳ",
      rule.autoPost ? "Tự ghi" : "Thủ công",
    ];
    if (isSkippedDuplicate) {
      subtitleParts.push("Đã có giao dịch khớp");
    }

    events.push({
      id: `cal_rec_${rule.id}_${normalizedMonthKey}`,
      dateIso,
      day,
      monthKey: normalizedMonthKey,
      kind: "RECURRING",
      title: rule.name,
      subtitle: subtitleParts.join(" · "),
      amount: rule.amount,
      transactionType: rule.type,
      status,
      accountId: rule.accountId,
      canQuickRecord: !isApplied && rule.lastAppliedMonth !== normalizedMonthKey,
      recurringRuleId: rule.id,
      autoPostEnabled: Boolean(rule.autoPost),
      isSkippedDuplicate,
    });
  }

  // 2. SKYONE Loan Installments falling in normalizedMonthKey
  if (contract) {
    const schedule = generateMortgageSchedule(contract, todayIso);
    for (const row of schedule.rows) {
      if (row.monthKey !== normalizedMonthKey) continue;
      const day = Math.min(
        daysInMonth,
        Math.max(1, parseInt(row.dueDate.split("-")[2] || String(contract.paymentDayOfMonth), 10))
      );
      const dateIso = buildDateIso(normalizedMonthKey, day);
      const diff = computeDaysDiff(dateIso, now);

      let status: FinancialCalendarEventStatus;
      if (row.status === "PAID") {
        status = "APPLIED";
      } else if (diff < 0) {
        status = "OVERDUE";
      } else if (diff === 0) {
        status = "DUE_TODAY";
      } else if (diff <= 3) {
        status = "DUE_SOON";
      } else {
        status = "UPCOMING";
      }

      events.push({
        id: `cal_inst_${row.period}`,
        dateIso,
        day,
        monthKey: normalizedMonthKey,
        kind: "INSTALLMENT",
        title: `Trả góp ${contract.projectName} · Kỳ #${row.period}`,
        subtitle: `Gốc ${row.principal.toLocaleString("vi-VN")}đ · Lãi ${row.interest.toLocaleString("vi-VN")}đ`,
        amount: row.totalPayment,
        transactionType: "EXPENSE",
        status,
        accountId: defaultInstallmentAccountId,
        canQuickRecord: row.status !== "PAID",
        installmentPeriod: row.period,
      });
    }
  }

  // 3. Credit Card Statement & Payment Due Dates
  for (const acc of accounts) {
    if (acc.type !== "CREDIT_CARD") continue;

    if (acc.statementDay && acc.statementDay >= 1) {
      const day = Math.min(daysInMonth, Math.max(1, acc.statementDay));
      const dateIso = buildDateIso(normalizedMonthKey, day);
      events.push({
        id: `cal_cc_stmt_${acc.id}_${normalizedMonthKey}`,
        dateIso,
        day,
        monthKey: normalizedMonthKey,
        kind: "CREDIT_STATEMENT",
        title: `Chốt sao kê · ${acc.name}`,
        subtitle: `Dư nợ hiện tại · Chu kỳ thẻ tín dụng`,
        amount: acc.currentBalance,
        transactionType: "EXPENSE",
        status: "CARD_INFO",
        accountId: acc.id,
        canQuickRecord: false,
      });
    }

    if (acc.dueDay && acc.dueDay >= 1) {
      const day = Math.min(daysInMonth, Math.max(1, acc.dueDay));
      const dateIso = buildDateIso(normalizedMonthKey, day);
      const diff = computeDaysDiff(dateIso, now);
      let status: FinancialCalendarEventStatus = "CARD_INFO";
      if (acc.currentBalance <= 0) {
        status = "APPLIED";
      } else if (normalizedMonthKey >= currentMonthKey && diff >= 0 && diff <= 3) {
        status = diff === 0 ? "DUE_TODAY" : "DUE_SOON";
      } else if (normalizedMonthKey >= currentMonthKey && diff < 0) {
        status = "OVERDUE";
      }

      events.push({
        id: `cal_cc_due_${acc.id}_${normalizedMonthKey}`,
        dateIso,
        day,
        monthKey: normalizedMonthKey,
        kind: "CREDIT_DUE",
        title: `Hạn thanh toán · ${acc.name}`,
        subtitle:
          acc.currentBalance > 0
            ? "Cần thanh toán dư nợ sao kê"
            : "Đã tất toán dư nợ thẻ",
        amount: acc.currentBalance,
        transactionType: "EXPENSE",
        status,
        accountId: acc.id,
        canQuickRecord: false,
      });
    }
  }

  // Sort events by day, then priority (OVERDUE > DUE_TODAY > DUE_SOON > UPCOMING > APPLIED > CARD_INFO)
  const priority: Record<FinancialCalendarEventStatus, number> = {
    OVERDUE: 0,
    DUE_TODAY: 1,
    DUE_SOON: 2,
    UPCOMING: 3,
    CARD_INFO: 4,
    APPLIED: 5,
  };

  events.sort(
    (a, b) => a.day - b.day || priority[a.status] - priority[b.status]
  );

  // Build day cells
  const eventsByDay = new Map<number, FinancialCalendarEvent[]>();
  for (const ev of events) {
    const list = eventsByDay.get(ev.day);
    if (list) list.push(ev);
    else eventsByDay.set(ev.day, [ev]);
  }

  const cells: FinancialCalendarDayCell[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateIso = buildDateIso(normalizedMonthKey, d);
    const dayEvents = eventsByDay.get(d) || [];
    cells.push({
      day: d,
      dateIso,
      isToday: dateIso === todayIso,
      events: dayEvents,
      hasOverdue: dayEvents.some((e) => e.status === "OVERDUE"),
      hasDueSoon: dayEvents.some(
        (e) => e.status === "DUE_TODAY" || e.status === "DUE_SOON"
      ),
      hasPending: dayEvents.some(
        (e) => e.status === "UPCOMING" && e.kind !== "CREDIT_STATEMENT"
      ),
      hasPaid: dayEvents.some((e) => e.status === "APPLIED"),
      hasCardEvent: dayEvents.some(
        (e) => e.kind === "CREDIT_STATEMENT" || e.kind === "CREDIT_DUE"
      ),
    });
  }

  let totalScheduledExpense = 0;
  let totalScheduledIncome = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let cardEventCount = 0;

  for (const ev of events) {
    if (ev.kind === "RECURRING" || ev.kind === "INSTALLMENT") {
      if (ev.transactionType === "INCOME") {
        totalScheduledIncome += ev.amount;
      } else {
        totalScheduledExpense += ev.amount;
      }
      if (ev.status === "APPLIED") {
        paidCount += 1;
      } else {
        pendingCount += 1;
        if (ev.status === "OVERDUE") overdueCount += 1;
      }
    } else {
      cardEventCount += 1;
    }
  }

  return {
    monthKey: normalizedMonthKey,
    year,
    monthNumber,
    daysInMonth,
    firstWeekdayOffset,
    cells,
    events,
    summary: {
      totalScheduledExpense,
      totalScheduledIncome,
      paidCount,
      pendingCount,
      overdueCount,
      cardEventCount,
    },
  };
}
