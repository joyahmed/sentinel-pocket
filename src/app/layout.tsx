import type { Metadata } from "next";
import { Manrope, Martian_Mono } from "next/font/google";
import "./globals.css";

const martian = Martian_Mono({ variable: "--font-martian", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sentinel Pocket",
  description: "Server alerts sorted by the AI in your own Chrome. Logs stay on this machine.",
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html lang="en" className={`${martian.variable} ${manrope.variable} h-full antialiased`}>
    <body className="flex min-h-full flex-col bg-ground font-sans text-[15px] leading-normal text-ink">{children}</body>
  </html>
);

export default RootLayout;
