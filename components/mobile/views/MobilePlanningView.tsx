"use client";

import React, { useState } from "react";
import { Target, Coins, Plus, Pencil, Trash2, X, Repeat, CheckCircle2 } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, getCurrentMonthKey, getMonthDisplayLabel } from "@/lib/formatters";
import { SavingsGoal } from "@/types/finance";
import { GoalDepositSheet } from "@/components/mobile/sheets/GoalDepositSheet";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

export function MobilePlanningView() {
  const {
    goals,
    budgetSummary,
    todaySpentInfo,
    selectedMonth,
    isPrivacyMode,
    recurringRules,
    addGoal,
    updateGoal,
    deleteGoal,
    setCategoryBudget,
    applyRecurringRule,
    applyAllPendingRecurringRules,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<"GOALS" | "BUDGET">("GOALS");
  const [depositingGoal, setDepositingGoal] = useState<SavingsGoal | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);

  // Goal Create/Edit Modal
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");

  // Budget Quick Edit Modal
  const [editingBudget, setEditingBudget] = useState<{
    categoryId: string;
    categoryName: string;
    limitAmount: number;
  } | null>(null);
  const [budgetInput, setBudgetInput] = useState("");

  const dailyAllowance = budgetSummary?.dailyAllowance || 0;
  const todaySpent = todaySpentInfo.amount;
  const todayRemaining = Math.max(0, dailyAllowance - todaySpent);
  const dailyPct = dailyAllowance > 0 ? Math.min(100, Math.round((todaySpent / dailyAllowance) * 100)) : 0;

  const activeMonthKey = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
  const monthLabel = selectedMonth === "ALL" ? "Tất cả" : getMonthDisplayLabel(selectedMonth);

  const openCreateGoal = () => {
    setEditingGoal(null);
    setGoalName("");
    setGoalTarget("");
    setGoalCurrent("0");
    setGoalDeadline("");
    setIsGoalModalOpen(true);
  };

  const openEditGoal = (g: SavingsGoal) => {
    setEditingGoal(g);
    setGoalName(g.name);
    setGoalTarget(new Intl.NumberFormat("vi-VN").format(g.targetAmount));
    setGoalCurrent(new Intl.NumberFormat("vi-VN").format(g.currentAmount));
    setGoalDeadline(g.deadline || "");
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim()) return;
    const target = parseFloat(goalTarget.replace(/[^0-9]/g, "")) || 0;
    const current = parseFloat(goalCurrent.replace(/[^0-9]/g, "")) || 0;
    if (target <= 0) return;

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
    setIsGoalModalOpen(false);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;
    const val = parseFloat(budgetInput.replace(/[^0-9]/g, "")) || 0;
    setCategoryBudget(editingBudget.categoryId, val, activeMonthKey);
    setEditingBudget(null);
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* 1. Header Switcher */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
        <button
          onClick={() => setActiveTab("GOALS")}
          className={`py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "GOALS"
              ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Hũ Tích Lũy ({goals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("BUDGET")}
          className={`py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "BUDGET"
              ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Ngân Sách ({budgetSummary.items.length})</span>
        </button>
      </div>

      {/* 2. DAILY ALLOWANCE WIDGET */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-xs block">
                Hạn Mức Chi Tiêu Ngày
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-400 block font-medium">
                Còn {budgetSummary.daysRemaining} ngày trong {monthLabel}
              </span>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
              todaySpent > dailyAllowance
                ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300"
                : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
            }`}
          >
            {todaySpent > dailyAllowance ? "Vượt hạn mức" : `Còn ${Math.max(0, 100 - dailyPct)}%`}
          </span>
        </div>

        <div>
          <div className="flex justify-between items-baseline text-xs mb-1">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Còn chi được hôm nay:</span>
            <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
              {formatVNDMasked(todayRemaining, isPrivacyMode)} /{" "}
              {formatVNDMasked(dailyAllowance, isPrivacyMode)}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                todaySpent > dailyAllowance ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. NỘI DUNG THEO TAB CHỌN */}
      {activeTab === "GOALS" ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 px-0.5">
            <span>Hũ Tích Lũy Tổ Ấm</span>
            <button
              onClick={openCreateGoal}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo hũ mới</span>
            </button>
          </div>

          {goals.map((g) => {
            const current = g.currentAmount;
            const target = g.targetAmount;
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 1000) / 10) : 0;
            const isHome = g.name.toLowerCase().includes("nhà");

            return (
              <div
                key={g.id}
                className={`p-4 rounded-xl border shadow-xs space-y-3 ${
                  isHome
                    ? "bg-[#F5F3FF] dark:bg-indigo-500/15 border-[#DDD6FE] dark:border-indigo-500/30"
                    : "bg-white dark:bg-slate-900 border-[#DCE4EE] dark:border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{isHome ? "🏡" : "🎯"}</span>
                    <div>
                      <h4 className={`font-extrabold text-xs sm:text-sm ${isHome ? "text-[#4338CA] dark:text-indigo-300" : "text-slate-800 dark:text-slate-100"}`}>
                        {g.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 block font-medium">
                        {g.deadline ? `Hạn mục tiêu: ${g.deadline}` : "Tổ ấm tương lai"}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-md ${
                      isHome
                        ? "bg-[#EEF2FF] dark:bg-indigo-500/20 text-[#4F46E5] dark:text-indigo-300 border border-[#C7D2FE] dark:border-indigo-500/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {pct}%
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-baseline text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Đã tích lũy:</span>
                    <span className={`font-black ${isHome ? "text-[#312E81] dark:text-indigo-200" : "text-slate-800 dark:text-slate-100"}`}>
                      {formatVNDMasked(current, isPrivacyMode)} /{" "}
                      {formatVNDMasked(target, isPrivacyMode)}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isHome ? "bg-[#4F46E5]" : "bg-blue-600"
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditGoal(g)}
                      aria-label={`Sửa mục tiêu ${g.name}`}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteGoalId(g.id)}
                      aria-label={`Xóa mục tiêu ${g.name}`}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => setDepositingGoal(g)}
                    className={`px-3 py-1.5 rounded-lg text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer ${
                      isHome ? "bg-[#4F46E5] hover:bg-indigo-700" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nạp hũ</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Toàn bộ danh mục ngân sách (không cắt slice(0,5)) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 px-0.5">
              <span>Tiến Độ Ngân Sách · {monthLabel}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Chạm để sửa hạn mức</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {(budgetSummary?.items || []).map((item) => {
                const pct = Math.min(100, Math.round(item.percentage));
                const isOver = item.spentAmount > item.limitAmount;

                return (
                  <button
                    key={item.categoryId}
                    type="button"
                    onClick={() => {
                      setEditingBudget({
                        categoryId: item.categoryId,
                        categoryName: item.categoryName,
                        limitAmount: item.limitAmount,
                      });
                      setBudgetInput(new Intl.NumberFormat("vi-VN").format(item.limitAmount));
                    }}
                    className="w-full text-left p-3.5 space-y-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.categoryColor || "#2563EB" }}
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.categoryName}</span>
                      </div>

                      <span className={`font-bold shrink-0 ${isOver ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300"}`}>
                        {formatVNDMasked(item.spentAmount, isPrivacyMode)} /{" "}
                        {formatVNDMasked(item.limitAmount, isPrivacyMode)}
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOver ? "bg-rose-500" : "bg-blue-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Giao dịch định kỳ áp dụng nhanh trên Mobile */}
          {recurringRules.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 px-0.5">
                <span className="flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Thu/Chi Định Kỳ ({activeMonthKey})</span>
                </span>
                {recurringRules.some((r) => r.isActive && r.lastAppliedMonth !== activeMonthKey) && (
                  <button
                    type="button"
                    onClick={() => applyAllPendingRecurringRules(activeMonthKey)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Ghi sổ hết
                  </button>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {recurringRules
                  .filter((r) => r.isActive)
                  .map((rule) => {
                    const applied = rule.lastAppliedMonth === activeMonthKey;
                    return (
                      <div key={rule.id} className="p-3 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 dark:text-slate-100 block truncate">{rule.name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium">
                            Ngày {rule.dayOfMonth} hàng tháng ·{" "}
                            {formatVNDMasked(rule.amount, isPrivacyMode)}
                          </span>
                        </div>
                        {applied ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> Đã ghi
                          </span>
                        ) : (
                          <button
                            onClick={() => applyRecurringRule(rule.id, activeMonthKey)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                          >
                            Ghi sổ
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Sheet nạp tiền vào hũ tích lũy */}
      <GoalDepositSheet
        goal={depositingGoal}
        isOpen={depositingGoal !== null}
        onClose={() => setDepositingGoal(null)}
      />

      {/* Modal Tạo / Sửa Goal */}
      {isGoalModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setIsGoalModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 border border-[#DCE4EE] dark:border-slate-800 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {editingGoal ? "Sửa hũ tích lũy" : "Tạo hũ tích lũy mới"}
              </h3>
              <button onClick={() => setIsGoalModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tên mục tiêu</label>
                <input
                  type="text"
                  required
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="VD: Quỹ du lịch Nhật Bản"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100"
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
                  placeholder="50.000.000"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Số tiền đã có (VND)</label>
                <input
                  type="text"
                  value={goalCurrent}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setGoalCurrent(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                  }}
                  placeholder="0"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Hạn mục tiêu</label>
                <input
                  type="date"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white cursor-pointer"
                >
                  Lưu mục tiêu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa Ngân sách danh mục */}
      {editingBudget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setEditingBudget(null)}
        >
          <div
            className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-2xl p-5 border border-[#DCE4EE] dark:border-slate-800 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Hạn mức: {editingBudget.categoryName}
            </h3>
            <form onSubmit={handleSaveBudget} className="space-y-3">
              <input
                type="text"
                autoFocus
                required
                value={budgetInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setBudgetInput(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-right text-base font-black text-slate-800 dark:text-slate-100"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBudget(null)}
                  className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white cursor-pointer"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteGoalId !== null}
        title="Xóa hũ tích lũy?"
        message="Mục tiêu này sẽ bị xóa khỏi danh sách kế hoạch."
        confirmLabel="Xóa"
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
