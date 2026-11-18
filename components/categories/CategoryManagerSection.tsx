"use client";

import React, { useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  buildCategoryUsageStats,
  CATEGORY_COLOR_SWATCHES,
  CATEGORY_ICON_OPTIONS,
} from "@/lib/categoryUtils";
import { Category } from "@/types/finance";
import { CategoryGlyph, CategoryIconBadge } from "./CategoryIconBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface CategoryManagerSectionProps {
  compact?: boolean;
  headerAction?: React.ReactNode;
  onStatusMessage?: (msg: string) => void;
}

export function CategoryManagerSection({
  compact = false,
  headerAction,
  onStatusMessage,
}: CategoryManagerSectionProps) {
  const {
    categories,
    transactions,
    budgets,
    recurringRules,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryVisibility,
    restoreDefaultCategories,
  } = useFinance();

  const [typeFilter, setTypeFilter] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");
  const [visibilityTab, setVisibilityTab] = useState<"ACTIVE" | "HIDDEN">("ACTIVE");
  const [searchText, setSearchText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [draftColor, setDraftColor] = useState("#3B82F6");
  const [draftIcon, setDraftIcon] = useState("Tag");
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirm state
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<Category | null>(null);

  const notify = (msg: string) => {
    setFeedback(msg);
    onStatusMessage?.(msg);
    window.setTimeout(() => {
      setFeedback((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const usageStats = useMemo(
    () => buildCategoryUsageStats(transactions, budgets, recurringRules),
    [transactions, budgets, recurringRules]
  );

  const counts = useMemo(() => {
    const typeMatched = categories.filter(
      (c) => typeFilter === "ALL" || c.type === typeFilter
    );
    const active = typeMatched.filter((c) => !c.isHidden).length;
    const hidden = typeMatched.filter((c) => Boolean(c.isHidden)).length;
    const hasHiddenOrMissingDefault = categories.some(
      (c) => c.isDefault && c.isHidden
    );
    return { active, hidden, hasHiddenOrMissingDefault };
  }, [categories, typeFilter]);

  const filteredCategories = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return categories.filter((c) => {
      if (typeFilter !== "ALL" && c.type !== typeFilter) return false;
      const isHidden = Boolean(c.isHidden);
      if (visibilityTab === "ACTIVE" && isHidden) return false;
      if (visibilityTab === "HIDDEN" && !isHidden) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [categories, typeFilter, visibilityTab, searchText]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setDraftName("");
    setDraftType(typeFilter === "INCOME" ? "INCOME" : "EXPENSE");
    setDraftColor("#3B82F6");
    setDraftIcon(typeFilter === "INCOME" ? "Briefcase" : "Utensils");
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setDraftName(cat.name);
    setDraftType(cat.type);
    setDraftColor(cat.color || "#3B82F6");
    setDraftIcon(cat.icon || "MoreHorizontal");
    setFormError(null);
    setIsModalOpen(true);
  };

  const editingUsageCount = editingCategory
    ? usageStats.get(editingCategory.id)?.txCount || 0
    : 0;

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = draftName.trim();
    if (!cleanName) {
      setFormError("Vui lòng nhập tên danh mục.");
      return;
    }

    const duplicate = categories.some(
      (c) =>
        c.id !== editingCategory?.id &&
        c.type === draftType &&
        c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      setFormError("Đã tồn tại danh mục trùng tên trong cùng nhóm Thu/Chi.");
      return;
    }

    if (editingCategory) {
      const nextType = editingUsageCount > 0 ? editingCategory.type : draftType;
      updateCategory(editingCategory.id, {
        name: cleanName,
        type: nextType,
        color: draftColor,
        icon: draftIcon,
      });
      notify(`Đã cập nhật danh mục "${cleanName}".`);
    } else {
      addCategory({
        name: cleanName,
        type: draftType,
        color: draftColor,
        icon: draftIcon,
        isHidden: false,
      });
      notify(`Đã thêm danh mục mới "${cleanName}".`);
    }
    setIsModalOpen(false);
  };

  const handleToggleHide = (cat: Category) => {
    const willHide = !cat.isHidden;
    toggleCategoryVisibility(cat.id);
    if (willHide) {
      notify(
        `Đã ẩn "${cat.name}" khỏi các form ghi sổ mới (lịch sử & báo cáo vẫn giữ nguyên).`
      );
    } else {
      notify(`Đã hiển thị lại danh mục "${cat.name}".`);
    }
  };

  const handleRestoreDefaults = () => {
    const restored = restoreDefaultCategories();
    if (restored > 0) {
      notify(`Đã khôi phục hiển thị ${restored} danh mục mặc định.`);
    } else {
      notify("Tất cả danh mục mặc định đều đang hiển thị.");
    }
  };

  const confirmDeleteUsage = confirmDeleteCat
    ? usageStats.get(confirmDeleteCat.id) || {
        txCount: 0,
        budgetCount: 0,
        ruleCount: 0,
      }
    : { txCount: 0, budgetCount: 0, ruleCount: 0 };

  return (
    <div
      data-testid="category-manager-section"
      className={`bg-white dark:bg-slate-900 rounded-xl border border-[#DCE4EE] dark:border-slate-800 shadow-xs space-y-4 ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Tags className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
              Danh Mục Thu / Chi Tùy Chỉnh
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Thêm, sửa hoặc ẩn danh mục ít dùng · Lịch sử giao dịch &amp; báo cáo cũ vẫn được giữ nguyên
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {headerAction}
          {counts.hasHiddenOrMissingDefault && (
            <button
              type="button"
              data-testid="restore-default-categories-btn"
              onClick={handleRestoreDefaults}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hiện lại mặc định</span>
            </button>
          )}
          <button
            type="button"
            data-testid="add-custom-category-btn"
            onClick={openCreateModal}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap shrink-0 shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm danh mục</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
        >
          {feedback}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Switcher */}
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#E9EEF5] dark:border-slate-700">
            {(
              [
                { id: "ALL", label: "Tất cả" },
                { id: "EXPENSE", label: "Chi tiêu" },
                { id: "INCOME", label: "Thu nhập" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTypeFilter(opt.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  typeFilter === opt.id
                    ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Active vs Hidden Switcher */}
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#E9EEF5] dark:border-slate-700">
            <button
              type="button"
              data-testid="category-tab-active"
              onClick={() => setVisibilityTab("ACTIVE")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap tabular-nums cursor-pointer transition-colors ${
                visibilityTab === "ACTIVE"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Đang hiển thị ({counts.active})
            </button>
            <button
              type="button"
              data-testid="category-tab-hidden"
              onClick={() => setVisibilityTab("HIDDEN")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap tabular-nums cursor-pointer transition-colors ${
                visibilityTab === "HIDDEN"
                  ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Đã ẩn ({counts.hidden})
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-52">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Tìm tên danh mục..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Category List */}
      {filteredCategories.length === 0 ? (
        <div className="p-6 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-1.5">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {visibilityTab === "HIDDEN"
              ? "Chưa có danh mục nào đang bị ẩn."
              : "Không tìm thấy danh mục phù hợp."}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {visibilityTab === "HIDDEN"
              ? "Khi bạn ẩn một danh mục mặc định ít dùng, danh mục đó sẽ nằm ở đây để có thể khôi phục bất kỳ lúc nào."
              : "Nhấn \"Thêm danh mục\" để tạo danh mục riêng cho gia đình."}
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-2.5 ${
            compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
          }`}
        >
          {filteredCategories.map((cat) => {
            const usage = usageStats.get(cat.id) || {
              txCount: 0,
              budgetCount: 0,
              ruleCount: 0,
            };
            const isHidden = Boolean(cat.isHidden);

            return (
              <div
                key={cat.id}
                data-testid={`category-item-${cat.id}`}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                  isHidden
                    ? "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-85"
                    : "bg-slate-50/60 dark:bg-slate-800/60 border-[#E9EEF5] dark:border-slate-700/80"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CategoryIconBadge iconName={cat.icon} color={cat.color} />
                  <div className="min-w-0">
                    <p
                      className={`text-xs sm:text-sm font-bold truncate ${
                        isHidden
                          ? "text-slate-500 dark:text-slate-400 line-through"
                          : "text-[#172B4D] dark:text-slate-100"
                      }`}
                    >
                      {cat.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate tabular-nums">
                      <span
                        className={
                          cat.type === "INCOME"
                            ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                            : "text-rose-600 dark:text-rose-400 font-semibold"
                        }
                      >
                        {cat.type === "INCOME" ? "Thu nhập" : "Chi tiêu"}
                      </span>
                      {" · "}
                      {cat.isDefault ? "Mặc định" : "Tùy chỉnh"}
                      {" · "}
                      {usage.txCount > 0
                        ? `${usage.txCount} giao dịch`
                        : "Chưa phát sinh"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid={`edit-category-${cat.id}`}
                    onClick={() => openEditModal(cat)}
                    title="Chỉnh sửa danh mục"
                    aria-label={`Chỉnh sửa danh mục ${cat.name}`}
                    className="min-w-[36px] min-h-[36px] p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    data-testid={`toggle-hide-category-${cat.id}`}
                    onClick={() => handleToggleHide(cat)}
                    title={
                      isHidden
                        ? "Hiện lại khi ghi sổ mới"
                        : "Ẩn khỏi màn hình ghi sổ mới (giữ lịch sử)"
                    }
                    aria-label={
                      isHidden
                        ? `Hiện lại danh mục ${cat.name}`
                        : `Ẩn danh mục ${cat.name}`
                    }
                    className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      isHidden
                        ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-300 hover:text-amber-700 dark:hover:text-amber-300"
                    }`}
                  >
                    {isHidden ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Hiện lại</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Ẩn</span>
                      </>
                    )}
                  </button>

                  {!cat.isDefault && (
                    <button
                      type="button"
                      data-testid={`delete-category-${cat.id}`}
                      onClick={() => setConfirmDeleteCat(cat)}
                      title="Xóa danh mục tùy chỉnh"
                      aria-label={`Xóa danh mục ${cat.name}`}
                      className="min-w-[36px] min-h-[36px] p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Thêm / Sửa Danh Mục */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-5 sm:p-6 border border-[#DCE4EE] dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
              <h3 className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100">
                {editingCategory ? "Chỉnh sửa danh mục" : "Thêm danh mục mới"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              {/* Live Preview */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <CategoryIconBadge iconName={draftIcon} color={draftColor} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#172B4D] dark:text-slate-100 truncate">
                      {draftName.trim() || "Xem trước tên danh mục"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {draftType === "INCOME" ? "Nhóm Thu nhập" : "Nhóm Chi tiêu"}
                    </p>
                  </div>
                </div>
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: draftColor }}
                />
              </div>

              {/* Tên danh mục */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Tên danh mục
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  data-testid="category-name-input"
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="VD: Chăm con, Thú cưng, Bảo dưỡng xe..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              {/* Loại Thu / Chi */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Loại giao dịch
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "EXPENSE", label: "Chi tiêu" },
                      { id: "INCOME", label: "Thu nhập" },
                    ] as const
                  ).map((opt) => {
                    const locked = Boolean(editingCategory && editingUsageCount > 0);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={locked}
                        onClick={() => setDraftType(opt.id)}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                          draftType === opt.id
                            ? opt.id === "EXPENSE"
                              ? "bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300"
                              : "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-slate-50 dark:bg-slate-800 border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        } ${locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {editingCategory && editingUsageCount > 0 && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    Không thể đổi Thu/Chi vì danh mục đã có {editingUsageCount} giao dịch lịch sử.
                  </p>
                )}
              </div>

              {/* Màu sắc */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Màu sắc đại diện
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {CATEGORY_COLOR_SWATCHES.map((swatch) => {
                    const active =
                      draftColor.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        title={swatch.label}
                        onClick={() => setDraftColor(swatch.hex)}
                        className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${
                          active
                            ? "ring-2 ring-offset-2 ring-blue-600 dark:ring-offset-slate-900 scale-110"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      />
                    );
                  })}
                  <label
                    title="Chọn màu tùy chỉnh"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    <input
                      type="color"
                      value={draftColor}
                      onChange={(e) => setDraftColor(e.target.value)}
                      className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span>Tùy ý</span>
                  </label>
                </div>
              </div>

              {/* Biểu tượng */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Biểu tượng
                </label>
                <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-1">
                  {CATEGORY_ICON_OPTIONS.map((opt) => {
                    const active = draftIcon === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        title={opt.label}
                        onClick={() => setDraftIcon(opt.key)}
                        className={`h-9 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                          active
                            ? "bg-blue-50 dark:bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-300"
                            : "bg-slate-50 dark:bg-slate-800 border-[#E9EEF5] dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        <CategoryGlyph iconName={opt.key} className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {formError && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {formError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  data-testid="save-category-btn"
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                >
                  {editingCategory ? "Lưu thay đổi" : "Tạo danh mục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Custom Category */}
      <ConfirmDialog
        isOpen={confirmDeleteCat !== null}
        title={`Xóa danh mục "${confirmDeleteCat?.name || ""}"?`}
        message={
          confirmDeleteUsage.txCount > 0 ||
          confirmDeleteUsage.budgetCount > 0 ||
          confirmDeleteUsage.ruleCount > 0
            ? `Danh mục này đang gắn với ${confirmDeleteUsage.txCount} giao dịch, ${confirmDeleteUsage.budgetCount} ngân sách và ${confirmDeleteUsage.ruleCount} quy tắc định kỳ. Bạn nên dùng nút "Ẩn" để bảo toàn lịch sử báo cáo, hoặc xác nhận xóa nếu thực sự muốn gỡ bỏ.`
            : "Danh mục tùy chỉnh này chưa có giao dịch phát sinh và sẽ bị xóa khỏi danh sách."
        }
        confirmLabel="Xóa danh mục"
        cancelLabel="Giữ lại"
        isDanger={true}
        onConfirm={() => {
          if (confirmDeleteCat) {
            const name = confirmDeleteCat.name;
            deleteCategory(confirmDeleteCat.id);
            setConfirmDeleteCat(null);
            notify(`Đã xóa danh mục "${name}".`);
          }
        }}
        onCancel={() => setConfirmDeleteCat(null)}
      />
    </div>
  );
}
