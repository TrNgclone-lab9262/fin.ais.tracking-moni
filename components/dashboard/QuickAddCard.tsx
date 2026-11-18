"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Wallet,
  Users,
  User,
  Home,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { ExpenseScope, FamilyMember } from "@/types/finance";
import { formatVND } from "@/lib/formatters";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { useHaptic } from "@/src/hooks/useHaptic";

interface QuickAddCardProps {
  compact?: boolean;
  onOpenFullForm?: () => void;
}

function findPreferredAccountId(
  accounts: ReturnType<typeof useFinance>["accounts"],
  member: FamilyMember
): string {
  const ownedLiquid = accounts.find(
    (a) => a.owner === member && a.type !== "CREDIT_CARD" && a.isSalaryAccount
  );
  if (ownedLiquid) return ownedLiquid.id;

  const anyOwnedLiquid = accounts.find(
    (a) => a.owner === member && a.type !== "CREDIT_CARD"
  );
  if (anyOwnedLiquid) return anyOwnedLiquid.id;

  const anyOwned = accounts.find((a) => a.owner === member);
  if (anyOwned) return anyOwned.id;

  const sharedLiquid = accounts.find(
    (a) => a.owner === "SHARED" && a.type !== "CREDIT_CARD"
  );
  if (sharedLiquid) return sharedLiquid.id;

  return accounts[0]?.id || "";
}

export function QuickAddCard({ compact = false, onOpenFullForm }: QuickAddCardProps) {
  const {
    accounts,
    categories,
    activePerspective,
    settings,
    addTransaction,
  } = useFinance();
  const haptic = useHaptic();

  const defaultMember: FamilyMember =
    activePerspective === "WIFE" ? "WIFE" : "HUSBAND";

  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [amountInput, setAmountInput] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [memberId, setMemberId] = useState<FamilyMember>(defaultMember);
  const [accountId, setAccountId] = useState<string>(() =>
    findPreferredAccountId(accounts, defaultMember)
  );
  const [scope, setScope] = useState<ExpenseScope>("FAMILY");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Tự đồng bộ thành viên & ví mặc định khi người dùng đổi góc nhìn tổng quan
  useEffect(() => {
    const nextMember: FamilyMember =
      activePerspective === "WIFE" ? "WIFE" : "HUSBAND";
    setMemberId(nextMember);
    setAccountId(findPreferredAccountId(accounts, nextMember));
  }, [activePerspective, accounts]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type && !c.isHidden),
    [categories, type]
  );

  useEffect(() => {
    if (
      filteredCategories.length > 0 &&
      !filteredCategories.some((c) => c.id === categoryId)
    ) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, categoryId]);

  // Sắp xếp ví để ví của thành viên đang chọn lên trước khi chạm đổi nhanh
  const orderedAccounts = useMemo(() => {
    const score = (owner: FamilyMember) => {
      if (owner === memberId) return 0;
      if (owner === "SHARED") return 1;
      return 2;
    };
    return [...accounts].sort((a, b) => score(a.owner) - score(b.owner));
  }, [accounts, memberId]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) || orderedAccounts[0],
    [accounts, accountId, orderedAccounts]
  );

  const numericAmount = useMemo(() => {
    const digits = amountInput.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }, [amountInput]);

  const handleAmountChange = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "").slice(0, 11);
    setAmountInput(digits);
    if (error) setError(null);
  };

  const handleAddChip = (delta: number) => {
    haptic.light();
    const next = numericAmount + delta;
    if (next <= 99_999_999_999) {
      setAmountInput(String(next));
      if (error) setError(null);
    }
  };

  const handleMultiplyThousand = () => {
    haptic.light();
    if (numericAmount <= 0) return;
    const next = numericAmount * 1000;
    if (next <= 99_999_999_999) {
      setAmountInput(String(next));
      if (error) setError(null);
    }
  };

  const handleToggleMember = () => {
    haptic.light();
    const nextMember: FamilyMember = memberId === "HUSBAND" ? "WIFE" : "HUSBAND";
    setMemberId(nextMember);
    setAccountId(findPreferredAccountId(accounts, nextMember));
  };

  const handleCycleAccount = () => {
    if (orderedAccounts.length <= 1) return;
    haptic.light();
    const currentIdx = orderedAccounts.findIndex((a) => a.id === selectedAccount?.id);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % orderedAccounts.length : 0;
    setAccountId(orderedAccounts[nextIdx].id);
  };

  const handleToggleScope = () => {
    haptic.light();
    setScope((prev) => (prev === "FAMILY" ? "PERSONAL" : "FAMILY"));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (numericAmount <= 0) {
      haptic.error();
      setError("Nhập số tiền lớn hơn 0 để ghi nhanh.");
      return;
    }

    const activeCat =
      filteredCategories.find((c) => c.id === categoryId) || filteredCategories[0];
    const targetAccId = selectedAccount?.id || accounts[0]?.id;

    if (!activeCat || !targetAccId) {
      haptic.error();
      setError("Thiếu danh mục hoặc ví thanh toán.");
      return;
    }

    addTransaction({
      amount: numericAmount,
      date: new Date().toISOString().slice(0, 10),
      type,
      categoryId: activeCat.id,
      accountId: targetAccId,
      memberId,
      scope,
      note: note.trim() || undefined,
    });

    haptic.success();
    const sign = type === "EXPENSE" ? "-" : "+";
    setSuccessToast(
      `Đã ghi ${sign}${formatVND(numericAmount)} · ${activeCat.name} · ${
        selectedAccount?.name || "Ví"
      }`
    );
    setAmountInput("");
    setNote("");
    setError(null);

    window.setTimeout(() => {
      setSuccessToast((prev) => (prev ? null : prev));
    }, 3200);
  };

  const memberDisplay =
    memberId === "WIFE" ? `👩 ${settings.wifeName}` : `👨 ${settings.husbandName}`;
  const isExpense = type === "EXPENSE";

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="quick-add-card"
      className={`bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs ${
        compact ? "p-3.5 space-y-3" : "p-5 space-y-4"
      }`}
    >
      {/* Header Row: Title + Type Toggle + Full Form Link */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-[#1E3A8A] dark:text-blue-400 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-[#172B4D] dark:text-slate-100 truncate">
                Ghi Nhanh (Quick Add)
              </h3>
              <span className="hidden sm:inline text-[11px] font-medium text-slate-400 dark:text-slate-400">
                · Số tiền & danh mục 1 chạm
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-[#E9EEF5] dark:border-slate-700">
            <button
              type="button"
              onClick={() => setType("EXPENSE")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                isExpense
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Chi tiêu
            </button>
            <button
              type="button"
              onClick={() => setType("INCOME")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                !isExpense
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Thu nhập
            </button>
          </div>

          {onOpenFullForm && (
            <button
              type="button"
              onClick={onOpenFullForm}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DCE4EE] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0 cursor-pointer"
              title="Mở biểu mẫu đầy đủ (chuyển ví, sửa ngày, quét hóa đơn)"
            >
              <span>Đầy đủ</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Feedback */}
      {error && (
        <div
          role="alert"
          className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successToast && (
        <div
          role="status"
          className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 tabular-nums"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate">{successToast}</span>
        </div>
      )}

      {/* Main Fast Input Row: Amount + Optional Note + Submit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
        <div className="lg:col-span-5 relative flex items-center">
          <input
            type="text"
            inputMode="numeric"
            value={numericAmount > 0 ? numericAmount.toLocaleString("vi-VN") : ""}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="Nhập số tiền (VD: 50.000)..."
            aria-label="Số tiền ghi nhanh"
            data-testid="quick-add-amount-input"
            className={`w-full min-h-[46px] pl-3.5 pr-12 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-base sm:text-lg font-black tabular-nums outline-none transition-colors ${
              error
                ? "border-rose-400 dark:border-rose-500 focus:border-rose-600"
                : "border-[#DCE4EE] dark:border-slate-700 focus:border-blue-600"
            } ${
              isExpense
                ? "text-[#BE123C] dark:text-rose-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                : "text-[#047857] dark:text-emerald-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            }`}
          />
          <span className="absolute right-3.5 text-xs font-extrabold text-slate-400 dark:text-slate-500 pointer-events-none">
            ₫
          </span>
        </div>

        <div className="lg:col-span-5 flex items-center">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú ngắn (không bắt buộc)..."
            aria-label="Ghi chú giao dịch nhanh"
            data-testid="quick-add-note-input"
            className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 focus:border-blue-600 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-colors"
          />
        </div>

        <div className="lg:col-span-2 flex items-center">
          <button
            type="submit"
            data-testid="quick-add-submit"
            className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm text-white shadow-xs transition-all active:scale-[0.98] whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 cursor-pointer ${
              isExpense
                ? "bg-[#1E3A8A] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Ghi nhanh</span>
          </button>
        </div>
      </div>

      {/* Quick Amount Increment Chips + 1-Tap Member / Account / Scope Overrides */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleMultiplyThousand}
            disabled={numericAmount <= 0}
            className="min-h-[36px] sm:min-h-[32px] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 disabled:opacity-40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 text-[11px] font-extrabold tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
          >
            ×1.000
          </button>
          {[
            { label: "+50k", val: 50_000 },
            { label: "+100k", val: 100_000 },
            { label: "+200k", val: 200_000 },
            { label: "+500k", val: 500_000 },
          ].map((chip) => (
            <button
              key={chip.val}
              type="button"
              onClick={() => handleAddChip(chip.val)}
              className="min-h-[36px] sm:min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-[#E9EEF5] dark:border-slate-700 text-[11px] font-bold tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* 1-Tap Context Switchers (Auto-selected from perspective, 1-tap override) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleToggleMember}
            data-testid="quick-add-member-toggle"
            title="Chạm để đổi nhanh thành viên thực hiện"
            className="min-h-[36px] sm:min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{memberDisplay}</span>
          </button>

          <button
            type="button"
            onClick={handleCycleAccount}
            data-testid="quick-add-account-toggle"
            title="Chạm để đổi nhanh ví / thẻ thanh toán"
            className="min-h-[36px] sm:min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 max-w-[190px] cursor-pointer transition-colors"
          >
            <Wallet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">{selectedAccount?.name || "Chọn ví"}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleScope}
            data-testid="quick-add-scope-toggle"
            title="Chạm để đổi phạm vi Chung gia đình / Cá nhân"
            className={`min-h-[36px] sm:min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              scope === "FAMILY"
                ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-purple-50 dark:bg-purple-500/15 border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300"
            }`}
          >
            {scope === "FAMILY" ? (
              <>
                <Home className="w-3 h-3" />
                <span>Chung</span>
              </>
            ) : (
              <>
                <User className="w-3 h-3" />
                <span>Riêng</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 1-Tap Category Grid */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
          <span>Chọn nhanh danh mục {isExpense ? "chi tiêu" : "thu nhập"}</span>
          <span className="tabular-nums">{filteredCategories.length} danh mục</span>
        </div>

        <div
          className={
            compact
              ? "grid grid-cols-2 sm:grid-cols-4 gap-1.5"
              : "flex flex-wrap gap-1.5"
          }
        >
          {filteredCategories.map((cat) => {
            const isSelected = cat.id === categoryId;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  haptic.light();
                  setCategoryId(cat.id);
                }}
                data-testid={`quick-add-cat-${cat.id}`}
                className={`min-h-[44px] sm:min-h-[36px] px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? isExpense
                      ? "bg-[#1E3A8A] dark:bg-blue-600 text-white border-[#1E3A8A] dark:border-blue-500 shadow-xs"
                      : "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-[#DCE4EE] dark:border-slate-700"
                }`}
              >
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isSelected ? "rgba(255,255,255,0.18)" : `${cat.color}18`,
                    color: isSelected ? "#ffffff" : cat.color,
                  }}
                >
                  <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" />
                </span>
                <span className="truncate">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </form>
  );
}
