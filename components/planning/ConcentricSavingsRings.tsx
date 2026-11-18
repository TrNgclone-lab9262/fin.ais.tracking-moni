"use client";

import React from "react";
import { EvaluatedSavingsChallenge } from "@/lib/savingsChallenges";
import { formatShortVNDMasked, formatVNDMasked } from "@/lib/formatters";

interface ConcentricSavingsRingsProps {
  rings: EvaluatedSavingsChallenge[];
  overallPct: number;
  completedCount: number;
  totalCount: number;
  selectedId: string | null;
  onSelectChallenge: (id: string | null) => void;
  isPrivacyMode: boolean;
}

export function ConcentricSavingsRings({
  rings,
  overallPct,
  completedCount,
  totalCount,
  selectedId,
  onSelectChallenge,
  isPrivacyMode,
}: ConcentricSavingsRingsProps) {
  const size = 280;
  const center = size / 2;

  // Điều chỉnh độ dày và khoảng cách vòng sao cho lõi giữa luôn đủ rộng >= 96px để đọc rõ số liệu
  const ringCount = Math.max(1, Math.min(5, rings.length));
  const strokeWidth = ringCount <= 3 ? 15 : 11;
  const step = ringCount <= 3 ? 21 : 16;
  const outerRadius = 120;

  const activeRing = selectedId
    ? rings.find((r) => r.challenge.id === selectedId) || null
    : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[248px] h-[248px] sm:w-[272px] sm:h-[272px] flex items-center justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full -rotate-90 overflow-visible"
          role="img"
          aria-label={`Biểu đồ vòng tròn đồng tâm tiến độ ${ringCount} thử thách tiết kiệm`}
        >
          {rings.map((item, idx) => {
            const radius = outerRadius - idx * step;
            const circumference = 2 * Math.PI * radius;
            const clampedPct = Math.min(100, Math.max(0, item.progressPct));
            const dashOffset = circumference * (1 - clampedPct / 100);
            const isSelected = selectedId === item.challenge.id;
            const isDimmed = selectedId !== null && !isSelected;

            return (
              <g
                key={item.challenge.id}
                onClick={() =>
                  onSelectChallenge(isSelected ? null : item.challenge.id)
                }
                className="cursor-pointer transition-opacity duration-200"
                style={{ opacity: isDimmed ? 0.32 : 1 }}
              >
                {/* Vòng nền */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={item.challenge.color}
                  strokeOpacity={0.16}
                  strokeWidth={strokeWidth}
                />
                {/* Vòng tiến độ */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={item.challenge.color}
                  strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-700 ease-out"
                />
              </g>
            );
          })}
        </svg>

        {/* Trung tâm vòng tròn đồng tâm */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-10">
          {activeRing ? (
            <>
              <span
                className="text-[11px] font-bold truncate max-w-[110px]"
                style={{ color: activeRing.challenge.color }}
              >
                {activeRing.challenge.name}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-[#172B4D] dark:text-slate-100 tabular-nums leading-tight mt-0.5">
                {Math.round(activeRing.progressPct)}%
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                {formatShortVNDMasked(activeRing.savedAmount, isPrivacyMode)} /{" "}
                {formatShortVNDMasked(activeRing.targetAmount, isPrivacyMode)}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Hoàn thành
              </span>
              <span className="text-2xl sm:text-3xl font-black text-[#172B4D] dark:text-slate-100 tabular-nums leading-tight">
                {Math.round(overallPct)}%
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                {completedCount}/{totalCount} thử thách
              </span>
            </>
          )}
        </div>
      </div>

      {/* Chú thích vòng tròn (từ vòng ngoài vào vòng trong) */}
      <div className="w-full space-y-1.5">
        {rings.map((item, idx) => {
          const isSelected = selectedId === item.challenge.id;
          return (
            <button
              key={item.challenge.id}
              type="button"
              onClick={() => onSelectChallenge(isSelected ? null : item.challenge.id)}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-500/15 ring-1 ring-blue-300 dark:ring-blue-500/40"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/70"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.challenge.color }}
                />
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                  V{idx + 1}
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                  {item.challenge.name}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 tabular-nums">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                  {formatVNDMasked(item.savedAmount, isPrivacyMode)}
                </span>
                <span
                  className="font-black text-xs"
                  style={{ color: item.challenge.color }}
                >
                  {Math.round(item.progressPct)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
