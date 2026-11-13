"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Smartphone,
  Sparkles,
  FileText,
  WifiOff,
  ChevronDown,
  ChevronUp,
  ScanFace,
  ImagePlus,
  KeyRound,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { usePWAUpdate } from "@/context/PWAUpdateContext";
import { formatCheckTimestamp } from "@/constants/appVersion";
import { AuthMemberId } from "@/types/finance";
import {
  checkBiometricAvailability,
  compressDeviceWallpaper,
  getMemberAuthConfig,
  hasMemberPasscode,
  loadMemberWallpapers,
  MemberWallpaperMap,
  registerMemberBiometric,
  removeMemberWallpaper,
  saveMemberWallpaper,
  BiometricAvailability,
} from "@/lib/authSecurity";

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
    setMemberPasscode,
    clearMemberPasscode,
    updateMemberAuthConfig,
    lockApp,
    hasPasscodeProtection,
  } = useFinance();

  const {
    status: pwaStatus,
    currentVersion,
    currentReleaseDate,
    latestRelease,
    lastCheckedAt,
    isChecking,
    hasUpdate,
    isStandalone,
    platform,
    isOnline,
    errorMessage,
    checkForUpdate,
    applyUpdateNow,
    openReleaseNotes,
  } = usePWAUpdate();

  const [husbandName, setHusbandName] = useState(settings.husbandName);
  const [wifeName, setWifeName] = useState(settings.wifeName);
  const [splitRatio, setSplitRatio] = useState(settings.sharedSplitRatioHusband ?? 50);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [aiServerReady, setAiServerReady] = useState<boolean | null>(null);
  const [showMobileUpdateGuide, setShowMobileUpdateGuide] = useState(false);

  // /login & Lock Screen Security state per member
  const [securityMember, setSecurityMember] = useState<AuthMemberId>(
    settings.authActiveProfile || "HUSBAND"
  );
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeConfirm, setPasscodeConfirm] = useState("");
  const [wallpapers, setWallpapers] = useState<MemberWallpaperMap>({});
  const [bioAvailability, setBioAvailability] = useState<BiometricAvailability>({
    supported: false,
    platformAuthenticatorAvailable: false,
  });
  const [isBioBusy, setIsBioBusy] = useState(false);
  const [isUploadingWallpaper, setIsUploadingWallpaper] = useState(false);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  // Quick Category Form
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [newCatColor, setNewCatColor] = useState("#2563EB");

  useEffect(() => {
    setHusbandName(settings.husbandName);
    setWifeName(settings.wifeName);
    setSplitRatio(settings.sharedSplitRatioHusband ?? 50);
  }, [settings]);

  useEffect(() => {
    setWallpapers(loadMemberWallpapers());
    void checkBiometricAvailability().then(setBioAvailability);
  }, []);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          const ready =
            typeof d.aiConfigured === "boolean"
              ? d.aiConfigured
              : typeof d.geminiConfigured === "boolean"
              ? d.geminiConfigured
              : false;
          setAiServerReady(ready);
        }
      })
      .catch(() => setAiServerReady(false));
  }, []);

  const flashSaved = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 2800);
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

  const activeSecurityConfig = getMemberAuthConfig(settings, securityMember);
  const activeSecurityName =
    securityMember === "HUSBAND" ? settings.husbandName : settings.wifeName;
  const activeMemberHasCode = hasMemberPasscode(settings, securityMember);
  const activeMemberWallpaper = wallpapers[securityMember];

  const handleSaveMemberPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = passcodeInput.replace(/[^0-9]/g, "");
    if (!/^\d{4,6}$/.test(cleaned)) {
      flashSaved("Mã Code bảo mật phải gồm 4 đến 6 chữ số.");
      return;
    }
    if (passcodeConfirm && cleaned !== passcodeConfirm.replace(/[^0-9]/g, "")) {
      flashSaved("Mã Code xác nhận chưa khớp.");
      return;
    }
    await setMemberPasscode(securityMember, cleaned);
    setPasscodeInput("");
    setPasscodeConfirm("");
    flashSaved(`Đã cập nhật mã Code ${cleaned.length} số cho ${activeSecurityName}.`);
  };

  const handleClearMemberPasscode = () => {
    clearMemberPasscode(securityMember);
    setPasscodeInput("");
    setPasscodeConfirm("");
    flashSaved(`Đã gỡ mã Code cho ${activeSecurityName}.`);
  };

  const handleToggleBiometric = async () => {
    if (activeSecurityConfig.webauthnCredentialId) {
      updateMemberAuthConfig(securityMember, {
        webauthnCredentialId: undefined,
        webauthnDeviceLabel: undefined,
      });
      flashSaved(`Đã tắt Face ID trên thiết bị này cho ${activeSecurityName}.`);
      return;
    }

    setIsBioBusy(true);
    try {
      const result = await registerMemberBiometric(securityMember, activeSecurityName);
      if (result.success && result.credentialId) {
        updateMemberAuthConfig(securityMember, {
          webauthnCredentialId: result.credentialId,
          webauthnDeviceLabel: result.deviceLabel || "Face ID / Sinh trắc học",
        });
        flashSaved(`Đã kích hoạt ${result.deviceLabel || "Face ID"} cho ${activeSecurityName}.`);
      } else {
        flashSaved(result.error || "Chưa kích hoạt được Face ID.");
      }
    } finally {
      setIsBioBusy(false);
    }
  };

  const handleUploadWallpaper = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingWallpaper(true);
    try {
      const dataUrl = await compressDeviceWallpaper(file);
      const saved = saveMemberWallpaper(securityMember, dataUrl);
      if (saved) {
        setWallpapers(loadMemberWallpapers());
        flashSaved(`Đã cập nhật ảnh nền màn hình khóa riêng cho ${activeSecurityName}.`);
      } else {
        flashSaved("Bộ nhớ trình duyệt đã đầy, hãy thử ảnh nhẹ hơn.");
      }
    } catch (err) {
      flashSaved(err instanceof Error ? err.message : "Không thể xử lý ảnh này.");
    } finally {
      setIsUploadingWallpaper(false);
      if (wallpaperInputRef.current) {
        wallpaperInputRef.current.value = "";
      }
    }
  };

  const handleRemoveWallpaper = () => {
    removeMemberWallpaper(securityMember);
    setWallpapers(loadMemberWallpapers());
    flashSaved(`Đã khôi phục nền Calm Slate mặc định cho ${activeSecurityName}.`);
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

      {/* 2. Phiên bản & Cập nhật PWA Di động */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-[#DCE4EE] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E9EEF5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D]">
                Phiên Bản & Cập Nhật Ứng Dụng
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                v{currentVersion} · Phát hành {currentReleaseDate} ·{" "}
                {isStandalone ? "Chế độ PWA đã cài đặt" : "Trình duyệt Web"}
              </p>
            </div>
          </div>

          <span
            className={`text-xs font-bold ${
              hasUpdate
                ? "text-blue-600"
                : !isOnline || pwaStatus === "OFFLINE"
                ? "text-amber-600"
                : pwaStatus === "ERROR"
                ? "text-rose-600"
                : "text-emerald-600"
            }`}
          >
            {hasUpdate
              ? `Có bản mới v${latestRelease?.version}`
              : !isOnline || pwaStatus === "OFFLINE"
              ? "Đang ngoại tuyến"
              : pwaStatus === "CHECKING"
              ? "Đang kiểm tra..."
              : "Đang ở bản mới nhất"}
          </span>
        </div>

        {/* Thẻ trạng thái bản mới hoặc kiểm tra gần nhất */}
        {hasUpdate && latestRelease ? (
          <div className="p-3.5 rounded-xl bg-blue-50/90 border border-blue-200 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-extrabold text-[#1E3A8A]">
                  Phiên bản v{latestRelease.version} đã sẵn sàng cài đặt
                </div>
                <p className="text-xs text-slate-700 font-medium">{latestRelease.title}</p>
                <ul className="space-y-1 pt-0.5">
                  {latestRelease.highlights.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-50 border border-[#E9EEF5] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-medium">
              {!isOnline || pwaStatus === "OFFLINE" ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              ) : (
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
              <span>
                {errorMessage ||
                  "Ứng dụng tự kiểm tra bản mới mỗi khi bạn mở lại từ màn hình chính."}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-semibold">
              Kiểm tra: {formatCheckTimestamp(lastCheckedAt)}
            </span>
          </div>
        )}

        {/* Hàng nút thao tác (>= 44px cho mobile thumb-zone) */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          {hasUpdate && (
            <button
              type="button"
              onClick={() => void applyUpdateNow()}
              disabled={pwaStatus === "UPDATING"}
              className="min-h-[44px] flex-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              <RefreshCw
                className={`w-4 h-4 ${pwaStatus === "UPDATING" ? "animate-spin" : ""}`}
              />
              <span>
                {pwaStatus === "UPDATING" ? "Đang cài bản mới..." : "Cập nhật ngay (1 chạm)"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void checkForUpdate({ silent: false })}
            disabled={isChecking || pwaStatus === "UPDATING"}
            className="min-h-[44px] flex-1 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-[#DCE4EE] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${isChecking ? "animate-spin" : ""}`} />
            <span>{isChecking ? "Đang dò bản mới..." : "Kiểm tra cập nhật"}</span>
          </button>

          <button
            type="button"
            onClick={openReleaseNotes}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-[#DCE4EE] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Xem thay đổi</span>
          </button>
        </div>

        {/* Hướng dẫn nhận cập nhật trên điện thoại Android & iPhone */}
        <div className="border-t border-[#E9EEF5] pt-3">
          <button
            type="button"
            onClick={() => setShowMobileUpdateGuide((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-blue-600 cursor-pointer py-1"
          >
            <span>
              Hướng dẫn nhận thông báo & cài bản mới trên{" "}
              {platform === "ios" ? "iPhone / iPad" : platform === "android" ? "Android" : "điện thoại"}
            </span>
            {showMobileUpdateGuide ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showMobileUpdateGuide && (
            <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 border border-[#E9EEF5] space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong>1. Tự động khi mở app:</strong> Mỗi lần bạn mở HOME MONI từ biểu tượng màn hình chính (hoặc quay lại từ đa nhiệm), ứng dụng âm thầm đối chiếu phiên bản mới nhất trên máy chủ.
              </p>
              <p>
                <strong>2. Cài đặt 1 chạm không mất dữ liệu:</strong> Khi có bản mới, thanh thông báo xanh xuất hiện ngay phía trên. Chạm <strong>Cập nhật ngay</strong> để nạp giao diện mới trong 1 giây — toàn bộ giao dịch & mã PIN trong máy được giữ nguyên.
              </p>
              <p>
                <strong>3. Mẹo riêng trên iPhone (iOS Safari PWA):</strong> Nếu để app chạy ngầm nhiều ngày mà chưa thấy nhắc, bạn chỉ cần vào <strong>Cài đặt → Kiểm tra cập nhật</strong> hoặc vuốt đóng hẳn cửa sổ app rồi mở lại là nhận ngay.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Trang /login, Bảo mật 2 Vợ Chồng, Face ID & Hình Nền Cá Nhân */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-[#DCE4EE] shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-[#E9EEF5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D]">
                Màn Hình Khóa /login, Face ID & Ảnh Nền Riêng
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Thiết lập mã Code 4–6 số, Face ID và hình nền màn hình khóa riêng cho từng người
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              <span>{isPrivacyMode ? "Đang ẩn số tiền" : "Ẩn số tiền"}</span>
            </button>

            <button
              type="button"
              onClick={lockApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-800 text-white text-xs font-bold cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Mở /login ngay</span>
            </button>
          </div>
        </div>

        {/* Bộ chọn hồ sơ cần tùy chỉnh */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-[#E9EEF5]">
          {(
            [
              { id: "HUSBAND" as AuthMemberId, emoji: "👨", label: settings.husbandName },
              { id: "WIFE" as AuthMemberId, emoji: "👩", label: settings.wifeName },
            ] as const
          ).map((item) => {
            const isActive = securityMember === item.id;
            const configured = hasMemberPasscode(settings, item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSecurityMember(item.id);
                  setPasscodeInput("");
                  setPasscodeConfirm("");
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-[#1E3A8A] shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>{item.emoji}</span>
                <span className="truncate">{item.label}</span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    configured ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  title={configured ? "Đã đặt mã Code" : "Chưa đặt mã Code"}
                />
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cột trái: Mã Code 4-6 số & Face ID */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-[#E9EEF5] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#172B4D] flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-blue-600" />
                Mã Code ({activeSecurityName})
              </span>
              <span
                className={`text-[11px] font-bold ${
                  activeMemberHasCode ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {activeMemberHasCode ? "Đã mã hóa SHA-256" : "Chưa đặt mã"}
              </span>
            </div>

            <form onSubmit={handleSaveMemberPasscode} className="space-y-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={passcodeInput}
                onChange={(e) =>
                  setPasscodeInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                }
                placeholder="Nhập mã Code mới (4–6 số)"
                className="w-full bg-white border border-[#DCE4EE] rounded-lg px-3 py-2 text-xs font-bold tracking-[0.25em] outline-none focus:border-blue-600"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={passcodeConfirm}
                onChange={(e) =>
                  setPasscodeConfirm(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                }
                placeholder="Xác nhận lại mã Code"
                className="w-full bg-white border border-[#DCE4EE] rounded-lg px-3 py-2 text-xs font-bold tracking-[0.25em] outline-none focus:border-blue-600"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  {activeMemberHasCode ? "Đổi mã Code" : "Kích hoạt mã Code"}
                </button>
                {activeMemberHasCode && (
                  <button
                    type="button"
                    onClick={handleClearMemberPasscode}
                    className="min-h-[40px] px-3 py-2 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-[#DCE4EE] text-xs font-bold cursor-pointer"
                  >
                    Gỡ mã
                  </button>
                )}
              </div>
            </form>

            {/* Face ID / WebAuthn */}
            <div className="pt-3 border-t border-[#E9EEF5] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#172B4D] flex items-center gap-1.5">
                  <ScanFace className="w-4 h-4 text-emerald-600" />
                  Face ID / Sinh trắc học
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {activeSecurityConfig.webauthnCredentialId
                    ? activeSecurityConfig.webauthnDeviceLabel || "Đã liên kết"
                    : "Chưa liên kết"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleToggleBiometric()}
                disabled={isBioBusy || (!bioAvailability.supported && !activeSecurityConfig.webauthnCredentialId)}
                className={`w-full min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60 ${
                  activeSecurityConfig.webauthnCredentialId
                    ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                    : "bg-white hover:bg-slate-100 text-slate-800 border border-[#DCE4EE]"
                }`}
              >
                <ScanFace className="w-4 h-4" />
                <span>
                  {isBioBusy
                    ? "Đang xác nhận cảm biến..."
                    : activeSecurityConfig.webauthnCredentialId
                    ? "Đang bật Face ID (Chạm để tắt)"
                    : "Đăng ký Face ID trên thiết bị này"}
                </span>
              </button>

              {!bioAvailability.platformAuthenticatorAvailable && (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {bioAvailability.reason ||
                    "Thiết bị này sẽ tự dùng mã Code dự phòng 4–6 số khi mở khóa."}
                </p>
              )}
            </div>
          </div>

          {/* Cột phải: Hình nền màn hình khóa cá nhân */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-[#E9EEF5] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#172B4D] flex items-center gap-1.5">
                <ImagePlus className="w-4 h-4 text-indigo-600" />
                Hình Nền Khóa ({activeSecurityName})
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {activeMemberWallpaper ? "Ảnh cá nhân" : "Mặc định"}
              </span>
            </div>

            <div className="relative h-32 rounded-xl overflow-hidden border border-[#DCE4EE] bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#1D4ED8]">
              {activeMemberWallpaper && (
                <img
                  src={activeMemberWallpaper}
                  alt={`Ảnh nền ${activeSecurityName}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    filter: `blur(${activeSecurityConfig.wallpaperBlur ?? 6}px)`,
                    transform: "scale(1.06)",
                  }}
                />
              )}
              <div
                className="absolute inset-0 bg-slate-950"
                style={{ opacity: (activeSecurityConfig.wallpaperDim ?? 45) / 100 }}
              />
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-white text-center px-3">
                <span className="text-xs font-extrabold">{activeSecurityName}</span>
                <span className="text-[10px] text-white/75 mt-0.5">
                  Xem trước độ mờ {activeSecurityConfig.wallpaperBlur ?? 6}px · Tối{" "}
                  {activeSecurityConfig.wallpaperDim ?? 45}%
                </span>
              </div>
            </div>

            <input
              ref={wallpaperInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleUploadWallpaper(e)}
              className="hidden"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => wallpaperInputRef.current?.click()}
                disabled={isUploadingWallpaper}
                className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-[#DCE4EE] text-xs font-bold text-slate-800 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ImagePlus className="w-4 h-4 text-blue-600" />
                <span>{isUploadingWallpaper ? "Đang tối ưu..." : "Chọn ảnh từ máy"}</span>
              </button>

              {activeMemberWallpaper && (
                <button
                  type="button"
                  onClick={handleRemoveWallpaper}
                  className="min-h-[40px] px-3 py-2 rounded-lg bg-white hover:bg-rose-50 border border-[#DCE4EE] text-xs font-bold text-rose-600 cursor-pointer"
                >
                  Xóa ảnh
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                  <span>Độ mờ</span>
                  <span>{activeSecurityConfig.wallpaperBlur ?? 6}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={activeSecurityConfig.wallpaperBlur ?? 6}
                  onChange={(e) =>
                    updateMemberAuthConfig(securityMember, {
                      wallpaperBlur: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                  <span>Độ tối phủ</span>
                  <span>{activeSecurityConfig.wallpaperDim ?? 45}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={75}
                  step={5}
                  value={activeSecurityConfig.wallpaperDim ?? 45}
                  onChange={(e) =>
                    updateMemberAuthConfig(securityMember, {
                      wallpaperDim: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tùy chọn tự động khóa phiên */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E9EEF5] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <label className="flex items-center justify-between sm:justify-start gap-2.5 cursor-pointer font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(settings.requireAuthOnOpen ?? hasPasscodeProtection)}
              onChange={(e) => updateSettings({ requireAuthOnOpen: e.target.checked })}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <span>Hỏi mã khi vừa mở app</span>
          </label>

          <label className="flex items-center justify-between sm:justify-start gap-2.5 cursor-pointer font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(settings.lockOnBackground)}
              onChange={(e) => updateSettings({ lockOnBackground: e.target.checked })}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <span>Khóa khi thu gọn nền</span>
          </label>

          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">Tự khóa khi rảnh:</span>
            <select
              value={settings.autoLockMinutes ?? 5}
              onChange={(e) =>
                updateSettings({ autoLockMinutes: parseInt(e.target.value, 10) })
              }
              className="bg-white border border-[#DCE4EE] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
            >
              <option value={0}>Không tự khóa</option>
              <option value={1}>1 phút</option>
              <option value={5}>5 phút</option>
              <option value={15}>15 phút</option>
            </select>
          </div>
        </div>
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
