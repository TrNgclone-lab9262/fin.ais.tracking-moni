"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Lock,
  ScanFace,
  ImagePlus,
  Trash2,
  Delete,
  Check,
  ShieldCheck,
  ArrowRight,
  SlidersHorizontal,
  X,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { AuthMemberId } from "@/types/finance";
import {
  BiometricAvailability,
  MemberWallpaperMap,
  checkBiometricAvailability,
  compressDeviceWallpaper,
  getMemberAuthConfig,
  hasAnyAppPasscode,
  isValidPasscodeFormat,
  loadMemberWallpapers,
  registerMemberBiometric,
  removeMemberWallpaper,
  saveMemberWallpaper,
  verifyMemberBiometric,
} from "@/lib/authSecurity";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function formatLiveClock(date: Date): string {
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLiveDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function LoginGateView() {
  const {
    settings,
    hasPasscodeProtection,
    unlockWithPasscode,
    unlockWithBiometricSuccess,
    setMemberPasscode,
    updateMemberAuthConfig,
    bypassLockForFirstSetup,
  } = useFinance();

  const [selectedMember, setSelectedMember] = useState<AuthMemberId>(
    settings.authActiveProfile || "HUSBAND"
  );
  const [wallpapers, setWallpapers] = useState<MemberWallpaperMap>({});
  const [now, setNow] = useState<Date>(() => new Date());

  // Keypad & Auth state
  const [codeInput, setCodeInput] = useState("");
  const [setupConfirmCode, setSetupConfirmCode] = useState("");
  const [isSetupStepConfirm, setIsSetupStepConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [switchPerspectiveOnUnlock, setSwitchPerspectiveOnUnlock] = useState(true);

  // Biometric capability
  const [bioAvailability, setBioAvailability] = useState<BiometricAvailability>({
    supported: false,
    platformAuthenticatorAvailable: false,
  });
  const [isBioBusy, setIsBioBusy] = useState(false);

  // Wallpaper Customizer Modal/Drawer
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memberName =
    selectedMember === "HUSBAND" ? settings.husbandName : settings.wifeName;
  const memberConfig = getMemberAuthConfig(settings, selectedMember);
  const activeWallpaper = wallpapers[selectedMember];
  const wallpaperBlur = memberConfig.wallpaperBlur ?? 4;
  const wallpaperDim = memberConfig.wallpaperDim ?? 55;
  const isLockedMode = hasPasscodeProtection || hasAnyAppPasscode(settings);
  const hasBiometricRegistered = Boolean(memberConfig.webauthnCredentialId);

  useEffect(() => {
    setWallpapers(loadMemberWallpapers());
    void checkBiometricAvailability().then(setBioAvailability);
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Countdown cooldown khi nhập sai 5 lần
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          setFailedCount(0);
          setAuthError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockoutRemaining]);

  const handleSelectMember = (member: AuthMemberId) => {
    setSelectedMember(member);
    setCodeInput("");
    setSetupConfirmCode("");
    setIsSetupStepConfirm(false);
    setAuthError(null);
    setAuthInfo(null);
  };

  const handleVerifyCode = useCallback(
    async (candidateCode: string) => {
      if (lockoutRemaining > 0 || isSubmitting) return;
      if (!isValidPasscodeFormat(candidateCode)) {
        setAuthError("Mã Code đăng nhập cần từ 4 đến 6 chữ số.");
        return;
      }

      setIsSubmitting(true);
      setAuthError(null);

      try {
        if (!isLockedMode) {
          // Chế độ thiết lập mã lần đầu ngay tại /login
          if (!isSetupStepConfirm) {
            setSetupConfirmCode(candidateCode);
            setCodeInput("");
            setIsSetupStepConfirm(true);
            setAuthInfo("Nhập lại mã Code vừa tạo để xác nhận.");
            setIsSubmitting(false);
            return;
          }
          if (candidateCode !== setupConfirmCode) {
            setAuthError("Mã xác nhận chưa khớp. Vui lòng nhập lại từ đầu.");
            setCodeInput("");
            setSetupConfirmCode("");
            setIsSetupStepConfirm(false);
            setIsSubmitting(false);
            return;
          }
          await setMemberPasscode(selectedMember, candidateCode);
          unlockWithBiometricSuccess(selectedMember, switchPerspectiveOnUnlock);
          return;
        }

        const ok = await unlockWithPasscode(selectedMember, candidateCode);
        if (ok) {
          if (switchPerspectiveOnUnlock) {
            unlockWithBiometricSuccess(selectedMember, true);
          }
          setFailedCount(0);
          setCodeInput("");
        } else {
          const nextFailed = failedCount + 1;
          setFailedCount(nextFailed);
          setCodeInput("");
          if (nextFailed >= MAX_FAILED_ATTEMPTS) {
            setLockoutRemaining(LOCKOUT_SECONDS);
            setAuthError(
              `Nhập sai ${MAX_FAILED_ATTEMPTS} lần. Vui lòng chờ ${LOCKOUT_SECONDS} giây.`
            );
          } else {
            setAuthError(
              `Mã Code chưa đúng (còn ${MAX_FAILED_ATTEMPTS - nextFailed} lần thử).`
            );
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      failedCount,
      isLockedMode,
      isSetupStepConfirm,
      isSubmitting,
      lockoutRemaining,
      selectedMember,
      setMemberPasscode,
      setupConfirmCode,
      switchPerspectiveOnUnlock,
      unlockWithBiometricSuccess,
      unlockWithPasscode,
    ]
  );

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (lockoutRemaining > 0 || isSubmitting) return;
      setAuthError(null);
      setCodeInput((prev) => {
        if (prev.length >= 6) return prev;
        const next = prev + digit;
        // Tự động xác thực ngay khi đủ 4 số nếu mã cũ 4 số, hoặc chờ bấm Xác nhận nếu dùng 4-6 số
        return next;
      });
    },
    [isSubmitting, lockoutRemaining]
  );

  const handleBackspace = useCallback(() => {
    setAuthError(null);
    setCodeInput((prev) => prev.slice(0, -1));
  }, []);

  // Hỗ trợ gõ bàn phím vật lý trên Desktop/Tablet
  useEffect(() => {
    if (isWallpaperModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) {
        handleDigitPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Enter" && codeInput.length >= 4) {
        void handleVerifyCode(codeInput);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [codeInput, handleBackspace, handleDigitPress, handleVerifyCode, isWallpaperModalOpen]);

  const handleBiometricUnlock = async () => {
    if (isBioBusy || lockoutRemaining > 0) return;
    setAuthError(null);
    setAuthInfo(null);

    if (!memberConfig.webauthnCredentialId) {
      setAuthInfo(
        `Hồ sơ ${memberName} chưa đăng ký Face ID trên máy này. Hãy bấm "Đăng ký Face ID" bên dưới hoặc dùng mã Code.`
      );
      return;
    }

    setIsBioBusy(true);
    try {
      const res = await verifyMemberBiometric(memberConfig.webauthnCredentialId);
      if (res.success) {
        unlockWithBiometricSuccess(selectedMember, switchPerspectiveOnUnlock);
      } else {
        setAuthError(res.error || "Không xác thực được Face ID. Hãy nhập mã Code.");
      }
    } finally {
      setIsBioBusy(false);
    }
  };

  const handleRegisterBiometric = async () => {
    if (isBioBusy) return;
    setIsBioBusy(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      const res = await registerMemberBiometric(selectedMember, memberName);
      if (res.success && res.credentialId) {
        updateMemberAuthConfig(selectedMember, {
          webauthnCredentialId: res.credentialId,
          webauthnDeviceLabel: res.deviceLabel,
        });
        setAuthInfo(`Đã kích hoạt ${res.deviceLabel || "Face ID"} cho ${memberName}.`);
      } else {
        setAuthError(res.error || "Chưa đăng ký được sinh trắc học trên thiết bị này.");
      }
    } finally {
      setIsBioBusy(false);
    }
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImage(true);
    setAuthError(null);
    try {
      const dataUrl = await compressDeviceWallpaper(file);
      const saved = saveMemberWallpaper(selectedMember, dataUrl);
      if (saved) {
        setWallpapers((prev) => ({ ...prev, [selectedMember]: dataUrl }));
        setAuthInfo(`Đã cập nhật hình nền riêng cho ${memberName}.`);
      } else {
        setAuthError("Bộ nhớ trình duyệt không đủ dung lượng cho ảnh này.");
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Không thể tải ảnh lên.");
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveWallpaper = () => {
    removeMemberWallpaper(selectedMember);
    setWallpapers((prev) => {
      const next = { ...prev };
      delete next[selectedMember];
      return next;
    });
    setAuthInfo(`Đã đưa hình nền của ${memberName} về mặc định.`);
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden flex flex-col justify-between bg-[#0F172A] text-white select-none pt-safe pb-safe">
      {/* 1. Hậu cảnh Hình nền Cá nhân (từ thư viện thiết bị của từng người) hoặc Calm Slate Gradient */}
      {activeWallpaper ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-cover bg-center transition-all duration-500 scale-105"
          style={{
            backgroundImage: `url(${activeWallpaper})`,
            filter: `blur(${wallpaperBlur}px)`,
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#0B193C]"
        />
      )}

      {/* Lớp phủ Scrim đảm bảo độ tương phản WCAG AA (>= 4.5:1) trên mọi ảnh sáng/tối */}
      <div
        aria-hidden="true"
        className="fixed inset-0 transition-opacity duration-300"
        style={{
          background: `linear-gradient(180deg, rgba(15,23,42,${
            Math.max(0.35, wallpaperDim / 100 - 0.1)
          }) 0%, rgba(15,23,42,${Math.min(0.92, wallpaperDim / 100 + 0.25)}) 100%)`,
        }}
      />

      {/* Input file ẩn để chọn ảnh cá nhân từ thư viện điện thoại / máy tính */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleWallpaperUpload}
        className="hidden"
        aria-label="Chọn ảnh nền từ thư viện thiết bị"
      />

      {/* 2. Thanh trên cùng gọn gàng, tối ưu notch / Dynamic Island */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-1 sm:pt-3 pb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-sm">
            <Lock className="w-4 h-4 text-sky-200" />
          </div>
          <div>
            <span className="font-black tracking-wider text-xs sm:text-base block leading-none">
              HOME MONI
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-300 font-medium">
              Bảo mật tài chính tổ ấm
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsWallpaperModalOpen(true)}
          className="min-h-[40px] sm:min-h-[44px] px-3 sm:px-3.5 py-1.5 rounded-2xl bg-white/12 hover:bg-white/20 active:scale-95 backdrop-blur-md border border-white/20 text-[11px] sm:text-xs font-bold text-white inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          <ImagePlus className="w-4 h-4 text-sky-200" />
          <span className="truncate max-w-[120px] sm:max-w-none">Nền {memberName}</span>
        </button>
      </header>

      {/* 3. Nội dung chính: Desktop 2 cột cân đối | iPhone / Mobile fit 1 màn hình không cần cuộn */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-8 py-1.5 sm:py-4 flex flex-col justify-center">
        <div className="w-full max-w-[430px] lg:max-w-none mx-auto flex flex-col lg:grid lg:grid-cols-12 gap-2.5 sm:gap-5 lg:gap-8 items-stretch">
          {/* Mobile Compact Status Strip (< lg) */}
          <section className="lg:hidden rounded-2xl bg-slate-900/45 backdrop-blur-md border border-white/15 px-3.5 py-2 flex items-center justify-between gap-3 shadow-lg">
            <div className="text-xl sm:text-2xl font-black tracking-tight tabular-nums text-white leading-none">
              {formatLiveClock(now)}
            </div>
            <div className="text-right min-w-0">
              <p className="text-xs font-bold text-sky-200 truncate">
                {getTimeGreeting()}, {memberName}
              </p>
              <p className="text-[10px] text-slate-200/80 capitalize truncate">
                {formatLiveDate(now)}
              </p>
            </div>
          </section>

          {/* Desktop Showcase Card (>= lg) */}
          <section className="hidden lg:flex lg:col-span-6 flex-col justify-between rounded-3xl bg-slate-900/35 backdrop-blur-md border border-white/15 p-8 shadow-2xl">
            <div className="space-y-2 text-left">
              <p className="text-sm font-semibold text-sky-200">
                {getTimeGreeting()}, {memberName}
              </p>
              <div className="text-6xl font-black tracking-tight tabular-nums text-white">
                {formatLiveClock(now)}
              </div>
              <p className="text-sm text-slate-200/90 capitalize">
                {formatLiveDate(now)}
              </p>
            </div>

            <div className="space-y-4 my-8">
              <div className="p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>Không gian riêng tư hai vợ chồng</span>
                </div>
                <p className="text-xs text-slate-200/90 leading-relaxed">
                  Mỗi thành viên có thể tự tải ảnh kỷ niệm từ thiết bị làm màn hình khóa riêng, mở khóa nhanh bằng Face ID hoặc mã Code bảo mật trước khi ghi chép giao dịch.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/15 text-xs text-slate-300">
              <span>
                Ảnh nền:{" "}
                <strong className="text-white">
                  {activeWallpaper ? "Ảnh cá nhân từ thiết bị" : "Mặc định Calm Slate"}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-bold text-sky-300 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                Tải ảnh mới từ máy
              </button>
            </div>
          </section>

          {/* Thẻ Xác Thực Bo Góc Hiện Đại (Chọn Hồ Sơ + Bàn phím số + Face ID) */}
          <section className="lg:col-span-6 rounded-3xl bg-white/95 dark:bg-slate-900/95 text-[#172B4D] dark:text-slate-100 backdrop-blur-xl border border-white/50 dark:border-slate-700/80 p-4 sm:p-6 shadow-2xl flex flex-col justify-between gap-3 sm:gap-4">
            {/* Bộ chuyển đổi hồ sơ Anh Chuột / Bé Mèo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold">
                <span>Hồ sơ đăng nhập</span>
                <span>
                  {isLockedMode
                    ? isSetupStepConfirm
                      ? "Xác nhận lại mã Code"
                      : "Yêu cầu xác thực"
                    : "Thiết lập bảo vệ lần đầu"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleSelectMember("HUSBAND")}
                  className={`min-h-[44px] rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedMember === "HUSBAND"
                      ? "bg-[#1E3A8A] text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span aria-hidden="true">👨</span>
                  <span className="truncate">{settings.husbandName}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectMember("WIFE")}
                  className={`min-h-[44px] rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedMember === "WIFE"
                      ? "bg-[#1E3A8A] text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span aria-hidden="true">👩</span>
                  <span className="truncate">{settings.wifeName}</span>
                </button>
              </div>
            </div>

            {/* Hiển thị chấm mã Code 4-6 số */}
            <div className="space-y-2">
              <div className="text-center space-y-0.5">
                <h1 className="text-sm sm:text-lg font-extrabold text-[#172B4D] dark:text-slate-100">
                  {!isLockedMode
                    ? isSetupStepConfirm
                      ? `Xác nhận mã Code cho ${memberName}`
                      : `Tạo mã Code cho ${memberName}`
                    : `Nhập mã Code hoặc Face ID`}
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  {!isLockedMode
                    ? "Nhập 4–6 chữ số để bảo vệ sổ tài chính"
                    : `Xác thực ${memberName} trước khi dùng ứng dụng`}
                </p>
              </div>

              {/* 6 ô chấm mã Code */}
              <div
                aria-label="Mã Code đã nhập"
                className="flex items-center justify-center gap-2.5 py-1"
              >
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const filled = idx < codeInput.length;
                  return (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full transition-all duration-150 ${
                        filled
                          ? "bg-[#2563EB] scale-110 shadow-xs"
                          : idx < 4
                          ? "bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600"
                          : "bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600"
                      }`}
                    />
                  );
                })}
              </div>

              {/* Thông báo lỗi / hướng dẫn */}
              {authError && (
                <div
                  role="alert"
                  className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] sm:text-xs font-semibold flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {authInfo && !authError && (
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-300 text-[11px] sm:text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{authInfo}</span>
                </div>
              )}
            </div>

            {/* Bàn phím số bo góc chuẩn chạm Apple HIG (48px - 54px) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={lockoutRemaining > 0 || isSubmitting}
                  onClick={() => handleDigitPress(digit)}
                  className="h-12 sm:h-[54px] rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 active:scale-95 text-lg font-extrabold text-[#172B4D] dark:text-slate-100 tabular-nums transition-all cursor-pointer disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsWallpaperModalOpen(true)}
                title="Đổi hình nền khóa"
                className="h-12 sm:h-[54px] rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 inline-flex flex-col items-center justify-center gap-0.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-[10px]">Nền khóa</span>
              </button>

              <button
                type="button"
                disabled={lockoutRemaining > 0 || isSubmitting}
                onClick={() => handleDigitPress("0")}
                className="h-12 sm:h-[54px] rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 active:scale-95 text-lg font-extrabold text-[#172B4D] dark:text-slate-100 tabular-nums transition-all cursor-pointer disabled:opacity-50"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                aria-label="Xóa một số"
                className="h-12 sm:h-[54px] rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center transition-all cursor-pointer"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Hàng hành động Thumb-Zone: Face ID (trái) + Xác nhận Code (phải) */}
            <div className="space-y-2 pt-0.5">
              <div className="flex items-stretch gap-2">
                {isLockedMode && (
                  <button
                    type="button"
                    onClick={() =>
                      !hasBiometricRegistered && bioAvailability.supported
                        ? void handleRegisterBiometric()
                        : void handleBiometricUnlock()
                    }
                    disabled={isBioBusy || lockoutRemaining > 0}
                    aria-label={
                      hasBiometricRegistered
                        ? "Mở khóa bằng Face ID"
                        : bioAvailability.supported
                        ? "Kích hoạt Face ID"
                        : "Xem trạng thái Face ID"
                    }
                    className={`min-h-[48px] px-3.5 sm:px-4 rounded-2xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 shrink-0 active:scale-95 ${
                      hasBiometricRegistered
                        ? "bg-[#1E3A8A] hover:bg-[#1E40AF] text-white shadow-md"
                        : bioAvailability.supported
                        ? "bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                        : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <ScanFace className="w-5 h-5 shrink-0" />
                    <span>
                      {isBioBusy
                        ? "Đang quét..."
                        : hasBiometricRegistered
                        ? "Face ID"
                        : bioAvailability.supported
                        ? "Bật Face ID"
                        : "Face ID"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={codeInput.length < 4 || lockoutRemaining > 0 || isSubmitting}
                  onClick={() => void handleVerifyCode(codeInput)}
                  className="min-h-[48px] flex-1 px-4 rounded-2xl bg-[#2563EB] hover:bg-blue-700 active:scale-[0.99] text-white text-xs sm:text-sm font-extrabold shadow-md inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>
                    {isSubmitting
                      ? "Đang xác thực..."
                      : !isLockedMode
                      ? isSetupStepConfirm
                        ? "Lưu mã & Vào app"
                        : "Tiếp tục"
                      : lockoutRemaining > 0
                      ? `Chờ (${lockoutRemaining}s)`
                      : "Xác nhận"}
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={switchPerspectiveOnUnlock}
                    onChange={(e) => setSwitchPerspectiveOnUnlock(e.target.checked)}
                    className="rounded accent-blue-600 w-4 h-4"
                  />
                  <span>Mở góc nhìn {memberName}</span>
                </label>

                {!isLockedMode && (
                  <button
                    type="button"
                    onClick={() => bypassLockForFirstSetup(selectedMember)}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Vào ngay (chưa đặt mã)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer chỉ hiện từ tablet/desktop để nhường chiều cao cho iPhone SE / Mini */}
      <footer className="hidden sm:block relative z-10 text-center pb-2 px-4 text-[11px] text-slate-300/80">
        Dữ liệu tài chính & ảnh nền cá nhân được lưu an toàn ngay trên thiết bị của gia đình.
      </footer>

      {/* 4. Modal / Sheet Tùy chỉnh Hình Nền & Sinh Trắc Học cho Từng Người */}
      {isWallpaperModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsWallpaperModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallpaper-modal-title"
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 text-[#172B4D] dark:text-slate-100 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-4 duration-200 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 id="wallpaper-modal-title" className="text-base font-extrabold">
                  Cá nhân hóa màn hình khóa
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hồ sơ đang chọn: <strong className="text-blue-700 dark:text-blue-400">{memberName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWallpaperModalOpen(false)}
                aria-label="Đóng tùy chỉnh"
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75dvh] overflow-y-auto">
              {/* Chọn ảnh từ thư viện thiết bị */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                  Hình nền riêng từ thư viện thiết bị
                </span>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={isProcessingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span>
                      {isProcessingImage
                        ? "Đang nén ảnh..."
                        : activeWallpaper
                        ? "Chọn ảnh khác từ thư viện"
                        : "Tải ảnh từ thư viện máy"}
                    </span>
                  </button>

                  {activeWallpaper && (
                    <button
                      type="button"
                      onClick={handleRemoveWallpaper}
                      className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Gỡ ảnh</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Thanh điều chỉnh độ mờ & độ tối lớp phủ */}
              {activeWallpaper && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span>Độ mờ hậu cảnh</span>
                      <span>{wallpaperBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={16}
                      step={2}
                      value={wallpaperBlur}
                      onChange={(e) =>
                        updateMemberAuthConfig(selectedMember, {
                          wallpaperBlur: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span>Độ tối lớp phủ dễ đọc</span>
                      <span>{wallpaperDim}%</span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={80}
                      step={5}
                      value={wallpaperDim}
                      onChange={(e) =>
                        updateMemberAuthConfig(selectedMember, {
                          wallpaperDim: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Kích hoạt / Gỡ Face ID cho thiết bị hiện tại */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <ScanFace className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Nhận diện khuôn mặt (Face ID / WebAuthn)</span>
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      hasBiometricRegistered ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {hasBiometricRegistered ? "Đã bật" : "Chưa bật"}
                  </span>
                </div>

                {bioAvailability.reason && !hasBiometricRegistered && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    {bioAvailability.reason}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isBioBusy}
                    onClick={() => void handleRegisterBiometric()}
                    className="min-h-[44px] flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    {hasBiometricRegistered ? "Đăng ký lại Face ID máy này" : "Đăng ký Face ID ngay"}
                  </button>
                  {hasBiometricRegistered && (
                    <button
                      type="button"
                      onClick={() =>
                        updateMemberAuthConfig(selectedMember, {
                          webauthnCredentialId: undefined,
                          webauthnDeviceLabel: undefined,
                        })
                      }
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold cursor-pointer"
                    >
                      Tắt
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
