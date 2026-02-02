import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NUTRIENT_RESEARCH, VIRTUAL_NUTRIENTS } from "@/lib/nutrients/research";

export const metadata: Metadata = {
  title: "Nutrient Research | Tibera Health",
  description:
    "Evidence-oriented notes and target options for nutrients, with quick links to set your personal goals.",
};

export default function NutrientResearchIndexPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          Nutrient research
        </h1>
        <p className="text-slate-600">
          Educational context and practical target options. Not medical advice.
        </p>
        <div className="pt-2">
          <Link
            href="/settings"
            className="inline-flex items-center h-10 px-4 rounded-full border border-black/10 bg-white/70 text-sm font-medium text-slate-900 hover:bg-white"
          >
            Set goals <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...NUTRIENT_RESEARCH, ...VIRTUAL_NUTRIENTS].map((entry) => (
          <Link
            key={entry.slug}
            href={`/nutrients/research/${entry.slug}`}
            className="rounded-[20px] border border-black/10 bg-white/70 backdrop-blur-xl p-5 hover:bg-white transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold tracking-tight text-slate-900">{entry.name}</p>
              <span className="text-xs text-slate-500 tabular-nums">{entry.unit}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600 line-clamp-2">
              {entry.summary[0]}
            </p>
            <p className="mt-4 text-sm font-medium text-slate-900 inline-flex items-center">
              View details <ArrowRight className="w-4 h-4 ml-2" />
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
