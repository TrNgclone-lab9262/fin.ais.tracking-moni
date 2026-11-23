"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  GitMerge,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { describeOutboxMutation, MAX_OUTBOX_RETRIES } from "@/lib/offlineOutbox";

interface SyncOutboxInspectorProps {
  compact?: boolean;
}

export function SyncOutboxInspector({ compact = false }: SyncOutboxInspectorProps) {
  const {
    outboxEntries,
    failedOutboxCount,
    isCloudConnected,
    isSyncing,
    lastConflictNotice,
    dismissConflictNotice,
    retryOutboxEntry,
    retryAllFailedOutbox,
    discardOutboxEntry,
    syncWithCloud,
  } = useFinance();

  const [busyKey, setBusyKey] = useState<string | null>(null);

  const pendingCount = outboxEntries.filter((e) => e.status === "PENDING").length;

  const handleRetryOne = async (key: string) => {
    setBusyKey(key);
    try {
      await retryOutboxEntry(key);
    } finally {
      setBusyKey(null);
    }
  };

  const handleRetryAllFailed = async () => {
    setBusyKey("__ALL__");
    try {
      await retryAllFailedOutbox();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 ${
        compact ? "p-4" : "p-5"
      } space-y-3.5`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              failedOutboxCount > 0
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                : outboxEntries.length > 0
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {failedOutboxCount > 0 ? (
              <AlertTriangle className="w-4 h-4" />
            ) : outboxEntries.length > 0 ? (
              <CloudOff className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Hàng đợi Đồng bộ (Sync Outbox)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {outboxEntries.length === 0
                ? "Tất cả thay đổi đã đồng bộ sạch sẽ"
                : `${pendingCount} chờ đẩy · ${failedOutboxCount} lỗi cần xử lý`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {failedOutboxCount > 0 && (
            <button
              type="button"
              onClick={handleRetryAllFailed}
              disabled={!isCloudConnected || busyKey !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${busyKey === "__ALL__" ? "animate-spin" : ""}`} />
              Thử lại mục lỗi
            </button>
          )}
          {isCloudConnected && (
            <button
              type="button"
              onClick={() => void syncWithCloud()}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              Đồng bộ ngay
            </button>
          )}
        </div>
      </div>

      {/* Conflict Auto-Merge Banner */}
      {lastConflictNotice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/40 px-3.5 py-2.5 text-xs text-indigo-800 dark:text-indigo-200">
          <div className="flex items-start gap-2">
            <GitMerge className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
            <span>{lastConflictNotice}</span>
          </div>
          <button
            type="button"
            onClick={dismissConflictNotice}
            className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300"
            aria-label="Đóng thông báo gộp dữ liệu"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Queue List */}
      {outboxEntries.length === 0 ? (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 px-4 py-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Không có thao tác nào tồn đọng trong hàng đợi ngoại tuyến. Các thay đổi mới sẽ tự động đồng bộ nền khi có mạng.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
          {outboxEntries.map((entry) => {
            const isFailed = entry.status === "FAILED";
            return (
              <div
                key={entry.key}
                className={`rounded-xl border px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                  isFailed
                    ? "border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20"
                    : "border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40"
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        isFailed
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                      }`}
                    >
                      {isFailed
                        ? `Lỗi (${entry.retryCount}/${MAX_OUTBOX_RETRIES})`
                        : `Chờ gửi (${entry.retryCount}/${MAX_OUTBOX_RETRIES})`}
                    </span>
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {describeOutboxMutation(entry.mutation)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap tabular-nums">
                    <span>Key: {entry.key}</span>
                    <span>•</span>
                    <span>
                      Lưu lúc:{" "}
                      {new Date(entry.queuedAt).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>
                  {entry.lastError && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 break-words">
                      Chi tiết lỗi: {entry.lastError}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleRetryOne(entry.key)}
                    disabled={!isCloudConnected || busyKey !== null}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    <RotateCcw
                      className={`w-3.5 h-3.5 ${busyKey === entry.key ? "animate-spin" : ""}`}
                    />
                    Thử lại
                  </button>
                  <button
                    type="button"
                    onClick={() => discardOutboxEntry(entry.key)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50"
                    title="Bỏ qua mục lỗi này khỏi hàng đợi"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Bỏ qua
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
