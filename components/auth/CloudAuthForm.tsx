"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RefreshCw,
  User,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { AuthMemberId } from "@/types/finance";

interface CloudAuthFormProps {
  defaultMode?: "SIGNIN" | "SIGNUP";
  onAuthSuccess?: () => void;
  onStatusToast?: (msg: string) => void;
  onSignupPendingConfirm?: (email: string) => void;
}

const RESEND_COOLDOWN_SECONDS = 60;

export function CloudAuthForm({
  defaultMode = "SIGNIN",
  onAuthSuccess,
  onStatusToast,
  onSignupPendingConfirm,
}: CloudAuthFormProps) {
  const {
    settings,
    cloudError,
    clearCloudError,
    signInCloud,
    signUpCloud,
    resendSignupConfirmationCloud,
    sendMagicLinkCloud,
  } = useFinance();

  const [mode, setMode] = useState<"SIGNIN" | "SIGNUP">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [memberSlot, setMemberSlot] = useState<AuthMemberId>(
    settings.authActiveProfile || "HUSBAND"
  );
  const [isBusy, setIsBusy] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState<string | null>(null);
  const [alreadyRegisteredEmail, setAlreadyRegisteredEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [localMessage, setLocalMessage] = useState<{
    type: "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const switchMode = (next: "SIGNIN" | "SIGNUP") => {
    setMode(next);
    clearCloudError();
    setLocalMessage(null);
    setAlreadyRegisteredEmail(null);
    if (next === "SIGNIN") {
      setPendingConfirmEmail(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearCloudError();
    setLocalMessage(null);
    setAlreadyRegisteredEmail(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setLocalMessage({
        type: "error",
        text: "Vui lòng nhập địa chỉ Email hợp lệ.",
      });
      return;
    }

    if (password.length < 6) {
      setLocalMessage({
        type: "error",
        text: "Mật khẩu phải có ít nhất 6 ký tự.",
      });
      return;
    }

    setIsBusy(true);
    try {
      if (mode === "SIGNIN") {
        const ok = await signInCloud(trimmedEmail, password);
        if (ok) {
          setPassword("");
          setPendingConfirmEmail(null);
          onStatusToast?.("Đã đăng nhập Supabase Cloud.");
          onAuthSuccess?.();
        }
      } else {
        const resolvedName =
          displayName.trim() ||
          (memberSlot === "HUSBAND" ? settings.husbandName : settings.wifeName);

        const res = await signUpCloud(trimmedEmail, password, {
          displayName: resolvedName,
          memberSlot,
        });

        if (res.alreadyRegistered) {
          setPassword("");
          setAlreadyRegisteredEmail(trimmedEmail);
          return;
        }

        if (res.ok) {
          setPassword("");
          if (res.needsEmailConfirm) {
            setPendingConfirmEmail(trimmedEmail);
            setResendCooldown(RESEND_COOLDOWN_SECONDS);
            onSignupPendingConfirm?.(trimmedEmail);
            onStatusToast?.("Vui lòng kiểm tra email để xác nhận tài khoản.");
          } else {
            onStatusToast?.("Đăng ký & lưu Profile cá nhân thành công.");
            onAuthSuccess?.();
          }
        }
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleResendConfirmation = async (targetEmail: string) => {
    if (isResending || resendCooldown > 0) return;
    clearCloudError();
    setLocalMessage(null);
    setIsResending(true);
    try {
      const ok = await resendSignupConfirmationCloud(targetEmail);
      if (ok) {
        setPendingConfirmEmail(targetEmail);
        setAlreadyRegisteredEmail(null);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setLocalMessage({
          type: "info",
          text: `Đã gửi lại email xác nhận tới ${targetEmail}.`,
        });
        onStatusToast?.(`Đã gửi lại email xác nhận tới ${targetEmail}.`);
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleSendMagicLink = async (overrideEmail?: string) => {
    clearCloudError();
    setLocalMessage(null);
    setAlreadyRegisteredEmail(null);

    const trimmedEmail = (overrideEmail ?? email).trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setLocalMessage({
        type: "error",
        text: "Nhập Email hợp lệ trước khi gửi Magic Link.",
      });
      return;
    }

    setIsBusy(true);
    try {
      const ok = await sendMagicLinkCloud(trimmedEmail);
      if (ok) {
        setLocalMessage({
          type: "info",
          text: "Đã gửi Magic Link tới hộp thư của bạn. Mở liên kết trên thiết bị này để hoàn tất đăng nhập.",
        });
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs sm:text-sm font-extrabold text-[#172B4D] dark:text-slate-100">
            {mode === "SIGNIN"
              ? "Đăng nhập tài khoản Cloud cá nhân"
              : "Đăng ký tài khoản & khởi tạo Profile"}
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Mỗi vợ/chồng dùng một Email riêng để bảo mật dữ liệu Tổ ấm bằng Supabase RLS.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Chế độ xác thực Cloud"
          className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "SIGNIN"}
            data-testid="cloud-auth-tab-signin"
            onClick={() => switchMode("SIGNIN")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === "SIGNIN"
                ? "bg-white dark:bg-slate-900 text-[#1E3A8A] dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "SIGNUP"}
            data-testid="cloud-auth-tab-signup"
            onClick={() => switchMode("SIGNUP")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === "SIGNUP"
                ? "bg-white dark:bg-slate-900 text-[#1E3A8A] dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Đăng ký mới
          </button>
        </div>
      </div>

      {cloudError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start justify-between gap-2"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{cloudError}</span>
          </div>
          <button
            type="button"
            onClick={clearCloudError}
            className="text-[11px] font-bold underline shrink-0 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {pendingConfirmEmail && (
        <div
          role="status"
          data-testid="cloud-auth-confirm-banner"
          className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs space-y-2.5"
        >
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-extrabold text-emerald-800 dark:text-emerald-100">
                Vui lòng kiểm tra email để xác nhận tài khoản
              </p>
              <p className="text-[11px] text-emerald-800/90 dark:text-emerald-200/90 leading-relaxed">
                Liên kết xác thực đã được yêu cầu gửi tới{" "}
                <strong className="font-mono">{pendingConfirmEmail}</strong>. Hãy kiểm tra thêm
                mục Thư rác (Spam) hoặc Cập nhật (Updates) trong hộp thư.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pl-6">
            <button
              type="button"
              disabled={isResending || resendCooldown > 0}
              data-testid="cloud-auth-resend-button"
              onClick={() => void handleResendConfirmation(pendingConfirmEmail)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-emerald-100/70 dark:hover:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed tabular-nums"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
              <span>
                {isResending
                  ? "Đang gửi lại..."
                  : resendCooldown > 0
                  ? `Gửi lại email xác nhận (${resendCooldown}s)`
                  : "Gửi lại email xác nhận"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => switchMode("SIGNIN")}
              className="min-h-[36px] px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-800 dark:text-emerald-200 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Đã xác nhận? Đăng nhập ngay
            </button>
          </div>
        </div>
      )}

      {alreadyRegisteredEmail && (
        <div
          role="alert"
          data-testid="cloud-auth-duplicate-banner"
          className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2.5"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-extrabold">
                Email <span className="font-mono">{alreadyRegisteredEmail}</span> đã tồn tại trên
                Supabase
              </p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
                Vì bảo mật chống dò tài khoản, Supabase không gửi lại mail đăng ký mới cho email đã
                có sẵn. Bạn có thể chuyển sang Đăng nhập, dùng Magic Link, hoặc gửi lại mail kích
                hoạt nếu trước đó chưa bấm xác nhận.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pl-6">
            <button
              type="button"
              onClick={() => switchMode("SIGNIN")}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Chuyển sang Đăng nhập
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleSendMagicLink(alreadyRegisteredEmail)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Gửi Magic Link
            </button>
            <button
              type="button"
              disabled={isResending || resendCooldown > 0}
              onClick={() => void handleResendConfirmation(alreadyRegisteredEmail)}
              className="min-h-[36px] px-2.5 py-1.5 text-[11px] font-bold underline text-amber-800 dark:text-amber-200 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 tabular-nums"
            >
              {resendCooldown > 0 ? `Gửi lại xác nhận (${resendCooldown}s)` : "Gửi lại email xác nhận"}
            </button>
          </div>
        </div>
      )}

      {localMessage && (
        <div
          role={localMessage.type === "error" ? "alert" : "status"}
          className={`p-3 rounded-lg border text-xs font-semibold flex items-start gap-2 ${
            localMessage.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {localMessage.type === "error" ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{localMessage.text}</span>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        {mode === "SIGNUP" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label
                htmlFor="cloud-auth-display-name"
                className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
              >
                Tên hiển thị (lưu vào Profile)
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="cloud-auth-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={
                    memberSlot === "HUSBAND"
                      ? `Ví dụ: ${settings.husbandName}`
                      : `Ví dụ: ${settings.wifeName}`
                  }
                  className="w-full min-h-[40px] bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Vai trò thành viên
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: "HUSBAND" as AuthMemberId,
                      label: `👨 ${settings.husbandName}`,
                    },
                    {
                      id: "WIFE" as AuthMemberId,
                      label: `👩 ${settings.wifeName}`,
                    },
                  ] as const
                ).map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setMemberSlot(slot.id)}
                    className={`min-h-[40px] px-2.5 py-2 rounded-lg border text-xs font-bold truncate cursor-pointer transition-colors ${
                      memberSlot === slot.id
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-200"
                        : "bg-white dark:bg-slate-900 border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="cloud-auth-email"
              className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="cloud-auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@family.vn"
                autoComplete="email"
                className="w-full min-h-[40px] bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="cloud-auth-password"
              className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
            >
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="cloud-auth-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                autoComplete={mode === "SIGNIN" ? "current-password" : "new-password"}
                className="w-full min-h-[40px] bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 rounded-lg pl-8 pr-9 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={isBusy}
            data-testid="cloud-auth-submit"
            className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 transition-colors"
          >
            {isBusy
              ? "Đang xử lý..."
              : mode === "SIGNIN"
              ? "Đăng nhập Supabase Cloud"
              : "Đăng ký & Lưu Profile"}
          </button>

          {mode === "SIGNIN" && (
            <button
              type="button"
              onClick={() => void handleSendMagicLink()}
              disabled={isBusy}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Gửi Magic Link</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
