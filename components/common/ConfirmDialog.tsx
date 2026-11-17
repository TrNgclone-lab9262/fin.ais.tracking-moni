"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { triggerHaptic } from "@/lib/haptic";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy bỏ",
  isDanger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-xl overflow-hidden border border-[#DCE4EE] dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                isDanger
                  ? "bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{message}</p>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/70 px-6 py-4 flex items-center justify-end gap-3 border-t border-[#E9EEF5] dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(isDanger ? "warning" : "success");
              onConfirm();
            }}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-md shadow-xs transition-all cursor-pointer ${
              isDanger
                ? "bg-rose-600 hover:bg-rose-700 active:scale-95"
                : "bg-blue-600 hover:bg-blue-700 active:scale-95"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
