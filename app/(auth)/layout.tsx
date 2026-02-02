import Image from 'next/image';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <div className="relative h-10 w-[200px]">
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
        {children}
      </div>
    </div>
  );
}
