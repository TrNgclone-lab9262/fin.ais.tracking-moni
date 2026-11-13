"use client";

import React, { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { DebtItem, DebtType, FamilyMember, InvestmentItem, InvestmentType } from "@/types/finance";
import { formatVNDMasked, formatDateVN } from "@/lib/formatters";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

export function DebtsInvestView() {
  const {
    debts,
    investments,
    accounts,
    isPrivacyMode,
    settings,
    addDebt,
    updateDebt,
    payDebt,
    deleteDebt,
    addInvestment,
    updateInvestment,
    deleteInvestment,
  } = useFinance();

  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);
  const [isInvestModalOpen, setIsInvestModalOpen] = useState(false);
  const [editingInvest, setEditingInvest] = useState<InvestmentItem | null>(null);
  const [payTargetDebt, setPayTargetDebt] = useState<DebtItem | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paySourceAccountId, setPaySourceAccountId] = useState("");
  const [deleteDebtId, setDeleteDebtId] = useState<string | null>(null);
  const [deleteInvestId, setDeleteInvestId] = useState<string | null>(null);

  // Debt Form
  const [debtName, setDebtName] = useState("");
  const [debtType, setDebtType] = useState<DebtType>("BORROW");
  const [debtMemberId, setDebtMemberId] = useState<FamilyMember>("SHARED");
  const [debtTotal, setDebtTotal] = useState("");
  const [debtInterest, setDebtInterest] = useState("0");
  const [debtStartDate, setDebtStartDate] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");

  // Investment Form
  const [invName, setInvName] = useState("");
  const [invType, setInvType] = useState<InvestmentType>("SAVINGS");
  const [invMemberId, setInvMemberId] = useState<FamilyMember>("SHARED");
  const [invAmount, setInvAmount] = useState("");
  const [invCurrentValue, setInvCurrentValue] = useState("");
  const [invProfit, setInvProfit] = useState("6.5");
  const [invStartDate, setInvStartDate] = useState("");

  const debtTotals = useMemo(() => {
    const borrowRemaining = debts
      .filter((d) => d.type !== "LEND" && d.status === "ACTIVE")
      .reduce((s, d) => s + Math.max(0, d.totalAmount - d.paidAmount), 0);
    const lendRemaining = debts
      .filter((d) => d.type === "LEND" && d.status === "ACTIVE")
      .reduce((s, d) => s + Math.max(0, d.totalAmount - d.paidAmount), 0);
    const totalPaid = debts.reduce((sum, d) => sum + d.paidAmount, 0);
    return { borrowRemaining, lendRemaining, totalPaid };
  }, [debts]);

  const investTotals = useMemo(() => {
    const active = investments.filter((i) => i.status === "ACTIVE");
    const totalInvested = active.reduce((sum, i) => sum + i.amount, 0);
    const totalMarketValue = active.reduce((sum, i) => sum + (i.currentValue || i.amount), 0);
    const totalGain = totalMarketValue - totalInvested;
    const roiPct = totalInvested > 0 ? Math.round((totalGain / totalInvested) * 1000) / 10 : 0;
    return { totalInvested, totalMarketValue, totalGain, roiPct };
  }, [investments]);

  const handleOpenAddDebt = () => {
    setEditingDebt(null);
    setDebtName("");
    setDebtType("BORROW");
    setDebtMemberId("SHARED");
    setDebtTotal("");
    setDebtInterest("0");
    setDebtStartDate(new Date().toISOString().split("T")[0]);
    setDebtDueDate("");
    setIsDebtModalOpen(true);
  };

  const handleOpenEditDebt = (d: DebtItem) => {
    setEditingDebt(d);
    setDebtName(d.name);
    setDebtType(d.type || "BORROW");
    setDebtMemberId(d.memberId || "SHARED");
    setDebtTotal(new Intl.NumberFormat("vi-VN").format(d.totalAmount));
    setDebtInterest(String(d.interestRate || 0));
    setDebtStartDate(d.startDate || "");
    setDebtDueDate(d.dueDate || "");
    setIsDebtModalOpen(true);
  };

  const handleSaveDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtName.trim()) return;

    const total = parseFloat(debtTotal.replace(/[^0-9]/g, "")) || 0;
    const interest = parseFloat(debtInterest) || 0;

    if (editingDebt) {
      updateDebt(editingDebt.id, {
        name: debtName.trim(),
        type: debtType,
        memberId: debtMemberId,
        totalAmount: total,
        interestRate: interest,
        startDate: debtStartDate,
        dueDate: debtDueDate,
      });
    } else {
      addDebt({
        name: debtName.trim(),
        type: debtType,
        memberId: debtMemberId,
        totalAmount: total,
        paidAmount: 0,
        interestRate: interest,
        startDate: debtStartDate || new Date().toISOString().split("T")[0],
        dueDate: debtDueDate || new Date().toISOString().split("T")[0],
        status: "ACTIVE",
      });
    }

    setIsDebtModalOpen(false);
    setEditingDebt(null);
  };

  const handlePayDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTargetDebt) return;

    const amt = parseFloat(payAmount.replace(/[^0-9]/g, "")) || 0;
    if (amt > 0) {
      payDebt(payTargetDebt.id, amt, paySourceAccountId || undefined);
    }
    setPayTargetDebt(null);
    setPayAmount("");
    setPaySourceAccountId("");
  };

  const handleOpenAddInvest = () => {
    setEditingInvest(null);
    setInvName("");
    setInvType("SAVINGS");
    setInvMemberId("SHARED");
    setInvAmount("");
    setInvCurrentValue("");
    setInvProfit("6.5");
    setInvStartDate(new Date().toISOString().split("T")[0]);
    setIsInvestModalOpen(true);
  };

  const handleOpenEditInvest = (inv: InvestmentItem) => {
    setEditingInvest(inv);
    setInvName(inv.name);
    setInvType(inv.type);
    setInvMemberId(inv.memberId || "SHARED");
    setInvAmount(new Intl.NumberFormat("vi-VN").format(inv.amount));
    setInvCurrentValue(
      new Intl.NumberFormat("vi-VN").format(inv.currentValue || inv.amount)
    );
    setInvProfit(String(inv.expectedProfitRate || 0));
    setInvStartDate(inv.startDate || "");
    setIsInvestModalOpen(true);
  };

  const handleSaveInvest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim()) return;

    const amt = parseFloat(invAmount.replace(/[^0-9]/g, "")) || 0;
    const profit = parseFloat(invProfit) || 0;
    const parsedCur = parseFloat(invCurrentValue.replace(/[^0-9]/g, ""));
    const currentVal = !isNaN(parsedCur) && parsedCur > 0 ? parsedCur : Math.round(amt * (1 + profit / 100));

    if (editingInvest) {
      updateInvestment(editingInvest.id, {
        name: invName.trim(),
        type: invType,
        memberId: invMemberId,
        amount: amt,
        currentValue: currentVal,
        expectedProfitRate: profit,
        startDate: invStartDate,
      });
    } else {
      addInvestment({
        name: invName.trim(),
        type: invType,
        memberId: invMemberId,
        amount: amt,
        currentValue: currentVal,
        expectedProfitRate: profit,
        startDate: invStartDate || new Date().toISOString().split("T")[0],
        status: "ACTIVE",
      });
    }

    setIsInvestModalOpen(false);
    setEditingInvest(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* PHẦN 1: QUẢN LÝ KHOẢN NỢ (ĐI VAY & CHO VAY) */}
      <section className="space-y-4">
        <div className="bg-white rounded-xl p-6 border border-[#DCE4EE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6 sm:gap-10">
            <div>
              <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">
                Đi vay còn phải trả
              </span>
              <span className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5 block">
                {formatVNDMasked(debtTotals.borrowRemaining, isPrivacyMode)}
              </span>
            </div>
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
                Cho vay chờ thu hồi
              </span>
              <span className="text-xl sm:text-2xl font-black text-blue-600 mt-0.5 block">
                {formatVNDMasked(debtTotals.lendRemaining, isPrivacyMode)}
              </span>
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">
                Đã thanh toán / thu hồi
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5 block">
                {formatVNDMasked(debtTotals.totalPaid, isPrivacyMode)}
              </span>
            </div>
          </div>

          <button
            onClick={handleOpenAddDebt}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm khoản nợ</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-[#DCE4EE] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Phân loại</th>
                  <th className="py-3.5 px-4">Tên khoản nợ</th>
                  <th className="py-3.5 px-4">Tổng giá trị</th>
                  <th className="py-3.5 px-4">Tiến độ</th>
                  <th className="py-3.5 px-4">Đáo hạn</th>
                  <th className="py-3.5 px-4 text-center">Lãi suất</th>
                  <th className="py-3.5 px-4 text-center">Trạng thái</th>
                  <th className="py-3.5 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {debts.map((d) => {
                  const remaining = Math.max(0, d.totalAmount - d.paidAmount);
                  const isPaid = d.status === "PAID" || remaining === 0;
                  const isLend = d.type === "LEND";

                  return (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isLend
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isLend ? "Cho vay" : "Đi vay"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{d.name}</td>
                      <td className="py-3.5 px-4 font-black text-slate-800">
                        {formatVNDMasked(d.totalAmount, isPrivacyMode)}
                      </td>
                      <td className="py-3.5 px-4 min-w-[140px]">
                        <div className="space-y-1">
                          <span className="text-[11px] text-slate-500 font-medium block">
                            {isPaid ? "Còn 0 ₫" : `Còn ${formatVNDMasked(remaining, isPrivacyMode)}`}
                          </span>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isPaid ? "bg-emerald-500" : isLend ? "bg-blue-600" : "bg-rose-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  d.totalAmount > 0 ? Math.round((d.paidAmount / d.totalAmount) * 100) : 0
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {formatDateVN(d.dueDate)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {d.interestRate}%
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {isPaid ? "Hoàn tất" : "Đang hiệu lực"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isPaid && (
                            <button
                              onClick={() => {
                                setPayTargetDebt(d);
                                setPayAmount("");
                                setPaySourceAccountId(accounts[0]?.id || "");
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-md transition-colors cursor-pointer"
                            >
                              {isLend ? "Thu nợ" : "Trả nợ"}
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditDebt(d)}
                            title="Chỉnh sửa khoản nợ"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteDebtId(d.id)}
                            title="Xóa khoản nợ"
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* PHẦN 2: QUẢN LÝ ĐẦU TƯ */}
      <section className="space-y-4">
        <div className="bg-white rounded-xl p-6 border border-[#DCE4EE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6 sm:gap-10">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Vốn đầu tư đang nắm giữ
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-700 mt-0.5 block">
                {formatVNDMasked(investTotals.totalInvested, isPrivacyMode)}
              </span>
            </div>
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
                Giá trị thị trường hiện tại
              </span>
              <span className="text-xl sm:text-2xl font-black text-blue-600 mt-0.5 block">
                {formatVNDMasked(investTotals.totalMarketValue, isPrivacyMode)}
              </span>
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">
                Lãi/Lỗ tạm tính (ROI)
              </span>
              <span
                className={`text-xl sm:text-2xl font-black mt-0.5 block ${
                  investTotals.totalGain >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {investTotals.totalGain >= 0 ? "+" : ""}
                {formatVNDMasked(investTotals.totalGain, isPrivacyMode)} ({investTotals.roiPct}%)
              </span>
            </div>
          </div>

          <button
            onClick={handleOpenAddInvest}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm khoản đầu tư</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-[#DCE4EE] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Tên khoản đầu tư</th>
                  <th className="py-3.5 px-4">Loại</th>
                  <th className="py-3.5 px-4">Số vốn gốc</th>
                  <th className="py-3.5 px-4">Giá trị hiện tại</th>
                  <th className="py-3.5 px-4 text-center">ROI thực tế</th>
                  <th className="py-3.5 px-4">Ngày bắt đầu</th>
                  <th className="py-3.5 px-4 text-center">Trạng thái</th>
                  <th className="py-3.5 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {investments.map((i) => {
                  const isActive = i.status === "ACTIVE";
                  const curVal = i.currentValue || i.amount;
                  const roi = i.amount > 0 ? Math.round(((curVal - i.amount) / i.amount) * 1000) / 10 : 0;
                  const typeLabel =
                    i.type === "GOLD"
                      ? "Vàng"
                      : i.type === "SAVINGS"
                      ? "Tiết kiệm"
                      : i.type === "STOCK"
                      ? "Chứng khoán"
                      : "Khác";

                  return (
                    <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{i.name}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">{typeLabel}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-700">
                        {formatVNDMasked(i.amount, isPrivacyMode)}
                      </td>
                      <td className="py-3.5 px-4 font-black text-blue-700">
                        {formatVNDMasked(curVal, isPrivacyMode)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-center font-bold ${
                          roi >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {roi >= 0 ? "+" : ""}
                        {roi}%
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {formatDateVN(i.startDate)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isActive
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {isActive ? "Đang đầu tư" : "Đã tất toán"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {isActive ? (
                            <button
                              onClick={() => updateInvestment(i.id, { status: "CLOSED" })}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Tất toán
                            </button>
                          ) : (
                            <button
                              onClick={() => updateInvestment(i.id, { status: "ACTIVE" })}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Kích hoạt lại
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditInvest(i)}
                            title="Chỉnh sửa khoản đầu tư"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteInvestId(i.id)}
                            title="Xóa khoản đầu tư"
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modal Trả / Thu Nợ (có kết nối ví Event Sourcing) */}
      {payTargetDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 border border-[#DCE4EE]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              {payTargetDebt.type === "LEND" ? "Ghi nhận thu nợ" : "Ghi nhận trả nợ"} - {payTargetDebt.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Còn lại: {formatVNDMasked(payTargetDebt.totalAmount - payTargetDebt.paidAmount, isPrivacyMode)}
            </p>

            <form onSubmit={handlePayDebtSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Số tiền đợt này (VND)
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={payAmount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setPayAmount(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                  }}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Ghi nhận dòng tiền từ ví / ngân hàng
                </label>
                <select
                  value={paySourceAccountId}
                  onChange={(e) => setPaySourceAccountId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  <option value="">Chỉ cập nhật sổ nợ (Không trừ/cộng ví)</option>
                  {accounts
                    .filter((a) => a.type !== "CREDIT_CARD")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatVNDMasked(a.currentBalance, isPrivacyMode)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPayTargetDebt(null)}
                  className="flex-1 py-2.5 text-xs font-semibold bg-slate-100 rounded-md hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold bg-emerald-600 text-white rounded-md shadow-md hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm / Sửa Khoản Nợ */}
      {isDebtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 border border-[#DCE4EE]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {editingDebt ? "Chỉnh sửa khoản nợ" : "Thêm khoản nợ mới"}
              </h3>
              <button
                onClick={() => {
                  setIsDebtModalOpen(false);
                  setEditingDebt(null);
                }}
                className="text-slate-400 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDebt} className="space-y-3.5 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDebtType("BORROW")}
                  className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                    debtType === "BORROW"
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  Đi vay (Phải trả)
                </button>
                <button
                  type="button"
                  onClick={() => setDebtType("LEND")}
                  className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                    debtType === "LEND"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  Cho vay (Chờ thu)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tên khoản nợ</label>
                <input
                  type="text"
                  required
                  value={debtName}
                  onChange={(e) => setDebtName(e.target.value)}
                  placeholder="VD: Vay mua xe, Cho bạn mượn..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Số tiền gốc (VND)</label>
                  <input
                    type="text"
                    required
                    value={debtTotal}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setDebtTotal(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                    }}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Thành viên</label>
                  <select
                    value={debtMemberId}
                    onChange={(e) => setDebtMemberId(e.target.value as FamilyMember)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="SHARED">🏡 Tổ ấm chung</option>
                    <option value="HUSBAND">👨 {settings.husbandName}</option>
                    <option value="WIFE">👩 {settings.wifeName}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Ngày phát sinh</label>
                  <input
                    type="date"
                    required
                    value={debtStartDate}
                    onChange={(e) => setDebtStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Ngày đáo hạn</label>
                  <input
                    type="date"
                    required
                    value={debtDueDate}
                    onChange={(e) => setDebtDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Lãi suất (%/năm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={debtInterest}
                  onChange={(e) => setDebtInterest(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDebtModalOpen(false);
                    setEditingDebt(null);
                  }}
                  className="flex-1 py-2.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-md text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/25 transition-colors cursor-pointer"
                >
                  {editingDebt ? "Lưu thay đổi" : "Lưu khoản nợ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm / Sửa Đầu Tư */}
      {isInvestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 border border-[#DCE4EE]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {editingInvest ? "Chỉnh sửa khoản đầu tư" : "Thêm khoản đầu tư"}
              </h3>
              <button
                onClick={() => {
                  setIsInvestModalOpen(false);
                  setEditingInvest(null);
                }}
                className="text-slate-400 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInvest} className="space-y-3.5 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tên khoản đầu tư</label>
                <input
                  type="text"
                  required
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  placeholder="VD: Vàng SJC, Cổ phiếu FPT..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Loại đầu tư</label>
                  <select
                    value={invType}
                    onChange={(e) => setInvType(e.target.value as InvestmentType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 font-semibold cursor-pointer"
                  >
                    <option value="GOLD">Vàng</option>
                    <option value="SAVINGS">Tiết kiệm ngân hàng</option>
                    <option value="STOCK">Cổ phiếu / Chứng khoán</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Thành viên</label>
                  <select
                    value={invMemberId}
                    onChange={(e) => setInvMemberId(e.target.value as FamilyMember)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="SHARED">🏡 Tổ ấm chung</option>
                    <option value="HUSBAND">👨 {settings.husbandName}</option>
                    <option value="WIFE">👩 {settings.wifeName}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Số tiền vốn gốc (VND)</label>
                  <input
                    type="text"
                    required
                    value={invAmount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setInvAmount(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                    }}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Giá trị hiện tại (VND)</label>
                  <input
                    type="text"
                    value={invCurrentValue}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setInvCurrentValue(raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : "");
                    }}
                    placeholder="Tự tính nếu trống"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-blue-700 outline-none focus:border-blue-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Lợi nhuận kỳ vọng (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={invProfit}
                    onChange={(e) => setInvProfit(e.target.value)}
                    placeholder="6.5"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    required
                    value={invStartDate}
                    onChange={(e) => setInvStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsInvestModalOpen(false);
                    setEditingInvest(null);
                  }}
                  className="flex-1 py-2.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-md text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/25 transition-colors cursor-pointer"
                >
                  {editingInvest ? "Lưu thay đổi" : "Lưu đầu tư"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteDebtId !== null}
        title="Xóa khoản nợ này?"
        message="Khoản nợ này sẽ bị xóa khỏi danh sách theo dõi."
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        isDanger={true}
        onConfirm={() => {
          if (deleteDebtId) {
            deleteDebt(deleteDebtId);
            setDeleteDebtId(null);
          }
        }}
        onCancel={() => setDeleteDebtId(null)}
      />

      <ConfirmDialog
        isOpen={deleteInvestId !== null}
        title="Xóa khoản đầu tư này?"
        message="Khoản đầu tư này sẽ bị xóa khỏi danh mục của bạn."
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        isDanger={true}
        onConfirm={() => {
          if (deleteInvestId) {
            deleteInvestment(deleteInvestId);
            setDeleteInvestId(null);
          }
        }}
        onCancel={() => setDeleteInvestId(null)}
      />
    </div>
  );
}
