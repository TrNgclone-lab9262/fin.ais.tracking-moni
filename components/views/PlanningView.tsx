"use client";

import React, { useMemo, useState } from "react";
import {
  Sliders,
  Plus,
  CheckCircle2,
  X,
  Coins,
  ShieldAlert,
  Plane,
  Laptop,
  Trash2,
  Edit2,
  Home,
  Copy,
  Repeat,
  AlertTriangle,
  BellRing,
  BellOff,
  Target,
  Tags,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, getCurrentMonthKey, getMonthDisplayLabel } from "@/lib/formatters";
import { shiftMonthKey } from "@/lib/financeEngine";
import {
  evaluateRecurringRuleDueStatus,
  getBudgetWarningStatus,
} from "@/lib/browserNotifications";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ExpenseScope, FamilyMember, RecurringRule, SavingsGoal, TransactionType } from "@/types/finance";
import { GoalDepositSheet } from "@/components/mobile/sheets/GoalDepositSheet";
import { SavingsChallengesSection } from "@/components/planning/SavingsChallengesSection";
import { CategoryManagerSection } from "@/components/categories/CategoryManagerSection";
import { getSelectableCategories } from "@/lib/categoryUtils";

export function PlanningView() {
  const {
    budgetSummary,
    goals,
    savingsChallenges,
    categories,
    accounts,
    recurringRules,
    selectedMonth,
    isPrivacyMode,
    settings,
    setCategoryBudget,
    deleteBudget,
    copyBudgetsFromMonth,
    addGoal,
    updateGoal,
    deleteGoal,
    addRecurringRule,
    updateRecurringRule,
    deleteRecurringRule,
    applyRecurringRule,
    applyAllPendingRecurringRules,
    getCategoryById,
    getAccountById,
    transactions,
    activePerspective,
    browserNotifStatus,
    browserNotifEnabled,
    enableBrowserNotifications,
    disableBrowserNotifications,
  } = useFinance();

  const [activeSubTab, setActiveSubTab] = useState<
    "BUDGET" | "GOALS" | "CHALLENGES" | "RECURRING" | "CATEGORIES"
  >("BUDGET");
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [recurringFeedback, setRecurringFeedback] = useState<string | null>(null);

  // Goal Form State
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");

  // Quick Category Budget Edit Modal
  const [editingCategoryBudget, setEditingCategoryBudget] = useState<{
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    limitAmount: number;
    spentAmount: number;
    hasExistingBudget: boolean;
  } | null>(null);
  const [categoryBudgetInput, setCategoryBudgetInput] = useState("");

  // Recurring Rule Modal State
  const [isRecModalOpen, setIsRecModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [recName, setRecName] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recType, setRecType] = useState<TransactionType>("EXPENSE");
  const [recCategoryId, setRecCategoryId] = useState("cat_expense_rent");
  const [recAccountId, setRecAccountId] = useState("");
  const [recMemberId, setRecMemberId] = useState<FamilyMember>("HUSBAND");
  const [recScope, setRecScope] = useState<ExpenseScope>("FAMILY");
  const [recDay, setRecDay] = useState("5");
  const [recNote, setRecNote] = useState("");

  const activeMonthKey = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
  const prevMonthKey = shiftMonthKey(activeMonthKey, -1);
  const activeMonthChallengeCount = useMemo(
    () => savingsChallenges.filter((c) => c.month === activeMonthKey).length,
    [savingsChallenges, activeMonthKey]
  );

  const activeCategoryCount = useMemo(
    () => categories.filter((c) => !c.isHidden).length,
    [categories]
  );

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "EXPENSE" && !c.isHidden),
    [categories]
  );

  const batchBudgetExpenseCategories = useMemo(() => {
    const budgetedIds = new Set(budgetSummary.items.map((item) => item.categoryId));
    return categories.filter(
      (c) => c.type === "EXPENSE" && (!c.isHidden || budgetedIds.has(c.id))
    );
  }, [categories, budgetSummary.items]);

  const categorySpentThisMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== "EXPENSE" || !tx.date.startsWith(activeMonthKey)) continue;
      if (activePerspective === "HUSBAND" && tx.memberId !== "HUSBAND") continue;
      if (activePerspective === "WIFE" && tx.memberId !== "WIFE") continue;
      map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount);
    }
    return map;
  }, [transactions, activeMonthKey, activePerspective]);

  const unbudgetedExpenseCategories = useMemo(() => {
    const budgetedIds = new Set(budgetSummary.items.map((item) => item.categoryId));
    return expenseCategories.filter((cat) => !budgetedIds.has(cat.id));
  }, [expenseCategories, budgetSummary.items]);

  const budgetTierCounts = useMemo(() => {
    let danger = 0;
    let warning = 0;
    let safe = 0;
    for (const item of budgetSummary.items) {
      const status = getBudgetWarningStatus(item);
      if (status.level === "DANGER") danger += 1;
      else if (status.level === "WARNING") warning += 1;
      else safe += 1;
    }
    return { danger, warning, safe };
  }, [budgetSummary.items]);

  const handleCopyPrevMonth = () => {
    const count = copyBudgetsFromMonth(prevMonthKey, activeMonthKey);
    if (count > 0) {
      setCopyFeedback(`Đã sao chép ${count} hạng mục ngân sách từ ${getMonthDisplayLabel(prevMonthKey)}.`);
    } else {
      setCopyFeedback(`Không có hạng mục mới nào cần sao chép từ ${getMonthDisplayLabel(prevMonthKey)}.`);
    }
    window.setTimeout(() => setCopyFeedback(null), 3500);
  };

  const openBatchBudgetModal = () => {
    const initialDrafts: Record<string, string> = {};
    for (const cat of batchBudgetExpenseCategories) {
      const existing = budgetSummary.items.find((b) => b.categoryId === cat.id);
      initialDrafts[cat.id] =
        existing && existing.limitAmount > 0
          ? new Intl.NumberFormat("vi-VN").format(existing.limitAmount)
          : "";
    }
    setBudgetDrafts(initialDrafts);
    setIsBudgetModalOpen(true);
  };

  const handleSaveBatchBudgets = (e: React.FormEvent) => {
    e.preventDefault();
    let updatedCount = 0;
    let removedCount = 0;

    for (const cat of batchBudgetExpenseCategories) {
      const raw = budgetDrafts[cat.id] || "";
      const val = parseInt(raw.replace(/[^0-9]/g, ""), 10) || 0;
      const existing = budgetSummary.items.find((b) => b.categoryId === cat.id);

      if (val > 0) {
        if (!existing || existing.limitAmount !== val) {
          setCategoryBudget(cat.id, val, activeMonthKey);
          updatedCount += 1;
        }
      } else if (existing) {
        deleteBudget(cat.id, activeMonthKey);
        removedCount += 1;
      }
    }

    setIsBudgetModalOpen(false);
    if (updatedCount > 0 || removedCount > 0) {
      setCopyFeedback(
        `Đã lưu hạn mức ngân sách cho ${getMonthDisplayLabel(activeMonthKey)} (${updatedCount} cập nhật${
          removedCount > 0 ? `, ${removedCount} đã gỡ` : ""
        }).`
      );
      window.setTimeout(() => setCopyFeedback(null), 3500);
    }
  };

  const handleToggleBrowserNotifications = async () => {
    if (browserNotifEnabled) {
      disableBrowserNotifications();
      setRecurringFeedback("Đã tắt thông báo đẩy trình duyệt.");
      window.setTimeout(() => setRecurringFeedback(null), 3000);
      return;
    }
    const granted = await enableBrowserNotifications();
    if (granted) {
      setRecurringFeedback(
        "Đã bật thông báo đẩy · Hệ thống tự nhắc trước 3 ngày đến hạn và khi vượt ngưỡng ngân sách."
      );
    } else if (browserNotifStatus === "unsupported") {
      setRecurringFeedback("Trình duyệt hiện tại không hỗ trợ Notification API.");
    } else {
      setRecurringFeedback(
        "Quyền thông báo đang bị chặn. Hãy cấp quyền Notification trong cài đặt trình duyệt."
      );
    }
    window.setTimeout(() => setRecurringFeedback(null), 3500);
  };

  const handleOpenCreateGoal = () => {
    setEditingGoal(null);
    setGoalName("");
    setGoalTarget("");
    setGoalCurrent("");
    setGoalDeadline("");
    setIsGoalModalOpen(true);
  };

  const handleOpenEditGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setGoalTarget(new Intl.NumberFormat("vi-VN").format(goal.targetAmount));
    setGoalCurrent(new Intl.NumberFormat("vi-VN").format(goal.currentAmount));
    setGoalDeadline(goal.deadline || "");
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim()) return;

    const target = parseFloat(goalTarget.replace(/[^0-9]/g, "")) || 0;
    const current = parseFloat(goalCurrent.replace(/[^0-9]/g, "")) || 0;

    if (editingGoal) {
      updateGoal(editingGoal.id, {
        name: goalName.trim(),
        targetAmount: target,
        currentAmount: current,
        deadline: goalDeadline || undefined,
      });
    } else {
      addGoal({
        name: goalName.trim(),
        targetAmount: target,
        currentAmount: current,
        deadline: goalDeadline || undefined,
      });
    }

    setEditingGoal(null);
    setGoalName("");
    setGoalTarget("");
    setGoalCurrent("");
    setGoalDeadline("");
    setIsGoalModalOpen(false);
  };

  const handleOpenQuickBudgetEdit = (item: {
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    limitAmount: number;
    spentAmount?: number;
    hasExistingBudget?: boolean;
  }) => {
    const spent = item.spentAmount ?? (categorySpentThisMonth.get(item.categoryId) || 0);
    const hasExisting = item.hasExistingBudget ?? item.limitAmount > 0;
    setEditingCategoryBudget({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      categoryColor: item.categoryColor,
      limitAmount: item.limitAmount,
      spentAmount: spent,
      hasExistingBudget: hasExisting,
    });
    setCategoryBudgetInput(
      item.limitAmount > 0 ? new Intl.NumberFormat("vi-VN").format(item.limitAmount) : ""
    );
  };

  const handleSaveCategoryBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategoryBudget) return;
    const val = parseFloat(categoryBudgetInput.replace(/[^0-9]/g, "")) || 0;
    if (val <= 0) {
      if (editingCategoryBudget.hasExistingBudget) {
        deleteBudget(editingCategoryBudget.categoryId, activeMonthKey);
      }
    } else {
      setCategoryBudget(editingCategoryBudget.categoryId, val, activeMonthKey);
    }
    setEditingCategoryBudget(null);
    setCategoryBudgetInput("");
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setRecName("");
    setRecAmount("");
    setRecType("EXPENSE");
    const selectableExp = getSelectableCategories(categories, "EXPENSE");
    setRecCategoryId(selectableExp[0]?.id || "cat_expense_rent");
    setRecAccountId(accounts[0]?.id || "");
    setRecMemberId("HUSBAND");
    setRecScope("FAMILY");
    setRecDay("5");
    setRecNote("");
    setIsRecModalOpen(true);
  };

  const openEditRule = (rule: RecurringRule) => {
    setEditingRule(rule);
    setRecName(rule.name);
    setRecAmount(new Intl.NumberFormat("vi-VN").format(rule.amount));
    setRecType(rule.type);
    setRecCategoryId(rule.categoryId);
    setRecAccountId(rule.accountId);
    setRecMemberId(rule.memberId);
    setRecScope(rule.scope);
    setRecDay(String(rule.dayOfMonth));
    setRecNote(rule.note || "");
    setIsRecModalOpen(true);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(recAmount.replace(/[^0-9]/g, "")) || 0;
    if (!recName.trim() || amt <= 0) return;
    const safeDay = Math.min(28, Math.max(1, parseInt(recDay, 10) || 1));

    const payload = {
      name: recName.trim(),
      amount: amt,
      type: recType,
      categoryId: recCategoryId,
      accountId: recAccountId || accounts[0]?.id || "acc_husband_bidv",
      memberId: recMemberId,
      scope: recScope,
      dayOfMonth: safeDay,
      isActive: editingRule ? editingRule.isActive : true,
      note: recNote.trim() || undefined,
    };

    if (editingRule) {
      updateRecurringRule(editingRule.id, payload);
    } else {
      addRecurringRule(payload);
    }
    setIsRecModalOpen(false);
  };

  const getGoalIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("nhà")) return <Home className="w-5 h-5 text-indigo-600" />;
    if (lower.includes("khẩn cấp") || lower.includes("quỹ")) return <ShieldAlert className="w-5 h-5 text-rose-500" />;
    if (lower.includes("du lịch") || lower.includes("đà lạt") || lower.includes("vé") || lower.includes("nhật"))
      return <Plane className="w-5 h-5 text-blue-500" />;
    return <Laptop className="w-5 h-5 text-amber-500" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-[#E9EEF5] dark:border-slate-700 w-fit">
        <button
          onClick={() => setActiveSubTab("BUDGET")}
          className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all cursor-pointer ${
            activeSubTab === "BUDGET"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Ngân sách tháng ({budgetSummary.items.length})
        </button>
        <button
          onClick={() => setActiveSubTab("GOALS")}
          className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === "GOALS"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Mục tiêu tiết kiệm ({goals.length})
        </button>
        <button
          onClick={() => setActiveSubTab("CHALLENGES")}
          data-testid="planning-tab-challenges"
          className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "CHALLENGES"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Thử thách tiết kiệm ({activeMonthChallengeCount})</span>
        </button>
        <button
          onClick={() => setActiveSubTab("RECURRING")}
          className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "RECURRING"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Thu/Chi Định Kỳ ({recurringRules.length})</span>
        </button>
        <button
          type="button"
          data-testid="planning-tab-categories"
          onClick={() => setActiveSubTab("CATEGORIES")}
          className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "CATEGORIES"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Tags className="w-3.5 h-3.5" />
          <span>Danh mục ({activeCategoryCount})</span>
        </button>
      </div>

      {activeSubTab === "BUDGET" ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-[#DCE4EE] dark:border-slate-800 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E9EEF5] dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">
                  Theo dõi ngân sách · {getMonthDisplayLabel(activeMonthKey)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Theo dõi chi tiêu so với ngân sách từng danh mục chi
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCopyPrevMonth}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 font-semibold text-xs rounded-md transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép từ tháng trước</span>
                </button>
                <button
                  type="button"
                  onClick={openBatchBudgetModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Đặt ngân sách</span>
                </button>
              </div>
            </div>

            {copyFeedback && (
              <div className="mt-4 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                {copyFeedback}
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-6">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Tổng ngân sách tháng
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#172B4D] dark:text-slate-100 mt-1 block tabular-nums">
                  {formatVNDMasked(budgetSummary.totalBudget, isPrivacyMode)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Đã chi
                </span>
                <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block tabular-nums">
                  {formatVNDMasked(budgetSummary.totalSpent, isPrivacyMode)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Còn lại
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block tabular-nums">
                  {formatVNDMasked(budgetSummary.remaining, isPrivacyMode)}
                </span>
              </div>
              <div className="bg-blue-50/70 dark:bg-blue-500/10 p-3 sm:p-4 rounded-lg border border-blue-100 dark:border-blue-500/30">
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                  Mỗi ngày còn được tiêu ({budgetSummary.daysRemaining} ngày)
                </span>
                <span className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-300 mt-1 block tabular-nums">
                  {formatVNDMasked(budgetSummary.dailyAllowance, isPrivacyMode)}
                </span>
              </div>
            </div>

            {budgetSummary.items.length > 0 && (
              <div className="mt-5 pt-4 border-t border-[#E9EEF5] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold tabular-nums">
                  <span className="text-rose-600 dark:text-rose-400">
                    {budgetTierCounts.danger} vượt / chạm trần (≥ 100%)
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-amber-700 dark:text-amber-300">
                    {budgetTierCounts.warning} gần chạm ngưỡng (80%–99%)
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-emerald-700 dark:text-emerald-300">
                    {budgetTierCounts.safe} trong hạn mức (&lt; 80%)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  Mốc vạch 80% cảnh báo vàng · 100% cảnh báo đỏ
                </span>
              </div>
            )}
          </div>

          {budgetSummary.items.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-dashed border-[#DCE4EE] dark:border-slate-700 text-center space-y-3">
              <p className="text-sm font-bold text-[#172B4D] dark:text-slate-100">
                Chưa có hạn mức danh mục nào cho {getMonthDisplayLabel(activeMonthKey)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Đặt hạn mức cho từng danh mục như Ăn uống, Giải trí để theo dõi thanh tiến độ và nhận cảnh báo sớm khi chạm ngưỡng 80%.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={openBatchBudgetModal}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  Đặt ngân sách hàng loạt
                </button>
                <button
                  type="button"
                  onClick={handleCopyPrevMonth}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Sao chép từ tháng trước
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {budgetSummary.items.map((item) => {
                const status = getBudgetWarningStatus(item);
                const isDanger = status.level === "DANGER";
                const isWarning = status.level === "WARNING";
                const overAmount = Math.max(0, item.spentAmount - item.limitAmount);

                return (
                  <div
                    key={item.categoryId}
                    data-testid={`budget-card-${item.categoryId}`}
                    className={`bg-white dark:bg-slate-900 rounded-xl p-5 border shadow-xs flex flex-col justify-between space-y-3 transition-colors ${
                      isDanger
                        ? "border-rose-300 dark:border-rose-500/40"
                        : isWarning
                        ? "border-amber-300 dark:border-amber-500/40"
                        : "border-[#DCE4EE] dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.categoryColor }}
                        />
                        <h4 className="font-bold text-[#172B4D] dark:text-slate-100 text-sm truncate">
                          {item.categoryName}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenQuickBudgetEdit({
                              ...item,
                              hasExistingBudget: true,
                            })
                          }
                          title="Điều chỉnh hạn mức danh mục"
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBudget(item.categoryId, activeMonthKey)}
                          title="Xóa hạn mức danh mục này"
                          className="p-1.5 text-slate-300 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                      <span>
                        {formatVNDMasked(item.spentAmount, isPrivacyMode)} /{" "}
                        {formatVNDMasked(item.limitAmount, isPrivacyMode)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenQuickBudgetEdit({
                            ...item,
                            hasExistingBudget: true,
                          })
                        }
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Sửa hạn mức
                      </button>
                    </div>

                    {/* Thanh tiến độ kèm vạch ngưỡng cảnh báo 80% */}
                    <div className="relative w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isDanger
                            ? "bg-rose-600"
                            : isWarning
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, status.percentage)}%` }}
                      />
                      <span
                        aria-hidden="true"
                        title="Ngưỡng cảnh báo 80%"
                        className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-slate-400/70 dark:bg-slate-500/80"
                      />
                    </div>

                    <div className="flex justify-between items-center gap-2 text-xs font-semibold">
                      <span
                        className={`inline-flex items-center gap-1 min-w-0 truncate ${
                          isDanger
                            ? "text-rose-600 dark:text-rose-400"
                            : isWarning
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {(isDanger || isWarning) && (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate tabular-nums">
                          {isDanger
                            ? overAmount > 0
                              ? `${status.label} (+${formatVNDMasked(overAmount, isPrivacyMode)})`
                              : status.label
                            : isWarning
                            ? `${status.label} · Còn ${formatVNDMasked(item.remainingAmount, isPrivacyMode)}`
                            : `Còn ${formatVNDMasked(item.remainingAmount, isPrivacyMode)}`}
                        </span>
                      </span>
                      <span
                        className={`font-bold tabular-nums shrink-0 ${
                          isDanger
                            ? "text-rose-600 dark:text-rose-400"
                            : isWarning
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {status.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Đặt nhanh hạn mức cho các danh mục chưa cài đặt */}
          {unbudgetedExpenseCategories.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#DCE4EE] dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-[#172B4D] dark:text-slate-100">
                    Đặt nhanh hạn mức cho danh mục khác
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Chọn một danh mục chi tiêu chưa có ngân sách trong {getMonthDisplayLabel(activeMonthKey)} để đặt ngưỡng cảnh báo
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {unbudgetedExpenseCategories.map((cat) => {
                  const spent = categorySpentThisMonth.get(cat.id) || 0;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      data-testid={`quick-add-budget-${cat.id}`}
                      onClick={() =>
                        handleOpenQuickBudgetEdit({
                          categoryId: cat.id,
                          categoryName: cat.name,
                          categoryColor: cat.color,
                          limitAmount: 0,
                          spentAmount: spent,
                          hasExistingBudget: false,
                        })
                      }
                      className="flex items-center justify-between gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-[#E9EEF5] dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                            {cat.name}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums block">
                            Đã chi: {formatVNDMasked(spent, isPrivacyMode)}
                          </span>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Đặt mức</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : activeSubTab === "GOALS" ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">Mục tiêu tài chính</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Đặt mục tiêu tiết kiệm và ghi nhận dòng tiền nạp hũ minh bạch
              </p>
            </div>
            <button
              onClick={handleOpenCreateGoal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm mục tiêu</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {goals.map((g) => {
              const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
              const isDone = pct === 100;

              return (
                <div
                  key={g.id}
                  className="bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-[#E9EEF5] dark:border-slate-700">
                          {getGoalIcon(g.name)}
                        </div>
                        <div>
                          <h4 className="font-bold text-[#172B4D] dark:text-slate-100 text-sm">{g.name}</h4>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {g.deadline ? `Hạn: ${g.deadline.split("-").reverse().join("/")}` : "Không đặt hạn"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between items-baseline mb-1.5 text-xs">
                        <span className="font-black text-[#172B4D] dark:text-slate-100">
                          {formatVNDMasked(g.currentAmount, isPrivacyMode)}
                        </span>
                        <span className="text-slate-400 font-semibold">
                          / {formatVNDMasked(g.targetAmount, isPrivacyMode)}
                        </span>
                      </div>

                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isDone ? "bg-emerald-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[11px] mt-2 font-medium">
                        <span className="text-slate-500 dark:text-slate-400">
                          {isDone ? "🎉 Đã hoàn thành!" : `Tiến độ: ${pct}%`}
                        </span>
                        {!isDone && (
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">
                            Cần ~{formatVNDMasked(Math.round((g.targetAmount - g.currentAmount) / 12), isPrivacyMode)}/tháng
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E9EEF5] dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {!isDone ? (
                        <button
                          onClick={() => setDepositGoalId(g.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>Nạp thêm</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" /> Đạt mục tiêu
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditGoal(g)}
                        title="Chỉnh sửa mục tiêu"
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-md transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteGoalId(g.id)}
                        title="Xóa mục tiêu"
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeSubTab === "CHALLENGES" ? (
        <SavingsChallengesSection />
      ) : activeSubTab === "CATEGORIES" ? (
        <CategoryManagerSection />
      ) : (
        /* TAB 4: THU/CHI ĐỊNH KỲ */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-[#DCE4EE] dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">
                  Quy Tắc Thu / Chi Định Kỳ Hàng Tháng
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Tiền lương, tiền thuê nhà, internet, gửi tiết kiệm... nhắc trước hạn 3 ngày &amp; ghi sổ 1 chạm ({activeMonthKey})
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {recurringRules.some((r) => r.isActive && r.lastAppliedMonth !== activeMonthKey) && (
                  <button
                    type="button"
                    onClick={() => applyAllPendingRecurringRules(activeMonthKey)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ghi sổ tất cả</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openCreateRule}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm quy tắc định kỳ</span>
                </button>
              </div>
            </div>

            {/* Browser Push Notification Strip cho chi tiêu định kỳ */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {browserNotifEnabled ? (
                  <BellRing className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#172B4D] dark:text-slate-100">
                    Thông báo đẩy trình duyệt cho khoản chi định kỳ
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {browserNotifStatus === "unsupported"
                      ? "Trình duyệt hiện tại không hỗ trợ Notification API (vẫn nhắc nội bộ trong app)"
                      : browserNotifStatus === "denied"
                      ? "Quyền thông báo trình duyệt đang bị chặn · Mở Cài đặt trình duyệt để cấp phép"
                      : browserNotifEnabled
                      ? "Đang bật · Tự động gửi thông báo đẩy trước ngày đến hạn 3 ngày (1 lần/tháng)"
                      : "Bật để nhận thông báo đẩy trình duyệt khi sắp đến hạn thanh toán tiền nhà, internet..."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="planning-recurring-push-toggle"
                disabled={browserNotifStatus === "unsupported"}
                onClick={() => void handleToggleBrowserNotifications()}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 transition-colors ${
                  browserNotifEnabled
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-600 text-slate-700 dark:text-slate-200"
                }`}
              >
                {browserNotifEnabled ? "Đang bật thông báo đẩy" : "Bật thông báo đẩy"}
              </button>
            </div>

            {recurringFeedback && (
              <div
                role="status"
                className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
              >
                {recurringFeedback}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recurringRules.map((rule) => {
              const cat = getCategoryById(rule.categoryId);
              const acc = getAccountById(rule.accountId);
              const appliedThisMonth = rule.lastAppliedMonth === activeMonthKey;
              const dueEval = evaluateRecurringRuleDueStatus(rule, activeMonthKey);
              const isExpenseReminderWindow =
                rule.isActive &&
                rule.type === "EXPENSE" &&
                !appliedThisMonth &&
                (dueEval.status === "OVERDUE" ||
                  dueEval.status === "DUE_TODAY" ||
                  dueEval.status === "DUE_SOON");

              return (
                <div
                  key={rule.id}
                  className={`bg-white dark:bg-slate-900 rounded-xl p-5 border shadow-xs flex flex-col justify-between space-y-3 ${
                    !rule.isActive
                      ? "border-slate-200 dark:border-slate-800 opacity-65"
                      : isExpenseReminderWindow && dueEval.status === "OVERDUE"
                      ? "border-rose-300 dark:border-rose-500/40"
                      : isExpenseReminderWindow
                      ? "border-amber-300 dark:border-amber-500/40"
                      : "border-[#DCE4EE] dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold">
                        <span
                          className={
                            rule.type === "INCOME"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {rule.type === "INCOME" ? "Thu nhập" : "Chi tiêu"}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                          Ngày {rule.dayOfMonth} hàng tháng
                        </span>
                        {rule.isActive && rule.type === "EXPENSE" && !appliedThisMonth && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span
                              className={`inline-flex items-center gap-1 tabular-nums ${
                                dueEval.status === "OVERDUE"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : dueEval.status === "DUE_TODAY" || dueEval.status === "DUE_SOON"
                                  ? "text-amber-700 dark:text-amber-300"
                                  : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {dueEval.status === "OVERDUE" ? (
                                <>
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>Quá hạn {Math.abs(dueEval.daysUntilDue)} ngày</span>
                                </>
                              ) : dueEval.status === "DUE_TODAY" ? (
                                <>
                                  <BellRing className="w-3 h-3 shrink-0" />
                                  <span>Đến hạn hôm nay</span>
                                </>
                              ) : dueEval.status === "DUE_SOON" ? (
                                <>
                                  <BellRing className="w-3 h-3 shrink-0" />
                                  <span>Nhắc trước hạn · Còn {dueEval.daysUntilDue} ngày</span>
                                </>
                              ) : (
                                <span>Còn {dueEval.daysUntilDue} ngày</span>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-1.5 truncate">
                        {rule.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {cat?.name || "Danh mục"} · {acc?.name || "Ví"} ·{" "}
                        {rule.memberId === "HUSBAND" ? settings.husbandName : settings.wifeName}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-base font-black tabular-nums ${
                          rule.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {rule.type === "INCOME" ? "+" : "-"}
                        {formatVNDMasked(rule.amount, isPrivacyMode)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateRecurringRule(rule.id, { isActive: !rule.isActive })}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md border whitespace-nowrap cursor-pointer ${
                          rule.isActive
                            ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                            : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {rule.isActive ? "Đang bật" : "Tạm tắt"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditRule(rule)}
                        title="Sửa quy tắc"
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-md cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRecurringRule(rule.id)}
                        title="Xóa quy tắc"
                        className="p-1.5 text-slate-300 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {appliedThisMonth ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        <CheckCircle2 className="w-4 h-4" /> Đã ghi {activeMonthKey}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => applyRecurringRule(rule.id, activeMonthKey)}
                        className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        Ghi sổ {activeMonthKey}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Cài đặt Ngân sách hàng loạt */}
      {isBudgetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsBudgetModalOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 border border-[#DCE4EE] dark:border-slate-800 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">
                  Cài đặt hạn mức ngân sách ({getMonthDisplayLabel(activeMonthKey)})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Nhập hạn mức từng danh mục (để trống hoặc 0 để gỡ hạn mức) · Ngưỡng cảnh báo 80% &amp; 100%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBudgetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBatchBudgets} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto py-4 space-y-2.5 pr-1">
                {batchBudgetExpenseCategories.map((cat) => {
                  const spent = categorySpentThisMonth.get(cat.id) || 0;
                  const draftVal = budgetDrafts[cat.id] || "";
                  const parsedLimit = parseInt(draftVal.replace(/[^0-9]/g, ""), 10) || 0;
                  const previewPct = parsedLimit > 0 ? Math.round((spent / parsedLimit) * 100) : 0;

                  return (
                    <div
                      key={cat.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {cat.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>Đã chi: {formatVNDMasked(spent, isPrivacyMode)}</span>
                          {parsedLimit > 0 && (
                            <>
                              <span>·</span>
                              <span
                                className={`font-bold ${
                                  previewPct >= 100
                                    ? "text-rose-600 dark:text-rose-400"
                                    : previewPct >= 80
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-emerald-700 dark:text-emerald-300"
                                }`}
                              >
                                Dự kiến {previewPct}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Hạn mức ${cat.name}`}
                          value={draftVal}
                          placeholder="Chưa đặt"
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            setBudgetDrafts((prev) => ({
                              ...prev,
                              [cat.id]: raw
                                ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10))
                                : "",
                            }));
                          }}
                          className="w-36 text-right bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 tabular-nums"
                        />
                        {draftVal && (
                          <button
                            type="button"
                            title="Gỡ hạn mức"
                            onClick={() =>
                              setBudgetDrafts((prev) => ({ ...prev, [cat.id]: "" }))
                            }
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-[#E9EEF5] dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs rounded-md cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  data-testid="save-batch-budgets-btn"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-xs whitespace-nowrap cursor-pointer"
                >
                  Lưu tất cả hạn mức
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <GoalDepositSheet
        goal={goals.find((g) => g.id === depositGoalId) || null}
        isOpen={depositGoalId !== null}
        onClose={() => setDepositGoalId(null)}
      />

      {/* Modal Tạo / Sửa Goal */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 border border-[#DCE4EE] dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
              <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">
                {editingGoal ? "Chỉnh sửa mục tiêu tiết kiệm" : "Thêm mục tiêu tiết kiệm"}
              </h3>
              <button
                onClick={() => {
                  setIsGoalModalOpen(false);
                  setEditingGoal(null);
                }}
                className="text-slate-400 p-1 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-3.5 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tên mục tiêu</label>
                <input
                  type="text"
                  required
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="VD: Quỹ dự phòng, Mua xe máy..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Số tiền mục tiêu (VND)</label>
                <input
                  type="text"
                  required
                  value={goalTarget}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setGoalTarget(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                  }}
                  placeholder="VD: 50.000.000"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Hiện đã có (VND)</label>
                <input
                  type="text"
                  value={goalCurrent}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setGoalCurrent(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                  }}
                  placeholder="0"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Hạn mục tiêu (Tùy chọn)</label>
                <input
                  type="date"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsGoalModalOpen(false);
                    setEditingGoal(null);
                  }}
                  className="flex-1 py-2.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-md text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
                >
                  {editingGoal ? "Cập nhật mục tiêu" : "Lưu mục tiêu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tạo / Sửa Recurring Rule */}
      {isRecModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 border border-[#DCE4EE] dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
              <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">
                {editingRule ? "Sửa quy tắc định kỳ" : "Thêm quy tắc định kỳ mới"}
              </h3>
              <button onClick={() => setIsRecModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tên khoản định kỳ</label>
                <input
                  type="text"
                  required
                  value={recName}
                  onChange={(e) => setRecName(e.target.value)}
                  placeholder="VD: Tiền thuê nhà, Lương tháng..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Số tiền (VND)</label>
                  <input
                    type="text"
                    required
                    value={recAmount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setRecAmount(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Ngày hàng tháng (1-28)</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={recDay}
                    onChange={(e) => setRecDay(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Loại</label>
                  <select
                    value={recType}
                    onChange={(e) => {
                      const nextType = e.target.value as TransactionType;
                      setRecType(nextType);
                      const firstCat = getSelectableCategories(
                        categories,
                        nextType === "INCOME" ? "INCOME" : "EXPENSE",
                        editingRule?.categoryId
                      )[0];
                      if (firstCat) setRecCategoryId(firstCat.id);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500"
                  >
                    <option value="EXPENSE">Chi tiêu</option>
                    <option value="INCOME">Thu nhập</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Danh mục</label>
                  <select
                    value={recCategoryId}
                    onChange={(e) => setRecCategoryId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500"
                  >
                    {getSelectableCategories(
                      categories,
                      recType === "INCOME" ? "INCOME" : "EXPENSE",
                      editingRule?.categoryId
                    ).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tài khoản</label>
                  <select
                    value={recAccountId}
                    onChange={(e) => setRecAccountId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Người thực hiện</label>
                  <select
                    value={recMemberId}
                    onChange={(e) => setRecMemberId(e.target.value as FamilyMember)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500"
                  >
                    <option value="HUSBAND">👨 {settings.husbandName}</option>
                    <option value="WIFE">👩 {settings.wifeName}</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRecModalOpen(false)}
                  className="flex-1 py-2.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-md text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  Lưu quy tắc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa nhanh / Đặt mới Hạn mức Danh mục */}
      {editingCategoryBudget && (() => {
        const previewVal = parseInt(categoryBudgetInput.replace(/[^0-9]/g, ""), 10) || 0;
        const previewPct =
          previewVal > 0 ? Math.round((editingCategoryBudget.spentAmount / previewVal) * 100) : 0;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setEditingCategoryBudget(null)}
          >
            <div
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 border border-[#DCE4EE] dark:border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: editingCategoryBudget.categoryColor }}
                  />
                  <h3 className="text-sm font-bold text-[#172B4D] dark:text-slate-100 truncate">
                    Hạn mức: {editingCategoryBudget.categoryName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCategoryBudget(null)}
                  className="text-slate-400 p-1 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCategoryBudget} className="space-y-4 pt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>Đã chi {getMonthDisplayLabel(activeMonthKey)}:</span>
                  <strong className="text-slate-800 dark:text-slate-100">
                    {formatVNDMasked(editingCategoryBudget.spentAmount, isPrivacyMode)}
                  </strong>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Hạn mức chi tháng này (VND)
                  </label>
                  <input
                    type="text"
                    autoFocus
                    inputMode="numeric"
                    value={categoryBudgetInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setCategoryBudgetInput(
                        raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : ""
                      );
                    }}
                    placeholder="Ví dụ: 3.000.000"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-base font-black text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 text-right tabular-nums"
                  />
                  {previewVal > 0 && (
                    <p
                      className={`text-[11px] font-semibold mt-1.5 text-right tabular-nums ${
                        previewPct >= 100
                          ? "text-rose-600 dark:text-rose-400"
                          : previewPct >= 80
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {previewPct >= 100
                        ? `Đang ở mức ${previewPct}% (Vượt hạn mức)`
                        : previewPct >= 80
                        ? `Đang ở mức ${previewPct}% (Gần chạm ngưỡng cảnh báo)`
                        : `Đang ở mức ${previewPct}% (Trong hạn mức an toàn)`}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {[1000000, 2000000, 3000000, 5000000, 7000000, 10000000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCategoryBudgetInput(new Intl.NumberFormat("vi-VN").format(val))}
                      className="py-1.5 px-2 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-blue-700 dark:hover:text-blue-300 text-slate-600 dark:text-slate-300 rounded-md transition-colors cursor-pointer tabular-nums"
                    >
                      {val / 1000000}tr
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  {editingCategoryBudget.hasExistingBudget && (
                    <button
                      type="button"
                      onClick={() => {
                        deleteBudget(editingCategoryBudget.categoryId, activeMonthKey);
                        setEditingCategoryBudget(null);
                        setCategoryBudgetInput("");
                      }}
                      className="px-3 py-2 text-xs font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/25 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Xóa
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingCategoryBudget(null)}
                    className="flex-1 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    Lưu hạn mức
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      <ConfirmDialog
        isOpen={deleteGoalId !== null}
        title="Xóa mục tiêu này?"
        message="Mục tiêu tiết kiệm này sẽ bị xóa khỏi kế hoạch tài chính của bạn."
        confirmLabel="Xóa mục tiêu"
        cancelLabel="Hủy"
        isDanger={true}
        onConfirm={() => {
          if (deleteGoalId) {
            deleteGoal(deleteGoalId);
            setDeleteGoalId(null);
          }
        }}
        onCancel={() => setDeleteGoalId(null)}
      />
    </div>
  );
}
