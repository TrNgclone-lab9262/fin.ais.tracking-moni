/**
 * @file appVersion.ts
 * @description Nguồn chân lý duy nhất (SSOT) cho số phiên bản, build ID và lịch sử thay đổi (Changelog) của HOME MONI.
 * Dùng chung cho Client UI, Service Worker và Express API /api/app-version.
 */

export interface AppReleaseEntry {
  version: string;
  buildId: string;
  releasedAt: string;
  title: string;
  highlights: string[];
  mandatory?: boolean;
}

export const APP_VERSION = '1.6.0';
export const APP_BUILD_ID = 'v1.6.0-phudong-skyone';
export const APP_RELEASE_DATE = '2026-11-13';

export const APP_CHANGELOG: AppReleaseEntry[] = [
  {
    version: '1.6.0',
    buildId: 'v1.6.0-phudong-skyone',
    releasedAt: '2026-11-13',
    title: 'Tab chuyên biệt Phú Đông SKYONE — Quản Lý Vay & BĐS Toàn Diện',
    highlights: [
      'Ra mắt tab Phú Đông SKYONE áp dụng chuẩn dư nợ giảm dần không ân hạn gốc, hỗ trợ 2 giai đoạn Lãi cố định ưu đãi & Lãi thả nổi (Cơ sở + Biên độ) cùng mốc điều chỉnh lãi suất thực tế từ ngân hàng.',
      'Bảng theo dõi thanh toán từng kỳ đa bộ lọc (Trạng thái, Giai đoạn, Năm vay), nhảy nhanh tới kỳ hiện tại, xác nhận từng kỳ hoặc hàng loạt kèm tùy chọn liên kết Sổ giao dịch.',
      'Phân tích chuyên sâu BĐS & Tài chính: Vốn chủ sở hữu (Equity %), LTV, gánh nặng trả nợ trên thu nhập gia đình (DTI %), bảng Stress-test biến động lãi thả nổi (+1%, +2%, +3%) và biểu đồ Gốc/Lãi/Dư nợ.',
      'Mô phỏng & lưu đợt Trả gốc trước hạn (tính phí phạt theo năm, lãi tiết kiệm ròng, rút ngắn kỳ hạn hoặc giảm đóng tháng) cùng đồng bộ hoàn toàn vào Sao lưu JSON và Gói hợp nhất 2 máy.',
    ],
    mandatory: false,
  },
  {
    version: '1.5.0',
    buildId: 'v1.5.0-mobile-iphone-parity',
    releasedAt: '2026-11-13',
    title: 'Tối ưu /login mọi dòng iPhone, Parity Mobile, Privacy 100% & Đồng bộ 2 máy',
    highlights: [
      'Tối ưu bố cục /login trên toàn bộ kích cỡ iPhone (SE đến Pro Max) và chế độ PWA safe-area: bàn phím số gọn vừa 1 màn hình kèm nút Face ID + Xác nhận ngay tầm ngón cái.',
      'Hoàn thiện tính năng trên Mobile: thanh chọn kỳ/tháng ngang, đối soát quỹ chung & tất toán 1 chạm, tóm tắt AI kỳ này và ghi sổ nhanh khoản định kỳ.',
      'Phủ kín Chế độ Riêng tư 100% trên toàn bộ bảng giao dịch, các Bottom Sheet và toàn bộ biểu đồ Recharts.',
      'Ra mắt Gói chia sẻ đồng bộ 2 máy (Smart Merge chống trùng ID + giữ nguyên bảo mật cục bộ) và tùy chọn xác thực Step-Up cho thao tác xóa hàng loạt / Reset / ghi đè.',
    ],
    mandatory: false,
  },
  {
    version: '1.4.0',
    buildId: 'v1.4.0-login-security',
    releasedAt: '2026-11-13',
    title: 'Màn hình khóa /login đôi, Face ID di động & Ảnh nền riêng cho 2 vợ chồng',
    highlights: [
      'Thiết kế trang /login bo góc hiện đại dành riêng cho Anh Chuột & Bé Mèo kèm bàn phím số 4–6 chữ số mã hóa SHA-256.',
      'Hỗ trợ mở khóa 1 chạm bằng Face ID / Sinh trắc học WebAuthn trên điện thoại cùng mã Code dự phòng.',
      'Cho phép mỗi người tự tải ảnh cá nhân từ thư viện thiết bị làm hình nền màn hình khóa và chỉnh độ mờ/tối.',
      'Hoàn thiện Trung tâm thông báo di động, ghi sổ định kỳ 1 chạm, xuất báo cáo CSV/Excel và tự động khóa phiên.',
    ],
    mandatory: false,
  },
  {
    version: '1.3.0',
    buildId: 'v1.3.0-pwa-autoupdate',
    releasedAt: '2026-10-31',
    title: 'Cập nhật PWA một chạm & Thông báo bản mới trên di động',
    highlights: [
      'Tự động phát hiện phiên bản mới ngay khi mở ứng dụng hoặc quay lại từ nền trên iPhone & Android.',
      'Thông báo gọn gàng kèm nút Cập nhật ngay 1 chạm, không làm gián đoạn khi đang nhập giao dịch.',
      'Bổ sung Trung tâm Phiên bản trong Cài đặt: xem ghi chú thay đổi và nút Kiểm tra cập nhật thủ công.',
      'Bảo toàn 100% dữ liệu thu chi, thẻ tín dụng và mã PIN lưu cục bộ trên thiết bị khi nâng cấp.',
    ],
    mandatory: false,
  },
  {
    version: '1.2.0',
    buildId: 'v1.2.0-data-studio',
    releasedAt: '2026-10-30',
    title: 'Studio Quản trị Dữ liệu, Đối soát Quỹ chung & Gemini AI Server',
    highlights: [
      'Ra mắt tab Quản trị Dữ liệu (Data Studio) thêm/sửa/xóa đồng bộ 8 bảng thực thể tài chính.',
      'Tích hợp đối soát chi tiêu chung 2 vợ chồng, giao dịch định kỳ tự động và khóa PIN 4 số.',
      'Chuyển các tác vụ AI quét hóa đơn & phân tích tháng sang máy chủ bảo mật khóa API.',
    ],
    mandatory: false,
  },
  {
    version: '1.1.0',
    buildId: 'v1.1.0-pwa',
    releasedAt: '2026-10-30',
    title: 'Cài đặt ứng dụng PWA trên màn hình chính & Quét hóa đơn AI',
    highlights: [
      'Hỗ trợ cài đặt toàn màn hình lên iPhone/iPad (Safari) và Android (Chrome WebAPK).',
      'Bổ sung Service Worker mở ứng dụng ngoại tuyến tức thì và chụp ảnh hóa đơn bằng camera.',
    ],
    mandatory: false,
  },
];

export const CURRENT_RELEASE: AppReleaseEntry = APP_CHANGELOG[0];

/**
 * So sánh 2 chuỗi phiên bản SemVer (vd: "1.4.0" vs "1.3.0" hoặc "v1.4.0").
 * Trả về: 1 nếu a > b, -1 nếu a < b, 0 nếu bằng nhau.
 */
export function compareSemver(a: string, b: string): number {
  const cleanA = a.replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const cleanB = b.replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(cleanA.length, cleanB.length, 3);

  for (let i = 0; i < maxLen; i++) {
    const partA = cleanA[i] ?? 0;
    const partB = cleanB[i] ?? 0;
    if (partA > partB) return 1;
    if (partA < partB) return -1;
  }
  return 0;
}

/**
 * Định dạng thời gian kiểm tra cập nhật thân thiện bằng tiếng Việt.
 */
export function formatCheckTimestamp(date: Date | null): string {
  if (!date) return 'Chưa kiểm tra trong phiên này';
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
