import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FlaskConical, Wrench, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Research | Tibera Health",
  description:
    "Do your own research: practical guides, evidence-oriented notes, and interactive tools.",
};

function HubCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-5 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)] hover:border-slate-900/20 hover:bg-white transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 group-hover:text-slate-900 transition-colors">
              {icon}
            </span>
            <p className="font-semibold tracking-tight text-slate-900">{title}</p>
          </div>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
      </div>
    </Link>
  );
}

export default function ResearchHubPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          Research
        </h1>
        <p className="text-slate-600">
          Do your own research: practical guides, evidence-oriented notes, and tools. Educational
          info only; not medical advice.
        </p>
      </div>

      <Card className="rounded-[28px] border-black/10 bg-white/70 backdrop-blur-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Tools</CardTitle>
          <p className="text-sm text-slate-600">
            Interactive pages for exploring options and comparing tradeoffs.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <HubCard
            href="/supplements/research"
            title="Supplement research tool"
            description="Compare supplements by dose, form, quality signals, and constraints."
            icon={<Wrench className="h-4 w-4" />}
          />
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-black/10 bg-white/70 backdrop-blur-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Guides</CardTitle>
          <p className="text-sm text-slate-600">Structured, practical reading material.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <HubCard
            href="/food/guides"
            title="Food guides"
            description="Food-focused guides, including beans/legumes and gut comfort."
            icon={<BookOpen className="h-4 w-4" />}
          />
          <HubCard
            href="/supplements/guides"
            title="Supplement guides"
            description="How to choose products safely and effectively."
            icon={<BookOpen className="h-4 w-4" />}
          />
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-black/10 bg-white/70 backdrop-blur-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Research notes</CardTitle>
          <p className="text-sm text-slate-600">
            Evidence-oriented notes and targets (with references).
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <HubCard
            href="/nutrients/research"
            title="Nutrient research"
            description="Notes and target options for common nutrients, with references."
            icon={<FlaskConical className="h-4 w-4" />}
          />
        </CardContent>
      </Card>
    </div>
  );
}
