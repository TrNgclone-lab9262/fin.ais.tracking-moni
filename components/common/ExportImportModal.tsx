"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileJson,
  FileSpreadsheet,
  ShieldCheck,
  RotateCcw,
  Copy,
  GitMerge,
  ClipboardPaste,
  Check,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { MergeDiffPreview, StoredAppStateV3 } from "@/lib/storage";
import { StepUpAuthModal } from "@/components/auth/StepUpAuthModal";

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenResetDemo: () => void;
}

export function ExportImportModal({
  isOpen,
  onClose,
  onOpenResetDemo,
}: ExportImportModalProps) {
  const {
    transactions,
    categories,
    selectedMonth,
    settings,
    hasPasscodeProtection,
    exportBackup,
    exportCsvReport,
    getSyncBundleJson,
    previewSyncBundle,
    importSyncBundle,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<"EXPORT" | "IMPORT">("EXPORT");
  const [importStatus, setImportStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

  // Couple Sync Export copy state
  const [copiedBundle, setCopiedBundle] = useState(false);
  const [manualBundlePreview, setManualBundlePreview] = useState<string | null>(null);

  // Couple Sync Import + Smart Merge state
  const [pastedText, setPastedText] = useState("");
  const [parsedCandidate, setParsedCandidate] = useState<{
    preview: MergeDiffPreview;
    parsedState: StoredAppStateV3;
    sourceLabel: string;
  } | null>(null);
  const [importMode, setImportMode] = useState<"MERGE" | "REPLACE">("MERGE");
  const [keepLocalSecurity, setKeepLocalSecurity] = useState(true);
  const [isReplaceStepUpOpen, setIsReplaceStepUpOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetImportState = () => {
    setImportStatus({ type: "idle" });
    setParsedCandidate(null);
    setPastedText("");
  };

  const handleExport = () => {
    exportBackup();
  };

  const handleCopySyncBundle = async () => {
    const bundleJson = getSyncBundleJson();
    try {
      await navigator.clipboard.writeText(bundleJson);
      setCopiedBundle(true);
      setManualBundlePreview(null);
      setTimeout(() => setCopiedBundle(false), 3000);
    } catch {
      setManualBundlePreview(bundleJson);
    }
  };

  const inspectIncomingText = (rawText: string, sourceLabel: string) => {
    if (!rawText.trim()) {
      setImportStatus({
        type: "error",
        message: "Vui lòng chọn file JSON hoặc dán nội dung gói đồng bộ.",
      });
      setParsedCandidate(null);
      return;
    }

    const res = previewSyncBundle(rawText);
    if (!res.success || !res.preview || !res.parsedState) {
      setParsedCandidate(null);
      setImportStatus({
        type: "error",
        message: res.error || "Nội dung gói đồng bộ không đúng định dạng HOME MONI.",
      });
      return;
    }

    setParsedCandidate({
      preview: res.preview,
      parsedState: res.parsedState,
      sourceLabel,
    });
    setImportStatus({ type: "idle" });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus({ type: "loading", message: "Đang kiểm tra gói dữ liệu..." });

    try {
      const text = await file.text();
      inspectIncomingText(text, file.name);
    } catch {
      setImportStatus({
        type: "error",
        message: "Có lỗi xảy ra khi đọc file JSON.",
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const executeApplyImport = () => {
    if (!parsedCandidate) return;
    const res = importSyncBundle(parsedCandidate.parsedState, {
      mode: importMode,
      keepLocalSecurity,
    });
    if (res.success) {
      const d = res.diff;
      const mortgageDelta =
        d.newMortgagePaidRecords + d.newMortgagePrepayments + d.newMortgageRateAdjustments;
      const mortgageSuffix =
        mortgageDelta > 0 ? `, ${mortgageDelta} cập nhật vay SKYONE` : "";
      const summaryMsg =
        importMode === "MERGE"
          ? `Hợp nhất thành công! Đã thêm ${d.newTransactions} giao dịch, ${d.newAccounts} ví, ${d.newBudgets} ngân sách, ${d.newGoals} mục tiêu mới${mortgageSuffix} và tính lại số dư chuẩn.`
          : "Đã khôi phục toàn bộ dữ liệu thay thế bản hiện tại và tính lại số dư chuẩn.";
      setImportStatus({ type: "success", message: summaryMsg });
      setParsedCandidate(null);
      setPastedText("");
    }
  };

  const handleConfirmImport = () => {
    if (!parsedCandidate) return;
    if (
      importMode === "REPLACE" &&
      settings.requireAuthForDangerActions &&
      hasPasscodeProtection
    ) {
      setIsReplaceStepUpOpen(true);
      return;
    }
    executeApplyImport();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-safe pb-safe bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div
          className="w-full max-w-lg max-h-[90dvh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-[#DCE4EE] dark:border-slate-800 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-[#E9EEF5] dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <FileJson className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                Sao lưu & Đồng bộ 2 máy
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab switch */}
          <div className="p-3 border-b border-[#E9EEF5] dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab("EXPORT");
                setImportStatus({ type: "idle" });
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "EXPORT"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-[#DCE4EE] dark:border-slate-700"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Download className="w-4 h-4" />
              Xuất / Chia sẻ gói
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("IMPORT");
                setImportStatus({ type: "idle" });
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "IMPORT"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-[#DCE4EE] dark:border-slate-700"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <GitMerge className="w-4 h-4" />
              Nhập / Hợp nhất 2 máy
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1">
            {activeTab === "EXPORT" ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg bg-blue-50/70 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/30 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                    Xuất tệp JSON hoặc sao chép nhanh <strong>Gói đồng bộ 2 máy</strong> để gửi qua Zalo/AirDrop cho vợ hoặc chồng hợp nhất giao dịch mà không ghi đè dữ liệu máy kia.
                  </div>
                </div>

                {/* Tóm tắt data */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-[#E9EEF5] dark:border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-400 font-medium">Tổng giao dịch:</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums">
                      {transactions.length} bản ghi
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-400 font-medium">Danh mục cấu hình:</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums">
                      {categories.length} danh mục
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => void handleCopySyncBundle()}
                    className="w-full py-3 px-4 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-sm rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
                  >
                    {copiedBundle ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Đã sao chép gói đồng bộ vào Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Sao chép gói đồng bộ 2 máy (gửi Zalo/Tin nhắn)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleExport}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Tải file sao lưu JSON về máy (.json)
                  </button>

                  <button
                    type="button"
                    onClick={exportCsvReport}
                    className="w-full py-2.5 px-4 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-bold text-xs sm:text-sm rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Xuất báo cáo Excel / CSV ({selectedMonth === "ALL" ? "Tất cả" : selectedMonth})
                    </span>
                  </button>
                </div>

                {manualBundlePreview && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      Trình duyệt chặn tự động sao chép — chạm giữ để chọn toàn bộ mã bên dưới:
                    </p>
                    <textarea
                      readOnly
                      value={manualBundlePreview}
                      onFocus={(e) => e.target.select()}
                      rows={4}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg p-2.5 text-[11px] font-mono text-slate-700 dark:text-slate-200"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {!parsedCandidate ? (
                  <>
                    {/* 1. Upload file */}
                    <div className="border-2 border-dashed border-[#DCE4EE] dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl p-4 text-center transition-colors bg-slate-50/50 dark:bg-slate-800/50">
                      <Upload className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
                      <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                        Chọn tệp JSON sao lưu từ máy khác
                      </p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".json,application/json"
                        onChange={(e) => void handleFileChange(e)}
                        className="hidden"
                        id="json-file-input"
                      />
                      <label
                        htmlFor="json-file-input"
                        className="mt-2.5 inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                      >
                        Duyệt file .json...
                      </label>
                    </div>

                    {/* 2. Paste sync bundle text */}
                    <div className="space-y-2">
                      <label
                        htmlFor="sync-bundle-paste"
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Hoặc dán chuỗi gói đồng bộ nhận từ máy vợ/chồng:</span>
                      </label>
                      <textarea
                        id="sync-bundle-paste"
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        rows={4}
                        placeholder='Dán nội dung JSON đồng bộ {"version":"4.0",...} hoặc JSON sao lưu vào đây'
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => inspectIncomingText(pastedText, "Nội dung dán trực tiếp")}
                        disabled={!pastedText.trim()}
                        className="w-full min-h-[42px] py-2 px-4 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <GitMerge className="w-4 h-4" />
                        <span>Kiểm tra & Xem trước thay đổi</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#1E3A8A] dark:text-blue-300">
                          Xem trước gói: {parsedCandidate.sourceLabel}
                        </span>
                        <button
                          type="button"
                          onClick={resetImportState}
                          className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                        >
                          Chọn gói khác
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-100 dark:border-slate-700">
                          <span className="text-slate-500 dark:text-slate-400 block">Giao dịch mới</span>
                          <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                            +{parsedCandidate.preview.newTransactions}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500 text-[10px] block">
                            / {parsedCandidate.preview.totalIncomingTransactions} bản ghi
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-100 dark:border-slate-700">
                          <span className="text-slate-500 dark:text-slate-400 block">Ví / Tài khoản mới</span>
                          <span className="text-sm font-black text-blue-700 dark:text-blue-400 tabular-nums">
                            +{parsedCandidate.preview.newAccounts}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-100 dark:border-slate-700">
                          <span className="text-slate-500 dark:text-slate-400 block">Ngân sách / Mục tiêu</span>
                          <span className="text-sm font-black text-indigo-700 dark:text-indigo-400 tabular-nums">
                            +{parsedCandidate.preview.newBudgets + parsedCandidate.preview.newGoals}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-100 dark:border-slate-700">
                          <span className="text-slate-500 dark:text-slate-400 block">Khoản nợ / Đầu tư</span>
                          <span className="text-sm font-black text-amber-700 dark:text-amber-400 tabular-nums">
                            +{parsedCandidate.preview.newDebts + parsedCandidate.preview.newInvestments}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-100 dark:border-slate-700 col-span-2 sm:col-span-2">
                          <span className="text-slate-500 dark:text-slate-400 block">Danh mục & Định kỳ mới</span>
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100 tabular-nums">
                            +{parsedCandidate.preview.newCategories} danh mục, +{parsedCandidate.preview.newRecurringRules} định kỳ
                          </span>
                        </div>
                        {parsedCandidate.preview.newMortgagePaidRecords +
                          parsedCandidate.preview.newMortgagePrepayments +
                          parsedCandidate.preview.newMortgageRateAdjustments >
                          0 && (
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-100 dark:border-slate-700 col-span-2 sm:col-span-3">
                            <span className="text-slate-500 dark:text-slate-400 block">Hợp đồng vay Phú Đông SKYONE</span>
                            <span className="text-sm font-black text-blue-700 dark:text-blue-400 tabular-nums">
                              +{parsedCandidate.preview.newMortgagePaidRecords} kỳ đã đóng, +
                              {parsedCandidate.preview.newMortgagePrepayments} trả trước hạn, +
                              {parsedCandidate.preview.newMortgageRateAdjustments} mốc lãi suất
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mode selection */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Chế độ đồng bộ:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setImportMode("MERGE")}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            importMode === "MERGE"
                              ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 ring-1 ring-emerald-500"
                              : "bg-slate-50 dark:bg-slate-800 border-[#DCE4EE] dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700"
                          }`}
                        >
                          <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                            Hợp nhất thông minh (Khuyên dùng)
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                            Chỉ thêm giao dịch & mục mới chưa có trên máy này, không bị trùng lặp.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setImportMode("REPLACE")}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            importMode === "REPLACE"
                              ? "bg-rose-50 dark:bg-rose-500/15 border-rose-500 ring-1 ring-rose-500"
                              : "bg-slate-50 dark:bg-slate-800 border-[#DCE4EE] dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700"
                          }`}
                        >
                          <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                            Thay thế toàn bộ (Replace)
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                            Ghi đè hoàn toàn dữ liệu hiện tại bằng dữ liệu từ gói nhập vào.
                          </p>
                        </button>
                      </div>
                    </div>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-[#E9EEF5] dark:border-slate-700 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepLocalSecurity}
                        onChange={(e) => setKeepLocalSecurity(e.target.checked)}
                        className="w-4 h-4 accent-blue-600 mt-0.5 shrink-0"
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Giữ nguyên mã Code, Face ID & hình nền màn hình khóa riêng của máy này
                      </span>
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={resetImportState}
                        className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmImport}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer ${
                          importMode === "MERGE"
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : "bg-rose-600 hover:bg-rose-700"
                        }`}
                      >
                        <GitMerge className="w-4 h-4" />
                        <span>
                          {importMode === "MERGE"
                            ? "Áp dụng hợp nhất ngay"
                            : "Ghi đè toàn bộ dữ liệu"}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Status feedback */}
                {importStatus.type === "success" && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-lg flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{importStatus.message}</span>
                  </div>
                )}

                {importStatus.type === "error" && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-semibold rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span>{importStatus.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* Nút Reset Mock data phụ bên dưới */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Muốn dùng lại dữ liệu mẫu demo?</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenResetDemo();
                }}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Nạp lại mẫu
              </button>
            </div>
          </div>
        </div>
      </div>

      <StepUpAuthModal
        isOpen={isReplaceStepUpOpen}
        title="Xác thực ghi đè toàn bộ dữ liệu"
        description="Chế độ Thay thế toàn bộ sẽ xóa dữ liệu hiện tại trên máy này để thay bằng gói nhập. Xác nhận mã Code hoặc Face ID để tiếp tục."
        onVerified={() => {
          setIsReplaceStepUpOpen(false);
          executeApplyImport();
        }}
        onCancel={() => setIsReplaceStepUpOpen(false)}
      />
    </>
  );
}
