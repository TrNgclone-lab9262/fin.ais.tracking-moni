import type { ReactNode } from "react";
import "./globals.css";
import { FinanceProvider } from "@/context/FinanceContext";

export const metadata = {
  title: "HOME MONI - Quản Lý Tài Chính Gia Đình",
  description: "Tổ ấm hạnh phúc - Tài chính minh bạch - Vun vén tương lai cho 2 vợ chồng",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased bg-[#F6F8FB] text-[#172B4D]">
        <FinanceProvider>{children}</FinanceProvider>
      </body>
    </html>
  );
}
