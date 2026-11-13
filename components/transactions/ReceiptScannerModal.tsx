/**
 * @file ReceiptScannerModal.tsx
 * @description Modal quét bóc tách hóa đơn thông minh + tách danh mục qua Server-side Gemini AI
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  Upload,
  CheckCircle2,
  Sparkles,
  X,
  RefreshCw,
  AlertCircle,
  Split,
} from "lucide-react";
import {
  parseReceiptWithGemini,
  ParsedReceiptResult,
} from "@/lib/geminiReceiptService";
import { formatVND } from "@/lib/formatters";
import { useFinance, TransactionInput } from "@/context/FinanceContext";
import { FamilyMember, ExpenseScope } from "@/types/finance";

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyReceipt: (result: ParsedReceiptResult) => void;
  onApplyTransactions?: (items: TransactionInput[]) => void;
}

export function ReceiptScannerModal({
  isOpen,
  onClose,
  onApplyReceipt,
  onApplyTransactions,
}: ReceiptScannerModalProps) {
  const { categories, accounts, activePerspective, settings } = useFinance();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ParsedReceiptResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editable review state
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [editMerchant, setEditMerchant] = useState<string>("");
  const [editCategoryId, setEditCategoryId] = useState<string>("cat_expense_food");
  const [editAccountId, setEditAccountId] = useState<string>("");
  const [editMemberId, setEditMemberId] = useState<FamilyMember>("HUSBAND");
  const [editScope, setEditScope] = useState<ExpenseScope>("FAMILY");
  const [splitByItems, setSplitByItems] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  useEffect(() => {
    if (isOpen) {
      const defMember: FamilyMember = activePerspective === "WIFE" ? "WIFE" : "HUSBAND";
      setEditMemberId(defMember);
      const preferredAcc =
        accounts.find((a) => a.owner === defMember) || accounts[0];
      if (preferredAcc) setEditAccountId(preferredAcc.id);
    }
  }, [isOpen, activePerspective, accounts]);

  if (!isOpen) return null;

  const hydrateEditableFields = (res: ParsedReceiptResult) => {
    setEditAmount(res.amount);
    setEditDate(res.date || new Date().toISOString().slice(0, 10));
    setEditMerchant(res.merchantName || "");
    setEditCategoryId(res.suggestedCategoryId || expenseCategories[0]?.id || "cat_expense_food");
    setSplitByItems(Boolean(res.items && res.items.length > 1));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setScanResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsScanning(true);
    try {
      const result = await parseReceiptWithGemini(file, categories);
      setScanResult(result);
      hydrateEditableFields(result);
    } catch {
      setErrorMsg("Không thể bóc tách hóa đơn. Vui lòng thử lại với ảnh rõ nét hơn.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setScanResult(null);
    setErrorMsg(null);
    setSplitByItems(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirm = () => {
    if (!scanResult) return;

    if (
      splitByItems &&
      scanResult.items &&
      scanResult.items.length > 1 &&
      onApplyTransactions
    ) {
      const batch: TransactionInput[] = scanResult.items
        .filter((item) => item.price > 0)
        .map((item) => ({
          amount: Math.round(item.price),
          date: editDate,
          type: "EXPENSE",
          categoryId: item.suggestedCategoryId || editCategoryId,
          accountId: editAccountId || accounts[0]?.id || "acc_husband_bidv",
          memberId: editMemberId,
          scope: editScope,
          note: `${editMerchant ? editMerchant + ": " : ""}${item.name}`,
        }));
      if (batch.length > 0) {
        onApplyTransactions(batch);
        onClose();
        handleReset();
        return;
      }
    }

    if (onApplyTransactions) {
      onApplyTransactions([
        {
          amount: Math.max(1, editAmount),
          date: editDate,
          type: "EXPENSE",
          categoryId: editCategoryId,
          accountId: editAccountId || accounts[0]?.id || "acc_husband_bidv",
          memberId: editMemberId,
          scope: editScope,
          note: `${editMerchant}${scanResult.notes ? " - " + scanResult.notes : ""}`,
        },
      ]);
    } else {
      onApplyReceipt({
        ...scanResult,
        amount: editAmount,
        date: editDate,
        merchantName: editMerchant,
        suggestedCategoryId: editCategoryId,
      });
    }

    onClose();
    handleReset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#F6F8FB]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                Quét Hóa Đơn Thông Minh
              </h3>
              <p className="text-[11px] text-blue-600 font-semibold">
                Gemini Vision AI · Server-Side OCR
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              handleReset();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {!imagePreview && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-slate-50/70 hover:bg-blue-50/30 transition-all cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                <Camera className="w-7 h-7" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-700">Chụp ảnh hoặc tải hóa đơn lên</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hỗ trợ bóc tách từng món hàng & tách danh mục tự động
                </p>
              </div>
              <button
                type="button"
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all pointer-events-none"
              >
                <Upload className="w-3.5 h-3.5" />
                Chọn ảnh hóa đơn
              </button>
            </div>
          )}

          {imagePreview && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 max-h-48 flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Hóa đơn"
                  className="w-full h-auto object-contain max-h-48 opacity-90"
                />
                {isScanning && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-2xs flex flex-col items-center justify-center text-white gap-2.5 p-4 text-center">
                    <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                    <p className="text-xs font-bold text-slate-100">
                      Gemini Vision AI đang đọc hóa đơn...
                    </p>
                    <p className="text-[10px] text-slate-300">
                      Đang nhận diện số tiền, cửa hàng & tách món hàng
                    </p>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {scanResult && !isScanning && (
                <div className="p-4 bg-slate-50 border border-[#DCE4EE] rounded-xl space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {scanResult.isDemoFallback
                        ? "Bóc tách mẫu offline (chưa gắn GEMINI_API_KEY)"
                        : "Bóc tách thành công bằng AI"}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Tin cậy {Math.round(scanResult.confidence * 100)}%
                    </span>
                  </div>

                  {/* Review & Edit Fields */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Tổng tiền (VNĐ)
                      </label>
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-black text-rose-600 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Ngày phát sinh
                      </label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-700 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Cửa hàng / Nội dung
                      </label>
                      <input
                        type="text"
                        value={editMerchant}
                        onChange={(e) => setEditMerchant(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Danh mục chính
                      </label>
                      <select
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-slate-800 outline-none focus:border-blue-500"
                      >
                        {expenseCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Ví / Thẻ thanh toán
                      </label>
                      <select
                        value={editAccountId}
                        onChange={(e) => setEditAccountId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-slate-800 outline-none focus:border-blue-500"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Thành viên
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => setEditMemberId("HUSBAND")}
                          className={`py-1.5 rounded-lg font-bold border text-[11px] cursor-pointer ${
                            editMemberId === "HUSBAND"
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-600 border-slate-200"
                          }`}
                        >
                          👨 {settings.husbandName}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditMemberId("WIFE")}
                          className={`py-1.5 rounded-lg font-bold border text-[11px] cursor-pointer ${
                            editMemberId === "WIFE"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-slate-600 border-slate-200"
                          }`}
                        >
                          👩 {settings.wifeName}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Phạm vi chi
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => setEditScope("FAMILY")}
                          className={`py-1.5 rounded-lg font-bold border text-[11px] cursor-pointer ${
                            editScope === "FAMILY"
                              ? "bg-blue-50 text-blue-700 border-blue-500"
                              : "bg-white text-slate-600 border-slate-200"
                          }`}
                        >
                          🏠 Chung
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditScope("PERSONAL")}
                          className={`py-1.5 rounded-lg font-bold border text-[11px] cursor-pointer ${
                            editScope === "PERSONAL"
                              ? "bg-purple-50 text-purple-700 border-purple-500"
                              : "bg-white text-slate-600 border-slate-200"
                          }`}
                        >
                          👤 Riêng
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Breakdown & Split Toggle */}
                  {scanResult.items && scanResult.items.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700">
                          Chi tiết món hàng ({scanResult.items.length})
                        </span>
                        {scanResult.items.length > 1 && onApplyTransactions && (
                          <button
                            type="button"
                            onClick={() => setSplitByItems((v) => !v)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                              splitByItems
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-indigo-700 border-indigo-200"
                            }`}
                          >
                            <Split className="w-3 h-3" />
                            <span>{splitByItems ? "Đang tách từng GD" : "Tách theo món"}</span>
                          </button>
                        )}
                      </div>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {scanResult.items.map((item, idx) => {
                          const itemCat = categories.find(
                            (c) => c.id === (item.suggestedCategoryId || editCategoryId)
                          );
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-md border border-slate-200"
                            >
                              <span className="text-slate-700 font-medium truncate pr-2">
                                {item.name}
                                {itemCat && (
                                  <span className="ml-1.5 text-[10px] text-blue-600 font-semibold">
                                    ({itemCat.name})
                                  </span>
                                )}
                              </span>
                              <span className="font-bold text-slate-800 shrink-0">
                                {formatVND(item.price)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {imagePreview ? (
            <>
              <button
                type="button"
                onClick={handleReset}
                disabled={isScanning}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Chụp lại
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!scanResult || isScanning}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {splitByItems && scanResult?.items && scanResult.items.length > 1
                  ? `Lưu ${scanResult.items.length} giao dịch tách món`
                  : "Xác nhận & Lưu giao dịch"}
              </button>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 mx-auto text-center">
              Chụp rõ hóa đơn có số tiền và tên cửa hàng để AI nhận diện chuẩn xác nhất.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
