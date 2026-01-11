/**
 * Supplement URL Import API Route
 *
 * Uses Claude to extract structured supplement data from product URLs.
 * Fetches HTML server-side to avoid CORS, then sends to Claude for extraction.
 *
 * POST /api/supplements/import-url
 * Body: { url: string }
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
  productUrl?: string;
}

// ============================================
// EXTRACTION PROMPT
// ============================================

const EXTRACTION_PROMPT = `You are an expert supplement product analyzer. Your task is to extract structured supplement data from e-commerce product pages.

Analyze the following HTML content from a supplement product page and extract ALL supplement information you can find.

IMPORTANT INSTRUCTIONS:
1. Extract the EXACT values shown - do not estimate or round
2. Pay attention to units: mcg, mg, g, IU, etc.
3. Note the specific FORMS of nutrients when listed (e.g., "Vitamin B12 as Methylcobalamin")
4. Look for supplement facts panels, ingredient lists, product descriptions
5. Extract % Daily Value when shown
6. List ALL other/inactive ingredients
7. Note any allergen warnings, certifications, or badges
8. The HTML may be messy - extract what you can identify

Return your analysis as a JSON object with this EXACT structure:
{
  "name": "Full product name",
  "brand": "Brand name or null if not found",
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
  "certifications": ["cert1", "cert2"]
}

CRITICAL: Return ONLY the JSON object, no other text. Ensure all numbers are actual numbers, not strings.

If this does not appear to be a supplement product page, return:
{
  "error": "This does not appear to be a supplement product page"
}

HTML CONTENT:
`;

// ============================================
// HTML CLEANING
// ============================================

function cleanHtml(html: string): string {
  // Remove script tags and their contents
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and their contents
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove nav, header, footer elements (usually not product info)
  cleaned = cleaned.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '');
  cleaned = cleaned.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '');
  cleaned = cleaned.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '');

  // Remove SVG content
  cleaned = cleaned.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');

  // Remove noscript tags
  cleaned = cleaned.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Remove inline styles and event handlers
  cleaned = cleaned.replace(/\s*style="[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s*on\w+="[^"]*"/gi, '');

  // Remove data attributes
  cleaned = cleaned.replace(/\s*data-[a-z-]+="[^"]*"/gi, '');

  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Truncate if too long (keep first 50KB which should have product info)
  if (cleaned.length > 50000) {
    cleaned = cleaned.substring(0, 50000);
  }

  return cleaned.trim();
}

// ============================================
// URL VALIDATION
// ============================================

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

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
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'No URL provided' },
        { status: 400 }
      );
    }

    // Validate URL
    if (!isValidUrl(url)) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL. Please provide a valid http or https URL.' },
        { status: 400 }
      );
    }

    // Fetch the webpage
    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
          { status: 422 }
        );
      }

      html = await response.text();
    } catch (fetchError) {
      console.error('Failed to fetch URL:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch the URL. The website may be blocking requests or unavailable.' },
        { status: 422 }
      );
    }

    // Clean and truncate HTML
    const cleanedHtml = cleanHtml(html);

    if (cleanedHtml.length < 100) {
      return NextResponse.json(
        { success: false, error: 'The page appears to be empty or blocked. Please try a different URL.' },
        { status: 422 }
      );
    }

    // Call Claude to extract data
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: EXTRACTION_PROMPT + cleanedHtml,
        },
      ],
    });

    // Extract text content from response
    const textContent = claudeResponse.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json(
        { success: false, error: 'No response from AI' },
        { status: 500 }
      );
    }

    // Parse JSON response
    let extractedData: ScannedSupplement & { error?: string };
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
          error: 'Failed to parse extracted data. The page may not contain supplement information.',
          rawResponse: textContent.text,
        },
        { status: 422 }
      );
    }

    // Check if Claude detected a non-supplement page
    if ('error' in extractedData && extractedData.error) {
      return NextResponse.json(
        { success: false, error: extractedData.error },
        { status: 422 }
      );
    }

    // Validate required fields
    if (!extractedData.name || !extractedData.ingredients) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract supplement information. Please ensure the URL points to a supplement product page.',
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

    // Add the source URL
    extractedData.productUrl = url;

    return NextResponse.json({
      success: true,
      data: extractedData,
    });

  } catch (error) {
    console.error('URL import error:', error);

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
      { success: false, error: 'Failed to import from URL. Please try again.' },
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
