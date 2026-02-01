import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FOOD_GUIDES, getFoodGuideBySlug, type FoodGuide } from "@/lib/food/guides";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveEmbedIFrame } from "@/components/ui/responsive-embed-iframe";

export function generateStaticParams() {
  return FOOD_GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> | Metadata {
  return (async () => {
    const { slug } = await params;
    const guide = getFoodGuideBySlug(slug);
    if (!guide) return {};

    return {
      title: `${guide.title} | Tibera Health`,
      description: guide.description,
    };
  })();
}

function renderSection(section: FoodGuide["sections"][number]) {
  const calloutToneClasses: Record<
    NonNullable<FoodGuide["sections"][number]["callouts"]>[number]["tone"],
    string
  > = {
    warning:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100",
    tip: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100",
    info: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100",
  };

  return (
    <Card
      key={section.id}
      id={section.id}
      className="rounded-[28px] border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]"
    >
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg">{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        {section.paragraphs?.map((p, idx) => (
          <p key={idx}>{p}</p>
        ))}
        {section.bullets && section.bullets.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1">
            {section.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        {section.callouts && section.callouts.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 pt-2">
            {section.callouts.map((c) => (
              <div
                key={c.title}
                className={`rounded-2xl border p-4 ${calloutToneClasses[c.tone]}`}
              >
                <p className="font-semibold">{c.title}</p>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                  {c.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
        {section.quotes && section.quotes.length > 0 ? (
          <div className="pt-3 border-t border-black/5 space-y-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Quotes
            </p>
            <div className="grid gap-2">
              {section.quotes.map((q) => (
                <blockquote
                  key={q.quote}
                  className="rounded-2xl border border-black/10 bg-white p-4"
                >
                  <p className="text-slate-800 italic">“{q.quote}”</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <a href={q.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {q.sourceLabel}
                    </a>
                    {q.note ? <span>{q.note}</span> : null}
                  </div>
                </blockquote>
              ))}
            </div>
          </div>
        ) : null}
        {section.images && section.images.length > 0 ? (
          <div className="pt-3 border-t border-black/5 space-y-3">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Images
            </p>
            {section.images.map((img) => (
              <figure
                key={img.src}
                className="overflow-hidden rounded-2xl border border-black/10 bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.alt} className="w-full h-auto" />
                {img.caption ? (
                  <figcaption className="px-4 py-3 border-t border-black/5 text-xs text-slate-600">
                    {img.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        ) : null}
        {section.links && section.links.length > 0 ? (
          <div className="pt-3 border-t border-black/5 space-y-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Official Links
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {section.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-black/10 bg-white p-4 hover:border-slate-900/20 transition-colors"
                >
                  <p className="font-medium text-slate-900">{l.label}</p>
                  {l.note ? <p className="mt-1 text-xs text-slate-600">{l.note}</p> : null}
                </a>
              ))}
            </div>
          </div>
        ) : null}
        {section.embeds && section.embeds.length > 0 ? (
          <div className="pt-3 border-t border-black/5 space-y-3">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Visuals
            </p>
            {section.embeds.map((e) => (
              <div
                key={e.src}
                className="overflow-hidden rounded-2xl border border-black/10 bg-white"
              >
                <iframe
                  title={e.title}
                  src={e.src}
                  className="w-full"
                  style={{ height: e.height ?? 820 }}
                />
                {e.caption ? (
                  <div className="px-4 py-3 border-t border-black/5 text-xs text-slate-600">
                    {e.caption}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function FoodGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getFoodGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          <Link href="/food" className="text-slate-900 font-medium hover:underline">
            Food
          </Link>{" "}
          /{" "}
          <Link href="/food/guides" className="text-slate-900 font-medium hover:underline">
            Guides
          </Link>
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          {guide.title}
        </h1>
        <p className="text-slate-600">{guide.description}</p>
      </div>

      {guide.embed ? (
        <Card className="rounded-[28px] border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Interactive tool</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700 max-w-2xl">
              This page includes an interactive bean/legume comparison tool (table + cards + charts)
              to help you find options that fit your comfort and goals.
            </p>
            <a
              href={`#${guide.embed.id}`}
              className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-black/10 bg-white text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Jump to tool
            </a>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <Card className="h-fit rounded-[28px] border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]">
          <CardHeader>
            <CardTitle className="text-base">On this page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {guide.sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block text-slate-900 font-medium hover:underline"
              >
                {section.title}
              </a>
            ))}
            {guide.embed ? (
              <div className="pt-3 border-t border-gray-200 space-y-2">
                <a href={`#${guide.embed.id}`} className="text-slate-900 font-medium hover:underline">
                  {guide.embed.title}
                </a>
                <p className="text-xs text-slate-600">{guide.embed.description}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-black/10 bg-white/60 backdrop-blur-xl p-5 text-sm text-slate-700 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]">
            <p className="font-semibold text-slate-900">Note</p>
            <p className="mt-1">
              This guide is educational and not medical advice. If you have IBS, IBD, or other GI
              conditions, use extra care and discuss dietary changes with your clinician.
            </p>
          </div>

          {guide.sections.map(renderSection)}
        </div>

        {guide.embed ? (
          <Card
            id={guide.embed.id}
            className="lg:col-span-2 rounded-[28px] border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]"
          >
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">{guide.embed.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-700">{guide.embed.description}</p>
              <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                <ResponsiveEmbedIFrame
                  embedId="bean-gas-chart"
                  title={guide.embed.title}
                  src={guide.embed.src}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
