import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { Navigation } from "@/components/layout/navigation";
import { Sidebar } from "@/components/layout/sidebar";

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
        <Providers>
          <div className="flex min-h-screen">
            {/* Desktop Sidebar */}
            <Sidebar className="hidden lg:flex" />

            {/* Main Content */}
            <main className="flex-1 pb-20 lg:pb-0">
              <div className="container mx-auto px-4 py-6 max-w-5xl">
                {children}
              </div>
            </main>
          </div>

          {/* Mobile Bottom Navigation */}
          <Navigation className="lg:hidden" />
        </Providers>
      </body>
    </html>
  );
}
