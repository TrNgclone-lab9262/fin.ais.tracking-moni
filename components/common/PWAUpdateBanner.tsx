"use client";

import React from "react";
import { RefreshCw, Sparkles, CheckCircle2, X, FileText } from "lucide-react";
import { usePWAUpdate } from "@/context/PWAUpdateContext";

export function PWAUpdateBanner() {
  const {
    status,
    latestRelease,
    hasUpdate,
    isDismissedForSession,
    justUpdatedVersion,
    applyUpdateNow,
    dismissUpdateBanner,
    dismissJustUpdatedToast,
    openReleaseNotes,
  } = usePWAUpdate();

  // 1. Toast xác nhận vừa cập nhật thành công sau reload
  if (status === "JUST_UPDATED" && justUpdatedVersion) {
    return (
      <div
        role="status"
        className="bg-emerald-600 text-white pt-safe shadow-sm text-xs border-b border-emerald-700 animate-in slide-in-from-top duration-200"
      >
        <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-100 shrink-0" />
          <p className="truncate font-semibold">
            Đã cập nhật lên <span className="font-black">v{justUpdatedVersion}</span>
            <span className="hidden sm:inline text-emerald-100 font-medium">
              {" "}
              · Dữ liệu thu chi gia đình được giữ nguyên 100%
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={dismissJustUpdatedToast}
          aria-label="Đóng thông báo đã cập nhật"
          className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
        </div>
      </div>
    );
  }

  // 2. Banner thông báo có phiên bản mới (ưu tiên hiển thị ngay khi mở app)
  const isUpdating = status === "UPDATING";
  if ((!hasUpdate && !isUpdating) || (isDismissedForSession && !isUpdating)) {
    return null;
  }

  const nextVersion = latestRelease?.version || "mới";
  const shortTitle = latestRelease?.title || "Cải thiện hiệu năng và bổ sung tính năng mới";

  return (
    <div
      role="region"
      aria-label="Thông báo cập nhật ứng dụng"
      className="bg-gradient-to-r from-[#1E3A8A] via-[#1D4ED8] to-[#2563EB] text-white pt-safe shadow-md border-b border-blue-900/50 animate-in slide-in-from-top duration-200"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-200" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-bold leading-tight truncate">
              <span>Bản mới v{nextVersion} sẵn sàng</span>
              <span className="hidden md:inline text-blue-200 font-normal">·</span>
              <span className="hidden md:inline text-blue-100 font-medium truncate">
                {shortTitle}
              </span>
            </div>
            <p className="md:hidden text-[11px] text-blue-100 font-medium truncate mt-0.5">
              {shortTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={openReleaseNotes}
            disabled={isUpdating}
            className="min-h-[38px] sm:min-h-[34px] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-100 hover:text-white hover:bg-white/10 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Chi tiết</span>
          </button>

          <button
            type="button"
            onClick={() => void applyUpdateNow()}
            disabled={isUpdating}
            className="min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg bg-white text-[#1E3A8A] hover:bg-blue-50 active:scale-95 text-xs font-extrabold shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-80"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
            <span>{isUpdating ? "Đang cập nhật..." : "Cập nhật ngay"}</span>
          </button>

          {!isUpdating && (
            <button
              type="button"
              onClick={dismissUpdateBanner}
              aria-label="Để sau"
              title="Để sau"
              className="min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
