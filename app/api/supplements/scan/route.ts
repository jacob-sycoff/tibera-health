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
6. Note any allergen warnings or certifications
7. If something is unclear or partially visible, include it with a note

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
  "rawText": "All visible text on the label for reference"
}

CRITICAL: Return ONLY the JSON object, no other text. Ensure all numbers are actual numbers, not strings.

Common unit conversions to be aware of (but don't convert, just recognize):
- mcg = micrograms = µg
- mg = milligrams
- g = grams
- IU = International Units
- mcg RAE = Retinol Activity Equivalents
- mcg DFE = Dietary Folate Equivalents
- mg NE = Niacin Equivalents

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

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
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

    // Extract text content from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json(
        { success: false, error: 'No response from AI' },
        { status: 500 }
      );
    }

    // Parse JSON response
    let extractedData: ScannedSupplement;
    try {
      // Clean up the response - sometimes Claude includes markdown code blocks
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();

      extractedData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent.text);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse extracted data. The image may be unclear or not a supplement label.',
          rawResponse: textContent.text,
        },
        { status: 422 }
      );
    }

    // Validate required fields
    if (!extractedData.name || !extractedData.ingredients) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract supplement information. Please ensure the image shows a clear supplement facts label.',
          data: extractedData,
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
