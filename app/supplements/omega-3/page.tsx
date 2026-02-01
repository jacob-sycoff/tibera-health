import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Omega-3 Supplements: What They Are and How to Choose | Tibera Health",
  description:
    "Learn the differences between DHA, EPA, DPA, and ALA. Compare omega-3 products by form, source, certifications, and more.",
};

export default function Omega3Page() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          Omega‑3
        </h1>
        <p className="text-slate-600">
          DHA, EPA, DPA, and ALA can look confusing on labels. This section explains the basics
          and links to focused tools for specific goals.
        </p>
      </div>

      <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)] p-5 space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Most popular: pregnancy</h2>
        <p className="text-sm text-slate-600">
          If you’re comparing omega-3s for pregnancy, start here:
        </p>
        <Link
          href="/supplements/omega-3/pregnancy"
          className="inline-flex items-center gap-2 text-slate-900 font-medium hover:underline"
        >
          Omega‑3 for pregnancy: how to choose + compare products <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="rounded-[28px] border border-black/10 bg-white/60 backdrop-blur-xl p-5 text-sm text-slate-700 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]">
        <p className="font-semibold text-slate-900">Note</p>
        <p className="mt-1">
          This content is educational and not medical advice. Pregnancy needs vary—talk with your
          clinician before starting or changing supplements.
        </p>
      </div>

      <div className="rounded-[28px] border border-black/10 bg-white p-5 space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Compare products</h2>
        <p className="text-sm text-slate-600">
          Use the Research tool to filter omega‑3 products by DHA/EPA/DPA, source, capsule, and more.
        </p>
        <Link
          href="/supplements/research?preset=omega3"
          className="inline-flex items-center gap-2 text-slate-900 font-medium hover:underline"
        >
          Open omega‑3 research <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
