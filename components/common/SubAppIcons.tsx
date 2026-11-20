"use client";

import React from "react";

interface SubAppIconProps {
  className?: string;
}

/**
 * Biểu tượng đa sắc hiện đại cho phân hệ Thu Chi Tổ Ấm (HOME MONI)
 * Kết hợp khối ví xanh dương hoàng gia, dải tăng trưởng ngọc lục bảo và đồng xu vàng ấm.
 */
export function FinanceAppIconSvg({ className = "w-14 h-14" }: SubAppIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Nền thẻ ví phía sau (Sky Cyan) */}
      <rect x="10" y="14" width="38" height="28" rx="7" fill="#0EA5E9" opacity="0.22" />
      <rect x="13" y="11" width="36" height="24" rx="6" fill="#0284C7" />

      {/* Thân ví chính (Royal Indigo-Blue) */}
      <rect x="8" y="21" width="42" height="31" rx="8" fill="#1E3A8A" />

      {/* Mảng sáng chéo hiện đại tạo chiều sâu hình khối */}
      <path
        d="M8 29C8 24.5817 11.5817 21 16 21H34L20 52H16C11.5817 52 8 48.4183 8 44V29Z"
        fill="#2563EB"
      />

      {/* Dải cân bằng dòng tiền (Emerald) */}
      <path
        d="M17 42L24 35L29 39L38 30"
        stroke="#34D399"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Đồng xu tích lũy (Warm Amber) */}
      <circle cx="48" cy="36" r="10" fill="#F59E0B" />
      <circle cx="48" cy="36" r="6" fill="#FDE68A" opacity="0.45" />
      <circle cx="48" cy="36" r="2.6" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * Biểu tượng đa sắc hiện đại cho phân hệ Căn hộ Phú Đông SKYONE
 * Kết hợp tháp đôi kiến trúc xanh chàm, cầu nối không gian cyan và khối chóp tài sản ngọc lục bảo.
 */
export function SkyOneAppIconSvg({ className = "w-14 h-14" }: SubAppIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Đế nền vững chắc */}
      <rect x="8" y="50" width="48" height="5" rx="2.5" fill="#6366F1" opacity="0.35" />

      {/* Tháp A chính (Deep Indigo + Royal Cobalt facet) */}
      <path
        d="M14 16C14 13.7909 15.7909 12 18 12H32C34.2091 12 36 13.7909 36 16V50H14V16Z"
        fill="#312E81"
      />
      <path
        d="M14 16C14 13.7909 15.7909 12 18 12H25V50H14V16Z"
        fill="#4F46E5"
      />

      {/* Tháp B bên phải (Electric Cyan-Blue) */}
      <path
        d="M32 24C32 21.7909 33.7909 20 36 20H48C50.2091 20 52 21.7909 52 24V50H32V24Z"
        fill="#0EA5E9"
      />
      <path
        d="M42 20H48C50.2091 20 52 21.7909 52 24V50H42V20Z"
        fill="#0284C7"
      />

      {/* Khối mái chéo & Vốn chủ sở hữu (Emerald) */}
      <path d="M18 12L30 7L36 12H18Z" fill="#10B981" />

      {/* Các ô cửa sổ cân đối */}
      <rect x="18" y="19" width="4" height="5" rx="1" fill="#E0E7FF" />
      <rect x="18" y="28" width="4" height="5" rx="1" fill="#E0E7FF" />
      <rect x="18" y="37" width="4" height="5" rx="1" fill="#A5B4FC" />

      <rect x="27" y="19" width="4" height="5" rx="1" fill="#C7D2FE" />
      <rect x="27" y="28" width="4" height="5" rx="1" fill="#C7D2FE" />
      <rect x="27" y="37" width="4" height="5" rx="1" fill="#818CF8" />

      {/* Cửa sổ tháp phải */}
      <rect x="36" y="26" width="4" height="5" rx="1" fill="#E0F2FE" />
      <rect x="36" y="35" width="4" height="5" rx="1" fill="#E0F2FE" />
      <rect x="44" y="26" width="4" height="5" rx="1" fill="#BAE6FD" />
      <rect x="44" y="35" width="4" height="5" rx="1" fill="#BAE6FD" />

      {/* Nhấn cầu Sky Bridge */}
      <rect x="28" y="42" width="12" height="3" rx="1.5" fill="#FBBF24" />
    </svg>
  );
}

/**
 * Biểu tượng đa sắc cho phân hệ Kho Tích Sản Vàng (HOME MONI GOLD)
 * Kết hợp nhẫn tròn 9999 tinh xảo, thỏi vàng khối chamfer và khiên phòng vệ tài sản.
 */
export function GoldAppIconSvg({ className = "w-14 h-14" }: SubAppIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Nền khiên phòng vệ hổ phách */}
      <rect x="9" y="12" width="46" height="40" rx="10" fill="#FEF3C7" opacity="0.35" />

      {/* Thỏi vàng đáy */}
      <path d="M12 46L17 34H47L52 46H12Z" fill="#B45309" />
      <path d="M17 34H47L43 40H21L17 34Z" fill="#F59E0B" />
      <path d="M12 46L21 40H43L52 46H12Z" fill="#D97706" />

      {/* Nhẫn trơn 9999 nổi bật phía trên */}
      <circle cx="32" cy="24" r="12" stroke="#D97706" strokeWidth="5.5" />
      <circle cx="32" cy="24" r="12" stroke="#FBBF24" strokeWidth="2.4" />
      <path
        d="M24 18C26.2 15.6 29.2 14.5 32.5 14.8"
        stroke="#FEF3C7"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Khắc dấu 9999 tối giản */}
      <rect x="26" y="41.5" width="12" height="2.4" rx="1.2" fill="#FEF3C7" opacity="0.85" />
    </svg>
  );
}

/**
 * Biểu tượng đa sắc cho phân hệ SKYONE 3D Interior Studio (Three.js)
 * Kết hợp khối isometric căn hộ 3D, mặt sàn ấm áp và đường gióng kiến trúc.
 */
export function InteriorAppIconSvg({ className = "w-14 h-14" }: SubAppIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Sàn isometric căn hộ */}
      <path d="M32 54L10 42L32 30L54 42L32 54Z" fill="#D4A373" />

      {/* Tường trái (Teal Architectural) */}
      <path d="M10 22L32 10V30L10 42V22Z" fill="#0F766E" />
      <path d="M15 24.5L27 18V27L15 33.5V24.5Z" fill="#99F6E4" opacity="0.7" />

      {/* Tường phải (Slate-Teal sâu hơn) */}
      <path d="M54 22L32 10V30L54 42V22Z" fill="#115E59" />
      {/* Cửa lùa ban công hướng Đông Nam */}
      <path d="M37 18L49 24.5V34L37 27.5V18Z" fill="#CCFBF1" opacity="0.85" />
      <path d="M43 21.2V30.8" stroke="#0F766E" strokeWidth="1.6" />

      {/* Khối nội thất trung tâm (Sofa / Bàn Dual Studio) */}
      <path d="M32 45L22 39.5L32 34L42 39.5L32 45Z" fill="#FEF3C7" />
      <path d="M22 39.5V43.5L32 49V45L22 39.5Z" fill="#D97706" />
      <path d="M42 39.5V43.5L32 49V45L42 39.5Z" fill="#B45309" />

      {/* Viền isometric sắc nét */}
      <path
        d="M10 22L32 10L54 22V42L32 54L10 42V22Z"
        stroke="#0D9488"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
