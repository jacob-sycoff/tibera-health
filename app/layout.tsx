import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { Navigation } from "@/components/layout/navigation";
import { Sidebar } from "@/components/layout/sidebar";
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
        <Providers>
          <div className="flex min-h-screen">
            {/* Desktop Sidebar */}
            <Sidebar className="hidden lg:flex" />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-auto">
              <header className="lg:hidden sticky top-0 z-30 border-b border-black/5 dark:border-white/5 bg-white/70 backdrop-blur-xl">
                <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 py-3">
                  <Link href="/" className="inline-flex items-center">
                    <div className="relative h-8 w-[160px]">
                      <Image
                        src="/brand/tibera-logo-v2.png"
                        alt="Tibera Health"
                        fill
                        priority
                        className="object-contain"
                      />
                    </div>
                  </Link>
                </div>
              </header>

              <main className="flex-1 pb-40 lg:pb-0">
                <div className="w-full max-w-screen-2xl mx-auto lg:mx-0 px-4 sm:px-6 lg:px-8 py-6">
                  {children}
                </div>
              </main>
            </div>
          </div>

          {/* Mobile Bottom Navigation */}
          <Navigation className="lg:hidden" />
        </Providers>
      </body>
    </html>
  );
}
