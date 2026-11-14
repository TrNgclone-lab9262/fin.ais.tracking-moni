"use client";

import React from "react";
import { X, Sparkles, RefreshCw, ShieldCheck, Check } from "lucide-react";
import { usePWAUpdate } from "@/context/PWAUpdateContext";

export function ReleaseNotesModal() {
  const {
    isReleaseNotesOpen,
    closeReleaseNotes,
    currentVersion,
    latestRelease,
    changelog,
    hasUpdate,
    status,
    applyUpdateNow,
  } = usePWAUpdate();

  if (!isReleaseNotesOpen) return null;

  const isUpdating = status === "UPDATING";
  const featured = latestRelease || changelog[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={closeReleaseNotes}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-notes-title"
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#DCE4EE] dark:border-slate-800 overflow-hidden max-h-[88vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 id="release-notes-title" className="text-base font-black tracking-tight">
                {hasUpdate ? `Bản cập nhật v${featured?.version}` : `Nhật ký phiên bản HOME MONI`}
              </h3>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Phiên bản đang dùng: v{currentVersion} · Phát hành {featured?.releasedAt}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeReleaseNotes}
            aria-label="Đóng chi tiết phiên bản"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Ghi chú phiên bản nổi bật */}
          {featured && (
            <div className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-slate-800/80 border border-[#DCE4EE] dark:border-slate-700 space-y-2.5">
              <div className="text-xs font-extrabold text-[#1E3A8A] dark:text-blue-300">
                v{featured.version} · {featured.title}
              </div>
              <ul className="space-y-2">
                {featured.highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Các phiên bản trước đó */}
          {changelog.length > 1 && (
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Các bản phát hành trước
              </h4>
              <div className="space-y-2.5">
                {changelog.slice(1).map((entry) => (
                  <div
                    key={entry.version}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5"
                  >
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      v{entry.version} · {entry.releasedAt}
                    </div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{entry.title}</p>
                    <ul className="space-y-1 pt-0.5">
                      {entry.highlights.map((h, i) => (
                        <li key={i} className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1.5">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cam kết an toàn dữ liệu offline */}
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/80 dark:border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Cập nhật chỉ làm mới giao diện ứng dụng, toàn bộ dữ liệu giao dịch & mã PIN trên máy được giữ nguyên 100%.
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={closeReleaseNotes}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer"
          >
            Đóng
          </button>

          {hasUpdate && (
            <button
              type="button"
              onClick={() => void applyUpdateNow()}
              disabled={isUpdating}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-extrabold shadow-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-75"
            >
              <RefreshCw className={`w-4 h-4 ${isUpdating ? "animate-spin" : ""}`} />
              <span>{isUpdating ? "Đang cài đặt..." : "Cập nhật ngay"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
