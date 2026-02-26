import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/app/components/Providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "天气预报",
  description: "天气预报与可视化展示",
  icons: {
    icon: "/icons/weather.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

