# HOME MONI — MASTER LIVING PROJECT STATE (SSOT)
> **Tệp Chủ Tối Thượng & Bản Đặc Tả Trạng Thái Dự Án (Single Source of Truth)**  
> **Phiên bản:** `v1.0.0-foundation` | **Ngày phát hành:** 2026-10-29 | **Môi trường:** Production Ready (PWA / SPA)  
> **Tiêu chuẩn Thiết kế:** Calm Slate Fintech (Slate/Blue/Emerald/Rose) | **Mô hình Kế toán:** Event Sourcing Dual-Member

---

## 1. PROJECT IDENTITY & SYSTEM METADATA

| Thuộc tính | Giá trị chi tiết |
| :--- | :--- |
| **Tên Ứng dụng** | **HOME MONI** (*Home Money Intelligence - Quản Lý Tài Chính Tổ Ấm*) |
| **Đối tượng Sử dụng** | Gia đình 2 vợ chồng trẻ: **Anh Chuột** (Chồng) & **Bé Mèo** (Vợ) |
| **Mục tiêu Cốt lõi** | Quản trị dòng tiền minh bạch, kiểm soát kỷ luật 2 thẻ tín dụng BIDV, theo dõi hạn mức ngày thích ứng, phân bổ 6 hũ tài chính và gia tăng tài sản ròng bền vững. |
| **Kho Lưu Trữ GitHub** | `https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni` |
| **Môi trường Trực tuyến** | Song song: **Google AI Studio** (`https://app-home-moni.ai.studio`) & **Google Antigravity** |
| **Skill Phát Hành** | `home-moni-ais-git-release` (GitHub Flow + CI Check + Conventional Commits + SemVer) |
| **Tech Stack** | React 19 (`^19.0.1`), TypeScript (`^7.0.2`), Vite (`^8.3.0`), Tailwind CSS v4 (`^4.3.3`), Recharts (`^3.10.1`), Motion (`^12.23.24`), Lucide React (`^0.546.0`), Zod (`^4.6.7`), `@google/genai` (`^2.4.0`) |
| **Kiến trúc Trình diễn** | Responsive Adaptive Shell: Phân tách hoàn toàn Desktop Shell (`>= 768px`) và Mobile Shell (`< 768px`) để tối ưu hiệu năng và triệt tiêu lỗi render ẩn $0 \times 0$ của Recharts. |
| **Tầng Dữ liệu** | Offline-First LocalStorage V3 Cache kết hợp kiến trúc sẵn sàng kết nối Supabase Cloud (PostgreSQL + RLS + Realtime). |

---

## 2. NON-NEGOTIABLE ARCHITECTURAL INVARIANTS (6 QUY TẮC BẤT BIẾN)

Mọi hoạt động phát triển, sửa đổi, tái cấu trúc hoặc sinh mã bằng AI **BẮT BUỘC** phải tuân thủ nghiêm ngặt 6 nguyên tắc bất biến sau:

### Invariant 1: Event Sourcing Accounting (Số dư tính từ chuỗi sự kiện)
* **Tuyệt đối không lưu cứng số dư tài khoản:** Thuộc tính `currentBalance` trong danh sách `accounts` không bao giờ được cập nhật thủ công tùy tiện.
* **Quy tắc tính:** Mọi thay đổi về số dư phải được tính toán thông qua hàm thuần túy `recalculateAccountBalances(accounts, transactions)`:
  * *Tài khoản thường (Bank, Cash, E-Wallet):*
    $$\text{Balance} = \text{initialBalance} + \sum \text{Incomes} - \sum \text{Expenses} - \sum \text{TransfersOut} + \sum \text{TransfersIn}$$
  * *Thẻ tín dụng (Credit Card):* Thể hiện dư nợ thực tế đang sử dụng:
    $$\text{DebtBalance} = \text{initialBalance} + \sum \text{Expenses} - \sum \text{Repayments/Incomes}$$

### Invariant 2: BIDV Dual Credit Card Safety Guardrails (Kỷ luật 2 Thẻ Tín Dụng)
* **Cấu hình 2 thẻ:**
  * **Thẻ Anh Chuột (Chồng):** BIDV Visa Platinum — Hạn mức $50.000.000$ VNĐ.
  * **Thẻ Bé Mèo (Vợ):** BIDV Flexi Gold — Hạn mức $20.000.000$ VNĐ.
* **Chu kỳ sao kê & Thanh toán:**
  * Ngày 20 hằng tháng: Chốt sao kê chu kỳ.
  * Ngày 06 tháng kế tiếp: Hạn chót thanh toán dư nợ để hưởng trọn 45 ngày miễn lãi ($0\%$).
* **Tỷ lệ an toàn tín dụng (*Credit Utilization*):** Luôn cảnh báo trực quan khi dư nợ vượt quá $30\%$ hạn mức (Mức an toàn: Thẻ Chuột $\le 15.000.000$đ, Thẻ Mèo $\le 6.000.000$đ).

### Invariant 3: Responsive Dual-Shell Separation (Triệt tiêu lỗi Recharts 0x0)
* **Không bao giờ dùng CSS `hidden` thuần túy để ẩn chứa các thẻ `<ResponsiveContainer>` của Recharts.**
* `app/page.tsx` phải dùng cơ chế phát hiện viewport (`isMobile` state kết hợp `window.matchMedia`) để chỉ mount duy nhất 1 Shell tương ứng:
  * Nếu màn hình di động: Chỉ mount `Mobile Shell` (Bento layout, thumb-zone, Bottom Navigation).
  * Nếu màn hình Desktop: Chỉ mount `Desktop Shell` (Sidebar, TopBar, Bảng 8 cột, Recharts).
* Mọi thẻ `<ResponsiveContainer>` phải luôn kèm thuộc tính bảo vệ `minWidth={0} minHeight={0}`.

### Invariant 4: Calm Slate Fintech Design System
* **Bảng màu định danh:**
  * Primary Navy: `#1E3A8A` (Sidebar, Thương hiệu, Điểm nhấn uy tín).
  * Active Blue: `#2563EB` (Action buttons, Active states, Link, Thẻ Chồng).
  * Canvas Neutral: `#F6F8FB` (Nền ứng dụng nhẹ mắt, không gây mỏi).
  * Card Background: `#FFFFFF` kết hợp viền Slate nhẹ `#DCE4EE` hoặc `#E2E8F0`.
  * Status Colors: Thu nhập/An toàn: Emerald (`#10B981`), Chi tiêu/Cảnh báo: Rose (`#F43F5E`), Hũ ngân sách: Amber (`#F59E0B`).

### Invariant 5: Zero-Any TypeScript & Zod Data Contracts
* Nghiêm cấm sử dụng kiểu `any` trong toàn bộ codebase.
* Mọi cấu trúc dữ liệu lưu trữ, import/export hoặc nhận từ Cloud phải được kiểm tra qua Zod schema trong `lib/validations.ts`. Nếu dữ liệu bị hỏng, hệ thống tự kích hoạt fallback an toàn thay vì làm ứng dụng crash.

### Invariant 6: Offline-First Resilience (0ms Tải trang)
* Ứng dụng phải mở lên ngay lập tức trong $0$ms bằng bộ nhớ đệm `localStorage` (Key: `homemoni_data_v3`).
* Mọi tương tác người dùng phải có phản hồi thị giác tức thì (Optimistic UI), sau đó đồng bộ ngầm với Supabase hoặc Cloud Storage.

---

## 3. TECH STACK & SYSTEM ARCHITECTURE MAP

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TẦNG TRÌNH DIỄN (UI/UX)                        │
├──────────────────────────────────┬─────────────────────────────────────┤
│      DESKTOP SHELL (>= 768px)    │        MOBILE SHELL (< 768px)       │
│ • Sidebar Navigation             │ • Mobile Header Bar                 │
│ • TopBar đa năng (Search, Add)   │ • Bento Net Worth Compact Card      │
│ • Bảng giao dịch 8 cột nâng cao  │ • 3-Second Quick Numpad Sheet       │
│ • 8 Khối Recharts Interactive    │ • Bottom Navigation Bar             │
└──────────────────────────────────┴─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│               TẦNG QUẢN TRỊ TRẠNG THÁI (STATE & DOMAIN ENGINE)         │
├────────────────────────────────────────────────────────────────────────┤
│ • FinanceContext (React Context + Hooks)                               │
│ • Event Sourcing Calculator (recalculateAccountBalances)               │
│ • Bộ lọc 4 chiều: Tháng, Danh mục, Loại GD, Tài khoản, Hội viên       │
│ • Adaptive Daily Spending Limit & 6 Jars Budget Engine                 │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     TẦNG LƯU TRỮ & DỮ LIỆU (PERSISTENCE)               │
├──────────────────────────────────┬─────────────────────────────────────┤
│      LOCAL STORAGE V3 CACHE      │        SUPABASE CLOUD READY         │
│ • Đọc ghi 0ms, hoạt động offline │ • PostgreSQL Tables                 │
│ • Zod Schema Runtime Validation  │ • Realtime WebSocket Sync           │
│ • Backup/Restore JSON File       │ • Row Level Security (RLS)          │
└──────────────────────────────────┴─────────────────────────────────────┘
```

---

## 4. COMPONENT INVENTORY & RESPONSIBILITY MATRIX

Bảng ma trận quản trị toàn bộ các tệp mã nguồn trong dự án HOME MONI:

### 4.1. Core Types, Constants & Validations
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `types/finance.ts` | Định nghĩa toàn bộ interfaces & types (`Transaction`, `Account`, `Category`, `SavingsGoal`, `DebtItem`, `InvestmentItem`...) | **STABLE** |
| `constants/defaultCategories.ts` | 18 danh mục chi tiêu & thu nhập chuẩn Việt Nam phân nhóm rõ ràng (Ăn uống, Nhà cửa, Con cái...) | **STABLE** |
| `constants/mockData.ts` | Dữ liệu mẫu chuẩn của gia đình Anh Chuột & Bé Mèo tháng 10/2026 | **STABLE** |
| `lib/validations.ts` | Zod Schemas kiểm tra tính toàn vẹn dữ liệu giao dịch, tài khoản và sao lưu JSON | **STABLE** |
| `lib/formatters.ts` | Bộ hàm định dạng tiền tệ Việt Nam (`15.000.000 đ`, `15 tr`), ngày tháng tiếng Việt, tỷ lệ phần trăm | **STABLE** |
| `lib/storage.ts` | Cơ chế lưu trữ offline LocalStorage V3, xuất/nhập file JSON dự phòng | **STABLE** |
| `lib/storage.test.ts` | Unit test tự động kiểm tra cơ chế lưu trữ và validation schema | **STABLE** |
| `lib/supabaseClient.ts` | Khởi tạo Supabase client an toàn với fallback khi chưa có biến môi trường | **STABLE** |
| `lib/supabaseMappers.ts` | Bộ chuyển đổi qua lại giữa camelCase (Client) và snake_case (PostgreSQL DB) | **STABLE** |
| `lib/supabaseService.ts` | Dịch vụ CRUD và đồng bộ hóa ngầm với Supabase Cloud | **STABLE** |

### 4.2. State Management & App Routing
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `context/FinanceContext.tsx` | Quản lý state toàn cục, Event Sourcing calculations, CRUD giao dịch, bộ lọc 4 chiều, đồng bộ cloud không vòng lặp | **STABLE** |
| `app/page.tsx` | View Router điều phối layout Desktop/Mobile thích ứng, mount độc quyền shell hiển thị | **STABLE** |
| `app/layout.tsx` | Root Layout thiết lập font sans, metadata và cấu trúc khung bao bọc | **STABLE** |
| `app/globals.css` | Import Tailwind CSS và khai báo các tiện ích toàn cục | **STABLE** |
| `src/App.tsx` | Cầu nối tương thích khởi chạy ứng dụng từ `HomePage` | **STABLE** |
| `src/main.tsx` | Điểm vào khởi tạo ReactDOM Client `createRoot` | **STABLE** |

### 4.3. Shared & Common Components (`components/common/`)
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `components/common/Sidebar.tsx` | Thanh điều hướng trái cho Desktop với logo HOME MONI, menu 7 mục, trạng thái sync | **STABLE** |
| `components/common/TopBar.tsx` | Thanh tiêu đề Desktop tích hợp tìm kiếm nhanh, chuyển đổi góc nhìn (Chồng/Vợ/Cả nhà), nút thêm GD | **STABLE** |
| `components/common/BottomNavBar.tsx` | Thanh điều hướng đáy cho Mobile với nút (+) nổi bật chính giữa | **STABLE** |
| `components/common/MobileDrawer.tsx` | Menu ngăn kéo vuốt từ cạnh trái cho Mobile chứa các tab phụ (Vay nợ, Hướng dẫn, Cài đặt) | **STABLE** |
| `components/common/CategoryIcon.tsx` | Icon biểu trưng màu sắc tương ứng theo từng mã danh mục | **STABLE** |
| `components/common/ConfirmDialog.tsx` | Modal xác nhận hành động nguy hiểm (Xóa giao dịch, Khôi phục cài đặt gốc) | **STABLE** |
| `components/common/ExportImportModal.tsx`| Hộp thoại xuất file sao lưu JSON hoặc nhập file khôi phục dữ liệu | **STABLE** |

### 4.4. Desktop Dashboard Widgets (`components/dashboard/`)
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `components/dashboard/SummaryCards.tsx` | 4 thẻ chỉ số tài chính: Tài sản ròng, Tổng thu, Tổng chi, Tiết kiệm tích lũy | **STABLE** |
| `components/dashboard/DualCreditCardsWidget.tsx` | Widget quản lý trực quan 2 thẻ tín dụng BIDV: Thẻ Chuột 50tr & Thẻ Mèo 20tr | **STABLE** |
| `components/dashboard/FamilyCashflowWidget.tsx` | Thước đo dòng tiền tổ ấm và Widget hạn mức chi tiêu ngày thích ứng (*Adaptive Daily Limit*) | **STABLE** |
| `components/dashboard/MonthlyTrendChart.tsx` | Biểu đồ cột Recharts thể hiện xu hướng thu nhập và chi tiêu qua các tháng | **STABLE** |
| `components/dashboard/ExpensePieChart.tsx` | Biểu đồ Donut Recharts thể hiện tỷ trọng chi tiêu theo từng danh mục | **STABLE** |
| `components/dashboard/IncomePieChart.tsx` | Biểu đồ Donut Recharts thể hiện cơ cấu các nguồn thu nhập của 2 vợ chồng | **STABLE** |
| `components/dashboard/TrendLineCharts.tsx` | Bộ 3 đồ thị đường biểu diễn biến động số dư và chi tiêu lũy kế trong tháng | **STABLE** |
| `components/dashboard/AssetDebtGoalsWidgets.tsx`| Khối Bento phân bổ: Cơ cấu tài sản, Đầu tư, Nợ cần thu/trả, Mục tiêu tiết kiệm | **STABLE** |
| `components/dashboard/RecentActivitySection.tsx`| Danh sách giao dịch mới nhất kèm bộ lọc nhanh | **STABLE** |
| `components/dashboard/FilterBar.tsx` | Thanh công cụ lọc theo tháng, tài khoản, loại thu/chi | **STABLE** |

### 4.5. Mobile-First Components (`components/mobile/`)
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `components/mobile/MobileHeader.tsx` | Thanh header cô đọng cho điện thoại với avatar Chuột & Mèo, nút mở menu | **STABLE** |
| `components/mobile/sheets/MobileNumpadSheet.tsx` | Bàn phím số 3 giây nhập liệu nhanh bằng ngón cái với phím tắt mệnh giá | **STABLE** |
| `components/mobile/sheets/TransactionDetailSheet.tsx`| Sheet xem chi tiết và sửa/xóa giao dịch trên di động | **STABLE** |
| `components/mobile/sheets/CreditCardRepaymentSheet.tsx`| Sheet thanh toán dư nợ thẻ tín dụng BIDV nhanh | **STABLE** |
| `components/mobile/sheets/GoalDepositSheet.tsx` | Sheet nạp thêm tiền vào mục tiêu tiết kiệm | **STABLE** |
| `components/mobile/views/MobileOverviewView.tsx` | Màn hình Tổng quan Bento tối ưu di động với thẻ Net Worth, 2 thẻ BIDV, Hạn mức ngày | **STABLE** |
| `components/mobile/views/MobileTransactionsView.tsx` | Sổ giao dịch dạng thẻ danh sách di động dễ vuốt chạm | **STABLE** |
| `components/mobile/views/MobileAccountsView.tsx` | Màn hình danh sách ví và thẻ tín dụng di động | **STABLE** |
| `components/mobile/views/MobilePlanningView.tsx` | Màn hình quản lý ngân sách 6 hũ và mục tiêu tiết kiệm di động | **STABLE** |

### 4.6. Transaction Modals & Tables (`components/transactions/`)
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `components/transactions/TransactionFormModal.tsx` | Modal nhập liệu giao dịch đầy đủ tính năng cho Desktop | **STABLE** |
| `components/transactions/TransactionList.tsx` | Bảng hiển thị danh sách giao dịch 8 cột và bộ thẻ phân trang | **STABLE** |

### 4.7. Main Feature Views (`components/views/`)
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `components/views/OverviewView.tsx` | Màn hình Tổng quan Desktop quy tụ đầy đủ các widget thống kê | **STABLE** |
| `components/views/TransactionsView.tsx` | Sổ giao dịch Desktop với Bảng 8 cột, tìm kiếm, phân trang và bộ lọc | **STABLE** |
| `components/views/AccountsView.tsx` | Quản lý danh mục tài khoản ngân hàng, ví tiền mặt, thẻ tín dụng BIDV | **STABLE** |
| `components/views/PlanningView.tsx` | Thiết lập ngân sách danh mục, quy tắc 6 hũ, tiến độ các mục tiêu tiết kiệm | **STABLE** |
| `components/views/DebtsInvestView.tsx` | Theo dõi sổ nợ (Ai nợ mình / Mình nợ ai) và danh mục đầu tư (Vàng, Cổ phiếu, Tiết kiệm) | **STABLE** |
| `components/views/GuideView.tsx` | Cẩm nang tài chính gia đình: Lời khuyên chi tiêu, hướng dẫn dùng thẻ tín dụng 45 ngày | **STABLE** |
| `components/views/SettingsView.tsx` | Quản lý thành viên, cấu hình Supabase Cloud, Sao lưu & Khôi phục dữ liệu JSON | **STABLE** |

### 4.8. Release Engineering & Developer Skills
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `scripts/verify-project-state.ts` | Công cụ tự động đối soát tính toàn vẹn giữa PROJECT_STATE.md và mã nguồn thực tế | **STABLE** |
| `scripts/generate-release-meta.mjs` | Script sinh metadata phát hành, Conventional Commits song ngữ EN/VI và 2-5 điểm đặc trưng | **STABLE** |
| `.agents/skills/home-moni-ais-git-release/SKILL.md` | Skill phát hành mã nguồn chuẩn quốc tế kết nối GitHub repo fin.ais.tracking-moni | **STABLE** |
| `.gemini/rules/00-project-state-rule.md` | Quy tắc cưỡng chế AI Agent đọc và cập nhật PROJECT_STATE.md theo vòng đời | **STABLE** |

---

## 5. DATA ENGINE & STORAGE SPECIFICATIONS

### 5.1. Cấu trúc Khóa Lưu trữ LocalStorage V3
* **Storage Key:** `homemoni_data_v3`
* **Schema Contract:** Được kiểm định bằng `storedDataV3Schema` trong `lib/validations.ts`:
```json
{
  "categories": [ ... ],
  "accounts": [ ... ],
  "transactions": [ ... ],
  "budgets": [ ... ],
  "goals": [ ... ],
  "debts": [ ... ],
  "investments": [ ... ],
  "settings": {
    "currency": "VND",
    "theme": "blue",
    "husbandName": "Anh Chuột",
    "wifeName": "Bé Mèo",
    "monthlyIncomeTarget": 50000000
  }
}
```

### 5.2. Hạn Mức Chi Tiêu Ngày Thích Ứng (Adaptive Daily Limit Formula)
Mỗi khi người dùng mở ứng dụng, hệ thống tính toán ngân sách an toàn cho ngày hôm nay dựa trên:
$$D_{\text{remaining}} = \max(1, \text{DaysInMonth} - \text{CurrentDay} + 1)$$
$$\text{RemainingBudget} = \max(0, \text{TotalMonthlyBudget} - \text{TotalSpentSoFar})$$
$$\text{SafeDailyLimit} = \frac{\text{RemainingBudget}}{D_{\text{remaining}}}$$
* Nếu khoản chi trong ngày của gia đình $\le \text{SafeDailyLimit}$: Trạng thái **An toàn (Xanh)**.
* Nếu khoản chi trong ngày vượt quá mức này: Trạng thái **Cảnh báo (Cam/Đỏ)** để 2 vợ chồng chủ động điều chỉnh các ngày tiếp theo.

---

## 6. MILESTONE ROADMAP & VISION 2035 STRATEGY

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│              LỘ TRÌNH CHIẾN LƯỢC TÀI CHÍNH TỔ ẤM HIỆN ĐẠI (2026 - 2035)                │
├─────────────────────┬─────────────────────┬─────────────────────┬──────────────────────┤
│ KỶ NGUYÊN 1         │ KỶ NGUYÊN 2         │ KỶ NGUYÊN 3         │ KỶ NGUYÊN 4          │
│ (2026)              │ (2027 - 2028)       │ (2029 - 2031)       │ (2032 - 2035)        │
│ Nền Tảng Kỷ Luật    │ Ngân Hàng Mở &      │ AI Twin Tài Chính & │ Private Sovereign    │
│ & Di Động Tiện Ích  │ Gia Sản Thời Gian   │ Tự Động Đầu Tư      │ Wealth Vault         │
├─────────────────────┼─────────────────────┼─────────────────────┼──────────────────────┤
│ • Event Sourcing    │ • VietQR & Open     │ • AI Agent Copilot  │ • Local LLM Offline  │
│ • 2 Thẻ BIDV (<30%) │   Banking Sync      │   chủ động đàm phán │   hoàn toàn trên NAS │
│ • PWA Installable   │ • Multi-device Cloud│ • Tự động tái cân   │ • Zero-Knowledge     │
│ • Gemini 2.5 Flash  │   Supabase Realtime │   bằng danh mục đầu │   Proof chia sẻ dữ   │
│   Multimodal OCR    │ • Trợ lý tối ưu nợ  │   tư (Vàng/Cổ phiếu)│   liệu ngân hàng     │
│ • Daily Smart Limit │   thẻ & lãi suất vay│ • Quản trị gia sản  │ • Module giáo dục tài│
│                     │ • Family Cashflow AI│   cho thế hệ con cái│   chính Gamified F2  │
└─────────────────────┴─────────────────────┴─────────────────────┴──────────────────────┘
```

* **v1.0.0 — Foundation Core (Hiện tại - Hoàn tất $100\%$):**
  * Xây dựng trọn vẹn kiến trúc Dual-Member, Event Sourcing accounting, Calm Slate Fintech UI, 8 widget Recharts và 3-Second Quick Numpad mobile sheet.
  * Thiết lập tệp chủ `PROJECT_STATE.md`, script đối soát `verify-project-state.ts`, và skill `home-moni-ais-git-release`.
  * Liên kết kho lưu trữ GitHub chính thức: `https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni`.
  * Đồng bộ môi trường publish Google AI Studio: `https://app-home-moni.ai.studio`.
* **v1.1.0 — Progressive Web App (PWA):**
  * Thêm `manifest.webmanifest`, bộ icon đa độ phân giải, và `sw.js` (Service Worker) để cài đặt trực tiếp lên màn hình chính iPhone / Android.
* **v1.2.0 — Gemini AI Vision & Smart Advisor:**
  * Kích hoạt `@google/genai`: Quét hóa đơn siêu thị tự động bóc tách ngày, tiền, danh mục; Chatbot cố vấn tài chính tổ ấm.
* **v1.3.0 — Supabase Realtime Multi-Device Sync:**
  * Kích hoạt PostgreSQL RLS, đăng nhập tài khoản riêng cho Chồng & Vợ, đồng bộ tức thời qua WebSockets.
* **v2.0.0 — Open Banking & Automation (2027 - 2028):**
  * Tích hợp mã VietQR động và đọc biến động số dư tự động qua SMS Parser / Open Banking API.
* **v3.0.0 — Autonomous Family Wealth & AI Twin (2029 - 2031):**
  * AI Copilot phân tích dữ liệu 10 năm, tái cân bằng danh mục đầu tư Vàng/Cổ phiếu, quản trị tài sản thế hệ con cái.
* **v4.0.0 — Sovereign Private Vault & Next-Gen Education (2032 - 2035):**
  * Chạy Local LLM hoàn toàn offline trên Home NAS, bảo mật Zero-Knowledge và giáo dục tài chính game hóa F2.

---

## 7. LIVING CHANGELOG & CHANGE PROTOCOL

### Giao Thức Thay Đổi (Change Protocol Bắt Buộc Cho AI & Dev)
Khi có bất kỳ thay đổi nào liên quan đến cấu trúc file, mô hình dữ liệu hoặc tính năng mới:
1. **Bước 1:** Kiểm tra 6 Quy tắc Bất Biến tại Mục 2.
2. **Bước 2:** Cập nhật bảng Ma trận Thành phần tại Mục 4 tương ứng với file thêm/sửa/xóa.
3. **Bước 3:** Chạy `npm run state:verify` để đảm bảo tệp chủ đồng bộ $100\%$ với mã nguồn thực tế.
4. **Bước 4:** Ghi nhận phiên bản và nội dung thay đổi vào Changelog bên dưới.

### Lịch Sử Phiên Bản (Living Changelog)
* **v1.0.0-foundation (2026-10-29):**
  * Thiết lập hệ thống nền tảng hoàn chỉnh cho HOME MONI.
  * Phân tách Dual-Shell (Desktop & Mobile) giải quyết triệt để lỗi vòng lặp `Maximum update depth exceeded` và lỗi Recharts $0 \times 0$.
  * Hoàn thành bộ 7 màn hình nghiệp vụ, 8 widget phân tích tài chính, bàn phím số 3 giây và cơ chế Event Sourcing.
  * Ban hành tệp chủ `PROJECT_STATE.md` và script đối soát `verify-project-state.ts`.
  * Đóng gói Skill `home-moni-ais-git-release` theo chuẩn GitHub Flow + CI Verification cho kho lưu trữ `https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni` và môi trường `https://app-home-moni.ai.studio`.
  * Hoàn thiện Kế hoạch Chiến lược Tầm nhìn Tài chính Gia đình Hiện đại 2035.
