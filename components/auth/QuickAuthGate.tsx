"use client";

import React, { useState } from "react";
import { ShieldCheck, ScanFace, KeyRound, AlertCircle, Settings } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { AuthMemberId, QuickAuthViewId } from "@/types/finance";
import {
  getMemberAuthConfig,
  hasAnyAppPasscode,
  hasMemberPasscode,
  verifyMemberBiometric,
} from "@/lib/authSecurity";
import { useHaptic } from "@/src/hooks/useHaptic";

const VIEW_LABELS: Record<QuickAuthViewId, { title: string; subtitle: string }> = {
  accounts: {
    title: "Tài khoản & Thẻ tín dụng",
    subtitle: "Xác thực nhanh bằng Face ID / Vân tay hoặc mã Code để xem số dư ví và hạn mức thẻ.",
  },
  debts_invest: {
    title: "Nợ & Đầu tư",
    subtitle: "Xác thực nhanh bằng Face ID / Vân tay hoặc mã Code để xem danh sách khoản nợ và danh mục đầu tư.",
  },
  data_admin: {
    title: "Quản trị Dữ liệu",
    subtitle: "Xác thực nhanh để truy cập khu vực chỉnh sửa sổ sách và sao lưu JSON.",
  },
};

interface QuickAuthGateProps {
  viewId: QuickAuthViewId;
  children: React.ReactNode;
}

export function QuickAuthGate({ viewId, children }: QuickAuthGateProps) {
  const {
    settings,
    isViewProtectedByQuickAuth,
    isViewUnlockedInSession,
    unlockProtectedView,
    verifyMemberPasscode,
    hasAuthCredential,
    setActiveTab,
  } = useFinance();
  const haptic = useHaptic();

  const [selectedMember, setSelectedMember] = useState<AuthMemberId>(
    settings.authActiveProfile || "HUSBAND"
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const isProtected = isViewProtectedByQuickAuth(viewId);
  const isUnlocked = isViewUnlockedInSession(viewId);

  if (!isProtected || isUnlocked) {
    return <>{children}</>;
  }

  const meta = VIEW_LABELS[viewId];
  const memberConfig = getMemberAuthConfig(settings, selectedMember);
  const memberName =
    selectedMember === "HUSBAND" ? settings.husbandName : settings.wifeName;
  const hasFaceId = Boolean(memberConfig.webauthnCredentialId);
  const hasAnyCode = hasAnyAppPasscode(settings);
  const activeMemberHasCode = hasMemberPasscode(settings, selectedMember);

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    const cleaned = code.replace(/[^0-9]/g, "");
    if (cleaned.length < 4) {
      haptic.error();
      setError("Vui lòng nhập đủ 4–6 chữ số mã Code.");
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const ok = await verifyMemberPasscode(selectedMember, cleaned);
      if (ok) {
        haptic.success();
        setCode("");
        unlockProtectedView(viewId);
      } else {
        haptic.error();
        setError("Mã Code chưa đúng. Vui lòng thử lại.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!memberConfig.webauthnCredentialId || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await verifyMemberBiometric(memberConfig.webauthnCredentialId);
      if (res.success) {
        haptic.success();
        setCode("");
        unlockProtectedView(viewId);
      } else {
        haptic.error();
        setError(res.error || "Xác thực sinh trắc học chưa thành công. Hãy thử lại hoặc dùng mã Code.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      data-testid={`quick-auth-gate-${viewId}`}
      className="max-w-md mx-auto my-6 sm:my-10 bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5 animate-in fade-in duration-150"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-[#1E3A8A] dark:text-blue-400 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
            Xác Thực Nhanh · Bảo Vệ Mục Nhạy Cảm
          </p>
          <h2 className="text-base font-extrabold text-[#172B4D] dark:text-slate-100 mt-0.5">
            {meta.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            {meta.subtitle}
          </p>
        </div>
      </div>

      {!hasAuthCredential ? (
        <div className="space-y-3 pt-2 border-t border-[#E9EEF5] dark:border-slate-800">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
            Bạn đang bật Quick Auth nhưng chưa thiết lập Face ID hoặc mã Code 4–6 số cho thành viên nào.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-[#1E3A8A] hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Thiết lập bảo mật</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Chọn thành viên xác thực */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-[#E9EEF5] dark:border-slate-700">
            {(
              [
                { id: "HUSBAND" as AuthMemberId, label: settings.husbandName },
                { id: "WIFE" as AuthMemberId, label: settings.wifeName },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedMember(item.id);
                  setError(null);
                }}
                className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-bold transition-colors truncate cursor-pointer ${
                  selectedMember === item.id
                    ? "bg-white dark:bg-slate-900 text-[#1E3A8A] dark:text-blue-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {hasFaceId && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleBiometricUnlock()}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ScanFace className="w-4 h-4" />
              <span>
                {isBusy
                  ? "Đang xác nhận sinh trắc học..."
                  : `Mở khóa bằng ${memberConfig.webauthnDeviceLabel || "Face ID / Vân tay"}`}
              </span>
            </button>
          )}

          {hasAnyCode && (
            <form onSubmit={(e) => void handleVerifyPasscode(e)} className="space-y-3 pt-1">
              <div>
                <label
                  htmlFor={`quick-auth-code-${viewId}`}
                  className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  {activeMemberHasCode
                    ? `Hoặc nhập mã Code của ${memberName} (4–6 số)`
                    : "Hoặc nhập mã Code gia đình (4–6 số)"}
                </label>
                <input
                  id={`quick-auth-code-${viewId}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                  placeholder="••••"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-center text-base font-black tracking-[0.4em] text-[#172B4D] dark:text-slate-100 outline-none focus:border-blue-600 tabular-nums"
                />
              </div>

              <button
                type="submit"
                disabled={isBusy || code.length < 4}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isBusy ? "Đang xác thực..." : "Mở khóa trong phiên này"}</span>
              </button>
            </form>
          )}

          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center pt-1">
            Sau khi mở khóa, mục này sẽ giữ trạng thái mở cho đến khi bạn khóa app hoặc tải lại trang.
          </p>
        </>
      )}
    </div>
  );
}
