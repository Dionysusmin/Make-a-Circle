import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "街舞少儿打卡与家校系统",
  description: "少儿街舞机构 | 打卡、学员档案、家校沟通",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-white text-black dark:bg-[#0a0a0a] dark:text-white`}>
        <header className="border-b border-black/10 dark:border-white/10 sticky top-0 bg-white/70 dark:bg-[#0a0a0a]/70 backdrop-blur z-10">
          <nav className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">街舞家校系统</Link>
            <div className="flex gap-4 text-sm">
              <Link href="/students" className="hover:underline">学员档案</Link>
              <Link href="/checkin" className="hover:underline">打卡上传</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-black/60 dark:text-white/50">
          © {new Date().getFullYear()} 街舞少儿打卡与家校系统
        </footer>
      </body>
    </html>
  );
}
