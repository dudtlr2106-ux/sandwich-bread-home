import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리집",
  description: "KOCOM + SmartThings 홈 IoT 컨트롤러",
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
