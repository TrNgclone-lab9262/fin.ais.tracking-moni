"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Download,
  Printer,
  Eye,
  EyeOff,
  Loader2,
  FileText,
  Calendar,
  Scale,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  formatVNDMasked,
  getCurrentMonthKey,
  getMonthDisplayLabel,
} from "@/lib/formatters";
import { PerspectiveFilter } from "@/lib/financeEngine";
import { buildMonthlyPdfReport } from "@/lib/monthlyReport";

interface MonthlyPdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MonthlyPdfReportModal({ isOpen, onClose }: MonthlyPdfReportModalProps) {
  const {
    transactions,
    categories,
    accounts,
    selectedMonth,
    availableMonths,
    activePerspective,
    settings,
    isPrivacyMode,
  } = useFinance();

  const defaultMonthKey =
    selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;

  const [reportMonth, setReportMonth] = useState<string>(defaultMonthKey);
  const [reportPerspective, setReportPerspective] =
    useState<PerspectiveFilter>(activePerspective);
  const [isMasked, setIsMasked] = useState<boolean>(isPrivacyMode);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setReportMonth(
        selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth
      );
      setReportPerspective(activePerspective);
      setIsMasked(isPrivacyMode);
      setStatusMessage(null);
    }
  }, [isOpen, selectedMonth, activePerspective, isPrivacyMode]);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove("pdf-printing");
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.classList.remove("pdf-printing");
    };
  }, []);

  const monthOptions = useMemo(() => {
    const current = getCurrentMonthKey();
    const set = new Set<string>([current, ...availableMonths]);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [availableMonths]);

  const report = useMemo(
    () =>
      buildMonthlyPdfReport({
        transactions,
        categories,
        accounts,
        monthKey: reportMonth,
        perspective: reportPerspective,
        settings,
      }),
    [transactions, categories, accounts, reportMonth, reportPerspective, settings]
  );

  if (!isOpen || typeof document === "undefined") return null;

  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return;
    setIsExportingPdf(true);
    setStatusMessage(null);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      let heightLeft = imgHeight;
      let yOffset = margin;

      pdf.addImage(imgData, "PNG", margin, yOffset, contentWidth, imgHeight);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, margin, "F");
      pdf.rect(0, pageHeight - margin, pageWidth, margin, "F");
      heightLeft -= contentHeight;

      while (heightLeft > 1) {
        yOffset = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, yOffset, contentWidth, imgHeight);
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, margin, "F");
        pdf.rect(0, pageHeight - margin, pageWidth, margin, "F");
        heightLeft -= contentHeight;
      }

      pdf.save(`home-moni-bao-cao-${report.monthKey}.pdf`);
      setStatusMessage({
        type: "success",
        text: `Đã tải xuống tệp PDF báo cáo ${report.monthLabel}.`,
      });
    } catch (err) {
      console.error("Lỗi tạo PDF:", err);
      setStatusMessage({
        type: "error",
        text: "Không thể tạo file PDF trực tiếp trên trình duyệt này. Vui lòng thử nút In / Lưu PDF.",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    setStatusMessage(null);
    document.body.classList.add("pdf-printing");
    window.setTimeout(() => {
      window.print();
    }, 60);
  };

  const settlement = report.coupleSettlement;
  const fromName =
    settlement.fromMember === "WIFE" ? report.wifeName : report.husbandName;
  const toName =
    settlement.toMember === "HUSBAND" ? report.husbandName : report.wifeName;

  const modalContent = (
    <div
      className="pdf-print-portal fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex flex-col pt-safe pb-safe animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Xem trước báo cáo tài chính tháng chuẩn A4"
    >
      {/* Top Toolbar (Hidden when printing) */}
      <div className="pdf-no-print bg-white dark:bg-slate-900 border-b border-[#DCE4EE] dark:border-slate-800 px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-[#1E3A8A] dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-[#172B4D] dark:text-slate-100 truncate">
              Xem Trước Bản In A4 · {report.monthLabel}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {report.perspectiveLabel} · {report.summary.transactionCount} giao dịch
            </p>
          </div>
        </div>

        {/* Filter & Export Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-1.5 shrink-0" />
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              aria-label="Chọn tháng xuất báo cáo PDF"
              className="bg-transparent outline-none cursor-pointer text-xs font-bold [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
            >
              {monthOptions.map((mk) => (
                <option key={mk} value={mk}>
                  {getMonthDisplayLabel(mk)}
                </option>
              ))}
            </select>
          </div>

          {/* Perspective Switcher */}
          <select
            value={reportPerspective}
            onChange={(e) =>
              setReportPerspective(e.target.value as PerspectiveFilter)
            }
            aria-label="Chọn phạm vi báo cáo PDF"
            className="min-h-[34px] bg-slate-100 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
          >
            <option value="ALL">Cả gia đình</option>
            <option value="HUSBAND">{settings.husbandName}</option>
            <option value="WIFE">{settings.wifeName}</option>
          </select>

          {/* Privacy Toggle for Reconciliation */}
          <button
            type="button"
            onClick={() => setIsMasked((v) => !v)}
            className={`min-h-[34px] px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              isMasked
                ? "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
                : "bg-slate-100 dark:bg-slate-800 border-[#DCE4EE] dark:border-slate-700 text-slate-700 dark:text-slate-200"
            }`}
            title="Bật hoặc tắt che số tiền trước khi in hoặc tải PDF"
          >
            {isMasked ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Đang che số</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Hiện số thật</span>
              </>
            )}
          </button>

          {/* Download Direct PDF */}
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={isExportingPdf}
            data-testid="pdf-download-btn"
            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs cursor-pointer transition-colors"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang tạo PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Tải file PDF</span>
              </>
            )}
          </button>

          {/* Browser Print / Save as PDF */}
          <button
            type="button"
            onClick={handlePrint}
            data-testid="pdf-print-btn"
            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In / Lưu PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng xem trước PDF"
            className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inline Status Banner */}
      {statusMessage && (
        <div
          role="status"
          className={`pdf-no-print px-4 sm:px-6 py-2 text-xs font-bold flex items-center justify-center gap-2 border-b ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Scrollable A4 Preview Viewport */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 flex justify-center items-start">
        <div
          ref={sheetRef}
          id="monthly-a4-report-sheet"
          style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
          className="w-full max-w-[794px] bg-[#ffffff] text-[#0f172a] rounded-lg shadow-2xl border border-[#e2e8f0] p-5 sm:p-9 space-y-6 print:shadow-none print:border-0 print:rounded-none print:p-0 print:max-w-none"
        >
          {/* A4 Document Header */}
          <div className="border-b-2 border-[#1e3a8a] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold tracking-widest uppercase text-[#1e3a8a]">
                HOME MONI · SỔ TÀI CHÍNH GIA ĐÌNH
              </p>
              <h1 className="text-xl sm:text-2xl font-black text-[#0f172a] mt-0.5 tracking-tight">
                Báo Cáo Tài Chính {report.monthLabel}
              </h1>
              <p className="text-xs font-semibold text-[#475569] mt-1">
                Phạm vi: {report.perspectiveLabel} · Vợ chồng: {report.husbandName} &{" "}
                {report.wifeName}
              </p>
            </div>

            <div className="text-left sm:text-right text-[11px] text-[#475569] space-y-0.5 tabular-nums">
              <p>
                Kỳ báo cáo:{" "}
                <strong className="text-[#0f172a]">{report.monthKey}</strong>
              </p>
              <p>
                Ngày lập:{" "}
                <strong className="text-[#0f172a]">
                  {report.generatedAtDisplay}
                </strong>
              </p>
              <p>
                Số lượng bút toán:{" "}
                <strong className="text-[#0f172a]">
                  {report.summary.transactionCount} giao dịch
                </strong>
              </p>
            </div>
          </div>

          {/* Section 1: Tổng kết thu chi tháng */}
          <section className="space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#1e3a8a]">
              1. Tổng Kết Thu – Chi & Tích Lũy Tháng
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
                <span className="text-[11px] font-semibold text-[#475569] block">
                  Tổng thu nhập
                </span>
                <span className="text-sm sm:text-base font-black text-[#047857] tabular-nums mt-1 block">
                  +{formatVNDMasked(report.summary.totalIncome, isMasked)}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
                <span className="text-[11px] font-semibold text-[#475569] block">
                  Tổng chi tiêu
                </span>
                <span className="text-sm sm:text-base font-black text-[#be123c] tabular-nums mt-1 block">
                  -{formatVNDMasked(report.summary.totalExpense, isMasked)}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
                <span className="text-[11px] font-semibold text-[#475569] block">
                  Chênh lệch ròng
                </span>
                <span
                  className={`text-sm sm:text-base font-black tabular-nums mt-1 block ${
                    report.summary.netSavings >= 0
                      ? "text-[#1e3a8a]"
                      : "text-[#be123c]"
                  }`}
                >
                  {report.summary.netSavings >= 0 ? "+" : ""}
                  {formatVNDMasked(report.summary.netSavings, isMasked)}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
                <span className="text-[11px] font-semibold text-[#475569] block">
                  Tỷ lệ tiết kiệm
                </span>
                <span className="text-sm sm:text-base font-black text-[#0f172a] tabular-nums mt-1 block">
                  {report.summary.savingsRate}%
                </span>
              </div>
            </div>

            {report.topExpenseCategories.length > 0 && (
              <div className="p-3.5 rounded-lg border border-[#e2e8f0] bg-[#ffffff] space-y-2">
                <p className="text-[11px] font-bold text-[#334155]">
                  Cơ cấu nhóm chi tiêu nổi bật
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {report.topExpenseCategories.slice(0, 6).map((cat) => (
                    <div key={cat.categoryId} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] gap-2">
                        <span className="font-semibold text-[#1e293b] truncate">
                          {cat.categoryName} ({cat.count})
                        </span>
                        <span className="font-bold text-[#0f172a] tabular-nums shrink-0">
                          {formatVNDMasked(cat.amount, isMasked)} · {cat.percentage}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#e2e8f0] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(4, cat.percentage))}%`,
                            backgroundColor: cat.categoryColor || "#1e3a8a",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Đối soát chi tiêu chung vợ chồng */}
          <section className="space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#1e3a8a] flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              <span>
                2. Đối Soát Chi Tiêu Vợ Chồng (Quỹ Chung Tỷ Lệ{" "}
                {settlement.husbandSharePct}% / {settlement.wifeSharePct}%)
              </span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-[#e2e8f0] bg-[#eff6ff]">
                <span className="text-[11px] font-bold text-[#1e3a8a] block">
                  {report.husbandName} đã chi chung
                </span>
                <span className="text-sm font-black text-[#0f172a] tabular-nums mt-0.5 block">
                  {formatVNDMasked(settlement.husbandPaid, isMasked)}
                </span>
                <span className="text-[10px] font-medium text-[#475569] tabular-nums mt-0.5 block">
                  Định mức ({settlement.husbandSharePct}%):{" "}
                  {formatVNDMasked(settlement.husbandExpected, isMasked)} · Chi riêng:{" "}
                  {formatVNDMasked(
                    report.memberBreakdown.husbandPersonalExpense,
                    isMasked
                  )}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#e2e8f0] bg-[#fff1f2]">
                <span className="text-[11px] font-bold text-[#be123c] block">
                  {report.wifeName} đã chi chung
                </span>
                <span className="text-sm font-black text-[#0f172a] tabular-nums mt-0.5 block">
                  {formatVNDMasked(settlement.wifePaid, isMasked)}
                </span>
                <span className="text-[10px] font-medium text-[#475569] tabular-nums mt-0.5 block">
                  Định mức ({settlement.wifeSharePct}%):{" "}
                  {formatVNDMasked(settlement.wifeExpected, isMasked)} · Chi riêng:{" "}
                  {formatVNDMasked(
                    report.memberBreakdown.wifePersonalExpense,
                    isMasked
                  )}
                </span>
              </div>

              <div
                className={`p-3 rounded-lg border ${
                  settlement.fromMember === "BALANCED"
                    ? "border-[#a7f3d0] bg-[#ecfdf5]"
                    : "border-[#bfdbfe] bg-[#f8fafc]"
                }`}
              >
                <span className="text-[11px] font-bold text-[#334155] block">
                  Kết luận bù trừ tháng
                </span>
                {settlement.fromMember === "BALANCED" ? (
                  <p className="text-xs font-extrabold text-[#047857] mt-1">
                    Đã cân bằng (Tổng chi chung{" "}
                    {formatVNDMasked(settlement.totalSharedExpense, isMasked)})
                  </p>
                ) : (
                  <p className="text-xs font-bold text-[#0f172a] mt-1 leading-snug tabular-nums">
                    <strong>{fromName}</strong> chuyển bù{" "}
                    <strong className="text-[#1e3a8a]">
                      {formatVNDMasked(settlement.transferAmount, isMasked)}
                    </strong>{" "}
                    cho <strong>{toName}</strong>
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Bảng giao dịch chi tiết tháng */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#1e3a8a]">
                3. Bảng Kê Giao Dịch Chi Tiết ({report.rows.length} bút toán)
              </h2>
              <span className="text-[11px] font-semibold text-[#64748b] tabular-nums">
                Đơn vị: VND
              </span>
            </div>

            {report.rows.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] text-center text-xs text-[#64748b] font-semibold">
                Chưa có giao dịch nào phát sinh trong {report.monthLabel} cho phạm vi{" "}
                {report.perspectiveLabel}.
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#e2e8f0] rounded-lg">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#f1f5f9] text-[#334155] border-b border-[#cbd5e1]">
                      <th className="py-2 px-2.5 font-extrabold whitespace-nowrap">
                        Ngày
                      </th>
                      <th className="py-2 px-2.5 font-extrabold whitespace-nowrap">
                        Loại
                      </th>
                      <th className="py-2 px-2.5 font-extrabold">
                        Danh mục & Ghi chú
                      </th>
                      <th className="py-2 px-2.5 font-extrabold whitespace-nowrap">
                        Ví / Thẻ
                      </th>
                      <th className="py-2 px-2.5 font-extrabold whitespace-nowrap">
                        Người · Phạm vi
                      </th>
                      <th className="py-2 px-2.5 font-extrabold text-right whitespace-nowrap">
                        Số tiền
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {report.rows.map((row) => {
                      const isExp = row.type === "EXPENSE";
                      const isInc = row.type === "INCOME";
                      return (
                        <tr key={row.id} className="bg-[#ffffff]">
                          <td className="py-2 px-2.5 font-semibold text-[#334155] tabular-nums whitespace-nowrap align-top">
                            {row.dateDisplay}
                          </td>
                          <td className="py-2 px-2.5 font-bold whitespace-nowrap align-top">
                            <span
                              className={
                                isExp
                                  ? "text-[#be123c]"
                                  : isInc
                                  ? "text-[#047857]"
                                  : "text-[#1e3a8a]"
                              }
                            >
                              {row.typeLabel}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 align-top">
                            <div className="font-bold text-[#0f172a]">
                              {row.categoryName}
                            </div>
                            {row.note && (
                              <div className="text-[10px] text-[#64748b] mt-0.5">
                                {row.note}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-[#334155] font-medium align-top">
                            {row.toAccountName
                              ? `${row.accountName} → ${row.toAccountName}`
                              : row.accountName}
                          </td>
                          <td className="py-2 px-2.5 text-[#334155] font-medium whitespace-nowrap align-top">
                            {row.memberLabel} · {row.scopeLabel}
                          </td>
                          <td
                            className={`py-2 px-2.5 font-extrabold text-right tabular-nums whitespace-nowrap align-top ${
                              isExp
                                ? "text-[#be123c]"
                                : isInc
                                ? "text-[#047857]"
                                : "text-[#1e3a8a]"
                            }`}
                          >
                            {isExp ? "-" : isInc ? "+" : ""}
                            {formatVNDMasked(row.amount, isMasked)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f8fafc] border-t-2 border-[#cbd5e1] font-extrabold text-[#0f172a] tabular-nums">
                      <td colSpan={4} className="py-2.5 px-2.5">
                        Tổng hợp kỳ {report.monthLabel} ({report.rows.length} giao dịch)
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-[#047857] whitespace-nowrap">
                        Thu +{formatVNDMasked(report.summary.totalIncome, isMasked)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-[#be123c] whitespace-nowrap">
                        Chi -{formatVNDMasked(report.summary.totalExpense, isMasked)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Signatures / Verification Footer */}
          <div className="pt-4 border-t border-[#e2e8f0] flex items-center justify-between text-[10px] text-[#64748b]">
            <span>
              Xuất từ HOME MONI · Dữ liệu gia đình lưu trữ cục bộ & đồng bộ
            </span>
            <span>
              Xác nhận đối soát: {report.husbandName} / {report.wifeName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
