import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Package } from "lucide-react";
import { VscodeBanner } from "@/app/components/VscodeBanner";
import { ServiceWorker } from "@/app/components/ServiceWorker";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bundle Scan — Package size & security scanner",
  description: "Analyze bundle size, security vulnerabilities, and dependency composition for npm, PyPI, and Maven packages.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bundle Scan",
  },
  openGraph: {
    title: "Bundle Scan",
    description: "Bundle size + security scanning for npm, PyPI & Maven",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased text-slate-900 dark:text-surface-text">

        <ServiceWorker />
        <VscodeBanner />

        {/* Ambient background */}
        <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-surface-base dark:bg-surface-dark" />
          <div className="absolute -top-[30%] left-1/2 -translate-x-[60%] w-[900px] h-[600px] rounded-full bg-gradient-to-b from-indigo-300/25 via-violet-200/15 to-transparent dark:from-indigo-700/20 dark:via-violet-700/10 dark:to-transparent blur-[140px]" />
          <div className="absolute top-[60%] -right-[10%] w-[500px] h-[500px] rounded-full bg-violet-200/20 dark:bg-violet-900/10 blur-[100px]" />
          <div className="absolute top-[30%] -left-[5%] w-[300px] h-[300px] rounded-full bg-sky-200/15 dark:bg-sky-900/8 blur-[80px]" />
        </div>

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-black/3 dark:border-white/3 bg-white/20 dark:bg-surface-dark/30 backdrop-blur-3xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-13 flex items-center justify-between">

            <a href="/" className="flex items-center gap-2.5 group">
              <div className="size-7 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25 flex-shrink-0">
                <Package className="size-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-body-sm font-semibold text-slate-800 dark:text-slate-200 tracking-tight group-hover:opacity-70 transition-opacity">
                Bundle Scan
              </span>
            </a>

            <nav className="flex items-center">
              <a
                href="https://osv.dev"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors px-3 py-1.5"
              >
                OSV.dev ↗
              </a>
            </nav>

          </div>
        </header>

        {children}

      </body>
    </html>
  );
}
