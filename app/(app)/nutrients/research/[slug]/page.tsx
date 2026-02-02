import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  getNutrientResearchBySlug,
  NUTRIENT_RESEARCH,
  VIRTUAL_NUTRIENTS,
  getVirtualNutrientBySlug,
  type NutrientDoseTarget,
} from "@/lib/nutrients/research";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return [...NUTRIENT_RESEARCH.map((n) => n.slug), ...VIRTUAL_NUTRIENTS.map((n) => n.slug)].map(
    (slug) => ({ slug })
  );
}

function kindLabel(kind: NutrientDoseTarget["kind"]) {
  if (kind === "recommended") return "Recommended target";
  if (kind === "upper_limit") return "Upper limit";
  return "Research dose";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getNutrientResearchBySlug(slug);
  const virtual = entry ? null : getVirtualNutrientBySlug(slug);

  if (!entry && !virtual) {
    return {
      title: "Nutrient Research | Tibera Health",
      description: "Educational context and target options for nutrients.",
    };
  }

  return {
    title: `${(entry ?? virtual)!.name} research | Tibera Health`,
    description: (entry ?? virtual)!.summary[0],
  };
}

export default async function NutrientResearchDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = getNutrientResearchBySlug(slug);
  const virtual = entry ? null : getVirtualNutrientBySlug(slug);

  if (!entry && !virtual) {
    return (
      <div className="space-y-6">
        <Link
          href="/nutrients/research"
          className="text-sm font-medium text-slate-900 hover:underline inline-flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          All nutrients
        </Link>

        <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Research page coming soon
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This nutrient doesn&apos;t have a curated target list yet.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/settings"
              className="inline-flex items-center h-10 px-4 rounded-full border border-black/10 bg-white text-sm font-medium text-slate-900 hover:bg-white/80"
            >
              Set a custom goal <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Educational info only; not medical advice.
          </p>
        </div>
      </div>
    );
  }

  if (virtual) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/nutrients/research"
            className="text-sm font-medium text-slate-900 hover:underline inline-flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            All nutrients
          </Link>
          <Link href="/settings" className="text-sm font-medium text-slate-900 hover:underline">
            Set goals
          </Link>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{virtual.name}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Unit: <span className="font-medium text-slate-900">{virtual.unit}</span>
            {" • "}
            Educational info only; not medical advice.
          </p>
          <div className="mt-5 space-y-2">
            {virtual.summary.map((p) => (
              <p key={p} className="text-sm text-slate-700">
                {p}
              </p>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-6">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">References</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(virtual.references ?? []).map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-900 font-medium hover:underline"
                >
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/nutrients/research"
          className="text-sm font-medium text-slate-900 hover:underline inline-flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          All nutrients
        </Link>
        <Link href="/settings" className="text-sm font-medium text-slate-900 hover:underline">
          Set goals
        </Link>
      </div>

      <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{entry.name}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Unit: <span className="font-medium text-slate-900">{entry.unit}</span>
          {" • "}
          Educational info only; not medical advice.
        </p>

        <div className="mt-5 space-y-2">
          {entry.summary.map((p) => (
            <p key={p} className="text-sm text-slate-700">
              {p}
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-6">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Target options</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pick a target in Settings, or use these as reference points.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Target</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Type</th>
              </tr>
            </thead>
            <tbody>
              {entry.targets.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-900">{t.label}</td>
                  <td className="px-4 py-3 text-slate-900 tabular-nums">
                    {t.amount}
                    {t.unit}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{kindLabel(t.kind)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {entry.targets.some((t) => t.notes) && (
          <div className="mt-4 space-y-2">
            {entry.targets
              .filter((t) => t.notes)
              .map((t) => (
                <p key={t.id} className="text-xs text-slate-600">
                  <span className="font-medium text-slate-900">{t.label}:</span> {t.notes}
                </p>
              ))}
          </div>
        )}
      </div>

      {entry.pairings && entry.pairings.length > 0 && (
        <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-6">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Pairings</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pairings are shown only where commonly discussed and context-dependent.
          </p>
          <div className="mt-4 space-y-3 text-sm">
            {entry.pairings.map((p) => (
              <div key={p.nutrientKey} className="rounded-xl border border-black/10 bg-white p-4">
                <p className="font-semibold text-slate-900">
                  {p.nutrientName} ({p.amount}
                  {p.unit})
                </p>
                <p className="mt-1 text-slate-700">{p.why}</p>
                {p.notes ? <p className="mt-2 text-xs text-slate-600">{p.notes}</p> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {entry.perspectives && entry.perspectives.length > 0 && (
        <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-6">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Perspectives</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sources are labeled (guideline, research, labeling, opinion) to help you interpret context.
          </p>
          <div className="mt-4 space-y-3 text-sm">
            {entry.perspectives.map((p) => (
              <div key={`${p.sourceName}-${p.sourceType}`} className="rounded-xl border border-black/10 bg-white p-4">
                <p className="font-semibold text-slate-900">
                  {p.sourceName}{" "}
                  <span className="text-xs text-slate-500">({p.sourceType})</span>
                  {p.status ? (
                    <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full border border-black/10 bg-slate-50 text-slate-700">
                      {p.status === "experimental" ? "Experimental" : "Established"}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-slate-700">{p.summary}</p>
                {p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-slate-900 font-medium hover:underline"
                  >
                    Source link
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-6">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">References</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {entry.references.map((r) => (
            <li key={r.url}>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="text-slate-900 font-medium hover:underline"
              >
                {r.label}
              </a>
            </li>
          ))}
        </ul>
        {entry.caveats && entry.caveats.length > 0 && (
          <div className="mt-4 text-xs text-slate-600 space-y-1">
            {entry.caveats.map((c) => (
              <p key={c}>{c}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
