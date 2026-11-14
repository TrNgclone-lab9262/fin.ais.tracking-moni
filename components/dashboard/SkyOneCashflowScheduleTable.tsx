"use client";

import React, { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Table2 } from "lucide-react";
import {
  buildSkyOneAmortizationChartData,
  MortgageScheduleRow,
  MortgageScheduleSummary,
} from "@/lib/mortgageEngine";
import { formatDateVN, formatVNDMasked } from "@/lib/formatters";
import { MortgageContract } from "@/types/finance";

export type CashflowGranularity = "YEARLY" | "MONTHLY";

export interface SkyOneCashflowScheduleTableProps {
  contract: MortgageContract;
  schedule: MortgageScheduleSummary;
  isPrivacyMode: boolean;
}

const MONTHS_PAGE_SIZE = 12;

function getStatusLabel(status: MortgageScheduleRow["status"]): {
  text: string;
  className: string;
} {
  switch (status) {
    case "PAID":
      return {
        text: "Đã đóng",
        className: "text-emerald-700 dark:text-emerald-300",
      };
    case "OVERDUE":
      return {
        text: "Quá hạn",
        className: "text-rose-700 dark:text-rose-300",
      };
    case "DUE_SOON":
      return {
        text: "Sắp đến hạn",
        className: "text-amber-700 dark:text-amber-300",
      };
    default:
      return {
        text: "Chờ đóng",
        className: "text-slate-500 dark:text-slate-400",
      };
  }
}

export function SkyOneCashflowScheduleTable({
  contract,
  schedule,
  isPrivacyMode,
}: SkyOneCashflowScheduleTableProps) {
  const [granularity, setGranularity] = useState<CashflowGranularity>("YEARLY");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const { milestones } = useMemo(
    () => buildSkyOneAmortizationChartData(contract, schedule),
    [contract, schedule]
  );

  const availableYears = useMemo(
    () => schedule.yearlySummary.map((y) => y.yearIndex),
    [schedule.yearlySummary]
  );

  const filteredMonthlyRows = useMemo(() => {
    if (selectedYear === "ALL") return schedule.rows;
    const yr = parseInt(selectedYear, 10);
    return schedule.rows.filter((r) => r.yearIndex === yr);
  }, [schedule.rows, selectedYear]);

  const totalMonthPages = Math.max(
    1,
    Math.ceil(filteredMonthlyRows.length / MONTHS_PAGE_SIZE)
  );
  const safePage = Math.min(currentPage, totalMonthPages);

  const pagedMonthlyRows = useMemo(() => {
    const start = (safePage - 1) * MONTHS_PAGE_SIZE;
    return filteredMonthlyRows.slice(start, start + MONTHS_PAGE_SIZE);
  }, [filteredMonthlyRows, safePage]);

  const yearlyTotals = useMemo(() => {
    return schedule.yearlySummary.reduce(
      (acc, y) => ({
        principalPaid: acc.principalPaid + y.principalPaid,
        interestPaid: acc.interestPaid + y.interestPaid,
        totalPaid: acc.totalPaid + y.totalPaid,
        endingBalance: y.endingBalance,
      }),
      { principalPaid: 0, interestPaid: 0, totalPaid: 0, endingBalance: 0 }
    );
  }, [schedule.yearlySummary]);

  const monthlyTotals = useMemo(() => {
    return filteredMonthlyRows.reduce(
      (acc, r) => ({
        principalPaid: acc.principalPaid + r.principal + r.prepaidInPeriod,
        interestPaid: acc.interestPaid + r.interest,
        totalPaid: acc.totalPaid + r.totalPayment + r.prepaidInPeriod,
        endingBalance: r.closingBalance,
      }),
      { principalPaid: 0, interestPaid: 0, totalPaid: 0, endingBalance: 0 }
    );
  }, [filteredMonthlyRows]);

  const handleGranularityChange = (next: CashflowGranularity) => {
    setGranularity(next);
    setCurrentPage(1);
  };

  const handleYearFilterChange = (val: string) => {
    setSelectedYear(val);
    setCurrentPage(1);
  };

  const handleJumpToCurrentYear = () => {
    const targetYear = milestones.currentYearIndex ?? 1;
    setSelectedYear(String(targetYear));
    setCurrentPage(1);
  };

  const activeTotals = granularity === "YEARLY" ? yearlyTotals : monthlyTotals;

  return (
    <section
      aria-label="Bảng chi tiết dòng tiền (Amortization Schedule)"
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-4"
    >
      {/* Header + Yearly/Monthly Segmented Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/70 text-[#4F46E5] dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
            <Table2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100 leading-snug">
              Bảng chi tiết dòng tiền (Amortization Schedule)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">
              {granularity === "YEARLY"
                ? `Tổng hợp ${schedule.yearlySummary.length} năm vay · Đối chiếu Dư nợ đầu kỳ, Gốc trả, Lãi trả và Dư nợ cuối kỳ`
                : `Chi tiết ${filteredMonthlyRows.length} kỳ thanh toán hàng tháng · Lãi suất thực tế theo từng kỳ`}
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Chuyển đổi góc nhìn bảng dòng tiền"
          className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-[#DCE4EE] dark:border-slate-700 self-start sm:self-auto shrink-0"
        >
          <button
            type="button"
            data-testid="skyone-cashflow-mode-yearly"
            aria-pressed={granularity === "YEARLY"}
            onClick={() => handleGranularityChange("YEARLY")}
            className={`min-h-[38px] sm:min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              granularity === "YEARLY"
                ? "bg-white dark:bg-slate-900 text-[#1D4ED8] dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-[#172B4D] dark:hover:text-white"
            }`}
          >
            Theo Năm
          </button>
          <button
            type="button"
            data-testid="skyone-cashflow-mode-monthly"
            aria-pressed={granularity === "MONTHLY"}
            onClick={() => handleGranularityChange("MONTHLY")}
            className={`min-h-[38px] sm:min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              granularity === "MONTHLY"
                ? "bg-white dark:bg-slate-900 text-[#1D4ED8] dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-[#172B4D] dark:hover:text-white"
            }`}
          >
            Theo Tháng
          </button>
        </div>
      </div>

      {/* Monthly Filter & Pagination Toolbar */}
      {granularity === "MONTHLY" && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="skyone-cashflow-year-select"
              className="text-slate-600 dark:text-slate-300 font-medium inline-flex items-center gap-1.5"
            >
              <CalendarRange className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-300" />
              <span>Lọc năm:</span>
            </label>
            <select
              id="skyone-cashflow-year-select"
              data-testid="skyone-cashflow-year-select"
              value={selectedYear}
              onChange={(e) => handleYearFilterChange(e.target.value)}
              className="min-h-[34px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[#172B4D] dark:text-slate-100 px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="ALL">Tất cả ({schedule.rows.length} tháng)</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  Năm {yr}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleJumpToCurrentYear}
              className="min-h-[34px] px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-[#1D4ED8] dark:text-blue-300 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors whitespace-nowrap cursor-pointer"
            >
              Năm hiện tại (Năm {milestones.currentYearIndex ?? 1})
            </button>
          </div>

          {totalMonthPages > 1 && (
            <div className="flex items-center gap-1.5 tabular-nums">
              <button
                type="button"
                aria-label="Trang trước"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-semibold text-slate-700 dark:text-slate-200">
                Trang {safePage} / {totalMonthPages}
              </span>
              <button
                type="button"
                aria-label="Trang sau"
                disabled={safePage >= totalMonthPages}
                onClick={() => setCurrentPage((p) => Math.min(totalMonthPages, p + 1))}
                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
      {(granularity === "YEARLY" && schedule.yearlySummary.length === 0) ||
      (granularity === "MONTHLY" && filteredMonthlyRows.length === 0) ? (
        <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
          Chưa có dữ liệu lịch trả nợ để hiển thị.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[700px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-2.5 px-3">
                  {granularity === "YEARLY" ? "Năm vay" : "Kỳ / Tháng"}
                </th>
                <th className="py-2.5 px-3 text-right">Dư nợ đầu kỳ</th>
                <th className="py-2.5 px-3 text-right">Gốc trả</th>
                <th className="py-2.5 px-3 text-right">Lãi trả</th>
                <th className="py-2.5 px-3 text-right">Tổng đóng</th>
                <th className="py-2.5 px-3 text-right">Dư nợ cuối kỳ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {granularity === "YEARLY"
                ? schedule.yearlySummary.map((yr) => {
                    const remainingRatioPct =
                      contract.loanAmount > 0
                        ? Math.max(
                            0,
                            Math.min(100, (yr.endingBalance / contract.loanAmount) * 100)
                          )
                        : 0;
                    const isCurrentYear = milestones.currentYearIndex === yr.yearIndex;
                    const isFixedEndYear = milestones.fixedEndYearIndex === yr.yearIndex;
                    const isEquity50Year = milestones.equity50YearIndex === yr.yearIndex;

                    const markers: string[] = [];
                    if (isCurrentYear) markers.push("Hiện tại");
                    if (isFixedEndYear) markers.push("Hết CĐ");
                    if (isEquity50Year) markers.push("Equity ≥50%");

                    return (
                      <tr
                        key={yr.yearIndex}
                        className={`transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50 ${
                          isCurrentYear ? "bg-blue-50/45 dark:bg-blue-950/30" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 align-middle">
                          <div className="font-bold text-[#172B4D] dark:text-slate-100 whitespace-nowrap">
                            {yr.label}
                          </div>
                          {markers.length > 0 && (
                            <div className="text-[10px] font-semibold text-[#4F46E5] dark:text-indigo-300 mt-0.5 whitespace-nowrap">
                              {markers.join(" · ")}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(yr.openingBalance, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#2563EB] dark:text-blue-400 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(yr.principalPaid, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#4F46E5] dark:text-indigo-300 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(yr.interestPaid, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#172B4D] dark:text-slate-100 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(yr.totalPaid, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                          <div className="font-semibold text-[#A21CAF] dark:text-fuchsia-300">
                            {formatVNDMasked(yr.endingBalance, isPrivacyMode)}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Còn {remainingRatioPct.toFixed(1)}% · Equity {yr.equityPercent.toFixed(1)}%
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : pagedMonthlyRows.map((row) => {
                    const statusInfo = getStatusLabel(row.status);
                    const totalPrincipalOut = row.principal + row.prepaidInPeriod;
                    const totalCashOut = row.totalPayment + row.prepaidInPeriod;
                    const isCurrentPeriod = schedule.currentReferencePeriod === row.period;

                    return (
                      <tr
                        key={row.period}
                        className={`transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50 ${
                          isCurrentPeriod ? "bg-blue-50/45 dark:bg-blue-950/30" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 align-middle">
                          <div className="font-bold text-[#172B4D] dark:text-slate-100 tabular-nums whitespace-nowrap">
                            Kỳ #{row.period} · {formatDateVN(row.dueDate)}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                            <span className={`font-semibold ${statusInfo.className}`}>
                              {statusInfo.text}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{row.stage === "FIXED" ? "Cố định" : "Thả nổi"}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{row.appliedRate.toFixed(2)}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(row.openingBalance, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#2563EB] dark:text-blue-400 tabular-nums whitespace-nowrap">
                          <div>{formatVNDMasked(totalPrincipalOut, isPrivacyMode)}</div>
                          {row.prepaidInPeriod > 0 && (
                            <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                              Gồm trả trước {formatVNDMasked(row.prepaidInPeriod, isPrivacyMode)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#4F46E5] dark:text-indigo-300 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(row.interest, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#172B4D] dark:text-slate-100 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(totalCashOut, isPrivacyMode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#A21CAF] dark:text-fuchsia-300 tabular-nums whitespace-nowrap">
                          {formatVNDMasked(row.closingBalance, isPrivacyMode)}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>

            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 font-bold text-xs">
                <td className="py-2.5 px-3 text-[#172B4D] dark:text-slate-100 whitespace-nowrap">
                  {granularity === "YEARLY"
                    ? `Tổng cộng (${schedule.yearlySummary.length} năm)`
                    : selectedYear === "ALL"
                      ? `Tổng toàn kỳ (${filteredMonthlyRows.length} kỳ)`
                      : `Tổng Năm ${selectedYear} (${filteredMonthlyRows.length} kỳ)`}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                  —
                </td>
                <td className="py-2.5 px-3 text-right text-[#2563EB] dark:text-blue-400 tabular-nums whitespace-nowrap">
                  {formatVNDMasked(activeTotals.principalPaid, isPrivacyMode)}
                </td>
                <td className="py-2.5 px-3 text-right text-[#4F46E5] dark:text-indigo-300 tabular-nums whitespace-nowrap">
                  {formatVNDMasked(activeTotals.interestPaid, isPrivacyMode)}
                </td>
                <td className="py-2.5 px-3 text-right text-[#172B4D] dark:text-slate-100 tabular-nums whitespace-nowrap">
                  {formatVNDMasked(activeTotals.totalPaid, isPrivacyMode)}
                </td>
                <td className="py-2.5 px-3 text-right text-[#A21CAF] dark:text-fuchsia-300 tabular-nums whitespace-nowrap">
                  {formatVNDMasked(activeTotals.endingBalance, isPrivacyMode)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
