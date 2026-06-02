import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="es">
      <body className={`${inter.className} bg-[#fafafa] text-slate-900`}>
        <main>{children}</main>
      </body>
    </html>
  );
}