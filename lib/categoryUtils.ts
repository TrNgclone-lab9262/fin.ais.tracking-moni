import {
  Category,
  CategoryBudget,
  RecurringRule,
  Transaction,
} from "@/types/finance";

export interface CategoryColorSwatch {
  hex: string;
  label: string;
}

export const CATEGORY_COLOR_SWATCHES: CategoryColorSwatch[] = [
  { hex: "#3B82F6", label: "Xanh dương" },
  { hex: "#F43F5E", label: "Đỏ hồng" },
  { hex: "#10B981", label: "Xanh ngọc" },
  { hex: "#F59E0B", label: "Vàng hổ phách" },
  { hex: "#8B5CF6", label: "Tím" },
  { hex: "#EC4899", label: "Hồng" },
  { hex: "#06B6D4", label: "Xanh lơ" },
  { hex: "#6366F1", label: "Chàm" },
  { hex: "#14B8A6", label: "Ngọc lam" },
  { hex: "#EA580C", label: "Cam" },
  { hex: "#1E3A8A", label: "Xanh navy" },
  { hex: "#64748B", label: "Xám đá" },
];

export const CATEGORY_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "Utensils", label: "Ăn uống" },
  { key: "Home", label: "Nhà cửa" },
  { key: "Car", label: "Di chuyển" },
  { key: "ShoppingBag", label: "Mua sắm" },
  { key: "HeartPulse", label: "Sức khỏe" },
  { key: "Zap", label: "Hóa đơn" },
  { key: "Film", label: "Giải trí" },
  { key: "Baby", label: "Con cái" },
  { key: "Dog", label: "Thú cưng" },
  { key: "Coffee", label: "Cà phê" },
  { key: "GraduationCap", label: "Học tập" },
  { key: "Plane", label: "Du lịch" },
  { key: "Gift", label: "Quà tặng" },
  { key: "Wrench", label: "Bảo trì" },
  { key: "Dumbbell", label: "Thể thao" },
  { key: "Briefcase", label: "Công việc" },
  { key: "Laptop", label: "Freelance" },
  { key: "Award", label: "Thưởng" },
  { key: "TrendingUp", label: "Đầu tư" },
  { key: "Wallet", label: "Tài chính" },
  { key: "PiggyBank", label: "Tiết kiệm" },
  { key: "MoreHorizontal", label: "Khác" },
];

/**
 * Trả về các danh mục khả dụng khi GHI SỔ MỚI (ẩn danh mục có isHidden = true).
 * Nếu đang sửa một giao dịch/quy tắc cũ đã gắn với `includeCategoryId` bị ẩn,
 * vẫn giữ danh mục đó trong danh sách để tránh làm mất tham chiếu lịch sử.
 */
export function getSelectableCategories(
  categories: Category[],
  type?: "INCOME" | "EXPENSE",
  includeCategoryId?: string
): Category[] {
  return categories.filter((c) => {
    if (type && c.type !== type) return false;
    if (!c.isHidden) return true;
    return Boolean(includeCategoryId && c.id === includeCategoryId);
  });
}

/**
 * Đếm số lượng giao dịch đã sử dụng theo từng categoryId (phục vụ hiển thị lịch sử & bảo vệ khi xóa)
 */
export function buildCategoryUsageStats(
  transactions: Transaction[],
  budgets: CategoryBudget[],
  recurringRules: RecurringRule[]
): Map<string, { txCount: number; budgetCount: number; ruleCount: number }> {
  const map = new Map<
    string,
    { txCount: number; budgetCount: number; ruleCount: number }
  >();

  const ensure = (id: string) => {
    let entry = map.get(id);
    if (!entry) {
      entry = { txCount: 0, budgetCount: 0, ruleCount: 0 };
      map.set(id, entry);
    }
    return entry;
  };

  for (const tx of transactions) {
    if (tx.type === "TRANSFER") continue;
    ensure(tx.categoryId).txCount += 1;
  }

  for (const b of budgets) {
    ensure(b.categoryId).budgetCount += 1;
  }

  for (const r of recurringRules) {
    ensure(r.categoryId).ruleCount += 1;
  }

  return map;
}

/**
 * Khôi phục trạng thái hiển thị cho toàn bộ danh mục mặc định và bổ sung lại
 * các danh mục mặc định nếu bị thiếu (giữ nguyên danh mục tự tạo).
 */
export function restoreDefaultCategoriesList(
  current: Category[],
  defaults: Category[]
): Category[] {
  const byId = new Map<string, Category>();
  for (const c of current) {
    byId.set(c.id, c);
  }

  const next: Category[] = current.map((cat) =>
    cat.isDefault ? { ...cat, isHidden: false } : cat
  );

  for (const def of defaults) {
    if (!byId.has(def.id)) {
      next.push({ ...def, isHidden: false });
    }
  }

  return next;
}
