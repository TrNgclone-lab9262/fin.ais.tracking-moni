"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BellOff,
  BellRing,
  Check,
  ChevronRight,
  History,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  formatVNDMasked,
  getCurrentMonthKey,
  getMonthDisplayLabel,
} from "@/lib/formatters";
import { TransactionList } from "@/components/dashboard/TransactionList";
import { SelectInput, TextInput } from "@/components/common/inputs";

export function RecentActivitySection() {
  const {
    filteredTransactions,
    budgetSummary,
    categories,
    selectedMonth,
    setCategoryBudget,
    setActiveTab,
    isPrivacyMode,
    browserNotifStatus,
    browserNotifEnabled,
    enableBrowserNotifications,
    disableBrowserNotifications,
  } = useFinance();

  const activeMonthKey = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "EXPENSE"),
    [categories]
  );

  const [isBudgetEditorOpen, setIsBudgetEditorOpen] = useState(false);
  const [budgetCatId, setBudgetCatId] = useState<string>("");
  const [budgetLimitInput, setBudgetLimitInput] = useState<string>("");
  const [budgetFeedback, setBudgetFeedback] = useState<string | null>(null);

  const openBudgetEditor = (initialCategoryId?: string, initialLimit?: number) => {
    const fallbackCatId =
      initialCategoryId || expenseCategories[0]?.id || "cat_expense_food";
    setBudgetCatId(fallbackCatId);
    setBudgetLimitInput(
      initialLimit && initialLimit > 0
        ? new Intl.NumberFormat("vi-VN").format(initialLimit)
        : ""
    );
    setIsBudgetEditorOpen(true);
  };

  const handleSaveQuickBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const targetCatId = budgetCatId || expenseCategories[0]?.id;
    const numericLimit = parseInt(budgetLimitInput.replace(/[^0-9]/g, ""), 10) || 0;
    if (!targetCatId || numericLimit <= 0) return;

    setCategoryBudget(targetCatId, numericLimit, activeMonthKey);
    const catName =
      expenseCategories.find((c) => c.id === targetCatId)?.name || "Danh mục";
    setIsBudgetEditorOpen(false);
    setBudgetLimitInput("");
    setBudgetFeedback(`Đã đặt hạn mức ${catName} tháng ${activeMonthKey}.`);
    window.setTimeout(() => setBudgetFeedback(null), 3200);
  };

  const handleToggleBrowserNotifications = async () => {
    if (browserNotifEnabled) {
      disableBrowserNotifications();
      setBudgetFeedback("Đã tắt thông báo trình duyệt.");
      window.setTimeout(() => setBudgetFeedback(null), 2600);
      return;
    }

    const granted = await enableBrowserNotifications();
    if (granted) {
      setBudgetFeedback("Đã bật thông báo trình duyệt khi danh mục vượt 80% hạn mức.");
    } else if (browserNotifStatus === "unsupported") {
      setBudgetFeedback("Trình duyệt hiện tại không hỗ trợ Browser Notifications.");
    } else {
      setBudgetFeedback(
        "Quyền thông báo đang bị chặn. Hãy cấp quyền Notification trong cài đặt trình duyệt."
      );
    }
    window.setTimeout(() => setBudgetFeedback(null), 3500);
  };

  const overallRatio =
    budgetSummary.totalBudget > 0
      ? Math.round((budgetSummary.totalSpent / budgetSummary.totalBudget) * 100)
      : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span>Hoạt động &amp; Ngân sách hàng tháng</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* CỘT 1 & 2: DANH SÁCH GIAO DỊCH GẦN ĐÂY CÓ SẮP XẾP */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E9EEF5] dark:border-slate-800 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
                Giao dịch gần đây
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Bấm tiêu đề cột để sắp xếp theo ngày, mô tả, danh mục hoặc số tiền
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("transactions")}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <TransactionList
            transactions={filteredTransactions}
            maxItems={6}
            compact={true}
            emptyMessage="Chưa có giao dịch nào trong kỳ đang xem"
          />
        </div>

        {/* CỘT 3: NGÂN SÁCH HÀNG THÁNG (MONTHLY BUDGET) + >80% BROWSER NOTIFICATIONS */}
        <div
          data-testid="overview-monthly-budget-card"
          className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col justify-between gap-4"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
                  Ngân sách tháng này
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {getMonthDisplayLabel(activeMonthKey)} · Tổng chi{" "}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {formatVNDMasked(budgetSummary.totalSpent, isPrivacyMode)}
                  </strong>{" "}
                  / {formatVNDMasked(budgetSummary.totalBudget, isPrivacyMode)} ({overallRatio}%)
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-testid="overview-add-budget-btn"
                  onClick={() =>
                    isBudgetEditorOpen
                      ? setIsBudgetEditorOpen(false)
                      : openBudgetEditor()
                  }
                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  {isBudgetEditorOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isBudgetEditorOpen ? "Đóng" : "Đặt hạn mức"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("planning")}
                  className="min-h-[34px] px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-0.5 whitespace-nowrap cursor-pointer"
                >
                  <span>Chi tiết</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Browser Notification Opt-in Strip (>80%) */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700 flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                {browserNotifEnabled ? (
                  <BellRing className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#172B4D] dark:text-slate-100 truncate">
                    Thông báo đẩy trình duyệt (Ngân sách &amp; Định kỳ)
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {browserNotifStatus === "unsupported"
                      ? "Trình duyệt không hỗ trợ Notification API"
                      : browserNotifStatus === "denied"
                      ? "Quyền thông báo đang bị chặn trên trình duyệt"
                      : browserNotifEnabled
                      ? "Đang bật · Nhắc vượt 80% &amp; chi định kỳ trước 3 ngày"
                      : "Chưa bật · Nhấn để cấp quyền nhắc hạn mức &amp; hóa đơn"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="browser-notif-toggle-btn"
                disabled={browserNotifStatus === "unsupported"}
                onClick={() => void handleToggleBrowserNotifications()}
                className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 transition-colors ${
                  browserNotifEnabled
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-600 text-slate-700 dark:text-slate-200"
                }`}
              >
                {browserNotifEnabled ? "Đang bật" : "Bật thông báo"}
              </button>
            </div>

            {budgetFeedback && (
              <div
                role="status"
                className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-[11px] font-semibold flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{budgetFeedback}</span>
              </div>
            )}

            {/* Inline Quick Category Limit Editor */}
            {isBudgetEditorOpen && (
              <form
                onSubmit={handleSaveQuickBudget}
                data-testid="overview-budget-inline-form"
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-[#DCE4EE] dark:border-slate-700 space-y-2.5"
              >
                <SelectInput
                  label="Danh mục chi tiêu"
                  value={budgetCatId}
                  onChange={(nextCatId) => {
                    setBudgetCatId(nextCatId);
                    const existing = budgetSummary.items.find(
                      (item) => item.categoryId === nextCatId
                    );
                    if (existing) {
                      setBudgetLimitInput(
                        new Intl.NumberFormat("vi-VN").format(existing.limitAmount)
                      );
                    }
                  }}
                  options={expenseCategories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                />

                <TextInput
                  label={`Hạn mức tháng (${activeMonthKey})`}
                  value={budgetLimitInput}
                  inputMode="numeric"
                  onChange={(raw) => {
                    const digits = raw.replace(/[^0-9]/g, "");
                    if (!digits) {
                      setBudgetLimitInput("");
                      return;
                    }
                    setBudgetLimitInput(
                      new Intl.NumberFormat("vi-VN").format(parseInt(digits, 10))
                    );
                  }}
                  placeholder="Ví dụ: 5.000.000"
                  required
                />

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsBudgetEditorOpen(false)}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    data-testid="overview-budget-save-btn"
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    Lưu hạn mức
                  </button>
                </div>
              </form>
            )}

            {/* Category Progress Bars */}
            {budgetSummary.items.length === 0 ? (
              <div className="p-6 text-center rounded-lg border border-dashed border-[#DCE4EE] dark:border-slate-700 space-y-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Chưa có hạn mức danh mục cho {getMonthDisplayLabel(activeMonthKey)}
                </p>
                <button
                  type="button"
                  onClick={() => openBudgetEditor()}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  Thiết lập hạn mức đầu tiên
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
                {budgetSummary.items.map((item) => {
                  const exactRatio =
                    item.limitAmount > 0 ? item.spentAmount / item.limitAmount : 0;
                  const isOver = exactRatio >= 1;
                  const isNear80 = !isOver && exactRatio > 0.8;

                  return (
                    <div key={item.categoryId} className="space-y-1.5">
                      <div className="flex justify-between items-center gap-2 text-xs">
                        <span className="font-bold text-[#172B4D] dark:text-slate-100 flex items-center gap-1.5 min-w-0">
                          <span
                            aria-hidden="true"
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.categoryColor }}
                          />
                          <span className="truncate">{item.categoryName}</span>
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold tabular-nums">
                            {formatVNDMasked(item.spentAmount, isPrivacyMode)} /{" "}
                            {formatVNDMasked(item.limitAmount, isPrivacyMode)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              openBudgetEditor(item.categoryId, item.limitAmount)
                            }
                            aria-label={`Sửa hạn mức ${item.categoryName}`}
                            title="Sửa hạn mức"
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${
                            isOver
                              ? "bg-rose-600"
                              : isNear80
                              ? "bg-amber-500"
                              : "bg-emerald-600"
                          }`}
                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-semibold">
                        <span
                          className={`inline-flex items-center gap-1 ${
                            isOver
                              ? "text-rose-600 dark:text-rose-400"
                              : isNear80
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {(isOver || isNear80) && (
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                          )}
                          <span>
                            {isOver
                              ? `Vượt hạn mức (${formatVNDMasked(
                                  item.spentAmount - item.limitAmount,
                                  isPrivacyMode
                                )})`
                              : isNear80
                              ? `Vượt ngưỡng 80% · Còn ${formatVNDMasked(
                                  item.remainingAmount,
                                  isPrivacyMode
                                )}`
                              : `Còn ${formatVNDMasked(item.remainingAmount, isPrivacyMode)}`}
                          </span>
                        </span>
                        <span
                          className={`font-bold tabular-nums ${
                            isOver
                              ? "text-rose-600 dark:text-rose-400"
                              : isNear80
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
