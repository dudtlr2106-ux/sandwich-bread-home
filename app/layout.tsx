import type { Metadata } from "next";
import Link from "next/link";
import InstallAppButton from "@/components/InstallAppButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리집",
  description: "우리집 스마트홈 컨트롤러",
  applicationName: "우리집",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/home-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/home-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: "/icons/home-192.svg",
  },
  appleWebApp: {
    capable: true,
    title: "우리집",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <Link href="/" className="brand" aria-label="우리집 홈">
              <span className="brand-mark">우</span>
              <span>
                <strong>우리집</strong>
                <small>SmartThings Home Control</small>
              </span>
            </Link>
            <nav className="nav-links" aria-label="주요 메뉴">
              <InstallAppButton />
              <Link href="/">홈</Link>
              <Link href="/logs">로그</Link>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
