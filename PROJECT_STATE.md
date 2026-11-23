# HOME MONI — MASTER LIVING PROJECT STATE (SSOT)
> **Tệp Chủ Tối Thượng & Bản Đặc Tả Trạng Thái Dự Án (Single Source of Truth)**  
> **Phiên bản:** `v1.9.0-fullstack-ecosystem` | **Ngày phát hành:** 2026-11-22 | **Môi trường:** Production Ready (4 Sub-App Ecosystem · Hardened Express + Gemini AI · Supabase Sync & Storage · Three.js 3D · PWA)  
> **Tiêu chuẩn Thiết kế:** Calm Slate Fintech + Warm Architectural Studio | **Mô hình Kế toán:** Event Sourcing Dual-Member + Bank-Grade Micro-Chỉ Gold Ledger + Live BOQ

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
| **Tech Stack** | React 19 (`^19.0.1`), TypeScript (`^7.0.2`), Vite (`^8.3.0`), Tailwind CSS v4 (`^4.3.3`), Three.js (`^0.187.0`), Recharts (`^3.10.1`), Motion (`^12.23.24`), Lucide React (`^0.546.0`), Zod (`^4.6.7`), `@google/genai` (`^3.4.0`) |
| **Kiến trúc Trình diễn** | Responsive Adaptive Shell: Phân tách hoàn toàn Desktop Shell (`>= 768px`) và Mobile Shell (`< 768px`) để tối ưu hiệu năng và triệt tiêu lỗi render ẩn $0 \times 0$ của Recharts. |
| **Tầng Dữ liệu** | Offline-First LocalStorage V4 Cache (`HOME_MONI_DATA_V4`, tự động migrate từ `homemoni_data_v3`) kết hợp Backend Express (`/api/ai/*`) & sẵn sàng đồng bộ Supabase Cloud. |

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
* Ứng dụng phải mở lên ngay lập tức trong $0$ms bằng bộ nhớ đệm `localStorage` (Key: `HOME_MONI_DATA_V4`, tương thích ngược với `homemoni_data_v3`).
* Mọi tương tác người dùng phải có phản hồi thị giác tức thì (Optimistic UI), đi kèm tầng server-side proxy `/api/ai/*` cho các tác vụ Gemini AI an toàn không lộ khóa trên client.

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
| `constants/appVersion.ts` | Nguồn chân lý (SSOT) cho phiên bản ứng dụng, nhật ký thay đổi (Changelog) và hàm so sánh SemVer | **STABLE** |
| `constants/appVersion.test.ts` | Unit test tự động cho hàm `compareSemver` và cấu trúc `APP_CHANGELOG` | **STABLE** |
| `lib/validations.ts` | Zod Schemas kiểm tra tính toàn vẹn dữ liệu giao dịch, tài khoản và sao lưu JSON | **STABLE** |
| `lib/formatters.ts` | Bộ hàm định dạng tiền tệ Việt Nam (`15.000.000 đ`, `15 tr`), ngày tháng tiếng Việt, tỷ lệ phần trăm | **STABLE** |
| `lib/storage.ts` | Cơ chế lưu trữ offline LocalStorage V4 (auto-migrate V3), xuất/nhập file JSON dự phòng | **STABLE** |
| `lib/storage.test.ts` | Unit test tự động kiểm tra cơ chế lưu trữ và validation schema | **STABLE** |
| `lib/financeEngine.ts` | Domain Engine thuần túy: hạn mức ngày, chu kỳ thẻ BIDV, đối soát 2 vợ chồng, heatmap, toàn vẹn Event Sourcing | **STABLE** |
| `lib/financeEngine.test.ts` | Unit test tự động cho các phép tính tài chính trong `financeEngine.ts` | **STABLE** |
| `lib/mortgageEngine.ts` | Engine vay căn hộ Phú Đông SKYONE: dư nợ giảm dần không ân hạn gốc, 2 giai đoạn cố định/thả nổi, mốc lãi suất ngân hàng, Equity/DTI/Stress-test & mô phỏng trả gốc trước hạn | **STABLE** |
| `lib/mortgageEngine.test.ts` | Unit test kiểm định lịch trả nợ SKYONE, bảo toàn snapshot quá khứ, mô phỏng trả trước hạn & DTI | **STABLE** |
| `lib/supabaseClient.ts` | Khởi tạo Supabase client an toàn với fallback khi chưa có biến môi trường | **STABLE** |
| `lib/supabaseMappers.ts` | Bộ chuyển đổi qua lại giữa camelCase (Client) và snake_case (PostgreSQL DB) | **STABLE** |
| `lib/supabaseService.ts` | Dịch vụ CRUD và đồng bộ hóa ngầm với Supabase Cloud | **STABLE** |
| `lib/geminiReceiptService.ts` | Bridge gọi API `/api/ai/*` (quét hóa đơn, nhập liệu ngôn ngữ tự nhiên, phân tích tháng) kèm offline fallback | **STABLE** |
| `lib/authSecurity.ts` | Bảo mật `/login` đa thành viên: băm SHA-256 + salt, WebAuthn Face ID, nén & lưu hình nền khóa từ thư viện thiết bị | **STABLE** |
| `lib/authSecurity.test.ts` | Unit test kiểm tra định dạng mã Code, băm/kiểm chứng SHA-256 và cấu hình khóa đôi | **STABLE** |
| `lib/appRegistry.ts` | Danh mục 4 Sub-app hệ sinh thái HOME MONI (`FINANCE`, `SKYONE`, `GOLD`, `INTERIOR`) & cảnh báo khẩn SKYONE | **STABLE** |
| `lib/appRegistry.test.ts` | Unit test kiểm định cấu hình 4 Sub-app và điều kiện cảnh báo kỳ hạn SKYONE | **STABLE** |
| `lib/appRouting.ts` | Điều phối deep-link SPA cho `/launcher`, `/finance/*`, `/skyone/*`, `/gold/*`, `/interior/*` | **STABLE** |
| `lib/appRouting.test.ts` | Unit test kiểm định parse/build URL và tiêu đề tài liệu 4 Sub-app | **STABLE** |
| `lib/offlineOutbox.ts` | Hàng đợi đồng bộ ngoại tuyến chuẩn Production (coalesce, retryCount, Dead-Letter FAILED không chặn đầu hàng & khôi phục thủ công) | **STABLE** |
| `lib/offlineOutbox.test.ts` | Unit test kiểm định gộp mutation, xả hàng đợi không chặn đầu hàng và Dead-Letter Queue | **STABLE** |
| `lib/apiSchemas.ts` | Zod request schemas cho toàn bộ `/api/ai/*`, unified error contract `{ ok: false, code, message }` & `SlidingWindowRateLimiter` | **STABLE** |
| `lib/apiSchemas.test.ts` | Unit test kiểm định Zod API schemas, giới hạn kích thước ảnh base64, MIME allowlist & Rate Limiter | **STABLE** |
| `lib/skyoneAiService.ts` | Client bridge gọi `POST /api/ai/scan-loan-statement` (OCR thông báo BIDV) & `POST /api/ai/skyone-strategy` (Cố vấn liên thông) | **STABLE** |
| `lib/interiorAiService.ts` | Client bridge gọi `POST /api/ai/scan-boq-quote` (OCR báo giá nhà thầu & so sánh chênh lệch BOQ) | **STABLE** |
| `lib/unifiedAlertsEngine.ts` | Bộ tổng hợp cảnh báo thuần túy 4 Sub-App (`FINANCE`, `SKYONE`, `GOLD`, `INTERIOR`) & Outbox DLQ sắp xếp theo mức độ nghiêm trọng | **STABLE** |
| `lib/unifiedAlertsEngine.test.ts` | Unit test kiểm định cảnh báo xuyên hệ sinh thái 4 Sub-App và thứ tự ưu tiên | **STABLE** |
| `lib/snagPhotoVault.ts` | Lưu trữ Hybrid Local-First (IndexedDB) + Supabase Storage (`household-media`) đồng bộ ảnh Snag List đa thiết bị | **STABLE** |
| `lib/interiorGlbVault.ts` | Lưu trữ Hybrid Local-First (IndexedDB) + Supabase Storage (`household-media`) đồng bộ mô hình 3D GLB/GLTF đa thiết bị | **STABLE** |
| `lib/goldEngine.ts` | Engine Kho Tích Sản Vàng chuẩn Bank-Grade: số học nguyên tỷ lệ micro-chỉ cho 6 đơn vị, kiểm toán bất biến sổ cái, WAC/FIFO/Specific-Lot, Bid Valuation & giả lập Q3/2027 | **STABLE** |
| `lib/goldEngine.test.ts` | Unit test kiểm định chuyển đổi khứ hồi 6 đơn vị vàng không sai số, bất biến sổ cái, FIFO/Specific-Lot & kịch bản chốt lời Q3/2027 | **STABLE** |
| `lib/interiorFloorplan.ts` | Bản vẽ số hóa chuẩn tỷ lệ 1:1 (`1 unit = 1m`) căn hộ Phú Đông SKYONE A.12A.07 (Loại A2 51.0m²/55.3m²), 26 món danh mục & 2 phương án 3D (PA-A PN2 & PA-B Dual Growth Studio) | **STABLE** |
| `lib/interiorBoqEngine.ts` | Engine bóc tách dự toán BOQ thời gian thực, kiểm tra khoảng trống công thái học & cầu nối Sẵn sàng Bàn giao Q3/2027 (FINANCE + GOLD + SKYONE + INTERIOR) | **STABLE** |
| `lib/interiorBoqEngine.test.ts` | Unit test kiểm định ngân sách 100–150tr PA-A/PA-B, Dual Growth Studio, không chồng lấn công thái học & Readiness Bridge | **STABLE** |
| `lib/three/interiorMaterials.ts` | Bộ sinh chất liệu PBR procedural `CanvasTexture` (gỗ sồi ấm, gạch Changyih, vải bouclé, đá marble, 4 style preset) tối ưu WebGL | **STABLE** |
| `lib/three/interiorFurnitureFactory.ts` | Factory dựng mô hình nội thất 3D parametric đa chi tiết cho đủ 26 món (hệ bàn đôi 2 PC/Laptop, kệ sách LED 3000K, Pegboard, bếp chữ L & WC 3 phân khu Hafele) | **STABLE** |
| `lib/three/interiorSceneController.ts` | Bộ điều khiển Three.js lõi: kiến trúc 8 phân khu A.12A.07, trần giật cấp 2.85m, ánh nắng Đông Nam 4 mốc giờ, Orbit/Walkthrough 1.6m, Auto-Cutaway, kéo thả snap 5cm & xuất ảnh PNG | **STABLE** |

### 4.2. State Management & App Routing
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `context/FinanceContext.tsx` | Quản lý state toàn cục, Event Sourcing calculations, CRUD giao dịch, bộ lọc 4 chiều, đồng bộ cloud không vòng lặp | **STABLE** |
| `context/PWAUpdateContext.tsx` | Quản lý vòng đời cập nhật PWA (kiểm tra SW + `/api/app-version` no-store, `SKIP_WAITING` 1 chạm, reload an toàn) | **STABLE** |
| `app/page.tsx` | View Router điều phối layout Desktop/Mobile thích ứng, mount độc quyền shell hiển thị | **STABLE** |
| `app/layout.tsx` | Root Layout thiết lập font sans, metadata và cấu trúc khung bao bọc | **STABLE** |
| `app/globals.css` | Import Tailwind CSS và khai báo các tiện ích toàn cục | **STABLE** |
| `src/App.tsx` | Cầu nối tương thích khởi chạy ứng dụng từ `HomePage` | **STABLE** |
| `src/main.tsx` | Điểm vào khởi tạo ReactDOM Client `createRoot` & đăng ký PWA Service Worker | **STABLE** |
| `src/hooks/usePWAInstall.ts` | Hook quản trị trạng thái cài đặt PWA đa nền tảng (Android/Chromium & iOS Safari) | **STABLE** |
| `server.ts` | Express Server cổng 3000 phục vụ Vite SSR/Dev & các endpoint AI `/api/ai/*`, `/api/health` | **STABLE** |

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
| `components/common/PWAInstallBanner.tsx` | Banner gợi ý cài đặt HOME MONI lên màn hình chính cho 2 vợ chồng | **STABLE** |
| `components/common/PWAUpdateBanner.tsx` | Banner thông báo bản mới trên di động/desktop với nút Cập nhật ngay 1 chạm & toast xác nhận sau nâng cấp | **STABLE** |
| `components/common/ReleaseNotesModal.tsx` | Hộp thoại/Sheet xem nhật ký phiên bản, tính năng mới và cam kết bảo toàn dữ liệu khi cập nhật | **STABLE** |
| `components/common/IOSInstallModal.tsx` | Modal hướng dẫn chi tiết cách cài đặt lên màn hình chính cho iPhone/iPad Safari | **STABLE** |
| `components/common/AppSwitcherWaffle.tsx` | Popover chuyển đổi nhanh giữa 4 Sub-app (`FINANCE`, `SKYONE`, `GOLD`, `INTERIOR`) trên TopBar | **STABLE** |
| `components/common/SubAppIcons.tsx` | Bộ icon vector định danh chuẩn mực cho 4 Sub-app hệ sinh thái HOME MONI | **STABLE** |
| `components/common/SyncOutboxInspector.tsx` | Trình quản trị Hàng đợi Đồng bộ ngoại tuyến (Outbox DLQ): xem trạng thái, thử lại từng mục/hàng loạt & thông báo Smart Merge xung đột | **STABLE** |

### 4.4. Desktop Dashboard Widgets (`components/dashboard/`)
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `components/dashboard/UnifiedNetWorthBanner.tsx` | Thẻ Tổng Gia Sản Hộ Gia Đình Hợp Nhất 4 Sub-App (Thanh khoản ngay ↔ Tổng gia sản gồm Vốn chủ BĐS SKYONE + Kho Vàng Bid), hỗ trợ 100% Privacy Mode | **STABLE** |
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
| `components/dashboard/SkyOneAmortizationChart.tsx` | Biểu đồ Recharts kết hợp Cột Gốc/Lãi và Đường tỷ lệ dư nợ giảm dần SKYONE (chuyển đổi VNĐ/%, 3 mốc tham chiếu) | **STABLE** |
| `components/dashboard/SkyOneCashflowScheduleTable.tsx` | Bảng chi tiết dòng tiền Amortization Schedule SKYONE theo Năm / Tháng (Dư nợ đầu kỳ, Gốc, Lãi, Tổng đóng, Dư nợ cuối kỳ) | **STABLE** |
| `components/skyone/SkyOneAiToolsPanel.tsx` | Bộ công cụ AI cho Sub-App SKYONE: Quét thông báo thu nợ/lãi suất BIDV (OCR) & Cố vấn chiến lược liên thông SKYONE × GOLD × FINANCE | **STABLE** |
| `components/interior/InteriorBoqAiAndPaymentPanel.tsx` | Bộ công cụ AI & Quyết toán cho Sub-App INTERIOR: Quét báo giá nhà thầu (OCR) & Ghi nhận thanh toán đợt sang FINANCE 1 chạm | **STABLE** |

### 4.5. Mobile-First Components (`components/mobile/`)
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `components/mobile/MobileHeader.tsx` | Thanh header cô đọng cho điện thoại với avatar Chuột & Mèo, nút mở menu | **STABLE** |
| `components/mobile/MobileMonthSelector.tsx` | Thanh chọn kỳ/tháng cuộn ngang tối ưu ngón cái cho giao diện tổng quan và giao dịch di động | **STABLE** |
| `components/mobile/sheets/MobileNumpadSheet.tsx` | Bàn phím số 3 giây nhập liệu nhanh bằng ngón cái với phím tắt mệnh giá | **STABLE** |
| `components/mobile/sheets/TransactionDetailSheet.tsx`| Sheet xem chi tiết và sửa/xóa giao dịch trên di động | **STABLE** |
| `components/mobile/sheets/CreditCardRepaymentSheet.tsx`| Sheet thanh toán dư nợ thẻ tín dụng BIDV nhanh | **STABLE** |
| `components/mobile/sheets/GoalDepositSheet.tsx` | Sheet nạp thêm tiền vào mục tiêu tiết kiệm | **STABLE** |
| `components/mobile/sheets/MobileNotificationSheet.tsx` | Bottom sheet thông báo cảnh báo BIDV/ngân sách & ghi sổ nhanh định kỳ trên di động | **STABLE** |
| `components/auth/LoginGateView.tsx` | Màn hình khóa `/login` đôi bo góc hiện đại cho Anh Chuột & Bé Mèo (Code 4-6 số, Face ID, ảnh nền cá nhân, tối ưu mọi màn hình iPhone) | **STABLE** |
| `components/auth/StepUpAuthModal.tsx` | Modal xác thực nâng cao (Code 4-6 số hoặc Face ID) bảo vệ thao tác xóa hàng loạt, Reset mẫu và ghi đè dữ liệu | **STABLE** |
| `components/mobile/views/MobileOverviewView.tsx` | Màn hình Tổng quan Bento tối ưu di động với thẻ Net Worth, 2 thẻ BIDV, Hạn mức ngày | **STABLE** |
| `components/mobile/views/MobileTransactionsView.tsx` | Sổ giao dịch dạng thẻ danh sách di động dễ vuốt chạm | **STABLE** |
| `components/mobile/views/MobileAccountsView.tsx` | Màn hình danh sách ví và thẻ tín dụng di động | **STABLE** |
| `components/mobile/views/MobilePlanningView.tsx` | Màn hình quản lý ngân sách 6 hũ và mục tiêu tiết kiệm di động | **STABLE** |

### 4.6. Transaction Modals & Tables (`components/transactions/`)
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `components/transactions/TransactionFormModal.tsx` | Modal nhập liệu giao dịch đầy đủ tính năng cho Desktop | **STABLE** |
| `components/transactions/TransactionList.tsx` | Bảng hiển thị danh sách giao dịch 8 cột và bộ thẻ phân trang | **STABLE** |
| `components/transactions/ReceiptScannerModal.tsx` | Modal quét và bóc tách hóa đơn tự động bằng Google Gemini Vision AI | **STABLE** |

### 4.7. Main Feature Views (`components/views/`)
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `components/views/OverviewView.tsx` | Màn hình Tổng quan Desktop quy tụ đầy đủ các widget thống kê | **STABLE** |
| `components/views/TransactionsView.tsx` | Sổ giao dịch Desktop với Bảng 8 cột, tìm kiếm, phân trang và bộ lọc | **STABLE** |
| `components/views/AccountsView.tsx` | Quản lý danh mục tài khoản ngân hàng, ví tiền mặt, thẻ tín dụng BIDV | **STABLE** |
| `components/views/PlanningView.tsx` | Thiết lập ngân sách danh mục, quy tắc 6 hũ, tiến độ các mục tiêu tiết kiệm | **STABLE** |
| `components/views/DebtsInvestView.tsx` | Theo dõi sổ nợ (Ai nợ mình / Mình nợ ai) và danh mục đầu tư (Vàng, Cổ phiếu, Tiết kiệm) | **STABLE** |
| `components/views/SkyOneLoanView.tsx` | Tab chuyên biệt Phú Đông SKYONE (5 phân khu: Tổng quan & Stress-Test, Lịch trả nợ, Trả gốc trước hạn, Hợp đồng & Lãi suất, Chi tiết dòng tiền) | **STABLE** |
| `components/views/GuideView.tsx` | Cẩm nang tài chính gia đình: Lời khuyên chi tiêu, hướng dẫn dùng thẻ tín dụng 45 ngày | **STABLE** |
| `components/views/SettingsView.tsx` | Quản lý thành viên, Privacy Mode & PIN 4 số, quản lý danh mục, kiểm tra AI Server & sao lưu JSON | **STABLE** |
| `components/views/DataAdminView.tsx` | Studio Quản trị Dữ liệu đa bảng (8 thực thể: Ngân sách, Mục tiêu, Nợ, Đầu tư, Giao dịch, Ví/Thẻ, Danh mục, Định kỳ) với kiểm toán Event Sourcing | **STABLE** |
| `components/views/AppLauncherView.tsx` | Màn hình Điều phối Hệ sinh thái 4 Sub-app hiển thị KPI tổng hợp Gia sản, SKYONE, Vàng Bid & BOQ Nội thất 3D | **STABLE** |
| `components/views/GoldVaultView.tsx` | Sub-app `GOLD` (5 phân khu: Tổng quan, Sổ lô vàng, Bảng giá & XAU/USD, Kế hoạch DCA, Giả lập thanh khoản Q3/2027) | **STABLE** |
| `components/gold/GoldSidebar.tsx` | Thanh điều hướng Desktop chuyên biệt cho Sub-app Kho Tích Sản Vàng | **STABLE** |
| `components/gold/GoldTopBar.tsx` | Thanh tiêu đề Desktop Sub-app Vàng tích hợp nút làm mới giá tham chiếu server & chuyển đổi Sub-app | **STABLE** |
| `components/gold/GoldMobileHeader.tsx` | Header cô đọng trên Mobile cho Sub-app Kho Tích Sản Vàng | **STABLE** |
| `components/gold/GoldBottomNavBar.tsx` | Bottom Navigation tối ưu ngón cái trên Mobile cho 5 tab Sub-app Vàng | **STABLE** |
| `components/views/InteriorStudioView.tsx` | Sub-app `INTERIOR` (lazy-loaded): Studio 3D/2D song hành, Dự toán BOQ, Sẵn sàng Bàn giao Q3/2027 & Checklist 8 phân khu CĐT | **STABLE** |
| `components/interior/Interior3DViewport.tsx` | Khung nhìn Three.js 3D tương tác (Orbit/Walkthrough/Cutaway/Sun 4 mốc giờ/chụp ảnh PNG/chuyển nhanh PA-A ↔ PA-B) | **STABLE** |
| `components/interior/Interior2DBlueprint.tsx` | Trình chỉnh sửa mặt bằng CAD 2D SVG kèm lớp ảnh nền CAD & CĐT tùy chỉnh độ mờ, kéo thả snap 5cm & cảnh báo công thái học | **STABLE** |
| `components/interior/InteriorSidebar.tsx` | Thanh điều hướng Desktop chuyên biệt cho SKYONE 3D Interior Studio | **STABLE** |
| `components/interior/InteriorTopBar.tsx` | Thanh tiêu đề Desktop Studio Nội thất với bộ chuyển nhanh Phương án A/B & chế độ 3D/2D | **STABLE** |
| `components/interior/InteriorMobileHeader.tsx` | Header cô đọng trên Mobile cho SKYONE 3D Interior Studio | **STABLE** |
| `components/interior/InteriorBottomNavBar.tsx` | Bottom Navigation tối ưu ngón cái trên Mobile cho 4 tab Studio Nội thất | **STABLE** |

### 4.8. Release Engineering & Developer Skills
| Tệp mã nguồn | Trách nhiệm chính | Trạng thái |
| :--- | :--- | :--- |
| `scripts/verify-project-state.ts` | Công cụ tự động đối soát tính toàn vẹn giữa PROJECT_STATE.md và mã nguồn thực tế | **STABLE** |
| `scripts/generate-release-meta.mjs` | Script sinh metadata phát hành, Conventional Commits song ngữ EN/VI và 2-5 điểm đặc trưng | **STABLE** |
| `.agents/skills/home-moni-ais-git-release/SKILL.md` | Skill phát hành mã nguồn chuẩn quốc tế kết nối GitHub repo fin.ais.tracking-moni | **STABLE** |
| `.gemini/rules/00-project-state-rule.md` | Quy tắc cưỡng chế AI Agent đọc và cập nhật PROJECT_STATE.md theo vòng đời | **STABLE** |
| `public/manifest.webmanifest` | Web App Manifest định danh PWA cài đặt toàn màn hình | **STABLE** |
| `public/sw.js` | Service Worker quản lý bộ nhớ đệm ngoại tuyến Stale-While-Revalidate 0ms | **STABLE** |
| `public/icons/icon.svg` | Icon nhận diện thương hiệu tổ ấm chuẩn Calm Slate Fintech đa kích cỡ | **STABLE** |
| `public/apple-touch-icon.png` | Icon chuẩn Apple 180x180 px cho iPhone 14 Pro Max Super Retina XDR WebClip | **STABLE** |
| `public/icons/icon-192.png` | Icon chuẩn PWA 192x192 px sắc nét cho Android & Web App Launcher | **STABLE** |
| `public/icons/icon-512.png` | Icon chuẩn PWA 512x512 px độ phân giải cao cho màn hình Splash PWA | **STABLE** |
| `public/icons/icon-maskable-512.png` | Icon thích ứng PWA Maskable 512x512 px (vùng an toàn Safe Zone 80%) | **STABLE** |

---

## 5. DATA ENGINE & STORAGE SPECIFICATIONS

### 5.1. Cấu trúc Khóa Lưu trữ LocalStorage V4
* **Storage Key:** `HOME_MONI_DATA_V4` (tự động nâng cấp từ `homemoni_data_v3`)
* **Schema Contract:** Được kiểm định bằng `storedDataV4Schema` (và alias tương thích `storedDataV3Schema`) trong `lib/validations.ts`:
```json
{
  "categories": [ ... ],
  "accounts": [ ... ],
  "transactions": [ ... ],
  "budgets": [ ... ],
  "goals": [ ... ],
  "debts": [ ... ],
  "investments": [ ... ],
  "recurringRules": [ ... ],
  "settings": {
    "currency": "VND",
    "theme": "blue",
    "husbandName": "Anh Chuột",
    "wifeName": "Bé Mèo",
    "monthlyIncomeTarget": 50000000,
    "sharedSplitRatioHusband": 50,
    "privacyMode": false
  },
  "skyoneLoan": { ... },
  "goldPortfolio": { ... },
  "interiorStudio": { ... }
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

* **v1.0.0 — Foundation Core (2026-10-29 - Hoàn tất 100%):**
  * Xây dựng trọn vẹn kiến trúc Dual-Member, Event Sourcing accounting, Calm Slate Fintech UI, 8 widget Recharts và 3-Second Quick Numpad mobile sheet.
  * Thiết lập tệp chủ `PROJECT_STATE.md`, script đối soát `verify-project-state.ts`, và skill `home-moni-ais-git-release`.
  * Liên kết kho lưu trữ GitHub chính thức: `https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni`.
  * Đồng bộ môi trường publish Google AI Studio: `https://app-home-moni.ai.studio`.
* **v1.1.0 — Progressive Web App (PWA) & Gemini Vision OCR (Hiện tại - Hoàn tất 100%):**
  * Thêm `public/manifest.webmanifest`, bộ icon đa kích cỡ (`public/icons/icon.svg`), và `public/sw.js` (Service Worker) hỗ trợ cài đặt toàn màn hình và offline caching 0ms.
  * Tích hợp hook `usePWAInstall.ts`, banner cài đặt `PWAInstallBanner.tsx` và modal hướng dẫn cho iPhone/iPad `IOSInstallModal.tsx`.
  * Kích hoạt sẵn tính năng Quét Hóa Đơn bằng Google Gemini Vision AI (`lib/geminiReceiptService.ts`, `components/transactions/ReceiptScannerModal.tsx`) với nút camera 📷 trên thanh ghi chép nhanh di động và TopBar.
* **v1.6.0 — Tab Chuyên Biệt Phú Đông SKYONE (Hiện tại - Hoàn tất 100%):**
  * Xây dựng module quản lý khoản vay căn hộ **Phú Đông SKYONE** (`lib/mortgageEngine.ts`, `components/views/SkyOneLoanView.tsx`) chuẩn ngân hàng (dư nợ giảm dần không ân hạn gốc, 2 giai đoạn cố định/thả nổi, mốc điều chỉnh lãi suất không làm sai snapshot các kỳ đã đóng).
  * Trang bị phân tích BĐS & tài chính thực chiến: Equity %, LTV %, DTI % tự động từ thu nhập gia đình, Stress-test biến động lãi thả nổi (+1%, +2%, +3%), biểu đồ cơ cấu Gốc/Lãi & đường cong giảm dư nợ, mô phỏng trả gốc trước hạn kèm tính phí phạt theo năm.
  * Đồng bộ xuyên suốt toàn app: thẻ truy cập nhanh trên Tổng quan Desktop & Mobile + Mobile Drawer, theo dõi độc lập với tùy chọn ghi kèm Sổ giao dịch, lưu trữ LocalStorage V4, sao lưu JSON & Gói hợp nhất 2 máy.
* **v1.5.0 — iPhone `/login` Responsive, Mobile Parity, 100% Privacy & Couple Sync (Hoàn tất 100%):**
  * Tối ưu toàn diện trang `/login` trên mọi kích thước màn hình iPhone (SE 375px đến Pro Max 430px) và chế độ PWA `viewport-fit=cover`: safe-area padding, dải đồng hồ/chào 1 dòng gọn gàng trên mobile, bàn phím số và hàng nút Face ID + Xác nhận vừa khít 1 màn hình không cần cuộn.
  * Bổ sung đầy đủ parity trên Mobile: `MobileMonthSelector.tsx`, thẻ đối soát quỹ chung & tất toán 1 chạm, tổng kết AI kỳ này (`generateMonthlyDigest`) và ghi sổ định kỳ 1 chạm ngay trên `MobileOverviewView.tsx`.
  * Phủ kín Chế độ Riêng tư 100% (`formatVNDMasked` / `formatShortVNDMasked`) across toàn bộ giao dịch Desktop, Sheet di động và toàn bộ biểu đồ Recharts; dọn sạch 100% kiểu `any`.
  * Triển khai Gói đồng bộ 2 máy (Smart Merge chống trùng ID + xem trước chênh lệch + giữ nguyên bảo mật máy cục bộ) trong `ExportImportModal.tsx` cùng tùy chọn bảo vệ Step-Up (`StepUpAuthModal.tsx`) cho thao tác Reset, xóa hàng loạt và ghi đè dữ liệu.
* **v1.4.0 — Secure Couple `/login`, Mobile Face ID & Custom Wallpapers (Hoàn tất 100%):**
  * Thiết kế màn hình khóa `/login` (`components/auth/LoginGateView.tsx`) phong cách Calm Slate Glass-Minimalist bo góc hiện đại cho **Anh Chuột** & **Bé Mèo** với hồ sơ tách biệt, mã Code 4–6 chữ số băm SHA-256 + muối (`lib/authSecurity.ts`), WebAuthn Face ID trên mobile kèm mã Code dự phòng, và tải ảnh cá nhân trực tiếp từ thư viện thiết bị làm hình nền khóa.
  * Tích hợp tự động khóa khi rảnh (`autoLockMinutes`), khóa khi thu gọn nền (`lockOnBackground`), đồng bộ URL `/login`, trung tâm thông báo di động (`MobileNotificationSheet.tsx`), nút ghi sổ tất cả định kỳ 1 chạm và xuất báo cáo CSV/Excel (`exportTransactionsToCsv`).
* **v1.3.0 — Mobile PWA 1-Tap Auto-Update (Hoàn tất 100%):**
  * Triển khai hệ thống phát hiện bản mới tức thì khi mở app qua endpoint `/api/app-version` (`no-store`) + `/version.json` kết hợp vòng đời Service Worker (`waiting` -> `SKIP_WAITING`).
  * Bổ sung `PWAUpdateContext.tsx`, banner `PWAUpdateBanner.tsx` (1 chạm "Cập nhật ngay"), modal `ReleaseNotesModal.tsx` và Trung tâm Phiên bản & Kiểm tra cập nhật thủ công trong `SettingsView.tsx` + `GuideView.tsx`.
* **v1.2.0 — Data Studio, Couple Settlement & Server-Side Gemini AI (Hoàn tất 100%):**
  * Triển khai Backend Express (`server.ts`) với các endpoint `/api/health`, `/api/ai/scan-receipt`, `/api/ai/parse-transaction`, `/api/ai/monthly-digest` bảo mật khóa API trên server.
  * Tách toàn bộ phép tính tài chính thuần túy sang `lib/financeEngine.ts` (hạn mức ngày động, chu kỳ sao kê 45 ngày BIDV, đối soát chi tiêu chung 2 vợ chồng, kiểm toán Event Sourcing) kèm bộ unit test `lib/financeEngine.test.ts`.
  * Bổ sung **Data Studio (`DataAdminView.tsx`)** cho phép Add / Modify / Delete đồng bộ xuyên suốt 8 bảng dữ liệu (Ngân sách, Mục tiêu, Khoản nợ, Đầu tư, Giao dịch, Ví/Thẻ, Danh mục, Giao dịch định kỳ), Privacy Mode, khóa PIN 4 số và quản lý Thu/Chi định kỳ.

---

## 7. LIVING CHANGELOG & CHANGE PROTOCOL

### Giao Thức Thay Đổi (Change Protocol Bắt Buộc Cho AI & Dev)
Khi có bất kỳ thay đổi nào liên quan đến cấu trúc file, mô hình dữ liệu hoặc tính năng mới:
1. **Bước 1:** Kiểm tra 6 Quy tắc Bất Biến tại Mục 2.
2. **Bước 2:** Cập nhật bảng Ma trận Thành phần tại Mục 4 tương ứng với file thêm/sửa/xóa.
3. **Bước 3:** Chạy `npm run state:verify` để đảm bảo tệp chủ đồng bộ $100\%$ với mã nguồn thực tế.
4. **Bước 4:** Ghi nhận phiên bản và nội dung thay đổi vào Changelog bên dưới.

### Lịch Sử Phiên Bản (Living Changelog)
* **v1.9.0-fullstack-ecosystem (2026-11-22):**
  * **Wave 1 (Backend Hardening & Version SSOT):** Bổ sung `lib/apiSchemas.ts` (Zod validation end-to-end cho toàn bộ `/api/ai/*`, unified error contract `{ ok: false, code, message }`, `SlidingWindowRateLimiter` 2 tầng), security headers, timeout `AbortController`, disk-backed calibrated `GET /api/gold/reference-prices`, nâng cấp `GET /api/health`, và đồng bộ SSOT phiên bản `1.9.0`.
  * **Wave 2 (Cloud Sync Chống Ghi Đè, Dead-Letter Outbox & Media Đa Thiết Bị):** Nâng cấp `supabase/schema.sql` với cột `revision` + trigger chống ghi đè cho 3 bảng JSONB (`skyone_loans`, `gold_portfolios`, `interior_studios`), Smart Merge tự động khi 2 máy sửa đồng thời, kéo Realtime tăng dần theo bảng (`fetchSingleTablePatch`), nâng cấp `lib/offlineOutbox.ts` chuẩn Dead-Letter Queue kèm `SyncOutboxInspector.tsx`, và bổ sung bucket private `household-media` + đồng bộ Hybrid Local-First/Cloud cho `lib/snagPhotoVault.ts` & `lib/interiorGlbVault.ts`.
  * **Wave 3 (Full-Stack & AI Parity 4 Sub-App):** Thêm 3 endpoint AI mới (`POST /api/ai/scan-loan-statement`, `POST /api/ai/skyone-strategy`, `POST /api/ai/scan-boq-quote`), giao diện `SkyOneAiToolsPanel.tsx` (OCR thông báo BIDV & Cố vấn liên thông SKYONE × GOLD × FINANCE), `InteriorBoqAiAndPaymentPanel.tsx` (OCR báo giá nhà thầu & cầu nối quyết toán Nội thất ↔ FINANCE), và bộ hiệu chỉnh biên độ nội địa Nhẫn 9999/SJC trong `GoldPricesTab.tsx`.
  * **Wave 4 (Hệ Sinh Thái Hợp Nhất):** Triển khai `computeUnifiedHouseholdNetWorth` (chống đếm trùng vàng cũ) + `UnifiedNetWorthBanner.tsx` trên Desktop/Mobile Overview & AppLauncher, Trung tâm Cảnh báo Hợp nhất 4 Sub-App (`lib/unifiedAlertsEngine.ts`) tích hợp trên `TopBar.tsx` & `MobileNotificationSheet.tsx`, và mở rộng `DataAdminView.tsx` thêm 4 tab kiểm toán (`SKYONE Loan`, `Kho Vàng`, `Nội thất 3D`, `Sync Outbox`).
* **v1.8.0-bank-grade-gold (2026-11-21):**
  * Nâng cấp lõi Kho Tích Sản Vàng chuẩn Bank-Grade với số học nguyên tỷ lệ micro-chỉ cho 6 đơn vị (Lượng, Chỉ, Phân, Ly, Gram, Troy Oz), kiểm toán 7 bất biến sổ cái (`verifyGoldPortfolioIntegrity`, `calculateLedgerIntegrity`) kèm đối soát két vật lý trên UI và phục hồi an toàn `parseGoldPortfolioSafely` trong `lib/validations.ts`.
* **v1.7.0-gold-interior-3d (2026-11-20):**
  * Mở rộng hệ sinh thái HOME MONI từ 2 lên **4 Sub-app liên thông** (`FINANCE`, `SKYONE`, `GOLD`, `INTERIOR`) trên `AppLauncherView.tsx`, `AppSwitcherWaffle.tsx`, `MobileDrawer.tsx`, `lib/appRegistry.ts` và `lib/appRouting.ts`.
  * Triển khai **Sub-app `GOLD` (`/gold/*`)** với `lib/goldEngine.ts`, `components/views/GoldVaultView.tsx`, endpoint tham chiếu `GET /api/gold/reference-prices` (cache 15 phút), hạch toán WAC/FIFO/Specific-Lot, định giá theo giá Mua vào (Bid), phân tích chênh lệch XAU/USD và giả lập thanh khoản Q3/2027.
  * Triển khai **Sub-app `INTERIOR` (`/interior/*` · Three.js Core lazy-loaded)** cho căn hộ **Phú Đông SKYONE A.12A.07 (Loại A2 51.0m²/55.3m²)** với `lib/three/*`, `Interior3DViewport.tsx`, `Interior2DBlueprint.tsx`, `InteriorStudioView.tsx`: 2 phương án 3D so sánh trực tiếp (**PA-A Phòng Ngủ 2 Linh Hoạt ~118tr** & **PA-B Dual Growth Studio 2 dàn PC/Laptop cho 2 vợ chồng ~140tr**), ánh nắng Đông Nam 4 mốc giờ, Walkthrough 1.6m, BOQ live 100–150tr và Cầu nối Sẵn sàng Bàn giao Q3/2027.
* **v1.6.0-phudong-skyone (2026-11-13):**
  * Thêm hợp đồng vay căn hộ `MortgageContract` (`skyoneLoan`) vào `types/finance.ts`, Zod contract `lib/validations.ts`, `lib/storage.ts` (kèm Smart Merge chống trùng kỳ đã đóng / đợt trả trước hạn / mốc lãi suất) và `FinanceContext.tsx`.
  * Xây dựng engine thuần túy `lib/mortgageEngine.ts` + bộ test `lib/mortgageEngine.test.ts` cho công thức dư nợ giảm dần không ân hạn gốc, 2 giai đoạn cố định/thả nổi, Equity %, DTI %, Stress-test lãi suất và mô phỏng trả gốc trước hạn.
  * Triển khai `components/views/SkyOneLoanView.tsx` (100% Privacy Mode, nhắc lịch nội bộ tab, lọc kỳ/nhảy tới kỳ hiện tại/đóng hàng loạt, biểu đồ Recharts, cấu hình hợp đồng) cùng thẻ truy cập nhanh trên `OverviewView.tsx`, `MobileOverviewView.tsx`, `Sidebar.tsx`, `MobileDrawer.tsx`.
* **v1.5.0-mobile-iphone-parity (2026-11-13):**
  * Tối ưu `/login` responsive mọi dòng iPhone (`index.html` `viewport-fit=cover`, `app/globals.css` `pt-safe`/`pb-safe`/`touch-action: manipulation`, `LoginGateView.tsx` bố cục `min-h-[100dvh]` vừa khít 1 màn hình trên iPhone SE/15/Pro Max).
  * Nâng cấp Mobile Parity: thêm `MobileMonthSelector.tsx`, đối soát quỹ chung & tất toán 1 chạm, tóm tắt AI kỳ này và nút ghi sổ định kỳ 1 chạm trên `MobileOverviewView.tsx` + `MobileTransactionsView.tsx`.
  * Phủ kín Privacy Mode 100% cho `TransactionsView.tsx`, `TransactionList.tsx`, `RecentActivitySection.tsx`, `TransactionDetailSheet.tsx`, `GoalDepositSheet.tsx`, `CreditCardRepaymentSheet.tsx` (kèm sửa ngày sao kê/hạn trả động) và 5 widget biểu đồ Recharts; loại bỏ triệt để toàn bộ kiểu `any`.
  * Triển khai Couple Sync Package (`mergeFinanceData`, `previewMergeDiff`, `parseSyncBundleText` trong `lib/storage.ts`) với UI sao chép/dán/xem trước trong `ExportImportModal.tsx`, cùng tùy chọn bảo vệ thao tác nguy hiểm (`requireAuthForDangerActions` + `StepUpAuthModal.tsx`).
* **v1.4.0-login-security (2026-11-13):**
  * Ra mắt màn hình khóa `/login` bo góc hiện đại (`components/auth/LoginGateView.tsx`) cùng mô hình bảo mật đôi cho Anh Chuột & Bé Mèo trong `lib/authSecurity.ts`: mã Code 4–6 số băm SHA-256 + muối, Face ID WebAuthn trên di động có fallback dự phòng, và tùy chỉnh hình nền khóa từ ảnh cá nhân trong thiết bị (nén Canvas lưu riêng tại `HOME_MONI_WALLPAPERS_V1`).
  * Nâng cấp `SettingsView.tsx`, `TopBar.tsx`, `MobileHeader.tsx`, `Sidebar.tsx`, `MobileDrawer.tsx` để cấu hình từng người, khóa nhanh `/login` và cấu hình tự động khóa phiên.
  * Bổ sung `MobileNotificationSheet.tsx`, loại bỏ mốc tháng cứng trong `FinanceContext.tsx` sang dải tháng động theo dữ liệu thực tế, thêm nút ghi sổ định kỳ hàng loạt (`applyAllPendingRecurringRules`) và xuất báo cáo CSV/Excel trong `ExportImportModal.tsx`.
* **v1.3.0-pwa-autoupdate (2026-10-31):**
  * Nâng cấp Service Worker (`public/sw.js`) với cơ chế giữ phiên bản mới ở trạng thái chờ (`waiting`), bỏ qua cache cho `/api/*`, `/version.json`, `/sw.js`, và áp dụng Network-First cho trang HTML để tránh kẹt giao diện cũ.
  * Bổ sung `GET /api/app-version` (`no-store`), `constants/appVersion.ts` (SSOT phiên bản & changelog) và `context/PWAUpdateContext.tsx` tự kiểm tra bản mới mỗi lần mở app, quay lại từ nền hoặc lấy lại mạng.
  * Ra mắt `PWAUpdateBanner.tsx` (1 chạm "Cập nhật ngay"), `ReleaseNotesModal.tsx` (xem ghi chú thay đổi) và thẻ **Phiên Bản & Cập Nhật Ứng Dụng** trong `SettingsView.tsx` kèm nút kiểm tra thủ công và hướng dẫn cập nhật trên iPhone/Android.
* **v1.2.0-data-studio (2026-10-30):**
  * Sửa triệt để các chỉ số giả/cứng trên Mobile & Desktop (hạn mức ngày động, ngày sao kê/hạn thanh toán BIDV, liên kết Sửa giao dịch trên mobile, nạp mục tiêu & trả/thu nợ chuẩn Event Sourcing).
  * Bổ sung Backend Express `/api/ai/*` (Quét hóa đơn đa dòng, Nhập liệu ngôn ngữ tự nhiên, Trợ lý phân tích tài chính tháng), Đối soát quỹ chung 2 vợ chồng, Quản lý Thu/Chi định kỳ, Privacy Mode & Khóa PIN 4 số.
  * Ra mắt tab **Quản trị Dữ liệu (`DataAdminView.tsx`)** theo phong cách Supabase Studio/Airtable kết nối trực tiếp `FinanceContext` cùng kiểm toán toàn vẹn Event Sourcing 100%.
* **v1.1.0-pwa (2026-10-30):**
  * Chuyển đổi HOME MONI thành Progressive Web App (PWA) cài đặt trực tiếp lên iPhone/Android, chạy độc lập toàn màn hình.
  * Tích hợp Service Worker (`public/sw.js`) lưu bộ nhớ đệm ngoại tuyến Stale-While-Revalidate mở app tức thì 0ms.
  * Xuất trọn bộ icon PNG chất lượng cao từ ảnh cưới "Anh Chuột & Bé Mèo" (`public/apple-touch-icon.png` 180x180 px cho iPhone 14 Pro Max, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`).
  * Tạo bộ icon nhận diện thương hiệu tổ ấm chuẩn Calm Slate Fintech (`public/icons/icon.svg`).
  * Xây dựng hook `usePWAInstall.ts`, banner `PWAInstallBanner.tsx` và modal hướng dẫn Safari iOS `IOSInstallModal.tsx`.
  * Tích hợp dịch vụ bóc tách hóa đơn `lib/geminiReceiptService.ts` và modal `ReceiptScannerModal.tsx`.
  * Kích hoạt nút chụp ảnh hóa đơn (icon 📷) trên thanh ghi chép nhanh di động (`MobileNumpadSheet.tsx`), thanh tiêu đề di động (`MobileHeader.tsx`) và Desktop TopBar (`TopBar.tsx`).
* **v1.0.0-foundation (2026-10-29):**
  * Thiết lập hệ thống nền tảng hoàn chỉnh cho HOME MONI.
  * Phân tách Dual-Shell (Desktop & Mobile) giải quyết triệt để lỗi vòng lặp `Maximum update depth exceeded` và lỗi Recharts $0 \times 0$.
  * Hoàn thành bộ 7 màn hình nghiệp vụ, 8 widget phân tích tài chính, bàn phím số 3 giây và cơ chế Event Sourcing.
  * Ban hành tệp chủ `PROJECT_STATE.md` và script đối soát `verify-project-state.ts`.
  * Đóng gói Skill `home-moni-ais-git-release` theo chuẩn GitHub Flow + CI Verification cho kho lưu trữ `https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni` và môi trường `https://app-home-moni.ai.studio`.
  * Hoàn thiện Kế hoạch Chiến lược Tầm nhìn Tài chính Gia đình Hiện đại 2035.
