import type { HealthCondition } from "@/types";

export type NutrientTargetKind = "recommended" | "upper_limit" | "study";

export type NutrientSourceType = "guideline" | "research" | "labeling" | "expert_opinion";
export type NutrientEvidenceStatus = "established" | "experimental";

export interface NutrientDoseTarget {
  id: string;
  label: string;
  amount: number;
  unit: string;
  kind: NutrientTargetKind;
  audiences?: Array<HealthCondition | "general">;
  notes?: string;
}

export interface NutrientPerspective {
  sourceName: string;
  sourceType: NutrientSourceType;
  status?: NutrientEvidenceStatus;
  summary: string;
  url?: string;
}

export interface NutrientResearchReference {
  label: string;
  url: string;
}

export interface NutrientPairing {
  nutrientKey: string;
  nutrientName: string;
  amount: number;
  unit: string;
  why: string;
  notes?: string;
}

export interface VirtualNutrient {
  key: string;
  slug: string;
  name: string;
  unit: string;
  summary: string[];
  references?: NutrientResearchReference[];
}

export interface NutrientResearchEntry {
  usdaId: number;
  slug: string;
  name: string;
  unit: string;
  summary: string[];
  targets: NutrientDoseTarget[];
  pairings?: NutrientPairing[];
  perspectives?: NutrientPerspective[];
  references: NutrientResearchReference[];
  caveats?: string[];
}

export const VIRTUAL_NUTRIENTS: VirtualNutrient[] = [
  {
    key: "vitamin_k2_mk7",
    slug: "vitamin-k2",
    name: "Vitamin K2 (MK-7)",
    unit: "mcg",
    summary: [
      "Vitamin K is a family (K1 and K2). Supplement labels often specify K2 as MK-7 or MK-4.",
      "K2 is sometimes paired with vitamin D in supplement routines; evidence varies by context.",
    ],
    references: [
      {
        label: "NIH ODS: Vitamin K (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/VitaminK-HealthProfessional/",
      },
    ],
  },
];

const VIRTUAL_NUTRIENTS_BY_KEY = new Map<string, VirtualNutrient>(
  VIRTUAL_NUTRIENTS.map((n) => [n.key, n])
);
const VIRTUAL_NUTRIENTS_BY_SLUG = new Map<string, VirtualNutrient>(
  VIRTUAL_NUTRIENTS.map((n) => [n.slug, n])
);

export const NUTRIENT_RESEARCH: NutrientResearchEntry[] = [
  {
    usdaId: 1106,
    slug: "vitamin-a",
    name: "Vitamin A",
    unit: "mcg",
    summary: [
      "Vitamin A is important for vision, immune function, and cellular development.",
      "Retinol (preformed vitamin A) and carotenoids (provitamin A) differ in potency and safety at high intakes.",
    ],
    targets: [
      {
        id: "rda_men",
        label: "RDA — adult men",
        amount: 900,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_women",
        label: "RDA — adult women",
        amount: 700,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 770,
        unit: "mcg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "rda_lactation",
        label: "RDA — breastfeeding",
        amount: 1300,
        unit: "mcg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
      {
        id: "ul",
        label: "UL — adults (preformed vitamin A / retinol)",
        amount: 3000,
        unit: "mcg",
        kind: "upper_limit",
        audiences: ["general"],
        notes:
          "The UL applies to preformed vitamin A (retinol), not beta-carotene from foods. High retinol in pregnancy can be harmful; discuss with a clinician.",
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/",
      },
      {
        sourceName: "FDA Daily Values (nutrition labeling)",
        sourceType: "labeling",
        status: "established",
        summary: "Daily Values are label reference amounts for %DV.",
        url: "https://www.fda.gov/food/new-nutrition-facts-label/daily-value-new-nutrition-and-supplement-facts-labels",
      },
    ],
    references: [
      {
        label: "NIH ODS: Vitamin A (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1162,
    slug: "vitamin-c",
    name: "Vitamin C",
    unit: "mg",
    summary: [
      "Vitamin C supports connective tissue formation and acts as an antioxidant.",
      "Vitamin C can increase absorption of non-heme iron, which may matter for iron supplementation.",
    ],
    targets: [
      {
        id: "rda_men",
        label: "RDA — adult men",
        amount: 90,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_women",
        label: "RDA — adult women",
        amount: 75,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 85,
        unit: "mg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "rda_lactation",
        label: "RDA — breastfeeding",
        amount: 120,
        unit: "mg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 2000,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
        notes: "Higher intakes may cause GI side effects in some people.",
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/",
      },
      {
        sourceName: "FDA Daily Values (nutrition labeling)",
        sourceType: "labeling",
        status: "established",
        summary: "Daily Values are label reference amounts for %DV.",
        url: "https://www.fda.gov/food/new-nutrition-facts-label/daily-value-new-nutrition-and-supplement-facts-labels",
      },
      {
        sourceName: "Dr. Thomas E. Levy (orthomolecular / high-dose vitamin C advocacy)",
        sourceType: "expert_opinion",
        status: "experimental",
        summary:
          "Some clinicians/authors advocate much higher vitamin C intakes than the RDA, often framing it as a promising, low-cost adjunct in certain scenarios. This is not consensus guidance; evidence quality and applicability vary widely, and higher doses can cause GI issues and may be inappropriate for some people (e.g., kidney stone risk, iron overload).",
      },
    ],
    references: [
      {
        label: "NIH ODS: Vitamin C (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1109,
    slug: "vitamin-e",
    name: "Vitamin E",
    unit: "mg",
    summary: [
      "Vitamin E is a fat-soluble antioxidant. Supplement forms and doses vary widely.",
      "High-dose vitamin E can interact with blood thinning medications and may increase bleeding risk.",
    ],
    targets: [
      {
        id: "rda",
        label: "RDA — adults",
        amount: 15,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 1000,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
        notes:
          "UL applies to supplemental alpha-tocopherol. Discuss high-dose use with a clinician.",
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/",
      },
      {
        sourceName: "FDA Daily Values (nutrition labeling)",
        sourceType: "labeling",
        status: "established",
        summary: "Daily Values are label reference amounts for %DV.",
        url: "https://www.fda.gov/food/new-nutrition-facts-label/daily-value-new-nutrition-and-supplement-facts-labels",
      },
    ],
    references: [
      {
        label: "NIH ODS: Vitamin E (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1185,
    slug: "vitamin-k",
    name: "Vitamin K",
    unit: "mcg",
    summary: [
      "Vitamin K is involved in blood clotting and bone-related proteins.",
      "If you take vitamin K–antagonist anticoagulants (e.g., warfarin), changes in vitamin K intake can matter.",
    ],
    targets: [
      {
        id: "ai_men",
        label: "AI — adult men",
        amount: 120,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ai_women",
        label: "AI — adult women",
        amount: 90,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, AIs, and medication interaction notes.",
        url: "https://ods.od.nih.gov/factsheets/VitaminK-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Vitamin K (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/VitaminK-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1165,
    slug: "thiamin-b1",
    name: "Thiamin (B1)",
    unit: "mg",
    summary: [
      "Thiamin supports energy metabolism and nervous system function.",
      "No UL is established for thiamin from foods or supplements in healthy people.",
    ],
    targets: [
      {
        id: "rda_men",
        label: "RDA — adult men",
        amount: 1.2,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_women",
        label: "RDA — adult women",
        amount: 1.1,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 1.4,
        unit: "mg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "rda_lactation",
        label: "RDA — breastfeeding",
        amount: 1.4,
        unit: "mg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary and RDAs.",
        url: "https://ods.od.nih.gov/factsheets/Thiamin-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Thiamin (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Thiamin-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1166,
    slug: "riboflavin-b2",
    name: "Riboflavin (B2)",
    unit: "mg",
    summary: [
      "Riboflavin supports energy production and cellular function.",
      "No UL is established for riboflavin in healthy people.",
    ],
    targets: [
      {
        id: "rda_men",
        label: "RDA — adult men",
        amount: 1.3,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_women",
        label: "RDA — adult women",
        amount: 1.1,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 1.4,
        unit: "mg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "rda_lactation",
        label: "RDA — breastfeeding",
        amount: 1.6,
        unit: "mg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary and RDAs.",
        url: "https://ods.od.nih.gov/factsheets/Riboflavin-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Riboflavin (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Riboflavin-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1167,
    slug: "niacin-b3",
    name: "Niacin (B3)",
    unit: "mg",
    summary: [
      "Niacin supports energy metabolism. High-dose niacin is also used as a medication in some contexts.",
      "The UL is mainly about flushing from nicotinic acid; medical-use doses should be clinician-guided.",
    ],
    targets: [
      {
        id: "rda_men",
        label: "RDA — adult men",
        amount: 16,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_women",
        label: "RDA — adult women",
        amount: 14,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 18,
        unit: "mg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "rda_lactation",
        label: "RDA — breastfeeding",
        amount: 17,
        unit: "mg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 35,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
        notes:
          "UL is for supplemental nicotinic acid (flushing). Prescription/therapeutic niacin dosing should be clinician-supervised.",
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and safety notes (including flushing/hepatotoxicity risk at high doses).",
        url: "https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Niacin (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1170,
    slug: "pantothenic-acid-b5",
    name: "Pantothenic Acid (B5)",
    unit: "mg",
    summary: [
      "Pantothenic acid supports energy metabolism (coenzyme A).",
      "No UL is established for pantothenic acid in healthy people.",
    ],
    targets: [
      {
        id: "ai_adults",
        label: "AI — adults",
        amount: 5,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ai_pregnancy",
        label: "AI — pregnancy",
        amount: 6,
        unit: "mg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "ai_lactation",
        label: "AI — breastfeeding",
        amount: 7,
        unit: "mg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary and AI values.",
        url: "https://ods.od.nih.gov/factsheets/PantothenicAcid-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Pantothenic Acid (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/PantothenicAcid-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1175,
    slug: "vitamin-b6",
    name: "Vitamin B6",
    unit: "mg",
    summary: [
      "Vitamin B6 is involved in amino acid metabolism and neurotransmitter synthesis.",
      "Very high chronic supplemental B6 can cause neuropathy; different agencies have different upper limits.",
    ],
    targets: [
      {
        id: "rda_adults",
        label: "RDA — adults (19–50)",
        amount: 1.3,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 1.9,
        unit: "mg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "rda_lactation",
        label: "RDA — breastfeeding",
        amount: 2.0,
        unit: "mg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
      {
        id: "ul_iom",
        label: "UL — adults (US IOM/NASEM)",
        amount: 100,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
        notes:
          "Other agencies may set lower ULs. Persistent high-dose B6 can cause neuropathy.",
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and neuropathy risk notes.",
        url: "https://ods.od.nih.gov/factsheets/VitaminB6-HealthProfessional/",
      },
      {
        sourceName: "EFSA (European Food Safety Authority)",
        sourceType: "guideline",
        status: "established",
        summary: "Some agencies set lower ULs than US IOM/NASEM; check regional guidance.",
        url: "https://www.efsa.europa.eu/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Vitamin B6 (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/VitaminB6-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1176,
    slug: "biotin-b7",
    name: "Biotin (B7)",
    unit: "mcg",
    summary: [
      "Biotin supports metabolism. Deficiency is uncommon but can occur in specific contexts.",
      "High-dose biotin can interfere with some lab tests (including some cardiac markers).",
    ],
    targets: [
      {
        id: "ai_adults",
        label: "AI — adults",
        amount: 30,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ai_pregnancy",
        label: "AI — pregnancy",
        amount: 30,
        unit: "mcg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "ai_lactation",
        label: "AI — breastfeeding",
        amount: 35,
        unit: "mcg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary and AI values; notes about lab test interference at high doses.",
        url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Biotin (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1178,
    slug: "vitamin-b12",
    name: "Vitamin B12",
    unit: "mcg",
    summary: [
      "Vitamin B12 supports neurologic function and red blood cell formation.",
      "Risk of low B12 is higher with vegan diets, some GI conditions, and certain medications.",
    ],
    targets: [
      {
        id: "rda_adults",
        label: "RDA — adults",
        amount: 2.4,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 2.6,
        unit: "mcg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "rda_lactation",
        label: "RDA — breastfeeding",
        amount: 2.8,
        unit: "mcg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, and deficiency risk notes.",
        url: "https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Vitamin B12 (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1087,
    slug: "calcium",
    name: "Calcium",
    unit: "mg",
    summary: [
      "Calcium is important for bone health, muscle function, and nerve signaling.",
      "Absorption depends on dose, food timing, and vitamin D status.",
    ],
    targets: [
      {
        id: "rda_adults",
        label: "RDA — adults (19–50)",
        amount: 1000,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_older",
        label: "RDA — older adults (some groups)",
        amount: 1200,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
        notes:
          "Some groups have higher RDAs (e.g., many women 51+). Personal needs vary.",
      },
      {
        id: "ul",
        label: "UL — adults (19–50)",
        amount: 2500,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
        notes:
          "UL varies by age group. High supplemental calcium can have risks; discuss with a clinician if considering high-dose supplementation.",
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Calcium (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1090,
    slug: "magnesium",
    name: "Magnesium",
    unit: "mg",
    summary: [
      "Magnesium is involved in hundreds of enzymatic reactions, including energy metabolism and muscle/nerve function.",
      "The UL applies to supplemental magnesium (not food magnesium) because of diarrhea/GI effects.",
    ],
    targets: [
      {
        id: "rda_men",
        label: "RDA — adult men",
        amount: 420,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_women",
        label: "RDA — adult women",
        amount: 320,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ul_supplements",
        label: "UL — supplemental magnesium",
        amount: 350,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
        notes: "UL is for supplements/medications, not magnesium from food.",
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Magnesium (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1092,
    slug: "potassium",
    name: "Potassium",
    unit: "mg",
    summary: [
      "Potassium is important for fluid balance, nerve signaling, and blood pressure regulation.",
      "Supplemental potassium can be risky in some medical contexts (kidney disease, certain medications).",
    ],
    targets: [
      {
        id: "ai_men",
        label: "AI — adult men",
        amount: 3400,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ai_women",
        label: "AI — adult women",
        amount: 2600,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary and AI values; cautions for supplements in kidney disease/medications.",
        url: "https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Potassium (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1095,
    slug: "zinc",
    name: "Zinc",
    unit: "mg",
    summary: [
      "Zinc supports immune function, wound healing, and many enzymes.",
      "Long-term high-dose zinc can impair copper status; balance matters.",
    ],
    targets: [
      {
        id: "rda_men",
        label: "RDA — adult men",
        amount: 11,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_women",
        label: "RDA — adult women",
        amount: 8,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 40,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
        notes: "High chronic zinc intake can cause copper deficiency and other issues.",
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Zinc (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1098,
    slug: "copper",
    name: "Copper",
    unit: "mg",
    summary: [
      "Copper supports energy production and connective tissue formation.",
      "Very high zinc intake over time can lower copper status; balance matters.",
    ],
    targets: [
      {
        id: "rda_adults",
        label: "RDA — adults",
        amount: 0.9,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 1.0,
        unit: "mg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "rda_lactation",
        label: "RDA — breastfeeding",
        amount: 1.3,
        unit: "mg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 10,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/Copper-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Copper (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Copper-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1101,
    slug: "manganese",
    name: "Manganese",
    unit: "mg",
    summary: [
      "Manganese is involved in metabolism and antioxidant enzymes.",
      "No UL is established for manganese from food, but high supplemental doses can be harmful.",
    ],
    targets: [
      {
        id: "ai_men",
        label: "AI — adult men",
        amount: 2.3,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ai_women",
        label: "AI — adult women",
        amount: 1.8,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 11,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, AIs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/Manganese-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Manganese (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Manganese-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1103,
    slug: "selenium",
    name: "Selenium",
    unit: "mcg",
    summary: [
      "Selenium supports thyroid hormone metabolism and antioxidant enzymes.",
      "High chronic intake can cause selenosis; Brazil nuts can be very high in selenium.",
    ],
    targets: [
      {
        id: "rda_adults",
        label: "RDA — adults",
        amount: 55,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 60,
        unit: "mcg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "rda_lactation",
        label: "RDA — breastfeeding",
        amount: 70,
        unit: "mcg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 400,
        unit: "mcg",
        kind: "upper_limit",
        audiences: ["general"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/Selenium-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Selenium (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Selenium-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1091,
    slug: "phosphorus",
    name: "Phosphorus",
    unit: "mg",
    summary: [
      "Phosphorus is important for bones/teeth and energy metabolism (ATP).",
      "High phosphorus intake from additives may be relevant in kidney disease; discuss targets with a clinician if applicable.",
    ],
    targets: [
      {
        id: "rda_adults",
        label: "RDA — adults",
        amount: 700,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ul",
        label: "UL — adults (19–70)",
        amount: 4000,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
        notes: "UL varies by age group.",
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/Phosphorus-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Phosphorus (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Phosphorus-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1146,
    slug: "chromium",
    name: "Chromium",
    unit: "mcg",
    summary: [
      "Chromium is involved in macronutrient metabolism; many details remain uncertain.",
      "No UL is established for chromium in healthy people.",
    ],
    targets: [
      {
        id: "ai_men",
        label: "AI — adult men",
        amount: 35,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ai_women",
        label: "AI — adult women",
        amount: 25,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary and AI values; notes about uncertain benefit for supplementation.",
        url: "https://ods.od.nih.gov/factsheets/Chromium-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Chromium (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Chromium-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1100,
    slug: "molybdenum",
    name: "Molybdenum",
    unit: "mcg",
    summary: [
      "Molybdenum is a trace mineral used by enzymes involved in sulfur amino acid metabolism.",
      "Deficiency is rare; excessive intake can be harmful.",
    ],
    targets: [
      {
        id: "rda_adults",
        label: "RDA — adults",
        amount: 45,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 2000,
        unit: "mcg",
        kind: "upper_limit",
        audiences: ["general"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, RDAs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/Molybdenum-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Molybdenum (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Molybdenum-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1099,
    slug: "fluoride",
    name: "Fluoride",
    unit: "mg",
    summary: [
      "Fluoride supports tooth enamel; intake sources include water, dental products, and some foods.",
      "Excess intake can cause fluorosis and other harms; keep supplemental use cautious.",
    ],
    targets: [
      {
        id: "ai_men",
        label: "AI — adult men",
        amount: 4,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ai_women",
        label: "AI — adult women",
        amount: 3,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 10,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
      },
    ],
    perspectives: [
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summary, AIs, ULs, and safety notes.",
        url: "https://ods.od.nih.gov/factsheets/Fluoride-HealthProfessional/",
      },
    ],
    references: [
      {
        label: "NIH ODS: Fluoride (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Fluoride-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1093,
    slug: "sodium",
    name: "Sodium",
    unit: "mg",
    summary: [
      "Sodium is essential, but typical diets often exceed recommended limits.",
      "Targets are usually framed as a limit rather than a minimum.",
    ],
    targets: [
      {
        id: "limit",
        label: "Common limit (many guidelines)",
        amount: 2300,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
        notes: "Some people benefit from lower targets depending on blood pressure and clinician advice.",
      },
    ],
    perspectives: [
      {
        sourceName: "FDA Daily Values (nutrition labeling)",
        sourceType: "labeling",
        status: "established",
        summary: "DV is used for %DV on labels and is often used as a practical upper reference.",
        url: "https://www.fda.gov/food/new-nutrition-facts-label/daily-value-new-nutrition-and-supplement-facts-labels",
      },
    ],
    references: [
      {
        label: "FDA: Daily Value reference for sodium (labeling context)",
        url: "https://www.fda.gov/food/new-nutrition-facts-label/daily-value-new-nutrition-and-supplement-facts-labels",
      },
    ],
  },
  {
    usdaId: 1180,
    slug: "choline",
    name: "Choline",
    unit: "mg",
    summary: [
      "Choline is an essential nutrient. Needs increase during pregnancy and breastfeeding.",
      "Many prenatals contain little or no choline, so diet + supplements often both matter.",
    ],
    targets: [
      {
        id: "ai_women",
        label: "Adequate Intake (AI) — adult women",
        amount: 425,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "ai_pregnancy",
        label: "Adequate Intake (AI) — pregnancy",
        amount: 450,
        unit: "mg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "ai_lactation",
        label: "Adequate Intake (AI) — breastfeeding",
        amount: 550,
        unit: "mg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
      {
        id: "study_pregnancy_example",
        label: "Research dose (example) — higher pregnancy intake",
        amount: 900,
        unit: "mg",
        kind: "study",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
        notes:
          "Example of a higher intake used in some studies. Not a recommendation; discuss with your clinician, and consider total intake from food + supplements.",
      },
      {
        id: "ul",
        label: "Tolerable Upper Intake Level (UL) — adults",
        amount: 3500,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
        notes: "Upper limit refers to total intake; higher doses may cause side effects.",
      },
    ],
    references: [
      {
        label: "NIH ODS: Choline (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Choline-HealthProfessional/",
      },
    ],
    caveats: [
      "Pregnancy targets vary by country and individual context (diet, nausea, prenatal contents, labs).",
      "If you supplement, track total choline across products to avoid unintentionally stacking doses.",
    ],
  },
  {
    usdaId: 1089,
    slug: "iron",
    name: "Iron",
    unit: "mg",
    summary: [
      "Iron needs increase substantially in pregnancy; targets also depend on ferritin/hemoglobin and clinician guidance.",
      "Iron is one of the most common causes of side effects in prenatals, so form and timing matter.",
    ],
    targets: [
      {
        id: "rda_women",
        label: "RDA — adult women (19–50)",
        amount: 18,
        unit: "mg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 27,
        unit: "mg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 45,
        unit: "mg",
        kind: "upper_limit",
        audiences: ["general"],
      },
    ],
    references: [
      {
        label: "NIH ODS: Iron (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/",
      },
    ],
    caveats: [
      "Iron supplementation can be inappropriate for some people; labs + clinician guidance matter.",
      "ULs and typical prenatal doses are not the same thing; aim for a plan tailored to you.",
    ],
  },
  {
    usdaId: 1177,
    slug: "folate",
    name: "Folate",
    unit: "mcg",
    summary: [
      "Folate targets are often expressed as mcg DFE; supplement labels may use folic acid or 5-MTHF amounts.",
      "Pregnancy has higher recommended intake than non-pregnant adults.",
    ],
    targets: [
      {
        id: "rda_adults",
        label: "RDA — adults",
        amount: 400,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 600,
        unit: "mcg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "ul_folic_acid",
        label: "UL — folic acid from supplements/fortified foods",
        amount: 1000,
        unit: "mcg",
        kind: "upper_limit",
        audiences: ["general"],
        notes:
          "The UL applies to synthetic folic acid (not natural food folate). Consider the form when comparing labels.",
      },
    ],
    references: [
      {
        label: "NIH ODS: Folate (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/",
      },
    ],
  },
  {
    usdaId: 1102,
    slug: "iodine",
    name: "Iodine",
    unit: "mcg",
    summary: [
      "Iodine is a key prenatal nutrient, but intake varies (iodized salt, dairy/seafood, supplements).",
      "Pregnancy and breastfeeding have higher recommended intake.",
    ],
    targets: [
      {
        id: "rda_adults",
        label: "RDA — adults",
        amount: 150,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "rda_pregnancy",
        label: "RDA — pregnancy",
        amount: 220,
        unit: "mcg",
        kind: "recommended",
        audiences: [
          "pregnancy_first_trimester",
          "pregnancy_second_trimester",
          "pregnancy_third_trimester",
        ],
      },
      {
        id: "rda_lactation",
        label: "RDA — breastfeeding",
        amount: 290,
        unit: "mcg",
        kind: "recommended",
        audiences: ["breastfeeding"],
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 1100,
        unit: "mcg",
        kind: "upper_limit",
        audiences: ["general"],
      },
    ],
    references: [
      {
        label: "NIH ODS: Iodine (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/Iodine-HealthProfessional/",
      },
    ],
    caveats: [
      "If you have thyroid disease, iodine supplementation should be discussed with a clinician.",
    ],
  },
  {
    usdaId: 1114,
    slug: "vitamin-d",
    name: "Vitamin D",
    unit: "mcg",
    summary: [
      "Vitamin D targets vary with sun exposure, baseline blood levels, and clinician guidance.",
      "Food amounts are typically small; supplementation is common.",
    ],
    targets: [
      {
        id: "rda_adults",
        label: "RDA — adults (19–70)",
        amount: 15,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
      },
      {
        id: "dv",
        label: "Daily Value (DV) — label reference",
        amount: 20,
        unit: "mcg",
        kind: "recommended",
        audiences: ["general"],
        notes: "DV is a labeling reference and can differ from RDAs.",
      },
      {
        id: "endocrine_society_common",
        label: "Common supplemental range (some guidelines) — 1,500–2,000 IU",
        amount: 50,
        unit: "mcg",
        kind: "study",
        audiences: ["general"],
        notes:
          "This corresponds to ~2,000 IU (50 mcg). Some guidelines/clinicians use this range depending on blood levels and risk factors.",
      },
      {
        id: "study_5000iu",
        label: "Higher intake (research/clinical use) — 5,000 IU",
        amount: 125,
        unit: "mcg",
        kind: "study",
        audiences: ["general"],
        notes:
          "5,000 IU (125 mcg) is above the adult UL (4,000 IU / 100 mcg). Some studies/clinical contexts use higher doses, typically based on blood levels and clinician guidance.",
      },
      {
        id: "study_10000iu",
        label: "Higher intake (research/clinical use) — 10,000 IU",
        amount: 250,
        unit: "mcg",
        kind: "study",
        audiences: ["general"],
        notes:
          "10,000 IU (250 mcg) is well above the adult UL (4,000 IU / 100 mcg). Use only with clinician guidance and monitoring; excess vitamin D can cause hypercalcemia and other harms.",
      },
      {
        id: "ul",
        label: "UL — adults",
        amount: 100,
        unit: "mcg",
        kind: "upper_limit",
        audiences: ["general"],
      },
    ],
    pairings: [
      {
        nutrientKey: "vitamin_k2_mk7",
        nutrientName: "Vitamin K2 (MK-7)",
        amount: 90,
        unit: "mcg",
        why:
          "Vitamin D supports calcium absorption. Vitamin K is involved in activating proteins related to normal calcium utilization (e.g., bones vs soft tissues).",
        notes:
          "K2 pairing is optional and evidence is mixed; avoid supplementing vitamin K without clinician input if you take warfarin or other vitamin K–antagonist anticoagulants.",
      },
    ],
    perspectives: [
      {
        sourceName: "FDA Daily Values (nutrition labeling)",
        sourceType: "labeling",
        status: "established",
        summary: "DV is used for %DV on labels; it is not personalized medical guidance.",
        url: "https://www.fda.gov/food/new-nutrition-facts-label/daily-value-new-nutrition-and-supplement-facts-labels",
      },
      {
        sourceName: "NIH Office of Dietary Supplements",
        sourceType: "guideline",
        status: "established",
        summary: "Evidence summaries, RDAs/AIs, ULs, and clinical context notes.",
        url: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/",
      },
      {
        sourceName: "RFK Jr. / MAHA-style public commentary (nutrient-first framing)",
        sourceType: "expert_opinion",
        status: "experimental",
        summary:
          "Some public figures emphasize nutrient optimization (including vitamin D) as a promising lever for health. This is not a dosing guideline; treat it as a hypothesis-driven perspective and anchor decisions in labs, medical context, and established safety limits.",
      },
    ],
    references: [
      {
        label: "NIH ODS: Vitamin D (Health Professional Fact Sheet)",
        url: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/",
      },
    ],
    caveats: [
      "Vitamin D helps your body absorb calcium. Some people pair it with vitamin K2 (often MK-7) because K2 is involved in activating proteins that help direct calcium to bones/teeth rather than soft tissues; evidence is mixed and context-dependent.",
      "If you take blood thinners (e.g., warfarin) or have medical conditions, discuss vitamin K2 with your clinician before supplementing.",
    ],
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getNutrientResearchBySlug(slug: string): NutrientResearchEntry | null {
  return NUTRIENT_RESEARCH.find((entry) => entry.slug === slug) ?? null;
}

export function getNutrientResearchByUsdaId(usdaId: number): NutrientResearchEntry | null {
  return NUTRIENT_RESEARCH.find((entry) => entry.usdaId === usdaId) ?? null;
}

export function getVirtualNutrientByKey(key: string): VirtualNutrient | null {
  return VIRTUAL_NUTRIENTS_BY_KEY.get(key) ?? null;
}

export function getVirtualNutrientBySlug(slug: string): VirtualNutrient | null {
  return VIRTUAL_NUTRIENTS_BY_SLUG.get(slug) ?? null;
}

export function getResearchSlugForNutrient(input: {
  usdaId: number | null;
  name: string;
}): string {
  if (typeof input.usdaId === "number") {
    const found = getNutrientResearchByUsdaId(input.usdaId);
    if (found) return found.slug;
  }
  return slugify(input.name);
}

export function getRelevantTargetsForAudiences(
  entry: NutrientResearchEntry,
  audiences: Array<HealthCondition | "general">
): NutrientDoseTarget[] {
  const matchesAudience = (target: NutrientDoseTarget) => {
    if (!target.audiences || target.audiences.length === 0) return true;
    return target.audiences.some((aud) => audiences.includes(aud));
  };

  const relevant = entry.targets.filter(matchesAudience);
  const others = entry.targets.filter((t) => !relevant.includes(t));

  return [...relevant, ...others];
}
