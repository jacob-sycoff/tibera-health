import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SUPPLEMENT_GUIDES,
  getSupplementGuideBySlug,
  type SupplementGuide,
} from "@/lib/supplements/guides";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function generateStaticParams() {
  return SUPPLEMENT_GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> | Metadata {
  // Next allows sync return, but params is a Promise in Next 16 app router types.
  return (async () => {
    const { slug } = await params;
    const guide = getSupplementGuideBySlug(slug);
    if (!guide) return {};

    return {
      title: `${guide.title} | Tibera Health`,
      description: guide.description,
    };
  })();
}

function buildFaqJsonLd(guide: SupplementGuide) {
  if (!guide.faqs || guide.faqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

function getPrevNext(slug: string) {
  const idx = SUPPLEMENT_GUIDES.findIndex((g) => g.slug === slug);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? SUPPLEMENT_GUIDES[idx - 1] : null,
    next: idx < SUPPLEMENT_GUIDES.length - 1 ? SUPPLEMENT_GUIDES[idx + 1] : null,
  };
}

export default async function SupplementGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getSupplementGuideBySlug(slug);
  if (!guide) notFound();

  const faqJsonLd = buildFaqJsonLd(guide);
  const { prev, next } = getPrevNext(slug);

  const related = SUPPLEMENT_GUIDES.filter(
    (g) =>
      g.slug !== guide.slug &&
      g.tags.some((t) => guide.tags.includes(t))
  ).slice(0, 4);

  return (
    <div className="space-y-6">
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          <Link href="/supplements" className="text-slate-900 font-medium hover:underline">
            Supplements
          </Link>{" "}
          /{" "}
          <Link href="/supplements/guides" className="text-slate-900 font-medium hover:underline">
            Guides
          </Link>
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          {guide.title}
        </h1>
        <p className="text-slate-600">{guide.description}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {guide.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="capitalize">
              {tag.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      </div>

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
            <div className="pt-3 border-t border-gray-200">
              <Link href="/supplements/research" className="text-slate-900 font-medium hover:underline">
                Open the research tool
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-black/10 bg-white/60 backdrop-blur-xl p-5 text-sm text-slate-700 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]">
            <p className="font-semibold text-slate-900">Note</p>
            <p className="mt-1">
              This guide is educational and not medical advice. Talk with your clinician if you’re
              pregnant, breastfeeding, have medical conditions, or take medications.
            </p>
          </div>

          {guide.sections.map((section) => (
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
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center justify-between gap-2">
            {prev ? (
              <Button
                asChild
                variant="outline"
                className="rounded-2xl border-black/10 bg-white/70 hover:bg-white"
              >
                <Link href={`/supplements/guides/${prev.slug}`}>← {prev.title}</Link>
              </Button>
            ) : (
              <div />
            )}
            {next ? (
              <Button
                asChild
                variant="outline"
                className="rounded-2xl border-black/10 bg-white/70 hover:bg-white"
              >
                <Link href={`/supplements/guides/${next.slug}`}>{next.title} →</Link>
              </Button>
            ) : (
              <div />
            )}
          </div>

          {related.length > 0 ? (
            <Card className="rounded-[28px] border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]">
              <CardHeader>
                <CardTitle className="text-base">Related guides</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {related.map((g) => (
                  <Link
                    key={g.slug}
                    href={`/supplements/guides/${g.slug}`}
                    className="rounded-2xl border border-black/10 bg-white p-4 hover:border-slate-900/20 transition-colors"
                  >
                    <p className="font-medium text-slate-900">{g.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{g.description}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
