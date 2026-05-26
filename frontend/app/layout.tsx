import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Neurones IA — Plateforme Intelligence",
  description: "Plateforme IA interne — Neurones Technologies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <body
        className="h-dvh flex overflow-hidden antialiased text-slate-900"
        style={{ background: "#f0f2f8" }}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
