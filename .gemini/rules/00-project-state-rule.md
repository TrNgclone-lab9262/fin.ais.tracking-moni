# AGENT RULE: MASTER PROJECT STATE ENFORCEMENT (SSOT)
# Áp dụng cho: Mọi AI Agent, Subagent & Senior Developers tham gia dự án HOME MONI

---

## 1. PRE-FLIGHT DIRECTIVE (BẮT BUỘC TRƯỚC KHI BẮT ĐẦU)
* **Quy tắc số 0:** Trước khi thực hiện bất kỳ lệnh sửa code, tạo file mới, hoặc lập kế hoạch, Agent **BẮT BUỘC PHẢI ĐỌC TỆP `/PROJECT_STATE.md`**.
* Nắm vững:
  1. Phiên bản hiện tại của hệ thống.
  2. Bảng **6 Non-Negotiable Architectural Invariants** (Mục 2 trong `PROJECT_STATE.md`).
  3. Bảng **Component Inventory & Responsibility Matrix** (Mục 4 trong `PROJECT_STATE.md`).

---

## 2. INVARIANT PROTECTION RULES (TUÂN THỦ CÁC QUY TẮC BẤT BIẾN)
Khi viết mã hoặc tái cấu trúc:
1. **Event Sourcing:** Không được cập nhật số dư `currentBalance` thủ công. Luôn sử dụng hàm thuần túy `recalculateAccountBalances`.
2. **Kỷ luật 2 Thẻ BIDV:** Luôn duy trì logic thẻ Chồng 50tr, thẻ Vợ 20tr, chu kỳ sao kê ngày 20, hạn thanh toán ngày 06, cảnh báo an toàn $\le 30\%$.
3. **Dual Shell Separation:** Không mount đồng thời Desktop Shell và Mobile Shell trong DOM để tránh Recharts $0 \times 0$. Mọi `<ResponsiveContainer>` phải có `minWidth={0} minHeight={0}`.
4. **Calm Slate Fintech Theme:** Bắt buộc tuân thủ mã màu định danh (Navy `#1E3A8A`, Active Blue `#2563EB`, Canvas `#F6F8FB`).
5. **Zero-Any TypeScript:** Không sử dụng kiểu `any`. Mọi payload qua Zod schema.
6. **Offline-First:** Luôn đảm bảo LocalStorage V3 hoạt động ổn định 0ms ngay cả khi không có kết nối Supabase.

---

## 3. POST-TASK DIRECTIVE (BẮT BUỘC SAU KHI HOÀN THÀNH TÍNH NĂNG)
Mỗi khi kết thúc một phiên làm việc có:
- Thêm file mới (`[NEW]`) hoặc xóa file (`[DELETE]`).
- Thay đổi cấu trúc dữ liệu hoặc mô hình kế toán.
- Hoàn thành một mốc trong Roadmap.

Agent **BẮT BUỘC PHẢI THỰC HIỆN CÁC BƯỚC SAU:**
1. Cập nhật bảng **Component Inventory & Responsibility Matrix** trong `PROJECT_STATE.md`.
2. Nếu có thay đổi lớn: Tăng version (patch/minor) và thêm một dòng vào **Living Changelog** trong `PROJECT_STATE.md`.
3. Chạy lệnh xác thực tự động:
   ```powershell
   npm run state:verify
   npm run lint
   npm run build
   ```
4. Đảm bảo $100\%$ các lệnh kiểm tra đều vượt qua với mã lỗi $0$.
