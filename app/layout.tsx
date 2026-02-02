import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeInitScript } from "@/components/ui/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tibera Health",
  description: "Comprehensive health tracking for nutrition, sleep, symptoms, and supplements",
  icons: {
    icon: "/icons/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeInitScript />
        {children}
      </body>
    </html>
  );
}
