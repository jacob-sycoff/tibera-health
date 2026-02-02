/**
 * Supplement Label Scanning API Route
 *
 * Uses Claude Vision API to extract structured supplement data from label images.
 *
 * POST /api/supplements/scan
 * Body: { image: string (base64), mimeType: string }
 * Returns: { success: boolean, data?: ScannedSupplement, error?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/utils/supabase/server';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// TYPES
// ============================================

interface ScannedIngredient {
  name: string;
  amount: number;
  unit: string;
  dailyValue?: number;
  form?: string;
}

interface DietaryAttributes {
  thirdPartyTested?: boolean;
  thirdPartyTesters?: string[];
  cgmpCertified?: boolean;
  heavyMetalsTested?: boolean;
  vegetarian?: boolean;
  vegan?: boolean;
  meatFree?: boolean;
  porkFree?: boolean;
  shellfishFree?: boolean;
  fishFree?: boolean;
  gelatinFree?: boolean;
  animalGelatinFree?: boolean;
  usesVegetarianCapsule?: boolean;
  usesFishGelatin?: boolean;
  usesPorkGelatin?: boolean;
  usesBeefGelatin?: boolean;
  capsuleType?: string;
  kosher?: boolean;
  kosherCertifier?: string;
  halal?: boolean;
  halalCertifier?: string;
  glutenFree?: boolean;
  dairyFree?: boolean;
  soyFree?: boolean;
  nutFree?: boolean;
  eggFree?: boolean;
  cornFree?: boolean;
  nonGMO?: boolean;
  organic?: boolean;
  organicCertifier?: string;
  sustainablySourced?: boolean;
  pregnancySafe?: boolean;
  nursingSafe?: boolean;
  madeInUSA?: boolean;
  countryOfOrigin?: string;
}

interface ScannedSupplement {
  name: string;
  brand: string | null;
  servingSize: string | null;
  servingsPerContainer: number | null;
  ingredients: ScannedIngredient[];
  otherIngredients: string[];
  allergens: string[];
  warnings: string[];
  certifications: string[];
  dietaryAttributes: DietaryAttributes;
  confidence: number;
  rawText?: string;
}

// ============================================
// EXTRACTION PROMPT
// ============================================

const EXTRACTION_PROMPT = `You are an expert supplement label analyzer with deep knowledge of nutrition science, biochemistry, and supplement formulations. Your task is to extract structured data from supplement label images with high accuracy.

Analyze this supplement label image and extract ALL information visible on the label. Be thorough and precise.

IMPORTANT INSTRUCTIONS:
1. Extract the EXACT values shown on the label - do not estimate or round
2. Pay attention to units: mcg, mg, g, IU, etc.
3. Note the specific FORMS of nutrients when listed (e.g., "Vitamin B12 as Methylcobalamin")
4. Extract % Daily Value when shown
5. List ALL other ingredients exactly as written
6. CAREFULLY check capsule/softgel ingredients to determine gelatin type
7. Note any allergen warnings or certifications
8. Look for dietary certifications: Kosher, Halal, Vegan, Vegetarian, Non-GMO, Organic
9. Look for third-party testing seals: NSF, USP, ConsumerLab, IFOS, etc.
10. If something is unclear or partially visible, include it with a note

Return your analysis as a JSON object with this EXACT structure:
{
  "name": "Full product name as shown on label",
  "brand": "Brand name or null if not visible",
  "servingSize": "Serving size as written (e.g., '2 capsules', '1 tablet')",
  "servingsPerContainer": number or null,
  "ingredients": [
    {
      "name": "Nutrient name (e.g., 'Vitamin D3')",
      "amount": numeric_value,
      "unit": "unit string (mcg, mg, IU, etc.)",
      "dailyValue": percentage_number_or_null,
      "form": "specific form if listed (e.g., 'Cholecalciferol') or null"
    }
  ],
  "otherIngredients": ["ingredient1", "ingredient2"],
  "allergens": ["allergen1", "allergen2"],
  "warnings": ["warning1", "warning2"],
  "certifications": ["cert1", "cert2"],
  "dietaryAttributes": {
    "thirdPartyTested": boolean or null,
    "thirdPartyTesters": ["NSF", "USP", etc.] or [],
    "cgmpCertified": boolean or null,
    "vegetarian": boolean or null,
    "vegan": boolean or null,
    "gelatinFree": boolean or null,
    "usesFishGelatin": boolean or null,
    "usesPorkGelatin": boolean or null,
    "usesBeefGelatin": boolean or null,
    "usesVegetarianCapsule": boolean or null,
    "capsuleType": "vegetable cellulose" | "fish gelatin" | "bovine gelatin" | "porcine gelatin" | null,
    "kosher": boolean or null,
    "kosherCertifier": string or null,
    "halal": boolean or null,
    "glutenFree": boolean or null,
    "dairyFree": boolean or null,
    "soyFree": boolean or null,
    "nonGMO": boolean or null,
    "organic": boolean or null,
    "madeInUSA": boolean or null
  },
  "rawText": "All visible text on the label for reference"
}

GELATIN DETECTION:
- "gelatin" alone typically means porcine (pig) gelatin
- "fish gelatin" or "marine gelatin" = fish source
- "bovine gelatin" = beef/cow source
- "vegetable capsule", "hypromellose", "HPMC", "pullulan" = vegetarian capsule
- If product is labeled "vegetarian" or "vegan", it uses non-animal capsules

CRITICAL: Return ONLY the JSON object, no other text. Ensure all numbers are actual numbers, not strings. Use null for unknown values.

Common unit conversions to be aware of (but don't convert, just recognize):
- mcg = micrograms = µg
- mg = milligrams
- g = grams
- IU = International Units

Common nutrient forms to look for:
- Vitamin D: D3/Cholecalciferol, D2/Ergocalciferol
- B12: Methylcobalamin, Cyanocobalamin
- Folate: Methylfolate/5-MTHF, Folic Acid
- Magnesium: Citrate, Glycinate, Oxide, etc.
- Iron: Ferrous Sulfate, Bisglycinate, etc.`;

// ============================================
// API HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { success: false, error: 'AI service not configured. Please add ANTHROPIC_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { image, mimeType } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'No image provided' },
        { status: 400 }
      );
    }

    // Validate mime type
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const mediaType = validMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';

    // Helper to call Claude and parse response
    async function tryExtraction(model: string): Promise<ScannedSupplement | null> {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 2048, // Reduced - supplement JSON is typically small
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                  data: image,
                },
              },
              {
                type: 'text',
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      });

      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') return null;

      try {
        let jsonText = textContent.text.trim();
        if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
        if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
        if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
        jsonText = jsonText.trim();

        const data = JSON.parse(jsonText) as ScannedSupplement;

        // Check if we got good data (at least 3 ingredients)
        if (data.name && data.ingredients && data.ingredients.length >= 3) {
          return data;
        }
        return null;
      } catch {
        return null;
      }
    }

    // Try Haiku first (much cheaper - ~10x less than Sonnet)
    console.log('Trying label scan with Haiku...');
    let extractedData = await tryExtraction('claude-haiku-4-5-20251001');

    // Fall back to Sonnet if Haiku didn't get good results
    if (!extractedData) {
      console.log('Haiku failed, trying Sonnet...');
      extractedData = await tryExtraction('claude-sonnet-4-20250514');
    }

    // Validate required fields
    if (!extractedData || !extractedData.name || !extractedData.ingredients) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract supplement information. Please ensure the image shows a clear supplement facts label.',
        },
        { status: 422 }
      );
    }

    // Ensure arrays exist
    extractedData.ingredients = extractedData.ingredients || [];
    extractedData.otherIngredients = extractedData.otherIngredients || [];
    extractedData.allergens = extractedData.allergens || [];
    extractedData.warnings = extractedData.warnings || [];
    extractedData.certifications = extractedData.certifications || [];
    extractedData.dietaryAttributes = extractedData.dietaryAttributes || {};

    // Ensure dietaryAttributes arrays exist
    if (extractedData.dietaryAttributes) {
      extractedData.dietaryAttributes.thirdPartyTesters = extractedData.dietaryAttributes.thirdPartyTesters || [];
    }

    // Clean up ingredients - ensure numeric values
    extractedData.ingredients = extractedData.ingredients.map(ing => ({
      name: String(ing.name || ''),
      amount: typeof ing.amount === 'number' ? ing.amount : parseFloat(String(ing.amount)) || 0,
      unit: String(ing.unit || 'mg'),
      dailyValue: ing.dailyValue != null ? (typeof ing.dailyValue === 'number' ? ing.dailyValue : parseFloat(String(ing.dailyValue))) : undefined,
      form: ing.form || undefined,
    }));

    // Calculate confidence score
    extractedData.confidence = calculateConfidence(extractedData);

    return NextResponse.json({
      success: true,
      data: extractedData,
    });

  } catch (error) {
    console.error('Supplement scan error:', error);

    // Handle specific Anthropic errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { success: false, error: 'Invalid API key. Please check ANTHROPIC_API_KEY.' },
          { status: 500 }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to analyze image. Please try again.' },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateConfidence(data: ScannedSupplement): number {
  let score = 0;
  let maxScore = 0;

  // Has name
  maxScore += 20;
  if (data.name && data.name.length > 2) score += 20;

  // Has brand
  maxScore += 10;
  if (data.brand) score += 10;

  // Has serving size
  maxScore += 10;
  if (data.servingSize) score += 10;

  // Has ingredients
  maxScore += 30;
  if (data.ingredients.length > 0) {
    score += Math.min(30, data.ingredients.length * 3);
  }

  // Ingredients have amounts
  maxScore += 20;
  const ingredientsWithAmounts = data.ingredients.filter(i => i.amount > 0).length;
  if (data.ingredients.length > 0) {
    score += Math.round((ingredientsWithAmounts / data.ingredients.length) * 20);
  }

  // Has other ingredients
  maxScore += 5;
  if (data.otherIngredients.length > 0) score += 5;

  // Has daily values
  maxScore += 5;
  const ingredientsWithDV = data.ingredients.filter(i => i.dailyValue != null).length;
  if (data.ingredients.length > 0 && ingredientsWithDV > 0) score += 5;

  return Math.round((score / maxScore) * 100) / 100;
}
