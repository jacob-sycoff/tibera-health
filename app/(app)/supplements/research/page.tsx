import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { SaarinenSupplementResearchTool } from "@/components/supplements/research/saarinen-research-tool";

export const metadata: Metadata = {
  title: "Supplement Research | Tibera Health",
  description:
    "Compare supplements by type, ingredients, certifications, and quality signals. Filter omega-3 products by EPA/DHA and more.",
};

export default function SupplementResearchPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            Research
          </h1>
          <p className="text-slate-600">
            A clean workspace for comparing products by dose, form, quality signals, and
            constraints.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/supplements/guides"
              className="inline-flex items-center h-10 px-4 rounded-full border border-black/10 bg-white/70 text-sm font-medium text-slate-900 hover:bg-white"
            >
              Browse guides <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              href="/supplements/omega-3/pregnancy"
              className="inline-flex items-center h-10 px-4 rounded-full border border-black/10 bg-white/70 text-sm font-medium text-slate-900 hover:bg-white"
            >
              Omega-3 for pregnancy <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)] p-5 w-full md:w-[360px]">
          <p className="text-sm font-semibold tracking-tight text-slate-900">Make it yours</p>
          <p className="mt-1 text-xs text-slate-600">
            Add products and metadata in the tracker to improve filtering over time.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <Link href="/supplements" className="text-sm font-medium text-slate-900 hover:underline">
              Open tracker
            </Link>
            <Link
              href="/supplements/guides/prenatal-multivitamin"
              className="text-sm font-medium text-slate-900 hover:underline"
            >
              Prenatal guide
            </Link>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Want structured, educational context?{" "}
          <Link href="/supplements/guides" className="text-slate-900 font-medium hover:underline">
            Use guides
          </Link>
          .
        </p>
        <p className="text-xs text-slate-500">Educational info only; not medical advice.</p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-[28px] border border-black/10 bg-white/70 p-10 text-sm text-slate-600">
            Loading research tool…
          </div>
        }
      >
        <SaarinenSupplementResearchTool />
      </Suspense>
    </div>
  );
}
