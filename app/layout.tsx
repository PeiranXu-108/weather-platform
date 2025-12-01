import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "天气预报 - 杭州",
  description: "杭州实时天气预报与可视化展示",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

