# HOME MONI & Phú Đông SKYONE — Tài Liệu Bối Cảnh Tài Chính (`context.md`)

> **Mục đích**: Đây là tài liệu ngữ cảnh chuẩn (Living Context) giúp AI nắm bắt nhất quán gần như tuyệt đối toàn bộ bối cảnh gia đình, dữ liệu pháp lý căn hộ **Phú Đông SKYONE · A.12A.07**, cấu trúc dòng tiền HOME MONI và chiến lược tài chính cho mọi phiên làm việc tiếp theo.
>
> - **Lược đồ kỹ thuật & luật nghiệp vụ (Schema & Invariants)**: Tra cứu tại `system_context.ts`.
> - **Cập nhật nhanh số liệu sống mới nhất**: Vào **Cài đặt → Xuất Context AI (`context.md`)** trong ứng dụng để sao chép hoặc tải bản snapshot tự động theo số dư/giao dịch thực tế hiện tại.

---

## 1. Quy Ước Bảo Mật & Bối Cảnh Gia Đình

- **Thành viên**: `Anh Chuột` (`HUSBAND`) & `Bé Mèo` (`WIFE`) — quản lý tài chính chung gia đình trên ứng dụng **HOME MONI** (`HOME_MONI_DATA_V4`, đơn vị `VND`).
- **Quy ước ẩn danh (Bắt buộc duy trì)**:
  - **Giữ nguyên**: Mã căn hộ **`A.12A.07`**, tên dự án **Phú Đông SKYONE**, tên chi nhánh ngân hàng **BIDV PGD Nguyễn Đình Chiểu**, toàn bộ số tiền (chính xác từng đồng) và các mốc ngày tháng.
  - **Ẩn danh**: Không lưu họ tên cá nhân pháp lý (dùng `Anh Chuột` / `Bé Mèo` / `Bên Mua`) và che số tài khoản ngân hàng chỉ giữ 4 số cuối (VD: `****2943`).
- **Tỷ lệ chia quỹ chung**: Cấu hình động trong `settings.sharedSplitRatioHusband` (mặc định `50% / 50%`), áp dụng cho mọi giao dịch `EXPENSE` có `scope = "FAMILY"`.

---

## 2. Hồ Sơ Pháp Lý & Dòng Tiền Thực Tế — Sub-app Phú Đông SKYONE (`A.12A.07`)

### 2.1. Thông Tin Căn Hộ & Giá Bán HĐMB (Số Cứng — Facts)

| Hạng mục | Số liệu chuẩn xác | Nguồn & Ghi chú đối chiếu |
| :--- | ---: | :--- |
| **Dự án & Vị trí** | Phú Đông SKYONE · Tháp A · Tầng 12A · **Căn A.12A.07** | Đường ĐT 743A, P. Tân Đông Hiệp, TP. Dĩ An, Bình Dương (nay là P. Dĩ An, TP.HCM) |
| **Chủ đầu tư & Bảo lãnh** | Công ty TNHH Đầu Tư Phú Đông 5 | Bảo lãnh nhà ở hình thành trong tương lai: MB Bank CN Sài Gòn (`30/01/2024`); Văn bản đủ điều kiện bán `3744/SXD-QLN` (`28/06/2025`) |
| **Diện tích ước tính từ đơn giá HĐMB** | ~`51,90 m²` thông thủy · ~`55,90 m²` tim tường | Đơn giá TT 05/2024: `27.866.551 đ/m²`; NĐ 02/2022: `28.082.990 đ/m²`; Sàn XD: `25.872.522 đ/m²` |
| **Giá bán chưa VAT & chưa PBT** | **1.446.273.971 đ** | Đã gồm tiền sử dụng đất tạm tính `174.209.381 đ` |
| **Thuế GTGT (VAT tạm tính)** | **127.206.459 đ** | Điều 3.1 HĐMB (có thể điều chỉnh theo cơ quan thuế nếu có) |
| **Tổng giá bán HĐMB (gồm VAT)** | **1.573.480.430 đ** | **Mốc chuẩn `propertyValue` trong Sub-app SKYONE** |
| **Kinh phí bảo trì 2% (ngoài giá bán)** | **28.925.479 đ** | Nộp 1 lần trước bàn giao Q3/2027 (TK PBT MB Bank CN Nam Bình Dương `****7780`) |
| **Tổng nghĩa vụ gồm VAT + PBT 2%** | **1.602.405.909 đ** | Chưa bao gồm lệ phí trước bạ & phí hành chính cấp Giấy chứng nhận |

### 2.2. Vốn Tự Có Đã Thanh Toán (~20% — 5 Đợt Thực Chi Trong 2024)

| Đợt | Ngày thanh toán | Nội dung | Số tiền thực chi |
| :---: | :--- | :--- | ---: |
| 1 | `04/03/2024` | Đặt cọc | `25.000.000 đ` |
| 2 | `20/05/2024` | Mở bán | `55.913.950 đ` |
| 3 | `14/06/2024` | Thanh toán ~5% | `80.914.000 đ` |
| 4 | `11/07/2024` | Thanh toán ~5% | `80.914.000 đ` |
| 5 | `11/07/2024` | Thanh toán ~5% | `80.914.000 đ` |
| **Tổng** | **5 đợt năm 2024** | **Mốc chuẩn `downPayment` trong SKYONE** | **323.655.950 đ** |

> *Ghi chú đối chiếu HĐMB*: Điều 3.3 HĐMB ghi Đợt 1 (20% + VAT) = `314.696.086 đ` (`289.254.794 đ` gốc + `25.441.292 đ` VAT). Tổng thực chi 5 đợt tự có là **`323.655.950 đ`** (cao hơn `+8.959.864 đ`, được chọn làm mốc vốn tự có chuẩn của gia đình).

### 2.3. Lịch Thanh Toán 4 Đợt Theo Điều 3.3 HĐMB (Đối Chiếu Tiến Độ)

| Đợt HĐMB | Tỷ lệ | Thời điểm | Giá trị chưa VAT | VAT tạm tính | Tổng phải nộp | Trạng thái & Nguồn tiền |
| :--- | :---: | :--- | ---: | ---: | ---: | :--- |
| Đợt 1 | 20% | Trong 3 ngày từ khi ký HĐMB | `289.254.794 đ` | `25.441.292 đ` | `314.696.086 đ` | Đã hoàn tất bằng vốn tự có 2024 (`323.655.950 đ`) |
| Đợt 2 | 50% | Trong 7 ngày từ khi ký HĐMB | `723.136.986 đ` | `63.603.230 đ` | `786.740.216 đ` | Đã hoàn tất qua Giải ngân Đợt 1 BIDV (`708.066.194 đ`) + phần bù/đối trừ |
| Đợt 3 | 25% | Thông báo bàn giao (**Quý III/2027**) | `361.568.493 đ` | `38.161.937 đ` | `399.730.430 đ` | Sắp tới: **Giải ngân Đợt 2 BIDV (`393.370.110 đ`)** + bù chênh nhỏ; đồng thời nộp **PBT 2% (`28.925.479 đ`)** & lệ phí trước bạ |
| Đợt 4 | 5% | Nhận Giấy chứng nhận (**Sổ hồng**) | `72.313.698 đ` | `0 đ` | `72.313.698 đ` | Sắp tới (từ Q3/2027): Chuẩn bị giải ngân thêm 5% hoặc dùng tiền mặt để nhận Sổ hồng |

### 2.4. Thông Báo Cho Vay BIDV & Chuỗi 12 Kỳ Sao Kê Đã Xác Thực

- **Ngân hàng**: **BIDV · PGD Nguyễn Đình Chiểu** (181 Nguyễn Đình Chiểu, TP.HCM) · Tài khoản thu nợ: `****2943`.
- **Tỷ lệ cho vay tối đa**: **70% Giá trị HĐMB** (đã gồm VAT, không gồm PBT).
  - **Mốc chuẩn `creditLimit` (tổng 2 đợt giải ngân)**: **`1.101.436.304 đ`** = Đợt 1 (`708.066.194 đ`) + Đợt 2 Q3/2027 (`393.370.110 đ`), khớp 70% × `1.573.480.430 đ` = `1.101.436.301 đ`.
  - *Đối chiếu văn bản*: Thông báo cho vay BIDV ghi trần tối đa dự kiến `1.246.000.000 đ` (lưu tham chiếu pháp lý, không dùng làm dư nợ dự tính).
- **Thông số lãi suất & gốc cố định**:
  - Ngày giải ngân gốc: **`26/08/2025`** · Ngày trả nợ hàng tháng: **Ngày 10**.
  - Lãi cố định ưu đãi: **`5,5%/năm` trong 36 tháng** (từ kỳ #1 đến hết kỳ #36 ngày **`10/08/2028`**) · Tính lãi **`Actual/365`**.
  - Gốc cố định hàng tháng: **`3.056.000 đ/tháng`** · Thời hạn vay trần: **30 năm (360 tháng)**.
- **Phát hiện khớp toán học tuyệt đối giữa Đợt 1 & Sao kê SmartBanking**:
  - Giải ngân Đợt 1: **`708.066.194 đ`**
  - Trừ 3 kỳ gốc chuyển tiếp ban đầu: `3 × 3.056.000 đ = 9.168.000 đ`
  - Kết quả: **`698.898.194 đ`** — khớp sát dư nợ mở sổ trước sao kê kỳ #4 (`10/12/2025`) là **`698.898.193 đ`** (chênh 1đ làm tròn).
- **12 kỳ sao kê đã xác thực (`isVerified = true`, kỳ #4 `10/12/2025` → kỳ #15 `10/11/2026`)**:
  - Tổng gốc đã trả 12 kỳ: `36.672.000 đ` · Tổng lãi đã trả 12 kỳ: `37.501.005 đ` · Tổng tiền mặt 12 kỳ: `74.173.005 đ`.
  - **Dư nợ thực tế sau kỳ #15 (`10/11/2026`)**: **`662.226.193 đ`**.
  - Kỳ trả nợ kế tiếp: **Kỳ #16 (`10/12/2026`)**.
- **Mốc Giải ngân Đợt 2 (Quý III/2027)**:
  - Dự kiến cộng **`+393.370.110 đ`** sau kỳ #24 (`10/08/2027`) khi bàn giao căn hộ.
  - Nghĩa vụ đi kèm bàn giao & Sổ hồng: **PBT 2% (`28.925.479 đ`) + 5% Sổ hồng (`72.313.698 đ`) = `101.239.177 đ`** (+ lệ phí trước bạ & phí hành chính).

### 2.5. Giả Định Chiến Lược Đang Theo Dõi (Assumptions — Có Thể Điều Chỉnh)

- **Lãi suất thả nổi sau `10/08/2028`**: Giả định cơ sở `6,5%` + biên độ `3,5%` = **`10,0%/năm`** (stress test từ `8,5%` đến `13,0%`).
- **Biểu phí phạt trả nợ trước hạn giả định**: Năm 1 `2,0%` · Năm 2 `1,5%` · Năm 3 `1,0%` · Từ Năm 4 (`09/2028` trở đi) **`0%`**.
- **Chiến lược Positive Carry & Quỹ Đệm 08/2028**: Trong giai đoạn ưu đãi `5,5%/năm` (thấp hơn lãi gửi tiết kiệm an toàn ~`6,0–6,5%/năm` và còn phí phạt trả trước), ưu tiên tích lũy **Quỹ Đệm** thay vì trả trước ngay, để:
  1. Chủ động nguồn tiền mặt bàn giao Q3/2027 (`28,93tr` PBT + lệ phí trước bạ + nội thất/5% sổ hồng).
  2. Đánh chặn giảm mạnh dư nợ gốc đúng mốc hết ưu đãi `08/2028` khi phí phạt về `0%`.

---

## 3. Cấu Trúc Dữ Liệu Tài Chính HOME MONI (Tham Chiếu Nhanh)

Chi tiết từng field, kiểu TypeScript và bất biến kiểm toán nằm trong `system_context.ts`. Tóm tắt 6 mảng chính:

1. **Ví & Thẻ (`accounts`)**: Tính số dư hoàn toàn theo Event Sourcing (`initialBalance` + `transactions`). Riêng `CREDIT_CARD` tính theo **dư nợ** (chi tiêu làm tăng dư nợ, chuyển khoản vào thẻ làm giảm dư nợ) và cung cấp mốc `statementDay` / `dueDay` cho **Lịch tài chính**.
2. **Danh mục (`categories`)**: Hỗ trợ thêm/sửa/ẩn danh mục tùy chỉnh. Danh mục `isHidden = true` bị ẩn khi ghi sổ mới nhưng **giữ nguyên trong lịch sử báo cáo & biểu đồ so sánh cùng kỳ**.
3. **Giao dịch (`transactions`)**: Phân biệt rõ `INCOME`, `EXPENSE`, `TRANSFER` (không tính vào tổng thu/chi), gắn `memberId` (`HUSBAND`/`WIFE`/`SHARED`) và `scope` (`FAMILY`/`PERSONAL`).
4. **Ngân sách & So sánh cùng kỳ (`budgets`)**: Ngưỡng cảnh báo `80%` (vàng) và `100%` (đỏ); biểu đồ Overview hỗ trợ so sánh **Tháng trước (MoM)** và **Cùng kỳ năm ngoái (YoY)**.
5. **Định kỳ, Tự động ghi sổ & Lịch tài chính (`recurringRules`)**: Nhắc trước 3 ngày & quá hạn; khoản bật `autoPost` tự ghi khi đến ngày và **tự bỏ qua nếu tháng đó đã nhập tay trùng khớp**; tự quét lịch sử để gợi ý khoản cố định mới; hiển thị đồng bộ trên **Lịch tài chính** cùng kỳ SKYONE và hạn thẻ BIDV.
6. **Nợ ngoài, Đầu tư & Mục tiêu (`debts`, `investments`, `goals`, `savingsChallenges`)**: Hợp nhất vào `Net Worth` và đo năng lực tích lũy Quỹ Đệm cho SKYONE.

---

## 4. Hướng Dẫn Chi Tiết Cách Duy Trì `context.md` Cho Các Phiên AI Sau

Để mỗi khi mở phiên làm việc mới (phát triển tính năng mới hoặc tư vấn dòng tiền SKYONE) AI đều hiểu đúng **100% bối cảnh hiện tại** mà bạn không phải giải thích lại từ đầu, hãy làm theo quy trình 3 bước sau:

### Bước 1: Xuất Snapshot Tự Động từ Ứng Dụng (Mất 5 giây)
1. Mở HOME MONI → vào **Cài đặt** → tìm mục **Xuất Context AI (`context.md`)**.
2. Giữ bật công tắc **Ẩn họ tên & che số tài khoản** (mặc định đang bật).
3. Bấm **Sao chép Context AI** (để dán thẳng vào đầu cuộc hội thoại mới) hoặc **Tải file `context.md`** (để đính kèm file hoặc thay thế file `context.md` trong dự án).

### Bước 2: Phân Tách Rõ 3 Lớp Thông Tin Khi Nạp Thêm Dữ Liệu Mới
Mỗi khi có biến động thực tế (sao kê kỳ #16 trở đi, thông báo giải ngân Đợt 2, thay đổi lương, mở thêm thẻ/khoản nợ), hãy cập nhật theo 3 nhãn rõ ràng để AI không bao giờ suy diễn sai:
- **`[FACTS — Số cứng]`**: Số trên sao kê ngân hàng, HĐMB, phiếu thu, ngày chốt thẻ. AI **không được tự làm tròn hoặc tự sửa**.
- **`[ASSUMPTIONS — Giả định]`**: Lãi thả nổi dự kiến, giá nhà thị trường, giá cho thuê kỳ vọng, ngày bàn giao dự kiến. AI được dùng để chạy mô phỏng/stress-test.
- **`[GOAL — Yêu cầu phiên này]`**: Nêu rõ bạn muốn *(a) Nạp/đối soát dữ liệu*, *(b) Phân tích chiến lược tài chính*, hay *(c) Xây dựng/sửa tính năng mới*.

### Bước 3: Mẫu Ghi Chép Chuẩn Cho Từng Mảng Dữ Liệu (Copy-Paste Khi Cần Bổ Sung Tay)

#### A. Mẫu cập nhật Giao dịch / Dòng tiền tháng mới
```markdown
[FACTS - Dòng tiền tháng YYYY-MM]
- Thu nhập Anh Chuột: ... đ | Thu nhập Bé Mèo: ... đ
- Chi cố định (nhà, điện nước, internet, SKYONE): ... đ
- Chi biến đổi nổi bật (ăn uống, mua sắm, phát sinh lớn): ... đ
- Thặng dư chuyển vào Quỹ Đệm SKYONE tháng này: ... đ
```

#### B. Mẫu cập nhật Hạng mục (Danh mục & Ngân sách)
```markdown
[FACTS - Danh mục & Hạn mức]
- Danh mục mới cần thêm: [Tên] ([Thu/Chi]) · Hạn mức tháng: ... đ
- Danh mục muốn ẩn (giữ lịch sử): [Tên danh mục]
- Quy tắc phân bổ quỹ chung: Anh Chuột ...% / Bé Mèo ...%
```

#### C. Mẫu cập nhật Ví & Thẻ tín dụng
```markdown
[FACTS - Ví & Thẻ tín dụng tại ngày DD/MM/YYYY]
- [Tên ví/ngân hàng] (Chủ sở hữu, ****XXXX): Số dư ... đ
- [Tên thẻ tín dụng] (Hạn mức ... đ, chốt ngày ..., hạn ngày ...): Dư nợ hiện tại ... đ
```

#### D. Mẫu cập nhật Nợ ngoài, Đầu tư & Kỳ mới SKYONE
```markdown
[FACTS - Cập nhật SKYONE & Nợ/Đầu tư]
- SKYONE kỳ #XX (ngày DD/MM/YYYY): Gốc ... đ | Lãi ... đ | Lãi suất ...% | Dư nợ còn lại: ... đ (Sao kê BIDV ****2943)
- Trả trước gốc / Giải ngân mới (nếu có): Ngày ... | Số tiền ... đ | Phí phạt ... đ
- Quỹ Đệm / Sổ tiết kiệm hiện có: ... đ (lãi suất .../năm, đáo hạn ...)
- Nợ ngoài SKYONE (nếu phát sinh): Tên ... | Còn lại ... đ | Lãi suất ...% | Hạn ...
```

---

## 5. Checklist Trước Khi Bắt Đầu Phiên Phát Triển Tính Năng Mới

Khi yêu cầu AI xây dựng tính năng mới trên HOME MONI hoặc SKYONE, bạn chỉ cần nhắc 1 câu:
> *"Hãy đọc `system_context.ts` và `context.md` trước khi thiết kế để đảm bảo khớp schema và số liệu căn A.12A.07."*

AI sẽ tự động đối chiếu toàn bộ kiểu dữ liệu, luật Event Sourcing số dư, quy tắc bảo mật ẩn danh và chuỗi sao kê xác thực của gia đình trước khi viết bất kỳ dòng mã nào.
