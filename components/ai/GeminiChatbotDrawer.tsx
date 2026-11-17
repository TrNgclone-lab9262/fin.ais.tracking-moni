"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Send,
  Sparkles,
  Trash2,
  Square,
  Copy,
  Check,
  AlertCircle,
  Database,
  Cpu,
  MessageSquare,
  RotateCcw,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { getMonthDisplayLabel } from "@/lib/formatters";
import { useHaptic } from "@/src/hooks/useHaptic";
import {
  CHATBOT_MODEL_ROUTES,
  CHATBOT_ROLES,
  ChatbotModelMode,
  ChatbotRoleId,
  ChatTurnMessage,
  FinancialChatContextSnapshot,
  getChatbotRolePreset,
  resolveChatbotModelRoute,
} from "@/lib/geminiChatConfig";
import {
  clearChatThread,
  GeminiChatRequestError,
  loadChatThread,
  saveChatThread,
  streamGeminiChat,
} from "@/lib/geminiChatService";

interface GeminiChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function createMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function renderInlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function FormattedChatText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-[13px] sm:text-sm leading-relaxed break-words">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }
        if (/^[-•*]\s+/.test(trimmed)) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0" />
              <span className="flex-1">{renderInlineBold(trimmed.replace(/^[-•*]\s+/, ""))}</span>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const match = trimmed.match(/^(\d+\.)\s+(.*)$/);
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0 tabular-nums">
                {match?.[1]}
              </span>
              <span className="flex-1">{renderInlineBold(match?.[2] || trimmed)}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInlineBold(line)}</p>;
      })}
    </div>
  );
}

export function GeminiChatbotDrawer({ isOpen, onClose }: GeminiChatbotDrawerProps) {
  const {
    activeApp,
    activePerspective,
    selectedMonth,
    settings,
    summary,
    budgetSummary,
    husbandCreditCard,
    wifeCreditCard,
    skyoneLoan,
  } = useFinance();

  const haptic = useHaptic();

  const [roleId, setRoleId] = useState<ChatbotRoleId>("family_advisor");
  const [modelMode, setModelMode] = useState<ChatbotModelMode>("general");
  const [includeFinancialContext, setIncludeFinancialContext] = useState<boolean>(true);
  const [messages, setMessages] = useState<ChatTurnMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>("");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Khi mở drawer ở phân hệ SKYONE lần đầu, ưu tiên vai trò Chiến lược gia SKYONE
  useEffect(() => {
    if (!isOpen) return;
    if (activeApp === "SKYONE") {
      setRoleId("skyone_strategist");
      setModelMode("deep");
    }
  }, [isOpen, activeApp]);

  // Nạp lịch sử hội thoại theo roleId
  useEffect(() => {
    const stored = loadChatThread(roleId);
    setMessages(stored);
    setErrorBanner(null);
  }, [roleId]);

  // Cuộn mượt xuống cuối thread khi có tin nhắn hoặc chunk mới
  useEffect(() => {
    if (!isOpen) return;
    threadEndRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
  }, [isOpen, messages, streamingText, isStreaming]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const activeRole = useMemo(() => getChatbotRolePreset(roleId), [roleId]);
  const activeRoute = useMemo(() => resolveChatbotModelRoute(modelMode), [modelMode]);

  const financialContextSnapshot = useMemo<FinancialChatContextSnapshot | null>(() => {
    if (!includeFinancialContext) return null;

    const perspectiveLabel =
      activePerspective === "HUSBAND"
        ? settings.husbandName
        : activePerspective === "WIFE"
        ? settings.wifeName
        : `Cả gia đình (${settings.husbandName} & ${settings.wifeName})`;

    const monthLabel =
      selectedMonth === "ALL" ? "Toàn thời gian" : getMonthDisplayLabel(selectedMonth);

    const cardSummaries: string[] = [];
    if (husbandCreditCard) {
      cardSummaries.push(
        `${husbandCreditCard.account.name}: dùng ${husbandCreditCard.usagePercentage}% (${husbandCreditCard.usedAmount.toLocaleString("vi-VN")} đ)`
      );
    }
    if (wifeCreditCard) {
      cardSummaries.push(
        `${wifeCreditCard.account.name}: dùng ${wifeCreditCard.usagePercentage}% (${wifeCreditCard.usedAmount.toLocaleString("vi-VN")} đ)`
      );
    }

    const overrunItems = budgetSummary.items
      .filter((b) => b.percentage >= 80)
      .map((b) => `${b.categoryName} (${b.percentage}%)`);

    const paidPeriodsCount = skyoneLoan.paidRecords?.length || 0;
    const floatingRateEstimate = Number(
      ((skyoneLoan.floatingBaseRate || 0) + (skyoneLoan.floatingSpread || 0)).toFixed(2)
    );
    const skyoneSummary = `${skyoneLoan.projectName} Căn ${skyoneLoan.unitCode} (${skyoneLoan.bankName}): giá trị HĐ ${skyoneLoan.propertyValue.toLocaleString("vi-VN")} đ, khoản vay gốc ${skyoneLoan.loanAmount.toLocaleString("vi-VN")} đ, đã thanh toán ${paidPeriodsCount}/${skyoneLoan.termMonths} kỳ, lãi suất ưu đãi ${skyoneLoan.fixedInterestRate}% (${skyoneLoan.fixedRateMonths} tháng), thả nổi ước tính ${floatingRateEstimate}%.`;

    return {
      perspectiveLabel,
      monthLabel,
      husbandName: settings.husbandName,
      wifeName: settings.wifeName,
      monthlyIncome: summary.monthlyIncome,
      monthlyExpense: summary.monthlyExpense,
      savingsAmount: summary.savingsAmount,
      savingsRate: summary.savingsRate,
      netWorth: summary.netWorth,
      creditCardSummary: cardSummaries.join("; ") || undefined,
      budgetWarnings: overrunItems.join(", ") || "Không có danh mục vượt 80% ngân sách",
      skyoneSummary,
    };
  }, [
    includeFinancialContext,
    activePerspective,
    selectedMonth,
    settings.husbandName,
    settings.wifeName,
    summary,
    husbandCreditCard,
    wifeCreditCard,
    budgetSummary.items,
    skyoneLoan,
  ]);

  if (!isOpen) return null;

  const handleSelectRole = (nextRoleId: ChatbotRoleId) => {
    if (isStreaming) return;
    haptic.light();
    setRoleId(nextRoleId);
    const preset = getChatbotRolePreset(nextRoleId);
    setModelMode(preset.recommendedMode);
  };

  const handleResetThread = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
    }
    haptic.light();
    clearChatThread(roleId);
    setMessages([]);
    setStreamingText("");
    setErrorBanner(null);
  };

  const handleStopStreaming = () => {
    haptic.light();
    abortControllerRef.current?.abort();
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      haptic.light();
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSendMessage = async (overridePrompt?: string) => {
    const promptText = (overridePrompt ?? inputValue).trim();
    if (!promptText || isStreaming) return;

    haptic.medium();
    setErrorBanner(null);

    const userTurn: ChatTurnMessage = {
      id: createMessageId(),
      role: "user",
      text: promptText,
      createdAt: new Date().toISOString(),
    };

    const historyForRequest = messages.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    const nextMessagesWithUser = [...messages, userTurn];
    setMessages(nextMessagesWithUser);
    saveChatThread(roleId, nextMessagesWithUser);

    if (!overridePrompt) {
      setInputValue("");
    }

    setIsStreaming(true);
    setStreamingText("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulated = "";
    try {
      const result = await streamGeminiChat({
        message: promptText,
        history: historyForRequest,
        roleId,
        mode: modelMode,
        financialContext: financialContextSnapshot,
        signal: controller.signal,
        onChunk: (chunkText) => {
          accumulated += chunkText;
          setStreamingText(accumulated);
        },
      });

      const finalText = (result.fullText || accumulated).trim();
      if (finalText) {
        const modelTurn: ChatTurnMessage = {
          id: createMessageId(),
          role: "model",
          text: finalText,
          createdAt: new Date().toISOString(),
          modelUsed: result.model,
          thinkingLevel: result.thinkingLevel,
        };
        const updatedMessages = [...nextMessagesWithUser, modelTurn];
        setMessages(updatedMessages);
        saveChatThread(roleId, updatedMessages);
        haptic.success();
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        const partial = accumulated.trim();
        if (partial) {
          const partialTurn: ChatTurnMessage = {
            id: createMessageId(),
            role: "model",
            text: `${partial}\n\n_(Đã tạm dừng phản hồi)_`,
            createdAt: new Date().toISOString(),
            modelUsed: activeRoute.model,
            thinkingLevel: activeRoute.thinkingLevel,
          };
          const updatedMessages = [...nextMessagesWithUser, partialTurn];
          setMessages(updatedMessages);
          saveChatThread(roleId, updatedMessages);
        }
      } else {
        haptic.error();
        const message =
          err instanceof GeminiChatRequestError || err instanceof Error
            ? err.message
            : "Đã xảy ra lỗi khi trò chuyện với Gemini AI.";
        setErrorBanner(message);
      }
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      abortControllerRef.current = null;
    }
  };

  const handleRetryLast = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || isStreaming) return;
    // Loại bỏ lượt user cuối trước khi gửi lại để tránh trùng lặp trong lịch sử
    const lastIdx = messages.lastIndexOf(lastUser);
    const trimmedMessages = messages.slice(0, lastIdx);
    setMessages(trimmedMessages);
    saveChatThread(roleId, trimmedMessages);
    window.setTimeout(() => {
      void handleSendMessage(lastUser.text);
    }, 0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Trợ lý AI Chatbot Gemini"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs"
        onClick={() => {
          haptic.light();
          onClose();
        }}
      />

      {/* Drawer / Mobile Full Sheet */}
      <div
        className="relative z-10 w-full md:max-w-xl h-full bg-white dark:bg-slate-900 text-[#172B4D] dark:text-slate-100 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col pt-safe pb-safe animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-gradient-to-r from-indigo-600/8 via-blue-600/5 to-transparent dark:from-indigo-500/15 dark:via-blue-500/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black tracking-tight truncate">
                Trợ lý AI Tài chính Gemini
              </h2>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                {activeRole.name} · {activeRoute.model}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetThread}
              title="Bắt đầu cuộc trò chuyện mới"
              aria-label="Bắt đầu cuộc trò chuyện mới"
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                haptic.light();
                onClose();
              }}
              aria-label="Đóng Trợ lý AI"
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Role (systemInstruction) & Model Config Bar */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 space-y-2 shrink-0">
          {/* Role selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {CHATBOT_ROLES.map((role) => {
              const isSelected = role.id === roleId;
              return (
                <button
                  key={role.id}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => handleSelectRole(role.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer border shrink-0 ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700"
                  } ${isStreaming ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {role.shortName}
                </button>
              );
            })}
          </div>

          {/* Model Mode + Financial Context Switch */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <select
                value={modelMode}
                disabled={isStreaming}
                onChange={(e) => {
                  haptic.light();
                  setModelMode(e.target.value as ChatbotModelMode);
                }}
                aria-label="Chọn mô hình và mức độ suy luận"
                className="text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none cursor-pointer"
              >
                {Object.values(CHATBOT_MODEL_ROUTES).map((route) => (
                  <option key={route.mode} value={route.mode}>
                    {route.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                haptic.light();
                setIncludeFinancialContext((prev) => !prev);
              }}
              aria-pressed={includeFinancialContext}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                includeFinancialContext
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }`}
            >
              <Database className="w-3 h-3" />
              <span>{includeFinancialContext ? "Kèm số liệu tổ ấm" : "Không kèm số liệu"}</span>
            </button>
          </div>
        </div>

        {/* 3. Scrollable Conversation Thread */}
        <div
          data-testid="chatbot-message-thread"
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#F6F8FB] dark:bg-[#0B1220]"
        >
          {messages.length === 0 && !isStreaming ? (
            <div className="py-6 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Vai trò đang chọn</span>
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {activeRole.name}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {activeRole.subtitle}. {activeRoute.description}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                  Gợi ý câu hỏi bắt đầu
                </p>
                <div className="space-y-2">
                  {activeRole.starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void handleSendMessage(prompt)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 text-xs sm:text-[13px] font-semibold text-slate-700 dark:text-slate-200 transition-all active:scale-[0.99] cursor-pointer shadow-2xs"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                        isUser
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-bl-sm"
                      }`}
                    >
                      {isUser ? (
                        <p className="text-[13px] sm:text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.text}
                        </p>
                      ) : (
                        <FormattedChatText text={msg.text} />
                      )}
                    </div>

                    <div className="mt-1 px-1 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                      <span>{isUser ? "Bạn" : msg.modelUsed || "Gemini"}</span>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => void handleCopyMessage(msg.id, msg.text)}
                          className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                          title="Sao chép câu trả lời"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400">Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Sao chép</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Streaming Bubble */}
              {isStreaming && (
                <div className="flex flex-col items-start">
                  <div className="max-w-[88%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-indigo-200 dark:border-indigo-800/70 shadow-2xs">
                    {streamingText ? (
                      <FormattedChatText text={streamingText} />
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 py-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                        <span>{activeRoute.model} đang phân tích...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {errorBanner && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 p-3 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <p className="font-semibold leading-relaxed">{errorBanner}</p>
                <button
                  type="button"
                  onClick={handleRetryLast}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-all active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Thử gửi lại</span>
                </button>
              </div>
            </div>
          )}

          <div ref={threadEndRef} />
        </div>

        {/* 4. Composer Footer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendMessage();
          }}
          className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0"
        >
          <div className="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl px-3 py-2 border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 dark:focus-within:border-indigo-400 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendMessage();
                }
              }}
              placeholder="Hỏi cố vấn AI về chi tiêu, thẻ BIDV hoặc vay SKYONE..."
              className="flex-1 bg-transparent text-[13px] sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none resize-none max-h-28 py-1"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopStreaming}
                aria-label="Dừng phản hồi"
                className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputValue.trim()}
                aria-label="Gửi tin nhắn"
                className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-center text-slate-400 dark:text-slate-500">
            Enter để gửi · Shift + Enter xuống dòng · Lịch sử hội thoại lưu cục bộ theo vai trò
          </p>
        </form>
      </div>
    </div>
  );
}
