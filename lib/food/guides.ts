export type FoodGuideTag =
  | "gut"
  | "beans"
  | "legumes"
  | "nutrition"
  | "policy"
  | "evidence"
  | "ultra_processed";

export interface FoodGuideSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  links?: Array<{
    label: string;
    url: string;
    note?: string;
  }>;
  quotes?: Array<{
    quote: string;
    sourceLabel: string;
    url: string;
    note?: string;
  }>;
  images?: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
  embeds?: Array<{
    title: string;
    src: string;
    caption?: string;
    height?: number;
  }>;
  callouts?: Array<{
    tone: "warning" | "tip" | "info";
    title: string;
    bullets: string[];
  }>;
}

export interface FoodGuideEmbed {
  id: string;
  title: string;
  description: string;
  src: string;
}

export interface FoodGuide {
  slug: string;
  title: string;
  description: string;
  tags: FoodGuideTag[];
  sections: FoodGuideSection[];
  embed?: FoodGuideEmbed;
}

export const FOOD_GUIDES: FoodGuide[] = [
  {
    slug: "rfk-cdc",
    title: "Federal dietary guidance (DGA): an overview",
    description:
      "An overview of the Dietary Guidelines for Americans (2025–2030) and related federal nutrition messaging, with primary sources and visuals.",
    tags: ["nutrition", "policy", "evidence", "ultra_processed"],
    sections: [
      {
        id: "pyramid",
        title: "The 2025–2030 pyramid (from the DGA document)",
        paragraphs: [
          "This pyramid is published in the official Dietary Guidelines document linked below.",
        ],
        embeds: [
          {
            title: "Dietary Guidelines for Americans (2025–2030) — pyramid page",
            src: "/guides/rfk-cdc/DGA.pdf#page=2&view=FitH",
            caption: "Source: DGA.pdf (RealFood.gov CDN), page 2.",
            height: 820,
          },
        ],
        links: [
          {
            label: "DGA PDF (RealFood.gov CDN) — source of truth",
            url: "https://cdn.realfood.gov/DGA.pdf",
            note: "Cited in this guide; pyramid appears on page 2.",
          },
        ],
      },
      {
        id: "official-visuals",
        title: "Official visuals & primary sources",
        paragraphs: [
          "Federal nutrition guidance is published via the Dietary Guidelines for Americans and supporting resources; other government pages typically align their messaging to these guidelines and related evidence summaries.",
          "Some sites may block embedding (browser security headers). If a visual doesn’t show inline, use the links below.",
        ],
        links: [
          {
            label: "Dietary Guidelines for Americans (DGA) PDF — 2025–2030",
            url: "https://cdn.realfood.gov/DGA.pdf",
            note: "Primary source; includes the updated pyramid (p.2).",
          },
          {
            label: "USDA MyPlate (official visual framework)",
            url: "https://www.myplate.gov/",
            note: "The current U.S. visual model for building a balanced plate.",
          },
          {
            label: "Dietary Guidelines for Americans (HHS/USDA)",
            url: "https://www.dietaryguidelines.gov/",
            note: "The primary U.S. federal nutrition guidelines document/site.",
          },
          {
            label: "CDC Nutrition (overview)",
            url: "https://www.cdc.gov/nutrition/index.html",
            note: "Public-health nutrition resources and context.",
          },
          {
            label: "CDC Food Safety for pregnancy",
            url: "https://www.cdc.gov/food-safety/foods/pregnant-women.html",
            note: "Food safety guidance that often gets bundled into “what to eat” advice.",
          },
        ],
      },
      {
        id: "what-this-is",
        title: "What this page is (and isn’t)",
        paragraphs: [
          "This page is a practical summary of the Dietary Guidelines for Americans (2025–2030) as published in the linked DGA PDF, plus related government resources that commonly echo/extend it (nutrition education, food safety, chronic disease prevention).",
          "It’s educational, not medical advice. Use it to choose a simple, consistent approach you can actually follow.",
        ],
      },
      {
        id: "dga-in-one-page",
        title: "The DGA philosophy in one page",
        paragraphs: [
          "The DGA framing in this document emphasizes eating “real food” and reducing highly processed foods, then turning that into repeatable household defaults.",
        ],
        bullets: [
          "Prioritize whole, nutrient-dense foods: protein, dairy, vegetables, fruits, healthy fats, whole grains, and beans/legumes.",
          "Reduce highly processed foods (especially those high in refined carbs, added sugar, excess sodium, and unhealthy fats).",
          "Use simple household defaults (repeatable breakfasts/lunches, batch cooking, predictable snacks).",
          "Keep food safety non-negotiable (especially in pregnancy).",
        ],
      },
      {
        id: "how-to-apply",
        title: "How to apply this without turning it into stress",
        paragraphs: [
          "The highest-ROI move is usually not perfect sourcing or perfect rules — it’s getting your defaults right and making them easy.",
        ],
        bullets: [
          "Build 2–3 repeatable meals you like (rotate beans/legumes, eggs/dairy, lean proteins, vegetables, fruit).",
          "Make the “good” option convenient (pre-cooked beans, washed greens, frozen veg, yogurt, fruit).",
          "Use swaps, not bans (water/unsweetened drinks; beans/whole grains instead of refined starches).",
          "If you change fiber a lot, ramp up gradually and track symptoms for 2–3 weeks.",
        ],
      },
      {
        id: "turn-into-plan",
        title: "Turn this into a plan you can follow",
        paragraphs: [
          "Keep it simple: decide what you’ll do most days, then make that the easiest option at home.",
        ],
        bullets: [
          "Pick 2–3 “default” bean meals per week (chili, lentil soup, tacos, bean salad).",
          "Set a realistic UPF target (e.g., “most meals from minimally processed foods”).",
          "Keep a short “swap list”: yogurt + berries instead of dessert; beans + rice instead of chips; nuts/fruit instead of candy.",
          "Use the tool below to find beans/legumes you tolerate and then standardize portions.",
        ],
      },
      {
        id: "safety-and-red-flags",
        title: "Safety and red flags",
        bullets: [
          "Avoid extreme elimination unless clinician-directed (it can worsen nutrient gaps and increase rebound eating).",
          "Be careful with claims that a single ingredient is “toxic” without dose/context (and without reliable sources).",
          "Food safety still matters: cook beans thoroughly; be cautious with high-risk foods in pregnancy/immunocompromise.",
          "If a philosophy increases anxiety, cost, or social isolation, simplify the rules and focus on consistent basics.",
        ],
      },
    ],
  },
  {
    slug: "bryan-johnson-blueprint",
    title: "Bryan Johnson (Blueprint): food guide",
    description:
      "A skimmable overview of Bryan Johnson’s current Blueprint food routine (as published), with quotes, visuals, and practical ways to adapt it.",
    tags: ["nutrition", "evidence", "ultra_processed"],
    sections: [
      {
        id: "sources",
        title: "Sources (what this guide is based on)",
        paragraphs: [
          "This guide is based on Bryan Johnson’s publicly posted “Protocol” page. It can change over time; treat the source links as canonical.",
          "Reviewed: Feb 1, 2026.",
        ],
        links: [
          {
            label: "Bryan Johnson’s Protocol (Blueprint) — primary source",
            url: "https://blueprint.bryanjohnson.com/blogs/news/bryan-johnsons-protocol",
            note: "Includes a Nutrition section plus an hour-by-hour daily schedule with meals.",
          },
          {
            label: "Bryan Johnson on X (updates)",
            url: "https://x.com/bryan_johnson",
            note: "Posts may require login; use for updates/clarifications.",
          },
        ],
        callouts: [
          {
            tone: "info",
            title: "How to read this page",
            bullets: [
              "Quotes are exact text snippets from the source page (linked).",
              "Everything else is a simplified interpretation for usability.",
              "Not medical advice; don’t copy caloric restriction or supplements without clinician guidance.",
            ],
          },
        ],
      },
      {
        id: "social",
        title: "Social media context (informal, but useful)",
        paragraphs: [
          "Social posts are often shorthand, humor, or commentary. Treat them as context and always defer to the Protocol page for specifics.",
        ],
        quotes: [
          {
            quote: "100k likes and I’ll eat a fast food meal",
            sourceLabel: "Bryan Johnson on X (Aug 17, 2025)",
            url: "https://x.com/bryan_johnson/status/1957123449970913310",
            note: "Social posts are not a protocol; use as context only.",
          },
        ],
      },
      {
        id: "core-idea",
        title: "Core idea (in his words)",
        quotes: [
          {
            quote:
              "My philosophy on nutrition is that every calorie must fight for its life.",
            sourceLabel: "Blueprint: Bryan Johnson’s Protocol (Nutrition section)",
            url: "https://blueprint.bryanjohnson.com/blogs/news/bryan-johnsons-protocol#nutrition",
          },
          {
            quote:
              "I don’t identify with any of them. I follow the scientific evidence and data in determining what I eat.",
            sourceLabel: "Blueprint: Bryan Johnson’s Protocol (Nutrition section)",
            url: "https://blueprint.bryanjohnson.com/blogs/news/bryan-johnsons-protocol#nutrition",
            note: "Context: he’s referring to diet “camps”.",
          },
        ],
        paragraphs: [
          "In practice, this is a highly structured routine built around repeatable meals, measured biomarkers, and a strong bias toward whole, nutrient-dense foods (and away from highly processed foods).",
        ],
      },
      {
        id: "published-macros",
        title: "Published daily targets (as posted)",
        quotes: [
          {
            quote: "Calories: 2,250 (10% caloric restriction)",
            sourceLabel: "Blueprint: Bryan Johnson’s Protocol (Nutrition section)",
            url: "https://blueprint.bryanjohnson.com/blogs/news/bryan-johnsons-protocol#nutrition",
          },
          {
            quote: "Protein: 130 grams (~25%)",
            sourceLabel: "Blueprint: Bryan Johnson’s Protocol (Nutrition section)",
            url: "https://blueprint.bryanjohnson.com/blogs/news/bryan-johnsons-protocol#nutrition",
          },
        ],
        bullets: [
          "Calories: 2,250 (listed as ~10% caloric restriction).",
          "Protein: 130 g (~25%).",
          "Carbs: 206 g (~35%).",
          "Fat: 101 g (~40%).",
        ],
        callouts: [
          {
            tone: "warning",
            title: "Caloric restriction isn’t a default recommendation",
            bullets: [
              "If you’re underweight, pregnant, an athlete, have an eating disorder history, or have medical conditions, don’t copy caloric restriction without clinician support.",
              "Start with food quality and consistency first; adjust calories only with clear goals and feedback (weight, labs, symptoms).",
            ],
          },
        ],
      },
      {
        id: "meal-timing",
        title: "Meal timing (early cutoff)",
        quotes: [
          {
            quote:
              "Eat your final meal/snack of the day four hours before bed. I stop eating around noon each day…",
            sourceLabel: "Blueprint: Bryan Johnson’s Protocol (Sleep section)",
            url: "https://blueprint.bryanjohnson.com/blogs/news/bryan-johnsons-protocol",
            note: "Emphasis added; see original for full context.",
          },
          {
            quote:
              "Noon, my final meal of the day…",
            sourceLabel: "Blueprint: Bryan Johnson’s Protocol (Daily schedule)",
            url: "https://blueprint.bryanjohnson.com/blogs/news/bryan-johnsons-protocol",
          },
        ],
        paragraphs: [
          "A defining feature is time‑restricted eating with an early end-of-day cutoff. If you try this, the main risk is simply that it’s hard to meet calories/protein if your eating window is too short.",
        ],
        bullets: [
          "If you want the sleep benefit without the intensity: try moving your last meal earlier by 1–2 hours first.",
          "If you wake up hungry: increase dinner protein/fiber earlier in the day, or widen the eating window.",
        ],
      },
      {
        id: "visual",
        title: "Visual summary",
        embeds: [
          {
            title: "Blueprint food routine timeline (visual)",
            src: "/guides/bryan-johnson-blueprint/meal-timeline.html",
            caption:
              "A simplified visual built from the Protocol page’s meal timing and meal examples.",
            height: 520,
          },
        ],
      },
      {
        id: "meals",
        title: "Meal structure (examples from the schedule)",
        paragraphs: [
          "Blueprint’s food routine is built around repeatable templates. The specifics can change, but the structure is consistent: a structured breakfast, a legume-and-veg heavy meal, and a final meal built around vegetables/beans/healthy fats.",
        ],
        bullets: [
          "Breakfast template: protein + berries + healthy fats (his schedule references a “nutty pudding” style meal).",
          "Lunch template: a “Super Veggie” style meal built around lentils plus cruciferous vegetables and add-ons.",
          "Final meal template: vegetables + beans/legumes + fats (example: stuffed sweet potato).",
        ],
      },
      {
        id: "food-guide-visual",
        title: "The “Don’t Die” food guide visual (as posted)",
        images: [
          {
            src: "https://cdn.shopify.com/s/files/1/0772/3129/2701/files/Screenshot_2026-01-12_at_1.04.48_PM.png?v=1768241236",
            alt: "Blueprint longevity foods guide screenshot",
            caption:
              "Source: Bryan Johnson’s Protocol page (Nutrition section).",
          },
        ],
        links: [
          {
            label: "Open the source page (Nutrition section)",
            url: "https://blueprint.bryanjohnson.com/blogs/news/bryan-johnsons-protocol#nutrition",
          },
        ],
      },
      {
        id: "adapt",
        title: "How to adapt (choose what you follow)",
        paragraphs: [
          "Some people want to follow Blueprint closely; others prefer to borrow a few ideas. Use the sources and the templates above, then choose the level of strictness that fits your life.",
        ],
        bullets: [
          "Follow closely: replicate the meal timing and meal templates as written, then track outcomes over weeks.",
          "Borrow selectively: keep the meal templates but adjust timing, calories, and ingredients to match your preferences.",
          "Keep the templates, not the brands: swap in any protein + berries + nuts/seeds; lentils + veg; beans + veg + fats.",
          "Use biomarkers if you can (weight trend, BP, A1c, lipids, ferritin, B12, vitamin D), and iterate.",
          "Make it easy: batch-cook lentils/veg once or twice weekly; keep frozen veg and canned beans on hand.",
        ],
        callouts: [
          {
            tone: "tip",
            title: "Option: a lighter-weight interpretation",
            bullets: [
              "Eat mostly minimally processed foods.",
              "Keep protein high enough to support your goals.",
              "Move your last meal earlier by 1–2 hours.",
              "Repeat 2–3 meals you like (consistency beats novelty).",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "beans-legumes",
    title: "Beans & legumes",
    description:
      "Beans and legumes are a high-fiber, protein-rich staple that can support gut health, heart health, and steady energy. This page includes practical ways to eat more of them comfortably.",
    tags: ["gut", "beans", "legumes"],
    embed: {
      id: "bean-chart",
      title: "Bean gas chart (interactive)",
      description: "Explore beans/legumes by gas potential, pregnancy notes, and practical tips.",
      src: "/guides/beans-legumes/bean-gas-chart.html",
    },
    sections: [
      {
        id: "benefits",
        title: "Why beans are worth it",
        paragraphs: [
          "Beans and legumes are one of the most “nutrient-dense per dollar” foods: they combine fiber, plant protein, minerals, and phytochemicals in a way that’s hard to match.",
          "Many people use them to support fullness, regularity, and a healthier overall dietary pattern (often by displacing ultra-processed snacks or refined carbs).",
        ],
        bullets: [
          "Fiber: supports regularity, satiety, and fermentation into short-chain fatty acids.",
          "Protein: supports meal satisfaction and helps balance carbohydrates.",
          "Micronutrients: common highlights include folate, magnesium, potassium, iron, and zinc (varies by type).",
          "Heart/metabolic support: associated with improved LDL and glycemic control in many dietary patterns.",
          "Cancer risk context: higher fiber intake and bean/legume-rich dietary patterns are associated with lower colorectal cancer risk in many observational studies; this is not a guarantee or medical advice.",
          "Practical: affordable, shelf-stable, and easy to batch-cook.",
        ],
      },
      {
        id: "how-to-eat",
        title: "Easy ways to eat more beans",
        bullets: [
          "Start with 2–4 tablespoons added to a familiar meal (tacos, salads, soups) and increase slowly.",
          "Use canned beans for convenience; rinse well to reduce sodium and some fermentable carbs.",
          "Use dried beans for cost/flavor/texture: soak (optional but often helpful), discard soaking water if you tolerate that better, and cook until fully tender.",
          "If you cook dried beans often, consider a pressure cooker to speed cooking and improve tenderness.",
          "Blend into sauces/soups (white beans in tomato sauce; lentils in chili) for an easier texture.",
          "Pair with grains/veg/fats for a meal that’s satisfying and easier on the stomach for some people.",
        ],
      },
      {
        id: "canned-vs-dried",
        title: "Canned vs dried (how to choose)",
        paragraphs: [
          "Canned and dried beans can both be great. Choose based on what you’ll actually use consistently.",
          "If comfort is your goal, preparation details matter more than whether the bean started canned or dried.",
        ],
        bullets: [
          "Canned: fastest; rinse thoroughly; try different brands (texture varies).",
          "Dried: cheapest and often best texture, but requires planning and thorough cooking (undercooked beans are both harder to digest and can be unsafe for certain types).",
          "Soaking (dried, optional): helps even cooking and may reduce some gas-producing carbs; if you soak, discard the soaking water and cook in fresh water.",
          "Cooking (dried): boil/simmer until fully tender; salt is fine; add acidic ingredients (tomatoes/vinegar) after beans are tender so they soften properly.",
          "Leftovers: cooked beans freeze well; portion/freeze to make “homemade canned beans”.",
        ],
      },
      {
        id: "gas",
        title: "Gas, bloating, and comfort (common + fixable)",
        paragraphs: [
          "Gas is common when increasing beans because they contain fermentable carbohydrates that gut microbes break down (gas is a normal byproduct).",
          "The good news: comfort often improves with gradual exposure, cooking choices, and consistent portions.",
        ],
        bullets: [
          "Go slow: increase serving size over weeks, not days.",
          "Prefer well-cooked beans; pressure cooking often improves tenderness.",
          "Rinse canned beans; for dry beans, soak and discard soaking water if you tolerate that better.",
          "Hold other big fiber changes constant so you can tell what’s helping/hurting.",
          "Use the interactive tool below to start with lower-gas options and ramp up from there.",
          "If you have IBS/FODMAP sensitivity, certain beans/portions may be more challenging—use smaller portions and symptom tracking.",
        ],
      },
      {
        id: "cancer",
        title: "Cancer prevention context (what to take from the evidence)",
        paragraphs: [
          "No single food “prevents cancer,” but diet patterns matter. Beans/legumes can contribute to a higher-fiber, lower–ultra-processed pattern that’s consistently linked with better long-term outcomes in population studies.",
          "If you’re making changes specifically because of cancer risk or a medical diagnosis, treat this as general education and follow your clinician’s guidance.",
        ],
        bullets: [
          "Fiber and resistant starch are linked to healthier bowel habits and may support a healthier colon environment (via fermentation).",
          "Replacing processed meats/refined carbs with beans is a practical way to shift overall dietary quality.",
          "The strength of evidence varies by cancer type; most signals are strongest for colorectal cancer in observational research.",
        ],
      },
      {
        id: "safety",
        title: "Safety & special notes",
        paragraphs: [
          "Beans are generally safe when properly cooked. Some specific items (like kidney beans) can cause acute GI illness if undercooked because of lectins.",
          "If you’re pregnant, have GI disease, or take medications that affect digestion, be more conservative with big dietary changes and discuss with your clinician.",
        ],
        bullets: [
          "Cook thoroughly; never undercook dry kidney beans (don’t slow-cook from dry).",
          "Avoid raw sprouts during pregnancy; cooked beans/legumes are generally fine.",
          "If you’re increasing fiber substantially, consider hydration and overall meal balance.",
        ],
        callouts: [
          {
            tone: "warning",
            title: "High risk: undercooked kidney beans (PHA lectin)",
            bullets: [
              "Risk: severe GI illness if undercooked.",
              "Fix: don’t slow-cook from dry; boil/pressure-cook thoroughly until fully tender.",
            ],
          },
          {
            tone: "warning",
            title: "Pregnancy: avoid raw sprouts",
            bullets: [
              "Risk: foodborne illness (sprouts are higher-risk when eaten raw).",
              "Fix: choose cooked legumes/beans; avoid raw sprouts unless clinician-directed and safely handled.",
            ],
          },
          {
            tone: "warning",
            title: "Home canning: botulism risk if done incorrectly",
            bullets: [
              "Risk: improper home canning can be dangerous.",
              "Fix: use commercially canned beans, or only use pressure-canning instructions from trusted sources.",
            ],
          },
          {
            tone: "tip",
            title: "Digestive comfort: don’t “tough it out”",
            bullets: [
              "If symptoms are intense, reduce portion size and increase more slowly.",
              "Try a different bean type/prep method, and use the tool below to pick a gentler starting point.",
            ],
          },
        ],
      },
      {
        id: "chart",
        title: "Use the embedded chart",
        paragraphs: [
          "Use the chart to explore different beans/legumes and find a personal “sweet spot” for comfort.",
          "Treat it as a starting point — individual tolerance varies a lot.",
        ],
      },
    ],
  },
];

const FOOD_GUIDES_BY_SLUG = new Map<string, FoodGuide>(
  FOOD_GUIDES.map((g) => [g.slug, g])
);

export function getFoodGuideBySlug(slug: string): FoodGuide | undefined {
  return FOOD_GUIDES_BY_SLUG.get(slug);
}
