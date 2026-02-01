import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FOOD_GUIDES } from "@/lib/food/guides";

export const metadata: Metadata = {
  title: "Food Guides | Tibera Health",
  description: "Practical guides and tools for food choices and gut comfort.",
};

export default function FoodGuidesIndexPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-2xl">
        <p className="text-sm text-slate-600">
          <Link href="/food" className="text-slate-900 font-medium hover:underline">
            Food
          </Link>{" "}
          / Guides
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          Food guides
        </h1>
        <p className="text-slate-600">Educational info only; not medical advice.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FOOD_GUIDES.map((guide) => (
          <Link
            key={guide.slug}
            href={`/food/guides/${guide.slug}`}
            className="rounded-[20px] border border-black/10 bg-white/70 backdrop-blur-xl p-5 hover:bg-white transition-colors"
          >
            <p className="font-semibold tracking-tight text-slate-900">{guide.title}</p>
            <p className="mt-2 text-sm text-slate-600 line-clamp-2">{guide.description}</p>
            <p className="mt-4 text-sm font-medium text-slate-900 inline-flex items-center">
              View guide <ArrowRight className="w-4 h-4 ml-2" />
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

