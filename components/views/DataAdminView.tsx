"use client";

import React, { useState, useMemo } from "react";
import {
  Database,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  Copy,
  CheckCircle2,
  Repeat,
  Coins,
  X,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  Account,
  AccountType,
  Category,
  CategoryBudget,
  DebtItem,
  DebtType,
  ExpenseScope,
  FamilyMember,
  InvestmentItem,
  InvestmentType,
  RecurringRule,
  SavingsGoal,
  Transaction,
  TransactionType,
} from "@/types/finance";
import { formatVNDMasked, formatDateVN, getCurrentMonthKey, getMonthDisplayLabel } from "@/lib/formatters";
import { calculateLedgerIntegrity, shiftMonthKey } from "@/lib/financeEngine";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { GoalDepositSheet } from "@/components/mobile/sheets/GoalDepositSheet";

type CollectionKey =
  | "budgets"
  | "goals"
  | "debts"
  | "investments"
  | "transactions"
  | "accounts"
  | "categories"
  | "recurringRules";

type ModalMode =
  | { kind: "budget"; item?: CategoryBudget }
  | { kind: "goal"; item?: SavingsGoal }
  | { kind: "debt"; item?: DebtItem }
  | { kind: "investment"; item?: InvestmentItem }
  | { kind: "account"; item?: Account }
  | { kind: "category"; item?: Category }
  | { kind: "recurring"; item?: RecurringRule }
  | null;

export function DataAdminView() {
  const {
    accounts,
    transactions,
    categories,
    budgets,
    goals,
    debts,
    investments,
    recurringRules,
    selectedMonth,
    isPrivacyMode,
    settings,
    exportBackup,
    setCategoryBudget,
    deleteBudget,
    copyBudgetsFromMonth,
    addGoal,
    updateGoal,
    deleteGoal,
    addDebt,
    updateDebt,
    payDebt,
    deleteDebt,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    deleteTransaction,
    deleteTransactionsBatch,
    addAccount,
    updateAccount,
    deleteAccount,
    addCategory,
    updateCategory,
    deleteCategory,
    addRecurringRule,
    updateRecurringRule,
    deleteRecurringRule,
    applyRecurringRule,
    getCategoryById,
    getAccountById,
  } = useFinance();

  const [activeCollection, setActiveCollection] = useState<CollectionKey>("budgets");
  const [search, setSearch] = useState("");
  const [budgetMonthFilter, setBudgetMonthFilter] = useState<string>(
    selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth
  );
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [txTypeFilter, setTxTypeFilter] = useState<"ALL" | TransactionType>("ALL");

  // Modals & Action sheets
  const [modal, setModal] = useState<ModalMode>(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);
  const [payDebtTarget, setPayDebtTarget] = useState<DebtItem | null>(null);
  const [payDebtAmt, setPayDebtAmt] = useState("");
  const [payDebtAccId, setPayDebtAccId] = useState("");

  const [pendingDelete, setPendingDelete] = useState<{
    label: string;
    onConfirm: () => void;
  } | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const flashToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Shared Form States for Entity Modals
  const [fName, setFName] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fAmount2, setFAmount2] = useState("");
  const [fMonth, setFMonth] = useState(budgetMonthFilter);
  const [fCategoryId, setFCategoryId] = useState("");
  const [fAccountId, setFAccountId] = useState("");
  const [fMemberId, setFMemberId] = useState<FamilyMember>("SHARED");
  const [fScope, setFScope] = useState<ExpenseScope>("FAMILY");
  const [fType, setFType] = useState<string>("EXPENSE");
  const [fDate1, setFDate1] = useState("");
  const [fDate2, setFDate2] = useState("");
  const [fNumber1, setFNumber1] = useState("0");
  const [fNumber2, setFNumber2] = useState("6");
  const [fColor, setFColor] = useState("#2563EB");
  const [fNote, setFNote] = useState("");

  const integrity = useMemo(
    () => calculateLedgerIntegrity(accounts, transactions),
    [accounts, transactions]
  );

  const collections: { key: CollectionKey; label: string; count: number }[] = [
    { key: "budgets", label: "Ngân sách", count: budgets.length },
    { key: "goals", label: "Mục tiêu", count: goals.length },
    { key: "debts", label: "Khoản nợ", count: debts.length },
    { key: "investments", label: "Đầu tư", count: investments.length },
    { key: "transactions", label: "Giao dịch", count: transactions.length },
    { key: "accounts", label: "Ví & Thẻ", count: accounts.length },
    { key: "categories", label: "Danh mục", count: categories.length },
    { key: "recurringRules", label: "Định kỳ", count: recurringRules.length },
  ];

  const q = search.toLowerCase().trim();

  // Spent lookup for selected budget month
  const spentByCatInMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type === "EXPENSE" && tx.date.startsWith(budgetMonthFilter)) {
        map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount);
      }
    }
    return map;
  }, [transactions, budgetMonthFilter]);

  const filteredBudgets = useMemo(() => {
    return budgets
      .filter((b) => b.month === budgetMonthFilter)
      .filter((b) => {
        if (!q) return true;
        const cat = getCategoryById(b.categoryId);
        return (cat?.name || b.categoryId).toLowerCase().includes(q);
      });
  }, [budgets, budgetMonthFilter, q, getCategoryById]);

  const filteredGoals = useMemo(
    () => goals.filter((g) => !q || g.name.toLowerCase().includes(q)),
    [goals, q]
  );

  const filteredDebts = useMemo(
    () => debts.filter((d) => !q || d.name.toLowerCase().includes(q)),
    [debts, q]
  );

  const filteredInvestments = useMemo(
    () => investments.filter((i) => !q || i.name.toLowerCase().includes(q) || i.type.toLowerCase().includes(q)),
    [investments, q]
  );

  const filteredTxRows = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (txTypeFilter !== "ALL" && tx.type !== txTypeFilter) return false;
        if (!q) return true;
        const cat = getCategoryById(tx.categoryId)?.name || "";
        const acc = getAccountById(tx.accountId)?.name || "";
        return (
          (tx.note || "").toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q) ||
          acc.toLowerCase().includes(q) ||
          tx.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, txTypeFilter, q, getCategoryById, getAccountById]);

  const filteredAccounts = useMemo(
    () => accounts.filter((a) => !q || a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)),
    [accounts, q]
  );

  const filteredCategories = useMemo(
    () => categories.filter((c) => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)),
    [categories, q]
  );

  const filteredRules = useMemo(
    () => recurringRules.filter((r) => !q || r.name.toLowerCase().includes(q)),
    [recurringRules, q]
  );

  // Open Create / Edit modal prefillers
  const openModal = (next: ModalMode) => {
    if (!next) {
      setModal(null);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);

    if (next.kind === "budget") {
      const b = next.item;
      const firstExpense = categories.find((c) => c.type === "EXPENSE")?.id || "cat_expense_food";
      setFCategoryId(b?.categoryId || firstExpense);
      setFMonth(b?.month || budgetMonthFilter);
      setFAmount(b ? new Intl.NumberFormat("vi-VN").format(b.limitAmount) : "3.000.000");
    } else if (next.kind === "goal") {
      const g = next.item;
      setFName(g?.name || "");
      setFAmount(g ? new Intl.NumberFormat("vi-VN").format(g.targetAmount) : "50.000.000");
      setFAmount2(g ? new Intl.NumberFormat("vi-VN").format(g.currentAmount) : "0");
      setFDate1(g?.deadline || "");
      setFMemberId(g?.memberId || "SHARED");
    } else if (next.kind === "debt") {
      const d = next.item;
      setFName(d?.name || "");
      setFType(d?.type || "BORROW");
      setFMemberId(d?.memberId || "SHARED");
      setFAmount(d ? new Intl.NumberFormat("vi-VN").format(d.totalAmount) : "");
      setFAmount2(d ? new Intl.NumberFormat("vi-VN").format(d.paidAmount) : "0");
      setFNumber1(d ? String(d.interestRate) : "0");
      setFDate1(d?.startDate || today);
      setFDate2(d?.dueDate || today);
    } else if (next.kind === "investment") {
      const inv = next.item;
      setFName(inv?.name || "");
      setFType(inv?.type || "SAVINGS");
      setFMemberId(inv?.memberId || "SHARED");
      setFAmount(inv ? new Intl.NumberFormat("vi-VN").format(inv.amount) : "");
      setFAmount2(inv ? new Intl.NumberFormat("vi-VN").format(inv.currentValue || inv.amount) : "");
      setFNumber1(inv ? String(inv.expectedProfitRate) : "7.0");
      setFDate1(inv?.startDate || today);
    } else if (next.kind === "account") {
      const acc = next.item;
      setFName(acc?.name || "");
      setFType(acc?.type || "BANK");
      setFMemberId(acc?.owner || "HUSBAND");
      setFAmount(acc ? new Intl.NumberFormat("vi-VN").format(acc.initialBalance) : "0");
      setFAmount2(acc?.creditLimit ? new Intl.NumberFormat("vi-VN").format(acc.creditLimit) : "50.000.000");
      setFNumber1(String(acc?.statementDay || 20));
      setFNumber2(String(acc?.dueDay || 6));
      setFColor(acc?.color || "#2563EB");
      setFNote(acc?.accountNumber || "");
    } else if (next.kind === "category") {
      const cat = next.item;
      setFName(cat?.name || "");
      setFType(cat?.type || "EXPENSE");
      setFColor(cat?.color || "#2563EB");
    } else if (next.kind === "recurring") {
      const r = next.item;
      setFName(r?.name || "");
      setFAmount(r ? new Intl.NumberFormat("vi-VN").format(r.amount) : "");
      setFType(r?.type || "EXPENSE");
      setFCategoryId(r?.categoryId || categories[0]?.id || "cat_expense_rent");
      setFAccountId(r?.accountId || accounts[0]?.id || "");
      setFMemberId(r?.memberId || "HUSBAND");
      setFScope(r?.scope || "FAMILY");
      setFNumber1(String(r?.dayOfMonth || 5));
      setFNote(r?.note || "");
    }

    setModal(next);
  };

  const handleCreatePrimary = () => {
    if (activeCollection === "transactions") {
      setEditingTx(null);
      setIsTxModalOpen(true);
      return;
    }
    const mapKind: Record<Exclude<CollectionKey, "transactions">, Exclude<ModalMode, null>["kind"]> = {
      budgets: "budget",
      goals: "goal",
      debts: "debt",
      investments: "investment",
      accounts: "account",
      categories: "category",
      recurringRules: "recurring",
    };
    openModal({ kind: mapKind[activeCollection] } as ModalMode);
  };

  const parseMoney = (s: string) => parseFloat(s.replace(/[^0-9]/g, "")) || 0;
  const formatMoneyInput = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "");
    return digits ? new Intl.NumberFormat("vi-VN").format(parseInt(digits, 10)) : "";
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;

    if (modal.kind === "budget") {
      const limit = parseMoney(fAmount);
      if (limit <= 0) return;
      setCategoryBudget(fCategoryId, limit, fMonth);
      flashToast("Đã cập nhật bản ghi ngân sách.");
    } else if (modal.kind === "goal") {
      const target = parseMoney(fAmount);
      const current = parseMoney(fAmount2);
      if (!fName.trim() || target <= 0) return;
      if (modal.item) {
        updateGoal(modal.item.id, {
          name: fName.trim(),
          targetAmount: target,
          currentAmount: current,
          deadline: fDate1 || undefined,
          memberId: fMemberId,
        });
      } else {
        addGoal({
          name: fName.trim(),
          targetAmount: target,
          currentAmount: current,
          deadline: fDate1 || undefined,
          memberId: fMemberId,
        });
      }
      flashToast("Đã lưu mục tiêu tiết kiệm.");
    } else if (modal.kind === "debt") {
      const total = parseMoney(fAmount);
      const paid = parseMoney(fAmount2);
      const rate = parseFloat(fNumber1) || 0;
      if (!fName.trim() || total <= 0) return;
      if (modal.item) {
        updateDebt(modal.item.id, {
          name: fName.trim(),
          type: fType as DebtType,
          memberId: fMemberId,
          totalAmount: total,
          paidAmount: Math.min(total, paid),
          interestRate: rate,
          startDate: fDate1,
          dueDate: fDate2,
        });
      } else {
        addDebt({
          name: fName.trim(),
          type: fType as DebtType,
          memberId: fMemberId,
          totalAmount: total,
          paidAmount: Math.min(total, paid),
          interestRate: rate,
          startDate: fDate1,
          dueDate: fDate2,
          status: paid >= total ? "PAID" : "ACTIVE",
        });
      }
      flashToast("Đã lưu bản ghi khoản nợ.");
    } else if (modal.kind === "investment") {
      const amt = parseMoney(fAmount);
      const cur = parseMoney(fAmount2) || amt;
      const profit = parseFloat(fNumber1) || 0;
      if (!fName.trim() || amt <= 0) return;
      if (modal.item) {
        updateInvestment(modal.item.id, {
          name: fName.trim(),
          type: fType as InvestmentType,
          memberId: fMemberId,
          amount: amt,
          currentValue: cur,
          expectedProfitRate: profit,
          startDate: fDate1,
        });
      } else {
        addInvestment({
          name: fName.trim(),
          type: fType as InvestmentType,
          memberId: fMemberId,
          amount: amt,
          currentValue: cur,
          expectedProfitRate: profit,
          startDate: fDate1,
          status: "ACTIVE",
        });
      }
      flashToast("Đã lưu bản ghi đầu tư.");
    } else if (modal.kind === "account") {
      const initBal = parseMoney(fAmount);
      const limit = fType === "CREDIT_CARD" ? parseMoney(fAmount2) : undefined;
      const stDay = fType === "CREDIT_CARD" ? Math.min(28, Math.max(1, parseInt(fNumber1, 10) || 20)) : undefined;
      const duDay = fType === "CREDIT_CARD" ? Math.min(28, Math.max(1, parseInt(fNumber2, 10) || 6)) : undefined;
      if (!fName.trim()) return;
      if (modal.item) {
        updateAccount(modal.item.id, {
          name: fName.trim(),
          owner: fMemberId,
          initialBalance: initBal,
          creditLimit: limit,
          statementDay: stDay,
          dueDay: duDay,
          color: fColor,
          accountNumber: fNote.trim() || undefined,
        });
      } else {
        addAccount({
          name: fName.trim(),
          type: fType as AccountType,
          owner: fMemberId,
          initialBalance: initBal,
          creditLimit: limit,
          statementDay: stDay,
          dueDay: duDay,
          color: fColor,
          accountNumber: fNote.trim() || undefined,
        });
      }
      flashToast("Đã lưu tài khoản & tính lại số dư Event Sourcing.");
    } else if (modal.kind === "category") {
      if (!fName.trim()) return;
      if (modal.item) {
        updateCategory(modal.item.id, {
          name: fName.trim(),
          type: fType as "INCOME" | "EXPENSE",
          color: fColor,
        });
      } else {
        addCategory({
          name: fName.trim(),
          type: fType as "INCOME" | "EXPENSE",
          color: fColor,
        });
      }
      flashToast("Đã lưu danh mục.");
    } else if (modal.kind === "recurring") {
      const amt = parseMoney(fAmount);
      const day = Math.min(28, Math.max(1, parseInt(fNumber1, 10) || 1));
      if (!fName.trim() || amt <= 0) return;
      const payload = {
        name: fName.trim(),
        amount: amt,
        type: fType as TransactionType,
        categoryId: fCategoryId,
        accountId: fAccountId || accounts[0]?.id || "acc_husband_bidv",
        memberId: fMemberId,
        scope: fScope,
        dayOfMonth: day,
        isActive: modal.item ? modal.item.isActive : true,
        note: fNote.trim() || undefined,
      };
      if (modal.item) {
        updateRecurringRule(modal.item.id, payload);
      } else {
        addRecurringRule(payload);
      }
      flashToast("Đã lưu quy tắc định kỳ.");
    }

    setModal(null);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Data Studio Header & Ledger Integrity Audit */}
      <div className="bg-white rounded-xl p-5 border border-[#DCE4EE] shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-[#172B4D]">
                  Data Studio — Quản Trị Cơ Sở Dữ Liệu
                </h2>
                {integrity.isValid ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Toàn vẹn Event Sourcing 100% ({integrity.checkedAccounts} ví)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Lệch {integrity.mismatches.length} ví
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Thêm, sửa, xóa trực tiếp mọi bảng dữ liệu thực tế và đồng bộ xuyên suốt toàn bộ Dashboard
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportBackup}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất JSON</span>
            </button>
            <button
              type="button"
              onClick={handleCreatePrimary}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm bản ghi</span>
            </button>
          </div>
        </div>

        {toastMsg && (
          <div className="px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Collection Tabs (8 Tables) */}
        <div
          role="tablist"
          aria-label="Bảng dữ liệu hệ thống"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E9EEF5]"
        >
          {collections.map((col) => {
            const active = activeCollection === col.key;
            return (
              <button
                key={col.key}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setActiveCollection(col.key);
                  setSearch("");
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                  active
                    ? "border-blue-600 text-blue-700 bg-blue-50/70"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span>{col.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                    active ? "bg-blue-600 text-white" : "bg-slate-200/80 text-slate-600"
                  }`}
                >
                  {col.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Collection Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Tìm kiếm trong bảng ${collections.find((c) => c.key === activeCollection)?.label}...`}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-[#DCE4EE] rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          {activeCollection === "budgets" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={budgetMonthFilter}
                onChange={(e) => setBudgetMonthFilter(e.target.value)}
                className="bg-slate-50 border border-[#DCE4EE] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
              />
              <button
                type="button"
                onClick={() => {
                  const prev = shiftMonthKey(budgetMonthFilter, -1);
                  const n = copyBudgetsFromMonth(prev, budgetMonthFilter);
                  flashToast(
                    n > 0
                      ? `Đã sao chép ${n} hạn mức từ ${getMonthDisplayLabel(prev)}.`
                      : `Không có mục mới cần sao chép từ ${getMonthDisplayLabel(prev)}.`
                  );
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy tháng trước</span>
              </button>
            </div>
          )}

          {activeCollection === "transactions" && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value as "ALL" | TransactionType)}
                className="bg-slate-50 border border-[#DCE4EE] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="ALL">Tất cả loại</option>
                <option value="EXPENSE">Chi tiêu</option>
                <option value="INCOME">Thu nhập</option>
                <option value="TRANSFER">Chuyển ví</option>
              </select>
              {selectedTxIds.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setPendingDelete({
                      label: `Xóa ${selectedTxIds.length} giao dịch đã chọn?`,
                      onConfirm: () => {
                        deleteTransactionsBatch(selectedTxIds);
                        setSelectedTxIds([]);
                        flashToast("Đã xóa hàng loạt giao dịch.");
                      },
                    })
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ({selectedTxIds.length})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Collection Data Grid */}
      <div className="bg-white rounded-xl border border-[#DCE4EE] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {/* TABLE 1: BUDGETS */}
          {activeCollection === "budgets" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Danh mục</th>
                  <th className="py-3 px-4">Kỳ ngân sách</th>
                  <th className="py-3 px-4">Hạn mức</th>
                  <th className="py-3 px-4">Đã chi thực tế</th>
                  <th className="py-3 px-4">Tỷ lệ dùng</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBudgets.map((b) => {
                  const cat = getCategoryById(b.categoryId);
                  const spent = spentByCatInMonth.get(b.categoryId) || 0;
                  const pct = b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 100) : 0;
                  return (
                    <tr key={`${b.month}_${b.categoryId}`} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat?.color || "#94A3B8" }}
                          />
                          <span>{cat?.name || b.categoryId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{b.month}</td>
                      <td className="py-3 px-4 font-black text-slate-800">
                        {formatVNDMasked(b.limitAmount, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600">
                        {formatVNDMasked(spent, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-4 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : "bg-blue-600"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className={`font-bold ${pct >= 100 ? "text-rose-600" : "text-slate-600"}`}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openModal({ kind: "budget", item: b })}
                          aria-label={`Sửa ngân sách ${cat?.name || b.categoryId}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setPendingDelete({
                              label: `Xóa hạn mức "${cat?.name || b.categoryId}" kỳ ${b.month}?`,
                              onConfirm: () => {
                                deleteBudget(b.categoryId, b.month);
                                flashToast("Đã xóa ngân sách.");
                              },
                            })
                          }
                          aria-label={`Xóa ngân sách ${cat?.name || b.categoryId}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredBudgets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Chưa có ngân sách cho kỳ {budgetMonthFilter}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* TABLE 2: GOALS */}
          {activeCollection === "goals" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Tên mục tiêu</th>
                  <th className="py-3 px-4">Đã tích lũy</th>
                  <th className="py-3 px-4">Mục tiêu</th>
                  <th className="py-3 px-4">Tiến độ</th>
                  <th className="py-3 px-4">Hạn</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGoals.map((g) => {
                  const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
                  return (
                    <tr key={g.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">{g.name}</td>
                      <td className="py-3 px-4 font-bold text-blue-600">
                        {formatVNDMasked(g.currentAmount, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {formatVNDMasked(g.targetAmount, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-700">{pct}%</td>
                      <td className="py-3 px-4 text-slate-500">{g.deadline ? formatDateVN(g.deadline) : "—"}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => updateGoal(g.id, { isCompleted: !g.isCompleted })}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                            g.isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {g.isCompleted ? "Hoàn thành" : "Đang tích lũy"}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setDepositGoal(g)}
                          className="px-2 py-1 mr-1 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px] cursor-pointer"
                        >
                          +Nạp
                        </button>
                        <button
                          onClick={() => openModal({ kind: "goal", item: g })}
                          aria-label={`Sửa mục tiêu ${g.name}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setPendingDelete({
                              label: `Xóa mục tiêu "${g.name}"?`,
                              onConfirm: () => {
                                deleteGoal(g.id);
                                flashToast("Đã xóa mục tiêu.");
                              },
                            })
                          }
                          aria-label={`Xóa mục tiêu ${g.name}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* TABLE 3: DEBTS */}
          {activeCollection === "debts" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Loại</th>
                  <th className="py-3 px-4">Tên khoản nợ</th>
                  <th className="py-3 px-4">Tổng gốc</th>
                  <th className="py-3 px-4">Đã trả/thu</th>
                  <th className="py-3 px-4">Còn lại</th>
                  <th className="py-3 px-4">Đáo hạn</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDebts.map((d) => {
                  const rem = Math.max(0, d.totalAmount - d.paidAmount);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.type === "LEND" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {d.type === "LEND" ? "Cho vay" : "Đi vay"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{d.name}</td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {formatVNDMasked(d.totalAmount, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600">
                        {formatVNDMasked(d.paidAmount, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-4 font-black text-rose-600">
                        {formatVNDMasked(rem, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDateVN(d.dueDate)}</td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {rem > 0 && (
                          <button
                            onClick={() => {
                              setPayDebtTarget(d);
                              setPayDebtAmt("");
                              setPayDebtAccId(accounts[0]?.id || "");
                            }}
                            className="px-2 py-1 mr-1 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px] cursor-pointer"
                          >
                            {d.type === "LEND" ? "Thu" : "Trả"}
                          </button>
                        )}
                        <button
                          onClick={() => openModal({ kind: "debt", item: d })}
                          aria-label={`Sửa nợ ${d.name}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setPendingDelete({
                              label: `Xóa khoản nợ "${d.name}"?`,
                              onConfirm: () => {
                                deleteDebt(d.id);
                                flashToast("Đã xóa khoản nợ.");
                              },
                            })
                          }
                          aria-label={`Xóa nợ ${d.name}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* TABLE 4: INVESTMENTS */}
          {activeCollection === "investments" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Tên tài sản</th>
                  <th className="py-3 px-4">Loại</th>
                  <th className="py-3 px-4">Vốn gốc</th>
                  <th className="py-3 px-4">Giá trị hiện tại</th>
                  <th className="py-3 px-4">ROI</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvestments.map((inv) => {
                  const cur = inv.currentValue || inv.amount;
                  const roi = inv.amount > 0 ? Math.round(((cur - inv.amount) / inv.amount) * 1000) / 10 : 0;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">{inv.name}</td>
                      <td className="py-3 px-4 font-semibold text-slate-500">{inv.type}</td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {formatVNDMasked(inv.amount, isPrivacyMode)}
                      </td>
                      <td className="py-3 px-4 font-black text-blue-700">
                        {formatVNDMasked(cur, isPrivacyMode)}
                      </td>
                      <td className={`py-3 px-4 font-bold ${roi >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {roi >= 0 ? "+" : ""}
                        {roi}%
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() =>
                            updateInvestment(inv.id, {
                              status: inv.status === "ACTIVE" ? "CLOSED" : "ACTIVE",
                            })
                          }
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                            inv.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {inv.status}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openModal({ kind: "investment", item: inv })}
                          aria-label={`Sửa đầu tư ${inv.name}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setPendingDelete({
                              label: `Xóa khoản đầu tư "${inv.name}"?`,
                              onConfirm: () => {
                                deleteInvestment(inv.id);
                                flashToast("Đã xóa khoản đầu tư.");
                              },
                            })
                          }
                          aria-label={`Xóa đầu tư ${inv.name}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* TABLE 5: TRANSACTIONS */}
          {activeCollection === "transactions" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả giao dịch"
                      checked={
                        filteredTxRows.length > 0 && selectedTxIds.length === filteredTxRows.length
                      }
                      onChange={(e) =>
                        setSelectedTxIds(
                          e.target.checked ? filteredTxRows.map((t) => t.id) : []
                        )
                      }
                    />
                  </th>
                  <th className="py-3 px-3">Ngày</th>
                  <th className="py-3 px-3">Loại</th>
                  <th className="py-3 px-3">Danh mục</th>
                  <th className="py-3 px-3">Ví nguồn</th>
                  <th className="py-3 px-3">Ghi chú</th>
                  <th className="py-3 px-3 text-right">Số tiền</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTxRows.map((tx) => {
                  const cat = getCategoryById(tx.categoryId);
                  const acc = getAccountById(tx.accountId);
                  const checked = selectedTxIds.includes(tx.id);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          aria-label={`Chọn giao dịch ${tx.note || tx.id}`}
                          onChange={(e) =>
                            setSelectedTxIds((prev) =>
                              e.target.checked ? [...prev, tx.id] : prev.filter((x) => x !== tx.id)
                            )
                          }
                        />
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium">{formatDateVN(tx.date)}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.type === "EXPENSE"
                              ? "bg-rose-50 text-rose-700"
                              : tx.type === "INCOME"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold">{cat?.name || tx.categoryId}</td>
                      <td className="py-2.5 px-3 text-slate-600">{acc?.name || tx.accountId}</td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate">{tx.note || "—"}</td>
                      <td
                        className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${
                          tx.type === "EXPENSE"
                            ? "text-rose-600"
                            : tx.type === "INCOME"
                            ? "text-emerald-600"
                            : "text-blue-600"
                        }`}
                      >
                        {formatVNDMasked(tx.amount, isPrivacyMode)}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditingTx(tx);
                            setIsTxModalOpen(true);
                          }}
                          aria-label={`Sửa giao dịch ${tx.id}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setPendingDelete({
                              label: `Xóa giao dịch "${tx.note || tx.id}"?`,
                              onConfirm: () => {
                                deleteTransaction(tx.id);
                                flashToast("Đã xóa giao dịch.");
                              },
                            })
                          }
                          aria-label={`Xóa giao dịch ${tx.id}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* TABLE 6: ACCOUNTS */}
          {activeCollection === "accounts" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Tên tài khoản</th>
                  <th className="py-3 px-4">Loại</th>
                  <th className="py-3 px-4">Chủ sở hữu</th>
                  <th className="py-3 px-4">Đầu kỳ</th>
                  <th className="py-3 px-4">Hiện tại (Event Sourced)</th>
                  <th className="py-3 px-4">Hạn mức / Chu kỳ</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-800">{acc.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{acc.type}</td>
                    <td className="py-3 px-4 font-semibold">{acc.owner}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {formatVNDMasked(acc.initialBalance, isPrivacyMode)}
                    </td>
                    <td className="py-3 px-4 font-black text-blue-600">
                      {formatVNDMasked(acc.currentBalance, isPrivacyMode)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {acc.type === "CREDIT_CARD"
                        ? `${formatVNDMasked(acc.creditLimit || 0, isPrivacyMode)} (SK ${acc.statementDay || 20} / Hạn ${acc.dueDay || 6})`
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => openModal({ kind: "account", item: acc })}
                        aria-label={`Sửa ví ${acc.name}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setPendingDelete({
                            label: `Xóa tài khoản "${acc.name}"?`,
                            onConfirm: () => {
                              deleteAccount(acc.id);
                              flashToast("Đã xóa tài khoản.");
                            },
                          })
                        }
                        aria-label={`Xóa ví ${acc.name}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TABLE 7: CATEGORIES */}
          {activeCollection === "categories" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Màu</th>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Tên danh mục</th>
                  <th className="py-3 px-4">Loại</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span
                        className="inline-block w-4 h-4 rounded-full border border-slate-200"
                        style={{ backgroundColor: cat.color }}
                      />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{cat.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{cat.name}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cat.type === "EXPENSE" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {cat.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => openModal({ kind: "category", item: cat })}
                        aria-label={`Sửa danh mục ${cat.name}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setPendingDelete({
                            label: `Xóa danh mục "${cat.name}"?`,
                            onConfirm: () => {
                              deleteCategory(cat.id);
                              flashToast("Đã xóa danh mục.");
                            },
                          })
                        }
                        aria-label={`Xóa danh mục ${cat.name}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TABLE 8: RECURRING RULES */}
          {activeCollection === "recurringRules" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Tên quy tắc</th>
                  <th className="py-3 px-4">Loại</th>
                  <th className="py-3 px-4">Số tiền</th>
                  <th className="py-3 px-4">Ngày / tháng</th>
                  <th className="py-3 px-4">Kỳ ghi gần nhất</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-800">{r.name}</td>
                    <td className="py-3 px-4 font-bold text-slate-600">{r.type}</td>
                    <td className="py-3 px-4 font-black text-slate-800">
                      {formatVNDMasked(r.amount, isPrivacyMode)}
                    </td>
                    <td className="py-3 px-4">Ngày {r.dayOfMonth}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{r.lastAppliedMonth || "—"}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => updateRecurringRule(r.id, { isActive: !r.isActive })}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                          r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {r.isActive ? "ACTIVE" : "PAUSED"}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          applyRecurringRule(r.id, budgetMonthFilter);
                          flashToast(`Đã ghi sổ "${r.name}" vào kỳ ${budgetMonthFilter}.`);
                        }}
                        className="px-2 py-1 mr-1 rounded bg-blue-50 text-blue-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Repeat className="w-3 h-3" />
                        Ghi sổ
                      </button>
                      <button
                        onClick={() => openModal({ kind: "recurring", item: r })}
                        aria-label={`Sửa quy tắc ${r.name}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setPendingDelete({
                            label: `Xóa quy tắc định kỳ "${r.name}"?`,
                            onConfirm: () => {
                              deleteRecurringRule(r.id);
                              flashToast("Đã xóa quy tắc định kỳ.");
                            },
                          })
                        }
                        aria-label={`Xóa quy tắc ${r.name}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Generic Record Editor Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-[#DCE4EE] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#172B4D]">
                {modal.item ? "Chỉnh sửa bản ghi" : "Thêm bản ghi mới"}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3">
              {modal.kind === "budget" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Danh mục chi</label>
                    <select
                      disabled={Boolean(modal.item)}
                      value={fCategoryId}
                      onChange={(e) => setFCategoryId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
                    >
                      {categories
                        .filter((c) => c.type === "EXPENSE")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tháng áp dụng</label>
                    <input
                      type="month"
                      disabled={Boolean(modal.item)}
                      value={fMonth}
                      onChange={(e) => setFMonth(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Hạn mức (VND)</label>
                    <input
                      type="text"
                      required
                      value={fAmount}
                      onChange={(e) => setFAmount(formatMoneyInput(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-black"
                    />
                  </div>
                </>
              )}

              {modal.kind === "goal" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tên mục tiêu</label>
                    <input
                      type="text"
                      required
                      value={fName}
                      onChange={(e) => setFName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Số tiền mục tiêu</label>
                      <input
                        type="text"
                        required
                        value={fAmount}
                        onChange={(e) => setFAmount(formatMoneyInput(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Đã tích lũy</label>
                      <input
                        type="text"
                        value={fAmount2}
                        onChange={(e) => setFAmount2(formatMoneyInput(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Hạn mục tiêu</label>
                    <input
                      type="date"
                      value={fDate1}
                      onChange={(e) => setFDate1(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
                    />
                  </div>
                </>
              )}

              {modal.kind === "debt" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFType("BORROW")}
                      className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                        fType === "BORROW" ? "bg-rose-600 text-white border-rose-600" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      Đi vay
                    </button>
                    <button
                      type="button"
                      onClick={() => setFType("LEND")}
                      className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                        fType === "LEND" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      Cho vay
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tên khoản nợ</label>
                    <input
                      type="text"
                      required
                      value={fName}
                      onChange={(e) => setFName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Tổng gốc (VND)</label>
                      <input
                        type="text"
                        required
                        value={fAmount}
                        onChange={(e) => setFAmount(formatMoneyInput(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Đã trả/thu</label>
                      <input
                        type="text"
                        value={fAmount2}
                        onChange={(e) => setFAmount2(formatMoneyInput(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Lãi %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={fNumber1}
                        onChange={(e) => setFNumber1(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Ngày vay</label>
                      <input
                        type="date"
                        value={fDate1}
                        onChange={(e) => setFDate1(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Đáo hạn</label>
                      <input
                        type="date"
                        value={fDate2}
                        onChange={(e) => setFDate2(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-semibold"
                      />
                    </div>
                  </div>
                </>
              )}

              {modal.kind === "investment" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tên tài sản đầu tư</label>
                    <input
                      type="text"
                      required
                      value={fName}
                      onChange={(e) => setFName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Loại</label>
                      <select
                        value={fType}
                        onChange={(e) => setFType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        <option value="GOLD">Vàng</option>
                        <option value="SAVINGS">Tiết kiệm</option>
                        <option value="STOCK">Chứng khoán</option>
                        <option value="OTHER">Khác</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Ngày bắt đầu</label>
                      <input
                        type="date"
                        value={fDate1}
                        onChange={(e) => setFDate1(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-semibold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Vốn gốc (VND)</label>
                      <input
                        type="text"
                        required
                        value={fAmount}
                        onChange={(e) => setFAmount(formatMoneyInput(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Giá trị hiện tại</label>
                      <input
                        type="text"
                        value={fAmount2}
                        onChange={(e) => setFAmount2(formatMoneyInput(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-700"
                      />
                    </div>
                  </div>
                </>
              )}

              {modal.kind === "account" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tên tài khoản / Ví</label>
                    <input
                      type="text"
                      required
                      value={fName}
                      onChange={(e) => setFName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Loại</label>
                      <select
                        disabled={Boolean(modal.item)}
                        value={fType}
                        onChange={(e) => setFType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        <option value="BANK">BANK</option>
                        <option value="CREDIT_CARD">CREDIT_CARD</option>
                        <option value="CASH">CASH</option>
                        <option value="E_WALLET">E_WALLET</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Chủ sở hữu</label>
                      <select
                        value={fMemberId}
                        onChange={(e) => setFMemberId(e.target.value as FamilyMember)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        <option value="HUSBAND">👨 {settings.husbandName}</option>
                        <option value="WIFE">👩 {settings.wifeName}</option>
                        <option value="SHARED">🏡 Chung</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Số dư đầu kỳ (VND)</label>
                    <input
                      type="text"
                      value={fAmount}
                      onChange={(e) => setFAmount(formatMoneyInput(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                    />
                  </div>
                  {fType === "CREDIT_CARD" && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Hạn mức</label>
                        <input
                          type="text"
                          value={fAmount2}
                          onChange={(e) => setFAmount2(formatMoneyInput(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Sao kê</label>
                        <input
                          type="number"
                          min={1}
                          max={28}
                          value={fNumber1}
                          onChange={(e) => setFNumber1(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Đáo hạn</label>
                        <input
                          type="number"
                          min={1}
                          max={28}
                          value={fNumber2}
                          onChange={(e) => setFNumber2(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {modal.kind === "category" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tên danh mục</label>
                    <input
                      type="text"
                      required
                      value={fName}
                      onChange={(e) => setFName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Loại</label>
                      <select
                        value={fType}
                        onChange={(e) => setFType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        <option value="EXPENSE">EXPENSE</option>
                        <option value="INCOME">INCOME</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Màu hiển thị</label>
                      <input
                        type="color"
                        value={fColor}
                        onChange={(e) => setFColor(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                  </div>
                </>
              )}

              {modal.kind === "recurring" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tên quy tắc</label>
                    <input
                      type="text"
                      required
                      value={fName}
                      onChange={(e) => setFName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Số tiền</label>
                      <input
                        type="text"
                        required
                        value={fAmount}
                        onChange={(e) => setFAmount(formatMoneyInput(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Ngày trong tháng</label>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={fNumber1}
                        onChange={(e) => setFNumber1(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Loại</label>
                      <select
                        value={fType}
                        onChange={(e) => setFType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        <option value="EXPENSE">EXPENSE</option>
                        <option value="INCOME">INCOME</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Tài khoản</label>
                      <select
                        value={fAccountId}
                        onChange={(e) => setFAccountId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  Lưu bản ghi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay/Collect Debt Modal */}
      {payDebtTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setPayDebtTarget(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-6 border border-[#DCE4EE] space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>{payDebtTarget.type === "LEND" ? "Thu nợ" : "Trả nợ"}: {payDebtTarget.name}</span>
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const amt = parseMoney(payDebtAmt);
                if (amt > 0) {
                  payDebt(payDebtTarget.id, amt, payDebtAccId || undefined);
                  flashToast("Đã cập nhật sổ nợ & sổ giao dịch.");
                }
                setPayDebtTarget(null);
              }}
              className="space-y-3"
            >
              <input
                type="text"
                autoFocus
                required
                value={payDebtAmt}
                onChange={(e) => setPayDebtAmt(formatMoneyInput(e.target.value))}
                placeholder="Số tiền VND"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
              />
              <select
                value={payDebtAccId}
                onChange={(e) => setPayDebtAccId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
              >
                <option value="">Chỉ cập nhật sổ nợ</option>
                {accounts
                  .filter((a) => a.type !== "CREDIT_CARD")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPayDebtTarget(null)}
                  className="flex-1 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white cursor-pointer"
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TransactionFormModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        editTransaction={editingTx}
      />

      <GoalDepositSheet
        goal={depositGoal}
        isOpen={depositGoal !== null}
        onClose={() => setDepositGoal(null)}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Xác nhận xóa bản ghi?"
        message={pendingDelete?.label || ""}
        confirmLabel="Xóa ngay"
        cancelLabel="Hủy"
        isDanger={true}
        onConfirm={() => {
          pendingDelete?.onConfirm();
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
