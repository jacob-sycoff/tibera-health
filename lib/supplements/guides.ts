export type GuideTag =
  | "pregnancy"
  | "breastfeeding"
  | "vegan"
  | "vegetarian"
  | "athletic"
  | "sleep"
  | "gut"
  | "heart"
  | "bone"
  | "energy"
  | "deficiency";

export interface GuideSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface GuideFaqItem {
  question: string;
  answer: string;
}

export interface SupplementGuide {
  slug: string;
  title: string;
  description: string;
  tags: GuideTag[];
  supplementTypes: Array<
    | "multivitamin"
    | "single"
    | "mineral"
    | "herbal"
    | "amino"
    | "probiotic"
    | "omega"
    | "other"
  >;
  sections: GuideSection[];
  faqs?: GuideFaqItem[];
}

export const SUPPLEMENT_GUIDES: SupplementGuide[] = [
  {
    slug: "omega-3",
    title: "Omega-3 (DHA/EPA): how to choose",
    description:
      "Understand DHA vs EPA vs DPA/ALA, how to read labels, and how to compare products by source, form, and quality signals.",
    tags: ["pregnancy", "heart"],
    supplementTypes: ["omega", "other"],
    sections: [
      {
        id: "basics",
        title: "What omega-3s are (DHA, EPA, DPA, ALA)",
        paragraphs: [
          "Omega-3s are a family of fatty acids. The labels you’ll see most often are DHA and EPA (marine omega-3s), plus ALA (plant omega-3).",
          "Some products list “fish oil” or “algal oil” milligrams, but what you usually care about is the DHA/EPA milligrams per serving.",
        ],
      },
      {
        id: "label",
        title: "What to look for on the label",
        bullets: [
          "DHA/EPA mg per serving (not just “fish oil” mg).",
          "Serving size (softgels per serving) so you compare fairly.",
          "Source (fish vs algae) and capsule ingredients (gelatin type).",
          "Quality signals: third-party testing, purification, oxidation controls (if disclosed).",
        ],
      },
      {
        id: "filters",
        title: "How to compare products in Tibera",
        bullets: [
          "Use the Research Tool filters for DHA/EPA/DPA and EPA:DHA ratio.",
          "Filter by oil form and source if you want fish-free (algae) options.",
          "Use kosher/halal + certification filters when those constraints matter.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is DHA the same as fish oil?",
        answer:
          "No. Fish oil is a source; DHA is a specific omega-3 fatty acid. You can also get DHA from algae-based products.",
      },
    ],
  },
  {
    slug: "prenatal-multivitamin",
    title: "Prenatal multivitamin: how to choose",
    description:
      "A practical checklist for prenatal labels: folate form, iron, iodine, choline, vitamin D, and tolerability.",
    tags: ["pregnancy", "deficiency"],
    supplementTypes: ["multivitamin"],
    sections: [
      {
        id: "why",
        title: "What a prenatal is for",
        paragraphs: [
          "Prenatals are designed to fill common nutrient gaps during pregnancy, but products vary a lot.",
          "The best fit depends on your labs, diet, nausea/tolerance, and what your clinician recommends.",
        ],
      },
      {
        id: "label",
        title: "Key things to check",
        bullets: [
          "Folate amount and form (5-MTHF vs folic acid).",
          "Iron dose and form (and whether you need iron at all).",
          "Iodine and choline presence/amount (often missing or low).",
          "Vitamin D, B12 (esp. if vegetarian/vegan), and calcium/magnesium expectations (often not fully covered).",
          "Other ingredients/allergens, capsule count per day, and nausea triggers.",
        ],
      },
      {
        id: "stacking",
        title: "Common add-ons",
        bullets: [
          "Omega-3 (DHA) if your prenatal is low/absent.",
          "Iron only if indicated by labs/clinician.",
          "Choline if your prenatal doesn’t include enough and diet is low.",
        ],
      },
    ],
  },
  {
    slug: "folate",
    title: "Folate vs folic acid (5-MTHF): how to choose",
    description:
      "Decode folate labels (mcg DFE vs mcg), compare forms (folic acid vs 5‑MTHF), and think about safety and dosing.",
    tags: ["pregnancy", "deficiency"],
    supplementTypes: ["single", "other", "multivitamin"],
    sections: [
      {
        id: "forms",
        title: "Forms you’ll see",
        bullets: [
          "Folic acid: the synthetic form used in many multis/prenatals and in food fortification.",
          "5‑MTHF (methylfolate): an active form used in some supplements.",
          "Labels may list “Folate” in mcg DFE (dietary folate equivalents).",
        ],
      },
      {
        id: "label",
        title: "How to compare products",
        bullets: [
          "Check the unit: mcg vs mcg DFE.",
          "Look at what else is included (B12 tells part of the story, especially if vegan/vegetarian).",
          "If you’re pregnant or trying, align with your clinician’s recommendation.",
        ],
      },
      {
        id: "safety",
        title: "Safety notes",
        bullets: [
          "High folate can mask B12 deficiency in some contexts; avoid stacking multiple high-dose sources unintentionally.",
          "Discuss dosing if you have a history of neural tube defects or are on certain medications.",
        ],
      },
    ],
  },
  {
    slug: "vitamin-b12",
    title: "Vitamin B12: methylcobalamin vs cyanocobalamin",
    description:
      "Learn common B12 forms, dosing ranges on labels, and who may need B12 supplementation.",
    tags: ["energy", "deficiency", "vegan", "vegetarian"],
    supplementTypes: ["single", "other", "multivitamin"],
    sections: [
      {
        id: "who",
        title: "Who often benefits",
        bullets: [
          "Vegetarian/vegan diets (dietary B12 is mostly in animal foods).",
          "People with low B12 labs or certain absorption issues (per clinician).",
          "Some medications can affect B12 status (discuss with your clinician).",
        ],
      },
      {
        id: "forms",
        title: "Forms",
        bullets: [
          "Methylcobalamin and cyanocobalamin are both common on labels.",
          "Dose matters more than form for many people; confirm with labs and clinician guidance.",
        ],
      },
      {
        id: "tracking",
        title: "What to track",
        bullets: [
          "Your supplement brand/product and dose.",
          "Energy symptoms, and lab markers as ordered by your clinician.",
        ],
      },
    ],
  },
  {
    slug: "calcium",
    title: "Calcium: citrate vs carbonate (and what your prenatal misses)",
    description:
      "Compare calcium forms, timing, and common reasons people split doses. Understand why many multis don’t include much calcium.",
    tags: ["bone", "pregnancy"],
    supplementTypes: ["mineral", "single", "multivitamin"],
    sections: [
      {
        id: "why-low",
        title: "Why most multis are low in calcium",
        paragraphs: [
          "Calcium takes up a lot of pill space. Many multivitamins (including prenatals) include little or none.",
        ],
      },
      {
        id: "forms",
        title: "Common forms",
        bullets: [
          "Calcium carbonate: often higher elemental calcium per pill; commonly taken with food.",
          "Calcium citrate: often gentler and sometimes preferred if sensitive stomach (individual).",
        ],
      },
      {
        id: "tips",
        title: "Practical tips",
        bullets: [
          "Compare elemental calcium (not just compound weight).",
          "Some people split doses for tolerability; confirm with clinician guidance.",
        ],
      },
    ],
  },
  {
    slug: "iodine",
    title: "Iodine: why it matters (especially in pregnancy)",
    description:
      "Iodine supports thyroid hormone production. Learn how to check prenatals and what to consider if you avoid iodized salt or dairy/seafood.",
    tags: ["pregnancy", "deficiency"],
    supplementTypes: ["mineral", "multivitamin", "single"],
    sections: [
      {
        id: "why",
        title: "Why iodine matters",
        paragraphs: [
          "Iodine is required for thyroid hormone production, which is especially important during pregnancy and fetal development.",
        ],
      },
      {
        id: "label",
        title: "How to check your prenatal",
        bullets: [
          "Many prenatals include iodine, but not all. Confirm the amount on your label.",
          "If you have thyroid disease, don’t change iodine intake without clinician guidance.",
        ],
      },
    ],
  },
  {
    slug: "choline",
    title: "Choline: a common prenatal gap",
    description:
      "Choline is often missing or low in prenatals. Learn how to assess diet vs supplement and what to look for on labels.",
    tags: ["pregnancy", "energy"],
    supplementTypes: ["single", "other", "multivitamin"],
    sections: [
      {
        id: "why",
        title: "Why choline comes up in pregnancy",
        paragraphs: [
          "Choline supports many processes; pregnancy is a common time clinicians discuss choline adequacy.",
        ],
      },
      {
        id: "label",
        title: "What to look for on labels",
        bullets: [
          "Whether the prenatal includes choline at all (many don’t).",
          "Form and dose vary widely; align with clinician guidance.",
        ],
      },
      {
        id: "diet",
        title: "Diet vs supplement",
        bullets: [
          "Eggs and some animal foods are major sources; intake can be lower on vegetarian/vegan patterns.",
          "If you supplement, track total choline from all sources to avoid overdoing it.",
        ],
      },
    ],
  },
  {
    slug: "zinc",
    title: "Zinc: picolinate vs glycinate, and when it matters",
    description:
      "Zinc shows up in immune, skin, and deficiency conversations. Compare common forms and avoid stacking too much.",
    tags: ["deficiency", "energy"],
    supplementTypes: ["mineral", "single", "multivitamin"],
    sections: [
      {
        id: "forms",
        title: "Common forms",
        bullets: [
          "Zinc picolinate and zinc glycinate are common on labels.",
          "Dose and total intake (including multivitamins) matter more than the exact form for many people.",
        ],
      },
      {
        id: "safety",
        title: "Safety notes",
        bullets: [
          "High-dose zinc long-term can affect copper status; avoid stacking high doses.",
          "If you’re taking zinc for a specific issue, confirm dose/duration with a clinician.",
        ],
      },
    ],
  },
  {
    slug: "creatine",
    title: "Creatine: how to choose (monohydrate, dose, safety)",
    description:
      "Creatine monohydrate is the most common. Learn how to compare products, what to look for, and what to track.",
    tags: ["athletic", "energy"],
    supplementTypes: ["amino", "other"],
    sections: [
      {
        id: "what",
        title: "What it is",
        paragraphs: [
          "Creatine supports rapid energy availability in muscles. Many products use creatine monohydrate.",
        ],
      },
      {
        id: "choose",
        title: "How to choose a product",
        bullets: [
          "Prefer simple ingredient lists (creatine monohydrate only) unless you specifically want added flavors/sweeteners.",
          "Look for third-party testing when available.",
        ],
      },
      {
        id: "tracking",
        title: "What to track",
        bullets: [
          "Training performance, body weight changes, and GI tolerance.",
          "Total caffeine/other stimulant stacking if using pre-workouts.",
        ],
      },
    ],
  },
  {
    slug: "vitamin-d",
    title: "Vitamin D: how to choose (D2 vs D3, dose, safety)",
    description:
      "Learn D2 vs D3, label units (IU vs mcg), and how to think about dose and safety.",
    tags: ["bone", "deficiency", "energy"],
    supplementTypes: ["single", "other"],
    sections: [
      {
        id: "forms",
        title: "D2 vs D3",
        paragraphs: [
          "Vitamin D supplements are commonly D3 (cholecalciferol) or D2 (ergocalciferol). Many products use D3.",
          "Your lab values, sun exposure, and clinician guidance matter more than any single rule.",
        ],
      },
      {
        id: "units",
        title: "IU vs mcg (how to compare labels)",
        bullets: [
          "Vitamin D labels may use IU or mcg.",
          "Make sure you’re comparing the same unit before deciding which product is “higher dose.”",
        ],
      },
      {
        id: "safety",
        title: "Safety and interactions",
        bullets: [
          "High-dose vitamin D can cause issues; avoid stacking multiple high-dose sources unintentionally.",
          "Discuss dosing if you have kidney disease, sarcoidosis, or take certain meds.",
        ],
      },
    ],
  },
  {
    slug: "iron",
    title: "Iron: forms, side effects, and what to look for",
    description:
      "Compare common forms (e.g., ferrous sulfate vs bisglycinate), tolerability, and when iron may be appropriate.",
    tags: ["deficiency", "pregnancy", "energy"],
    supplementTypes: ["mineral", "single"],
    sections: [
      {
        id: "when",
        title: "When iron is useful",
        paragraphs: [
          "Iron is most helpful when you have low ferritin/iron deficiency confirmed by labs or clinician assessment.",
          "Taking iron “just in case” can cause GI side effects and isn’t appropriate for everyone.",
        ],
      },
      {
        id: "forms",
        title: "Common forms",
        bullets: [
          "Ferrous sulfate: common, often effective, can be harder on the stomach.",
          "Ferrous bisglycinate: often better tolerated for some people.",
          "Heme iron: different absorption profile; product quality varies.",
        ],
      },
      {
        id: "tips",
        title: "Tolerability tips",
        bullets: [
          "GI side effects are common; dosing schedule and form matter.",
          "Separate from certain minerals/coffee/tea when advised by your clinician.",
        ],
      },
    ],
  },
  {
    slug: "magnesium",
    title: "Magnesium: glycinate vs citrate vs oxide",
    description:
      "Choose a magnesium form based on your goal (sleep, constipation, migraines) and tolerability.",
    tags: ["sleep", "energy"],
    supplementTypes: ["mineral", "single"],
    sections: [
      {
        id: "forms",
        title: "Forms and what they’re used for",
        bullets: [
          "Glycinate: often chosen for sleep/anxiety-style goals and gentler GI profile.",
          "Citrate: more likely to loosen stools; sometimes used for constipation.",
          "Oxide: inexpensive; can be less absorbed for some people.",
          "Threonate: marketed for brain benefits; evidence is mixed and products vary.",
        ],
      },
      {
        id: "dose",
        title: "Dose and GI tolerance",
        bullets: [
          "Start low and increase gradually to avoid diarrhea.",
          "Check “elemental magnesium” vs compound weight when comparing products.",
        ],
      },
    ],
  },
  {
    slug: "probiotics",
    title: "Probiotics: strains, CFU, and label decoding",
    description:
      "A guide to probiotic labels: CFU, strains, storage, and what to track for outcomes.",
    tags: ["gut"],
    supplementTypes: ["probiotic"],
    sections: [
      {
        id: "label",
        title: "How to read a probiotic label",
        bullets: [
          "Strains matter (genus, species, strain ID).",
          "CFU at expiration (if stated) is more useful than CFU at manufacture.",
          "Storage requirements: shelf-stable vs refrigerated.",
          "Prebiotics and other ingredients can affect tolerability.",
        ],
      },
      {
        id: "tracking",
        title: "What to track in Tibera",
        bullets: [
          "Symptoms (bloating, stool frequency, skin, mood) over time.",
          "The exact product and strain list (scan/import to preserve label details).",
        ],
      },
    ],
  },
];

export function getSupplementGuideBySlug(slug: string): SupplementGuide | null {
  return SUPPLEMENT_GUIDES.find((g) => g.slug === slug) ?? null;
}

export function getAllGuideTags(): GuideTag[] {
  const tags = new Set<GuideTag>();
  for (const guide of SUPPLEMENT_GUIDES) {
    for (const tag of guide.tags) tags.add(tag);
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}
