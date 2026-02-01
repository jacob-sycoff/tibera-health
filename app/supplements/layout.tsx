import { SupplementsShell } from "@/components/supplements/layout/supplements-shell";

export default function SupplementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SupplementsShell>{children}</SupplementsShell>;
}

