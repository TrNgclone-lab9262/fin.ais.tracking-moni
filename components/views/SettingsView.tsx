"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Download,
  RotateCcw,
  HardDrive,
  Database,
  RefreshCw,
  Users,
  Lock,
  Tags,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  ArrowRight,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";

interface SettingsViewProps {
  onOpenBackupModal: () => void;
  onOpenResetConfirm: () => void;
}

export function SettingsView({
  onOpenBackupModal,
  onOpenResetConfirm,
}: SettingsViewProps) {
  const {
    isCloudConnected,
    isSyncing,
    lastSyncedAt,
    syncWithCloud,
    settings,
    updateSettings,
    isPrivacyMode,
    togglePrivacyMode,
    categories,
    addCategory,
    deleteCategory,
    setActiveTab,
  } = useFinance();

  const [husbandName, setHusbandName] = useState(settings.husbandName);
  const [wifeName, setWifeName] = useState(settings.wifeName);
  const [splitRatio, setSplitRatio] = useState(settings.sharedSplitRatioHusband ?? 50);
  const [pinInput, setPinInput] = useState(settings.pinCode || "");
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [aiServerReady, setAiServerReady] = useState<boolean | null>(null);

  // Quick Category Form
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [newCatColor, setNewCatColor] = useState("#2563EB");

  useEffect(() => {
    setHusbandName(settings.husbandName);
    setWifeName(settings.wifeName);
    setSplitRatio(settings.sharedSplitRatioHusband ?? 50);
    setPinInput(settings.pinCode || "");
  }, [settings]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.geminiConfigured === "boolean") {
          setAiServerReady(d.geminiConfigured);
        }
      })
      .catch(() => setAiServerReady(false));
  }, []);

  const flashSaved = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 2500);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      husbandName: husbandName.trim() || "Anh Chuột",
      wifeName: wifeName.trim() || "Bé Mèo",
      sharedSplitRatioHusband: Math.min(100, Math.max(0, splitRatio)),
    });
    flashSaved("Đã lưu cấu hình thành viên & tỷ lệ quỹ chung.");
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.replace(/[^0-9]/g, "");
    if (cleaned.length > 0 && cleaned.length !== 4) {
      flashSaved("Mã PIN bảo mật phải gồm đúng 4 chữ số.");
      return;
    }
    updateSettings({ pinCode: cleaned || undefined });
    flashSaved(cleaned ? "Đã bật khóa ứng dụng bằng PIN 4 số." : "Đã tắt khóa mã PIN.");
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory({
      name: newCatName.trim(),
      type: newCatType,
      color: newCatColor,
    });
    setNewCatName("");
    flashSaved("Đã thêm danh mục mới.");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-200">
      {savedToast && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{savedToast}</span>
        </div>
      )}

      {/* 1. Hồ sơ Gia đình & Tỷ lệ Quỹ Chung */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white rounded-xl p-5 sm:p-6 border border-[#DCE4EE] shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#E9EEF5]">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D]">
              Thành Viên Tổ Ấm & Tỷ Lệ Quỹ Chung
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Tùy biến tên gọi hiển thị và tỷ lệ chia khoản chi chung hàng tháng
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Tên thành viên 1 (Chồng)</label>
            <input
              type="text"
              value={husbandName}
              onChange={(e) => setHusbandName(e.target.value)}
              className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-sm font-semibold text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Tên thành viên 2 (Vợ)</label>
            <input
              type="text"
              value={wifeName}
              onChange={(e) => setWifeName(e.target.value)}
              className="w-full bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-sm font-semibold text-slate-800"
            />
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-[#E9EEF5] rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Tỷ lệ chia chi tiêu chung (My Home)</span>
            <span className="text-blue-600">
              {husbandName}: {splitRatio}% · {wifeName}: {100 - splitRatio}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={splitRatio}
            onChange={(e) => setSplitRatio(parseInt(e.target.value, 10))}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
          >
            Lưu hồ sơ gia đình
          </button>
        </div>
      </form>

      {/* 2. Bảo mật & Quyền riêng tư */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-[#DCE4EE] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D]">
                Quyền Riêng Tư & Khóa PIN
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Che số tiền nhạy cảm khi mở nơi công cộng hoặc đặt PIN 4 số
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={togglePrivacyMode}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
              isPrivacyMode
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
          >
            {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{isPrivacyMode ? "Đang ẩn số tiền" : "Đang hiện số tiền"}</span>
          </button>
        </div>

        <form onSubmit={handleSavePin} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            placeholder="Nhập PIN 4 số (để trống để tắt)"
            className="flex-1 bg-slate-50 border border-[#DCE4EE] rounded-lg px-3.5 py-2 text-sm font-bold tracking-widest"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
          >
            {pinInput ? "Cập nhật PIN" : "Tắt khóa PIN"}
          </button>
        </form>
      </div>

      {/* 3. Quản lý Danh mục nhanh */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-[#DCE4EE] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Tags className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D]">
                Danh Mục Thu / Chi ({categories.length})
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Thêm nhanh danh mục mới hoặc mở Data Studio để chỉnh sửa chuyên sâu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab("data_admin")}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
          >
            <span>Mở Quản trị Dữ liệu</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleAddCategory} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Tên danh mục mới..."
            className="flex-1 min-w-[160px] bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-xs font-semibold"
          />
          <select
            value={newCatType}
            onChange={(e) => setNewCatType(e.target.value as "EXPENSE" | "INCOME")}
            className="bg-slate-50 border border-[#DCE4EE] rounded-lg px-3 py-2 text-xs font-semibold"
          >
            <option value="EXPENSE">Chi tiêu</option>
            <option value="INCOME">Thu nhập</option>
          </select>
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            className="w-10 h-9 rounded-lg border border-[#DCE4EE] cursor-pointer"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm</span>
          </button>
        </form>

        <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pt-1">
          {categories.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700"
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
              <span>{cat.name}</span>
              {!cat.isDefault && (
                <button
                  type="button"
                  onClick={() => deleteCategory(cat.id)}
                  title="Xóa danh mục"
                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* 4. Trạng thái Lưu trữ, AI Server & Sao lưu */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-[#DCE4EE] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D]">
                Lưu Trữ & Kết Nối Hệ Thống
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Offline-First LocalStorage (<code className="font-mono text-blue-600">HOME_MONI_DATA_V4</code>)
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
              isCloudConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {isCloudConnected ? "Cloud Sync Active" : "Local-First Active"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-[#E9EEF5] rounded-lg flex items-center justify-between">
            <span className="font-semibold text-slate-600">Dịch vụ AI Server (/api/ai)</span>
            <span
              className={`font-bold ${
                aiServerReady ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {aiServerReady === null
                ? "Đang kiểm tra..."
                : aiServerReady
                ? "Gemini AI Sẵn sàng"
                : "Chế độ Heuristic Offline"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-[#E9EEF5] rounded-lg flex items-center justify-between">
            <span className="font-semibold text-slate-600">Đồng bộ đám mây</span>
            {isCloudConnected ? (
              <button
                type="button"
                onClick={() => syncWithCloud()}
                disabled={isSyncing}
                className="inline-flex items-center gap-1 text-emerald-700 font-bold cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{lastSyncedAt ? lastSyncedAt.toLocaleTimeString("vi-VN") : "Đồng bộ"}</span>
              </button>
            ) : (
              <span className="text-slate-500 font-semibold">Lưu cục bộ an toàn</span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            onClick={onOpenBackupModal}
            className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Sao lưu / Phục hồi JSON</span>
          </button>

          <button
            onClick={onOpenResetConfirm}
            className="flex-1 py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <span>Nạp lại dữ liệu mẫu Demo</span>
          </button>
        </div>

        <div className="pt-2 border-t border-[#E9EEF5] flex items-center gap-2 text-[11px] text-slate-500">
          <HardDrive className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>
            Mọi dữ liệu giao dịch và số dư được kiểm toán Event Sourcing trên thiết bị của {settings.husbandName} & {settings.wifeName}.
          </span>
        </div>
      </div>
    </div>
  );
}
