import type { ReactNode } from "react";
import "./globals.css";
import { FinanceProvider } from "@/context/FinanceContext";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const metadata = {
  title: "HOME MONI - Quản Lý Tài Chính Gia Đình",
  description: "Nền tảng quản lý tài chính tổ ấm thông minh, bảo mật cho 2 vợ chồng (Anh Chuột & Bé Mèo).",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">
        <FinanceProvider>{children}</FinanceProvider>
      </body>
    </html>
  );
}
