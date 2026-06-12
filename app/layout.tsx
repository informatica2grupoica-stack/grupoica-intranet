import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Comercial MP Workspace",
  description: "Plataforma comercial y operativa — Comercial MP Workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className={`${inter.className} bg-[#F1F5F9] text-slate-900 antialiased`}>
        <main>{children}</main>
      </body>
    </html>
  );
}
