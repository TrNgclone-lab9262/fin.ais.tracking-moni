"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, getCurrentMonthKey, getMonthDisplayLabel } from "@/lib/formatters";
import { shiftMonthKey } from "@/lib/financeEngine";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ExpenseScope, FamilyMember, RecurringRule, SavingsGoal, TransactionType } from "@/types/finance";
import { GoalDepositSheet } from "@/components/mobile/sheets/GoalDepositSheet";

export function PlanningView() {
  const {
    budgetSummary,
    goals,
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
  } = useFinance();

  const [activeSubTab, setActiveSubTab] = useState<"BUDGET" | "GOALS" | "RECURRING">("BUDGET");
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

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

  const handleCopyPrevMonth = () => {
    const count = copyBudgetsFromMonth(prevMonthKey, activeMonthKey);
    if (count > 0) {
      setCopyFeedback(`Đã sao chép ${count} hạng mục ngân sách từ ${getMonthDisplayLabel(prevMonthKey)}.`);
    } else {
      setCopyFeedback(`Không có hạng mục mới nào cần sao chép từ ${getMonthDisplayLabel(prevMonthKey)}.`);
    }
    setTimeout(() => setCopyFeedback(null), 3500);
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
  }) => {
    setEditingCategoryBudget(item);
    setCategoryBudgetInput(new Intl.NumberFormat("vi-VN").format(item.limitAmount));
  };

  const handleSaveCategoryBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategoryBudget) return;
    const val = parseFloat(categoryBudgetInput.replace(/[^0-9]/g, "")) || 0;
    setCategoryBudget(editingCategoryBudget.categoryId, val, activeMonthKey);
    setEditingCategoryBudget(null);
    setCategoryBudgetInput("");
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setRecName("");
    setRecAmount("");
    setRecType("EXPENSE");
    setRecCategoryId("cat_expense_rent");
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
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-[#E9EEF5] w-fit">
        <button
          onClick={() => setActiveSubTab("BUDGET")}
          className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all cursor-pointer ${
            activeSubTab === "BUDGET"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Ngân sách tháng ({budgetSummary.items.length})
        </button>
        <button
          onClick={() => setActiveSubTab("GOALS")}
          className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all cursor-pointer ${
            activeSubTab === "GOALS"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Mục tiêu tiết kiệm ({goals.length})
        </button>
        <button
          onClick={() => setActiveSubTab("RECURRING")}
          className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "RECURRING"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Thu/Chi Định Kỳ ({recurringRules.length})</span>
        </button>
      </div>

      {activeSubTab === "BUDGET" ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-[#DCE4EE] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E9EEF5]">
              <div>
                <h3 className="text-base font-bold text-[#172B4D]">
                  Theo dõi ngân sách · {getMonthDisplayLabel(activeMonthKey)}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Theo dõi chi tiêu so với ngân sách từng danh mục chi
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCopyPrevMonth}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-md transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép từ tháng trước</span>
                </button>
                <button
                  onClick={() => setIsBudgetModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-md transition-colors cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-slate-500" />
                  <span>Đặt ngân sách</span>
                </button>
              </div>
            </div>

            {copyFeedback && (
              <div className="mt-4 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                {copyFeedback}
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-6">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Tổng ngân sách tháng
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#172B4D] mt-1 block">
                  {formatVNDMasked(budgetSummary.totalBudget, isPrivacyMode)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Đã chi
                </span>
                <span className="text-xl sm:text-2xl font-black text-rose-600 mt-1 block">
                  {formatVNDMasked(budgetSummary.totalSpent, isPrivacyMode)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Còn lại
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 block">
                  {formatVNDMasked(budgetSummary.remaining, isPrivacyMode)}
                </span>
              </div>
              <div className="bg-blue-50/70 p-3 sm:p-4 rounded-lg border border-blue-100">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                  Mỗi ngày còn được tiêu ({budgetSummary.daysRemaining} ngày)
                </span>
                <span className="text-lg sm:text-xl font-black text-blue-700 mt-1 block">
                  {formatVNDMasked(budgetSummary.dailyAllowance, isPrivacyMode)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgetSummary.items.map((item) => {
              const isOver = item.percentage >= 100;
              return (
                <div
                  key={item.categoryId}
                  className="bg-white rounded-xl p-5 border border-[#DCE4EE] shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.categoryColor }}
                      />
                      <h4 className="font-bold text-[#172B4D] text-sm truncate">{item.categoryName}</h4>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenQuickBudgetEdit(item)}
                        title="Điều chỉnh hạn mức danh mục"
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteBudget(item.categoryId, activeMonthKey)}
                        title="Xóa hạn mức danh mục này"
                        className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-slate-600">
                    {formatVNDMasked(item.spentAmount, isPrivacyMode)} /{" "}
                    {formatVNDMasked(item.limitAmount, isPrivacyMode)}
                  </div>

                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOver ? "bg-amber-500" : "bg-teal-500"
                      }`}
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                    <span>
                      {isOver ? "Còn 0 ₫" : `Còn ${formatVNDMasked(item.remainingAmount, isPrivacyMode)}`}
                    </span>
                    <span className={`font-bold ${isOver ? "text-amber-600" : "text-teal-600"}`}>
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeSubTab === "GOALS" ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-[#DCE4EE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#172B4D]">Mục tiêu tài chính</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
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
                  className="bg-white rounded-xl p-5 sm:p-6 border border-[#DCE4EE] shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-[#E9EEF5]">
                          {getGoalIcon(g.name)}
                        </div>
                        <div>
                          <h4 className="font-bold text-[#172B4D] text-sm">{g.name}</h4>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {g.deadline ? `Hạn: ${g.deadline.split("-").reverse().join("/")}` : "Không đặt hạn"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between items-baseline mb-1.5 text-xs">
                        <span className="font-black text-[#172B4D]">
                          {formatVNDMasked(g.currentAmount, isPrivacyMode)}
                        </span>
                        <span className="text-slate-400 font-semibold">
                          / {formatVNDMasked(g.targetAmount, isPrivacyMode)}
                        </span>
                      </div>

                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isDone ? "bg-emerald-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[11px] mt-2 font-medium">
                        <span className="text-slate-500">
                          {isDone ? "🎉 Đã hoàn thành!" : `Tiến độ: ${pct}%`}
                        </span>
                        {!isDone && (
                          <span className="text-blue-600 font-semibold">
                            Cần ~{formatVNDMasked(Math.round((g.targetAmount - g.currentAmount) / 12), isPrivacyMode)}/tháng
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E9EEF5] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {!isDone ? (
                        <button
                          onClick={() => setDepositGoalId(g.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>Nạp thêm</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" /> Đạt mục tiêu
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditGoal(g)}
                        title="Chỉnh sửa mục tiêu"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteGoalId(g.id)}
                        title="Xóa mục tiêu"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
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
      ) : (
        /* TAB 3: THU/CHI ĐỊNH KỲ */
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-[#DCE4EE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#172B4D]">
                Quy Tắc Thu / Chi Định Kỳ Hàng Tháng
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Tiền lương, tiền thuê nhà, internet, gửi tiết kiệm... ghi sổ 1 chạm mỗi tháng ({activeMonthKey})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {recurringRules.some((r) => r.isActive && r.lastAppliedMonth !== activeMonthKey) && (
                <button
                  type="button"
                  onClick={() => applyAllPendingRecurringRules(activeMonthKey)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ghi sổ tất cả</span>
                </button>
              )}
              <button
                onClick={openCreateRule}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm quy tắc định kỳ</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recurringRules.map((rule) => {
              const cat = getCategoryById(rule.categoryId);
              const acc = getAccountById(rule.accountId);
              const appliedThisMonth = rule.lastAppliedMonth === activeMonthKey;

              return (
                <div
                  key={rule.id}
                  className={`bg-white rounded-xl p-5 border shadow-xs flex flex-col justify-between space-y-3 ${
                    rule.isActive ? "border-[#DCE4EE]" : "border-slate-200 opacity-65"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rule.type === "INCOME"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {rule.type === "INCOME" ? "Thu nhập" : "Chi tiêu"}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          Ngày {rule.dayOfMonth} hàng tháng
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm mt-1.5">{rule.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {cat?.name || "Danh mục"} · {acc?.name || "Ví"} ·{" "}
                        {rule.memberId === "HUSBAND" ? settings.husbandName : settings.wifeName}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-base font-black ${
                          rule.type === "INCOME" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {rule.type === "INCOME" ? "+" : "-"}
                        {formatVNDMasked(rule.amount, isPrivacyMode)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateRecurringRule(rule.id, { isActive: !rule.isActive })}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md border cursor-pointer ${
                          rule.isActive
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-slate-100 border-slate-200 text-slate-500"
                        }`}
                      >
                        {rule.isActive ? "Đang bật" : "Tạm tắt"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditRule(rule)}
                        title="Sửa quy tắc"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRecurringRule(rule.id)}
                        title="Xóa quy tắc"
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {appliedThisMonth ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" /> Đã ghi {activeMonthKey}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => applyRecurringRule(rule.id, activeMonthKey)}
                        className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
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

      {/* Modal Cài đặt Ngân sách */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 border border-[#DCE4EE] max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5]">
              <h3 className="text-base font-bold text-[#172B4D]">
                Cài đặt hạn mức ngân sách ({getMonthDisplayLabel(activeMonthKey)})
              </h3>
              <button onClick={() => setIsBudgetModalOpen(false)} className="text-slate-400 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {categories
                .filter((c) => c.type === "EXPENSE")
                .map((cat) => {
                  const currentBudget =
                    budgetSummary.items.find((b) => b.categoryId === cat.id)?.limitAmount || 0;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-[#E9EEF5]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs font-bold text-slate-800">{cat.name}</span>
                      </div>
                      <input
                        type="text"
                        defaultValue={new Intl.NumberFormat("vi-VN").format(currentBudget)}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value.replace(/[^0-9]/g, "")) || 0;
                          if (val > 0) {
                            setCategoryBudget(cat.id, val, activeMonthKey);
                          }
                        }}
                        className="w-32 text-right bg-white border border-[#DCE4EE] rounded-lg px-2.5 py-1 text-xs font-black text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-[#E9EEF5] flex justify-end">
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-md shadow-xs cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
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
            className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 border border-[#DCE4EE]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5]">
              <h3 className="text-base font-bold text-[#172B4D]">
                {editingGoal ? "Chỉnh sửa mục tiêu tiết kiệm" : "Thêm mục tiêu tiết kiệm"}
              </h3>
              <button
                onClick={() => {
                  setIsGoalModalOpen(false);
                  setEditingGoal(null);
                }}
                className="text-slate-400 p-1 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-3.5 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tên mục tiêu</label>
                <input
                  type="text"
                  required
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="VD: Quỹ dự phòng, Mua xe máy..."
                  className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Số tiền mục tiêu (VND)</label>
                <input
                  type="text"
                  required
                  value={goalTarget}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setGoalTarget(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                  }}
                  placeholder="VD: 50.000.000"
                  className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Hiện đã có (VND)</label>
                <input
                  type="text"
                  value={goalCurrent}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setGoalCurrent(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                  }}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Hạn mục tiêu (Tùy chọn)</label>
                <input
                  type="date"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                  className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsGoalModalOpen(false);
                    setEditingGoal(null);
                  }}
                  className="flex-1 py-2.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
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
            className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 border border-[#DCE4EE]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5]">
              <h3 className="text-base font-bold text-[#172B4D]">
                {editingRule ? "Sửa quy tắc định kỳ" : "Thêm quy tắc định kỳ mới"}
              </h3>
              <button onClick={() => setIsRecModalOpen(false)} className="text-slate-400 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tên khoản định kỳ</label>
                <input
                  type="text"
                  required
                  value={recName}
                  onChange={(e) => setRecName(e.target.value)}
                  placeholder="VD: Tiền thuê nhà, Lương tháng..."
                  className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Số tiền (VND)</label>
                  <input
                    type="text"
                    required
                    value={recAmount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setRecAmount(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                    }}
                    className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Ngày hàng tháng (1-28)</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={recDay}
                    onChange={(e) => setRecDay(e.target.value)}
                    className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Loại</label>
                  <select
                    value={recType}
                    onChange={(e) => {
                      const nextType = e.target.value as TransactionType;
                      setRecType(nextType);
                      const firstCat = categories.find((c) => c.type === (nextType === "INCOME" ? "INCOME" : "EXPENSE"));
                      if (firstCat) setRecCategoryId(firstCat.id);
                    }}
                    className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-xs font-semibold"
                  >
                    <option value="EXPENSE">Chi tiêu</option>
                    <option value="INCOME">Thu nhập</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Danh mục</label>
                  <select
                    value={recCategoryId}
                    onChange={(e) => setRecCategoryId(e.target.value)}
                    className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-xs font-semibold"
                  >
                    {categories
                      .filter((c) => c.type === (recType === "INCOME" ? "INCOME" : "EXPENSE"))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tài khoản</label>
                  <select
                    value={recAccountId}
                    onChange={(e) => setRecAccountId(e.target.value)}
                    className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-xs font-semibold"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Người thực hiện</label>
                  <select
                    value={recMemberId}
                    onChange={(e) => setRecMemberId(e.target.value as FamilyMember)}
                    className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-xs font-semibold"
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
                  className="flex-1 py-2.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-md text-xs font-bold bg-blue-600 text-white cursor-pointer"
                >
                  Lưu quy tắc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa nhanh Hạn mức Danh mục */}
      {editingCategoryBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 border border-[#DCE4EE]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5]">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: editingCategoryBudget.categoryColor }}
                />
                <h3 className="text-sm font-bold text-[#172B4D]">
                  Hạn mức: {editingCategoryBudget.categoryName}
                </h3>
              </div>
              <button
                onClick={() => setEditingCategoryBudget(null)}
                className="text-slate-400 p-1 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategoryBudget} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Hạn mức chi tháng này (VND)
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={categoryBudgetInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setCategoryBudgetInput(
                      raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : ""
                    );
                  }}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-base font-black text-slate-800 outline-none focus:border-blue-500 text-right"
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {[1000000, 2000000, 3000000, 5000000, 7000000, 10000000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCategoryBudgetInput(new Intl.NumberFormat("vi-VN").format(val))}
                    className="py-1 px-2 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-md transition-colors cursor-pointer"
                  >
                    {val / 1000000}tr
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCategoryBudget(null)}
                  className="flex-1 py-2 text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
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
      )}

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
