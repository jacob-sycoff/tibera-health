import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Omega-3 for Pregnancy: How to Choose + Compare Products | Tibera Health",
  description:
    "A practical guide to DHA/EPA (and DPA), third-party testing, heavy metals, source, gelatin/capsules, certifications, and pregnancy safety—plus a product research tool.",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What matters most on an omega-3 label for pregnancy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most people focus on DHA per serving first, then EPA (and sometimes DPA). Also look for purification/quality signals (e.g., third‑party testing), and consider source (fish vs algae) plus capsule ingredients if you need kosher/halal or gelatin-free options.",
      },
    },
    {
      "@type": "Question",
      name: "Is DHA the same as fish oil?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Fish oil is a source; DHA is one specific omega‑3 fatty acid. Some products are algae-based (DHA-only or DHA+EPA) and contain no fish.",
      },
    },
    {
      "@type": "Question",
      name: "How do I compare EPA:DHA ratios?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "EPA:DHA ratio compares how much EPA you get relative to DHA. For pregnancy-focused products, DHA is often emphasized, so ratios vary widely. Use the ratio filters to match your personal goals and clinician guidance.",
      },
    },
  ],
};

export default function Omega3PregnancyPage() {
  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="space-y-2">
        <p className="text-sm text-slate-600">
          <Link href="/supplements/omega-3" className="text-slate-900 font-medium hover:underline">
            Omega-3
          </Link>{" "}
          / Pregnancy
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          Omega-3 for pregnancy: how to choose (and compare products)
        </h1>
        <p className="text-slate-600">
          A digestible guide to what label terms mean—plus a product research tool that lets you
          filter by DHA/EPA/DPA amounts, form, source, certifications, and more.
        </p>
      </div>

      <div className="rounded-[28px] border border-black/10 bg-white/60 backdrop-blur-xl p-5 text-sm text-slate-700 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]">
        <p className="font-semibold text-slate-900">Important</p>
        <p className="mt-1">
          This page is educational, not medical advice. If you’re pregnant (or trying), confirm
          supplement choices with your OB/midwife—especially if you take blood thinners, have fish
          allergies, or are considering high-dose products.
        </p>
      </div>

      <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)] p-5 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick takeaways</h2>
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>
            Start with <span className="font-medium">DHA per serving</span>; many pregnancy-focused
            discussions use a DHA target around <span className="font-medium">~200 mg/day</span>{" "}
            (confirm with your clinician).
          </li>
          <li>
            EPA can matter too (inflammation, mood, triglycerides), but pregnancy products often
            prioritize DHA.
          </li>
          <li>
            Prefer products with clear quality signals (e.g., third-party testing, purification)
            and be mindful of heavy metals, oxidation, and allergens.
          </li>
          <li>
            If you need kosher/halal or gelatin-free, check capsule ingredients—fish oil can still
            be inside a bovine gelatin capsule, and some capsules use fish gelatin or plant-based
            materials.
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What the omega-3 letters mean</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-4 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.25)]">
            <p className="font-semibold text-slate-900">DHA</p>
            <p className="mt-1 text-sm text-slate-700">
              Docosahexaenoic acid. Often emphasized in pregnancy discussions because it’s a key
              structural fat in the brain and retina.
            </p>
          </div>
          <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-4 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.25)]">
            <p className="font-semibold text-slate-900">EPA</p>
            <p className="mt-1 text-sm text-slate-700">
              Eicosapentaenoic acid. Often discussed for inflammation-related pathways and
              cardiometabolic benefits; some people prefer higher EPA, others prefer DHA-heavy.
            </p>
          </div>
          <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-4 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.25)]">
            <p className="font-semibold text-slate-900">DPA</p>
            <p className="mt-1 text-sm text-slate-700">
              Docosapentaenoic acid. Less commonly labeled, but sometimes present; research is
              emerging and labels vary.
            </p>
          </div>
          <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-4 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.25)]">
            <p className="font-semibold text-slate-900">ALA</p>
            <p className="mt-1 text-sm text-slate-700">
              Alpha-linolenic acid (plant omega-3). The body can convert some ALA to EPA/DHA, but
              conversion is often limited.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What to filter for (and why)</h2>
        <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-5 space-y-3 text-sm text-slate-700 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]">
          <p>
            The “best” omega-3 depends on your goal, diet, and constraints. The research tool
            supports these filters:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="font-medium">DHA/EPA/DPA amounts</span>: compare mg per serving, not
              just “fish oil” mg (which can include non-omega fats).
            </li>
            <li>
              <span className="font-medium">EPA:DHA ratio</span>: useful if you’re targeting a
              specific balance.
            </li>
            <li>
              <span className="font-medium">Form & source</span>: fish oil vs algal oil vs krill;
              algae can be a good option if you avoid fish.
            </li>
            <li>
              <span className="font-medium">Third-party testing & heavy metals</span>: pregnancy is
              a common time to be extra cautious; look for transparency and testing documentation
              when available.
            </li>
            <li>
              <span className="font-medium">Kosher / halal / gelatin</span>: the oil and the capsule
              can come from different sources.
            </li>
            <li>
              <span className="font-medium">Other ingredients</span>: flavors, antioxidants, and
              capsule materials may matter for tolerability.
            </li>
          </ul>
        </div>
      </div>

      <div className="rounded-[28px] border border-black/10 bg-white p-5 space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Compare products</h2>
        <p className="text-sm text-slate-600">
          Open the Research tool with pregnancy defaults (omega‑3 only + DHA minimum) and refine from there.
        </p>
        <Link
          href="/supplements/research?preset=omega3-pregnancy"
          className="inline-flex items-center gap-2 text-slate-900 font-medium hover:underline"
        >
          Open omega‑3 pregnancy research <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="rounded-[28px] border border-black/10 bg-white/60 backdrop-blur-xl p-5 text-sm text-slate-700 space-y-2 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]">
        <p className="font-semibold text-slate-900">Want better filters?</p>
        <p>
          Use <span className="font-medium">Supplements → Add New</span> to add a product, and (for
          omega-3 types) fill in optional fields like oil form, gelatin, and testing status. Those
          map directly to the research filters on this page.
        </p>
      </div>
    </div>
  );
}
