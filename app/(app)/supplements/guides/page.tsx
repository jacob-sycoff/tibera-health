import type { Metadata } from "next";
import Link from "next/link";
import { GuidesHub } from "@/components/supplements/guides/guides-hub";

export const metadata: Metadata = {
  title: "Supplement Guides | Tibera Health",
  description:
    "Browse practical, digestible guides for common supplements and learn how to choose products safely and effectively.",
};

export default function SupplementGuidesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-slate-600">
          <Link href="/supplements" className="text-slate-900 font-medium hover:underline">
            Supplements
          </Link>{" "}
          / Guides
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          Guides
        </h1>
        <p className="text-slate-600">
          Search by supplement name, filter by goals, and jump into a guide with a built-in table of
          contents.
        </p>
      </div>

      <GuidesHub />
    </div>
  );
}
