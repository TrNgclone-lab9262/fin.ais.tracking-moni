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

export const APP_VERSION = '1.3.0';
export const APP_BUILD_ID = 'v1.3.0-pwa-autoupdate';
export const APP_RELEASE_DATE = '2026-10-31';

export const APP_CHANGELOG: AppReleaseEntry[] = [
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
