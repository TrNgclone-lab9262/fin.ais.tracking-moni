"use client";

import React, { useState } from "react";
import { X, ShieldAlert, ScanFace, KeyRound, AlertCircle } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { AuthMemberId } from "@/types/finance";
import { getMemberAuthConfig, verifyMemberBiometric } from "@/lib/authSecurity";
import { useHaptic } from "@/src/hooks/useHaptic";

interface StepUpAuthModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onVerified: () => void;
  onCancel: () => void;
}

export function StepUpAuthModal({
  isOpen,
  title,
  description,
  onVerified,
  onCancel,
}: StepUpAuthModalProps) {
  const { settings, verifyMemberPasscode } = useFinance();
  const haptic = useHaptic();
  const [selectedMember, setSelectedMember] = useState<AuthMemberId>(
    settings.authActiveProfile || "HUSBAND"
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  if (!isOpen) return null;

  const memberConfig = getMemberAuthConfig(settings, selectedMember);
  const memberName =
    selectedMember === "HUSBAND" ? settings.husbandName : settings.wifeName;
  const hasFaceId = Boolean(memberConfig.webauthnCredentialId);

  const handleSubmit = async (e: React.FormEvent) => {
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
        onVerified();
      } else {
        haptic.error();
        setError("Mã Code chưa đúng. Vui lòng thử lại.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleFaceId = async () => {
    if (!memberConfig.webauthnCredentialId || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await verifyMemberBiometric(memberConfig.webauthnCredentialId);
      if (res.success) {
        haptic.success();
        setCode("");
        onVerified();
      } else {
        haptic.error();
        setError(res.error || "Không xác thực được Face ID. Hãy nhập mã Code.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stepup-auth-title"
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#DCE4EE] dark:border-slate-800 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 id="stepup-auth-title" className="text-sm font-extrabold text-[#172B4D] dark:text-slate-100">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Đóng xác thực"
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Selector */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          {(
            [
              { id: "HUSBAND" as AuthMemberId, emoji: "👨", label: settings.husbandName },
              { id: "WIFE" as AuthMemberId, emoji: "👩", label: settings.wifeName },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedMember(item.id);
                setError(null);
              }}
              className={`min-h-[38px] rounded-lg px-2.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selectedMember === item.id
                  ? "bg-[#1E3A8A] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span aria-hidden="true">{item.emoji}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div>
            <label
              htmlFor="stepup-code-input"
              className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1"
            >
              Nhập mã Code của {memberName} (4–6 số)
            </label>
            <input
              id="stepup-code-input"
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="••••"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-center text-base font-black tracking-[0.4em] text-[#172B4D] dark:text-slate-100 outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex gap-2">
            {hasFaceId && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleFaceId()}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <ScanFace className="w-4 h-4" />
                <span>Face ID</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isBusy || code.length < 4}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isBusy ? "Đang xác thực..." : "Xác nhận & Thực hiện"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
