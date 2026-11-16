"use client";

import React, { useEffect } from "react";
import { Cloud, ArrowRight, X, Check } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { CloudAuthForm } from "@/components/auth/CloudAuthForm";

interface CloudAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFamilyHub?: () => void;
}

export function CloudAuthModal({
  isOpen,
  onClose,
  onOpenFamilyHub,
}: CloudAuthModalProps) {
  const { cloudUser, cloudProfile, household } = useFinance();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoToFamilyHub = () => {
    onClose();
    onOpenFamilyHub?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-auth-modal-title"
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#E9EEF5] dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3
                id="cloud-auth-modal-title"
                className="text-sm font-extrabold text-[#172B4D] dark:text-slate-100 truncate"
              >
                Tài khoản Cloud &amp; Đồng bộ Tổ ấm
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Supabase Auth · Lưu trữ Profile cá nhân &amp; Ghép đôi FamilyHub
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {cloudUser ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Đã đăng nhập Supabase Cloud</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-200 font-semibold">
                  {cloudProfile?.displayName || cloudUser.email}{" "}
                  <span className="text-slate-500 dark:text-slate-400 font-normal">
                    ({cloudUser.email})
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {household
                    ? `Đang ghép đôi trong Tổ ấm "${household.name}" (Mã: ${household.inviteCode}).`
                    : "Bước tiếp theo: Tạo Tổ ấm hoặc nhập mã ghép đôi tại FamilyHub trong Cài đặt."}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Đóng
                </button>
                {onOpenFamilyHub && (
                  <button
                    type="button"
                    onClick={handleGoToFamilyHub}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Mở FamilyHub</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <CloudAuthForm onAuthSuccess={handleGoToFamilyHub} />
          )}
        </div>
      </div>
    </div>
  );
}
