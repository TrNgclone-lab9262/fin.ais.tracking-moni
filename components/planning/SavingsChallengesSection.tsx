"use client";

import React, { useMemo, useState } from "react";
import {
  Plus,
  Sparkles,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  Copy,
  Target,
  Zap,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatVNDMasked, getCurrentMonthKey, getMonthDisplayLabel } from "@/lib/formatters";
import { shiftMonthKey } from "@/lib/financeEngine";
import {
  CHALLENGE_RING_COLORS,
  evaluateSavingsChallenges,
  SAVINGS_CHALLENGE_TEMPLATES,
} from "@/lib/savingsChallenges";
import { ConcentricSavingsRings } from "@/components/planning/ConcentricSavingsRings";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FamilyMember, SavingsChallenge, SavingsChallengeMode } from "@/types/finance";

interface SavingsChallengesSectionProps {
  compact?: boolean;
}

export function SavingsChallengesSection({ compact = false }: SavingsChallengesSectionProps) {
  const {
    savingsChallenges,
    transactions,
    selectedMonth,
    activePerspective,
    isPrivacyMode,
    settings,
    addSavingsChallenge,
    updateSavingsChallenge,
    deleteSavingsChallenge,
    contributeSavingsChallenge,
  } = useFinance();

  const activeMonthKey = selectedMonth === "ALL" ? getCurrentMonthKey() : selectedMonth;
  const prevMonthKey = shiftMonthKey(activeMonthKey, -1);

  const [selectedRingId, setSelectedRingId] = useState<string | null>(null);
  const [customDepositId, setCustomDepositId] = useState<string | null>(null);
  const [customDepositInput, setCustomDepositInput] = useState("");
  const [deleteChallengeId, setDeleteChallengeId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<SavingsChallenge | null>(null);
  const [formName, setFormName] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formManualSaved, setFormManualSaved] = useState("0");
  const [formMode, setFormMode] = useState<SavingsChallengeMode>("MANUAL");
  const [formColor, setFormColor] = useState(CHALLENGE_RING_COLORS[0].hex);
  const [formMemberId, setFormMemberId] = useState<FamilyMember>("SHARED");

  const challengeSummary = useMemo(
    () =>
      evaluateSavingsChallenges({
        challenges: savingsChallenges,
        monthKey: activeMonthKey,
        transactions,
        perspective: activePerspective,
      }),
    [savingsChallenges, activeMonthKey, transactions, activePerspective]
  );

  // Kiểm tra tháng trước hoặc tháng mẫu gần nhất có thử thách để hỗ trợ sao chép nhanh 1 chạm
  const copySourceMonth = useMemo(() => {
    if (challengeSummary.items.length > 0) return null;
    if (savingsChallenges.some((c) => c.month === prevMonthKey)) return prevMonthKey;
    const otherMonths = Array.from(new Set(savingsChallenges.map((c) => c.month)))
      .filter((m) => m !== activeMonthKey)
      .sort((a, b) => b.localeCompare(a));
    return otherMonths[0] || null;
  }, [challengeSummary.items.length, savingsChallenges, prevMonthKey, activeMonthKey]);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3200);
  };

  const openCreateModal = () => {
    setEditingChallenge(null);
    setFormName("");
    setFormTarget("1.000.000");
    setFormManualSaved("0");
    setFormMode("MANUAL");
    const nextColor =
      CHALLENGE_RING_COLORS[challengeSummary.items.length % CHALLENGE_RING_COLORS.length].hex;
    setFormColor(nextColor);
    setFormMemberId(activePerspective === "ALL" ? "SHARED" : activePerspective);
    setIsModalOpen(true);
  };

  const openEditModal = (c: SavingsChallenge) => {
    setEditingChallenge(c);
    setFormName(c.name);
    setFormTarget(new Intl.NumberFormat("vi-VN").format(c.targetAmount));
    setFormManualSaved(new Intl.NumberFormat("vi-VN").format(c.manualSavedAmount || 0));
    setFormMode(c.trackingMode);
    setFormColor(c.color);
    setFormMemberId(c.memberId || "SHARED");
    setIsModalOpen(true);
  };

  const applyTemplate = (tpl: (typeof SAVINGS_CHALLENGE_TEMPLATES)[number]) => {
    setFormName(tpl.name);
    setFormTarget(new Intl.NumberFormat("vi-VN").format(tpl.targetAmount));
    setFormMode(tpl.trackingMode);
    setFormColor(tpl.color);
  };

  const handleSaveChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(formTarget.replace(/[^0-9]/g, ""), 10) || 0;
    const manualSaved = parseInt(formManualSaved.replace(/[^0-9]/g, ""), 10) || 0;
    if (!formName.trim() || target <= 0) return;

    if (editingChallenge) {
      updateSavingsChallenge(editingChallenge.id, {
        name: formName.trim(),
        targetAmount: target,
        manualSavedAmount: manualSaved,
        trackingMode: formMode,
        color: formColor,
        memberId: formMemberId,
      });
      showNotice(`Đã cập nhật thử thách "${formName.trim()}".`);
    } else {
      addSavingsChallenge({
        name: formName.trim(),
        month: activeMonthKey,
        targetAmount: target,
        manualSavedAmount: manualSaved,
        trackingMode: formMode,
        color: formColor,
        memberId: formMemberId,
      });
      showNotice(`Đã tạo thử thách "${formName.trim()}" cho ${getMonthDisplayLabel(activeMonthKey)}.`);
    }

    setIsModalOpen(false);
  };

  const handleCopyFromSourceMonth = () => {
    if (!copySourceMonth) return;
    const sourceItems = savingsChallenges.filter((c) => c.month === copySourceMonth);
    for (const src of sourceItems) {
      addSavingsChallenge({
        name: src.name,
        month: activeMonthKey,
        targetAmount: src.targetAmount,
        manualSavedAmount: 0,
        trackingMode: src.trackingMode,
        color: src.color,
        memberId: src.memberId,
        icon: src.icon,
      });
    }
    showNotice(
      `Đã sao chép ${sourceItems.length} thử thách từ ${getMonthDisplayLabel(copySourceMonth)} (đặt lại tiến độ nạp 0đ).`
    );
  };

  const handleQuickDeposit = (challenge: SavingsChallenge, delta: number) => {
    contributeSavingsChallenge(challenge.id, delta);
    showNotice(`+${new Intl.NumberFormat("vi-VN").format(delta)} ₫ vào "${challenge.name}"`);
  };

  const handleCustomDepositSubmit = (e: React.FormEvent, challenge: SavingsChallenge) => {
    e.preventDefault();
    const val = parseInt(customDepositInput.replace(/[^0-9]/g, ""), 10) || 0;
    if (val <= 0) return;
    contributeSavingsChallenge(challenge.id, val);
    setCustomDepositId(null);
    setCustomDepositInput("");
    showNotice(`+${new Intl.NumberFormat("vi-VN").format(val)} ₫ vào "${challenge.name}"`);
  };

  return (
    <div data-testid="savings-challenges-section" className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
              Thử Thách Tiết Kiệm · {getMonthDisplayLabel(activeMonthKey)}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mỗi vòng tròn đồng tâm biểu thị một thử thách tiết kiệm nhỏ trong tháng (cập nhật tự động theo chênh lệch thu-chi hoặc nạp nhanh)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {copySourceMonth && (
            <button
              type="button"
              onClick={handleCopyFromSourceMonth}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Sao chép từ {getMonthDisplayLabel(copySourceMonth)}</span>
            </button>
          )}
          <button
            type="button"
            onClick={openCreateModal}
            data-testid="create-challenge-btn"
            className="min-h-[38px] px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo thử thách</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {challengeSummary.items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-[#DCE4EE] dark:border-slate-800 shadow-xs text-center space-y-3">
          <Target className="w-10 h-10 text-blue-500 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#172B4D] dark:text-slate-100">
              Chưa có thử thách tiết kiệm nào trong {getMonthDisplayLabel(activeMonthKey)}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Bắt đầu từ những thử thách nhỏ như &ldquo;Không trà sữa ngoài&rdquo; hay &ldquo;Giữ thặng dư tháng&rdquo; để theo dõi qua vòng tròn đồng tâm.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {copySourceMonth && (
              <button
                type="button"
                onClick={handleCopyFromSourceMonth}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                Sao chép từ {getMonthDisplayLabel(copySourceMonth)}
              </button>
            )}
            <button
              type="button"
              onClick={openCreateModal}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold cursor-pointer"
            >
              + Thêm thử thách đầu tiên
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 ${
            compact ? "gap-4" : "lg:grid-cols-12 gap-6"
          }`}
        >
          {/* Left: Concentric Circles Visualization */}
          <div
            className={`${
              compact ? "" : "lg:col-span-5"
            } bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#DCE4EE] dark:border-slate-800 shadow-xs flex flex-col justify-between gap-4`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Vòng tròn đồng tâm ({challengeSummary.ringItems.length} vòng)
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                Thặng dư kỳ này: {formatVNDMasked(challengeSummary.activeSurplus, isPrivacyMode)}
              </span>
            </div>

            <ConcentricSavingsRings
              rings={challengeSummary.ringItems}
              overallPct={challengeSummary.overallPct}
              completedCount={challengeSummary.completedCount}
              totalCount={challengeSummary.items.length}
              selectedId={selectedRingId}
              onSelectChallenge={setSelectedRingId}
              isPrivacyMode={isPrivacyMode}
            />

            {challengeSummary.overflowCount > 0 && (
              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                Biểu đồ hiển thị 5 vòng tiêu biểu · +{challengeSummary.overflowCount} thử thách khác ở danh sách bên cạnh
              </p>
            )}
          </div>

          {/* Right: Challenge Cards with Quick Deposit & Auto-Surplus Status */}
          <div className={`${compact ? "" : "lg:col-span-7"} space-y-3`}>
            {challengeSummary.items.map((item) => {
              const c = item.challenge;
              const isSelected = selectedRingId === c.id;
              const isCustomOpen = customDepositId === c.id;

              return (
                <div
                  key={c.id}
                  data-testid={`challenge-card-${c.id}`}
                  onMouseEnter={() => setSelectedRingId(c.id)}
                  onMouseLeave={() => setSelectedRingId(null)}
                  className={`bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border shadow-xs space-y-3 transition-colors ${
                    isSelected
                      ? "border-blue-400 dark:border-blue-500"
                      : item.isCompleted
                      ? "border-emerald-300 dark:border-emerald-500/40"
                      : "border-[#DCE4EE] dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 mt-1"
                        style={{ backgroundColor: c.color }}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <h4 className="font-bold text-sm text-[#172B4D] dark:text-slate-100 truncate">
                            {c.name}
                          </h4>
                          {item.isCompleted && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Đạt mục tiêu
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-1.5">
                          <span className="inline-flex items-center gap-1 font-semibold">
                            {c.trackingMode === "AUTO_SURPLUS" ? (
                              <>
                                <Sparkles className="w-3 h-3 text-emerald-500" />
                                Tự động từ chênh lệch thu-chi
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3 text-blue-500" />
                                Nạp nhanh thủ công
                              </>
                            )}
                          </span>
                          <span>·</span>
                          <span>
                            {c.memberId === "HUSBAND"
                              ? settings.husbandName
                              : c.memberId === "WIFE"
                              ? settings.wifeName
                              : "Cả nhà"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(c)}
                        aria-label={`Sửa ${c.name}`}
                        className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteChallengeId(c.id)}
                        aria-label={`Xóa ${c.name}`}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Numbers & Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
                      <span className="font-black text-slate-800 dark:text-slate-100">
                        {formatVNDMasked(item.savedAmount, isPrivacyMode)}{" "}
                        <span className="font-medium text-slate-400 dark:text-slate-500">
                          / {formatVNDMasked(item.targetAmount, isPrivacyMode)}
                        </span>
                      </span>
                      <span className="font-black" style={{ color: c.color }}>
                        {Math.round(item.progressPct)}%
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.progressPct}%`,
                          backgroundColor: c.color,
                        }}
                      />
                    </div>

                    {c.trackingMode === "AUTO_SURPLUS" && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        Chênh lệch Thu - Chi kỳ này đóng góp:{" "}
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {formatVNDMasked(item.autoSurplusAmount, isPrivacyMode)}
                        </strong>
                        {item.manualSavedAmount > 0 && (
                          <span>
                            {" "}
                            · Nạp thêm: {formatVNDMasked(item.manualSavedAmount, isPrivacyMode)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Quick 1-Tap Deposit Controls */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[50000, 100000, 200000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleQuickDeposit(c, amt)}
                          className="min-h-[34px] px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-500/20 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-bold tabular-nums whitespace-nowrap cursor-pointer transition-colors"
                        >
                          +{amt / 1000}k
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setCustomDepositId(isCustomOpen ? null : c.id);
                          setCustomDepositInput("");
                        }}
                        className="min-h-[34px] px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        {isCustomOpen ? "Đóng" : "Nạp khác"}
                      </button>
                    </div>

                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                      {item.isCompleted
                        ? "Đã hoàn tất mục tiêu!"
                        : `Còn thiếu ${formatVNDMasked(item.remainingAmount, isPrivacyMode)}`}
                    </span>
                  </div>

                  {isCustomOpen && (
                    <form
                      onSubmit={(e) => handleCustomDepositSubmit(e, c)}
                      className="flex items-center gap-2 pt-1"
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        autoFocus
                        value={customDepositInput}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          setCustomDepositInput(
                            raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : ""
                          );
                        }}
                        placeholder="Nhập số tiền nạp (VND)..."
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 tabular-nums"
                      />
                      <button
                        type="submit"
                        className="min-h-[34px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        Nạp ngay
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Tạo / Sửa Thử Thách */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-5 sm:p-6 border border-[#DCE4EE] dark:border-slate-800 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
              <h3 className="text-base font-bold text-[#172B4D] dark:text-slate-100">
                {editingChallenge
                  ? "Chỉnh sửa thử thách tiết kiệm"
                  : `Thêm thử thách · ${getMonthDisplayLabel(activeMonthKey)}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveChallenge} className="space-y-4 pt-4">
              {!editingChallenge && (
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Chọn nhanh mẫu gợi ý:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {SAVINGS_CHALLENGE_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="text-left p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-500/15 border border-[#E9EEF5] dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: tpl.color }}
                          />
                          <span className="truncate">{tpl.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {tpl.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Tên thử thách
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="VD: Không trà sữa, Tự nấu ăn trưa..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Mục tiêu tháng (VND)
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    value={formTarget}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setFormTarget(
                        raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : ""
                      );
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-black text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 tabular-nums text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Đã nạp thủ công (VND)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formManualSaved}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setFormManualSaved(
                        raw ? new Intl.NumberFormat("vi-VN").format(parseInt(raw, 10)) : ""
                      );
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 tabular-nums text-right"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[500000, 1000000, 2000000, 5000000, 15000000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      setFormTarget(new Intl.NumberFormat("vi-VN").format(val))
                    }
                    className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-500/20 text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums cursor-pointer"
                  >
                    {val >= 1_000_000 ? `${val / 1_000_000}tr` : `${val / 1_000}k`}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Cách cập nhật tiến độ
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormMode("MANUAL")}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                      formMode === "MANUAL"
                        ? "bg-blue-50 dark:bg-blue-500/15 border-blue-400 dark:border-blue-500 text-blue-800 dark:text-blue-200"
                        : "bg-slate-50 dark:bg-slate-800 border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span className="font-bold block">Nạp nhanh thủ công</span>
                    <span className="text-[10px] opacity-80">Nạp +50k/+100k/+200k mỗi lần tiết kiệm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMode("AUTO_SURPLUS")}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                      formMode === "AUTO_SURPLUS"
                        ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-400 dark:border-emerald-500 text-emerald-800 dark:text-emerald-200"
                        : "bg-slate-50 dark:bg-slate-800 border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span className="font-bold block">Tự tính Thu - Chi</span>
                    <span className="text-[10px] opacity-80">Tự bám theo chênh lệch thu chi tháng</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    Màu vòng tròn
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {CHALLENGE_RING_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setFormColor(c.hex)}
                        title={c.label}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                          formColor === c.hex
                            ? "ring-2 ring-offset-2 ring-slate-700 dark:ring-white scale-110"
                            : ""
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Thành viên
                  </label>
                  <select
                    value={formMemberId}
                    onChange={(e) => setFormMemberId(e.target.value as FamilyMember)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                  >
                    <option value="SHARED">🏠 Cả nhà</option>
                    <option value="HUSBAND">👨 {settings.husbandName}</option>
                    <option value="WIFE">👩 {settings.wifeName}</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-md text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                >
                  {editingChallenge ? "Cập nhật" : "Lưu thử thách"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteChallengeId !== null}
        title="Xóa thử thách tiết kiệm?"
        message="Vòng tròn và tiến độ thử thách này sẽ bị xóa khỏi tháng đang xem."
        confirmLabel="Xóa thử thách"
        cancelLabel="Hủy"
        isDanger={true}
        onConfirm={() => {
          if (deleteChallengeId) {
            deleteSavingsChallenge(deleteChallengeId);
            setDeleteChallengeId(null);
          }
        }}
        onCancel={() => setDeleteChallengeId(null)}
      />
    </div>
  );
}
