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

interface DietaryAttributes {
  // Testing & Quality
  thirdPartyTested?: boolean;
  thirdPartyTesters?: string[];  // e.g., ["NSF", "USP", "ConsumerLab", "IFOS"]
  cgmpCertified?: boolean;
  heavyMetalsTested?: boolean;

  // Dietary Restrictions
  vegetarian?: boolean;
  vegan?: boolean;
  meatFree?: boolean;
  porkFree?: boolean;
  shellfishFree?: boolean;
  fishFree?: boolean;

  // Gelatin/Capsule Type
  gelatinFree?: boolean;
  animalGelatinFree?: boolean;
  usesVegetarianCapsule?: boolean;
  usesFishGelatin?: boolean;
  usesPorkGelatin?: boolean;
  usesBeefGelatin?: boolean;
  capsuleType?: string;  // e.g., "vegetable cellulose", "fish gelatin", "bovine gelatin"

  // Religious Certifications
  kosher?: boolean;
  kosherCertifier?: string;
  halal?: boolean;
  halalCertifier?: string;

  // Allergen-Free Claims
  glutenFree?: boolean;
  dairyFree?: boolean;
  soyFree?: boolean;
  nutFree?: boolean;
  eggFree?: boolean;
  cornFree?: boolean;

  // Other Certifications
  nonGMO?: boolean;
  organic?: boolean;
  organicCertifier?: string;
  sustainablySourced?: boolean;

  // Pregnancy/Nursing
  pregnancySafe?: boolean;
  nursingSafe?: boolean;

  // Additional
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
  productUrl?: string;
}

// ============================================
// EXTRACTION PROMPT
// ============================================

const EXTRACTION_PROMPT = `You are an expert supplement product analyzer. Your task is to extract structured supplement data from e-commerce product pages.

Analyze the following content from a supplement product page and extract ALL supplement information you can find.

The content is organized into sections:
- STRUCTURED DATA: JSON-LD or JavaScript product data (most reliable if present)
- COLLAPSED/ACCORDION CONTENT: Content from hidden accordion panels like "Supplement Facts"
- PAGE CONTENT: The main HTML content

IMPORTANT INSTRUCTIONS:
1. Check ALL sections - supplement facts are often in COLLAPSED/ACCORDION CONTENT
2. Extract the EXACT values shown - do not estimate or round
3. Pay attention to units: mcg, mg, g, IU, etc.
4. Note the specific FORMS of nutrients when listed (e.g., "Vitamin B12 as Methylcobalamin")
5. Look for supplement facts panels, ingredient lists, product descriptions
6. Extract % Daily Value when shown
7. List ALL other/inactive ingredients
8. Note any allergen warnings, certifications, or badges
9. CAREFULLY analyze capsule/softgel ingredients to determine gelatin type
10. Look for religious certifications (Kosher, Halal) and dietary claims (vegan, vegetarian)
11. Look for third-party testing logos/claims (NSF, USP, ConsumerLab, IFOS, etc.)
12. The HTML may be messy - extract what you can identify

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
  "certifications": ["cert1", "cert2"],
  "dietaryAttributes": {
    "thirdPartyTested": boolean or null,
    "thirdPartyTesters": ["NSF", "USP", etc.] or [],
    "cgmpCertified": boolean or null,
    "heavyMetalsTested": boolean or null,
    "vegetarian": boolean or null,
    "vegan": boolean or null,
    "meatFree": boolean or null,
    "porkFree": boolean or null,
    "shellfishFree": boolean or null,
    "fishFree": boolean or null,
    "gelatinFree": boolean or null,
    "animalGelatinFree": boolean or null,
    "usesVegetarianCapsule": boolean or null,
    "usesFishGelatin": boolean or null,
    "usesPorkGelatin": boolean or null,
    "usesBeefGelatin": boolean or null,
    "capsuleType": "vegetable cellulose" | "fish gelatin" | "bovine gelatin" | "porcine gelatin" | null,
    "kosher": boolean or null,
    "kosherCertifier": "OU" | "OK" | "Star-K" | etc. or null,
    "halal": boolean or null,
    "halalCertifier": string or null,
    "glutenFree": boolean or null,
    "dairyFree": boolean or null,
    "soyFree": boolean or null,
    "nutFree": boolean or null,
    "eggFree": boolean or null,
    "cornFree": boolean or null,
    "nonGMO": boolean or null,
    "organic": boolean or null,
    "organicCertifier": "USDA Organic" | etc. or null,
    "sustainablySourced": boolean or null,
    "pregnancySafe": boolean or null,
    "nursingSafe": boolean or null,
    "madeInUSA": boolean or null,
    "countryOfOrigin": string or null
  }
}

GELATIN DETECTION TIPS:
- "gelatin" alone often means porcine (pig) gelatin
- "fish gelatin" or "marine gelatin" = fish source
- "bovine gelatin" = beef/cow source
- "vegetable capsule", "hypromellose", "HPMC", "pullulan" = vegetarian
- If product says "vegetarian" or "vegan", it uses non-animal capsules

CRITICAL: Return ONLY the JSON object, no other text. Ensure all numbers are actual numbers, not strings. Use null for unknown values, not false.

If this does not appear to be a supplement product page, return:
{
  "error": "This does not appear to be a supplement product page"
}

HTML CONTENT:
`;

// ============================================
// IMAGE EXTRACTION PROMPT
// ============================================

const IMAGE_EXTRACTION_PROMPT = `You are an expert supplement label reader. Analyze this product image and extract ALL supplement information visible.

Look for:
1. Supplement Facts panel
2. Ingredient lists (including capsule/softgel type - gelatin source)
3. Serving size and servings per container
4. % Daily Value
5. Other ingredients
6. Allergen warnings
7. Certifications (NSF, USP, GMP, Non-GMO, Kosher, Halal, etc.)
8. Dietary claims (Vegan, Vegetarian, Gluten-Free, etc.)
9. Third-party testing seals

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
  "certifications": ["cert1", "cert2"],
  "dietaryAttributes": {
    "thirdPartyTested": boolean or null,
    "thirdPartyTesters": [] or ["NSF", "USP", "IFOS", etc.],
    "cgmpCertified": boolean or null,
    "vegetarian": boolean or null,
    "vegan": boolean or null,
    "gelatinFree": boolean or null,
    "usesFishGelatin": boolean or null,
    "usesPorkGelatin": boolean or null,
    "usesBeefGelatin": boolean or null,
    "usesVegetarianCapsule": boolean or null,
    "capsuleType": string or null,
    "kosher": boolean or null,
    "kosherCertifier": string or null,
    "halal": boolean or null,
    "glutenFree": boolean or null,
    "dairyFree": boolean or null,
    "soyFree": boolean or null,
    "nonGMO": boolean or null,
    "organic": boolean or null,
    "madeInUSA": boolean or null
  }
}

GELATIN TIPS: "gelatin" alone = likely porcine; "fish gelatin" = fish; "bovine" = beef; "vegetable capsule/HPMC" = vegetarian

CRITICAL: Return ONLY the JSON object, no other text. Use null for unknown values.

If no supplement information is visible, return:
{"noSupplementInfo": true}`;

// ============================================
// IMAGE URL EXTRACTION
// ============================================

function extractImageUrls(html: string, baseUrl: string): string[] {
  const imageUrls: string[] = [];

  // Match img src attributes
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    imageUrls.push(match[1]);
  }

  // Match data-src (lazy loading)
  const dataSrcRegex = /data-src=["']([^"']+)["']/gi;
  while ((match = dataSrcRegex.exec(html)) !== null) {
    imageUrls.push(match[1]);
  }

  // Match srcset
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1];
    const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
    imageUrls.push(...urls);
  }

  // Match background-image urls
  const bgRegex = /background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    imageUrls.push(match[1]);
  }

  // Convert relative URLs to absolute and filter
  const base = new URL(baseUrl);
  const absoluteUrls = imageUrls
    .map(url => {
      try {
        if (url.startsWith('//')) return `https:${url}`;
        if (url.startsWith('/')) return `${base.origin}${url}`;
        if (url.startsWith('http')) return url;
        return new URL(url, baseUrl).href;
      } catch {
        return null;
      }
    })
    .filter((url): url is string => url !== null);

  // Filter for likely product images (larger images, supplement-related keywords)
  const productImages = absoluteUrls.filter(url => {
    const lower = url.toLowerCase();
    // Skip tiny icons, tracking pixels, logos
    if (lower.includes('icon') || lower.includes('logo') || lower.includes('pixel')) return false;
    if (lower.includes('1x1') || lower.includes('spacer')) return false;
    // Prefer larger images and product-related terms
    const isLikelyProduct =
      lower.includes('product') ||
      lower.includes('supplement') ||
      lower.includes('label') ||
      lower.includes('facts') ||
      lower.includes('large') ||
      lower.includes('main') ||
      lower.includes('primary') ||
      /\d{3,}x\d{3,}/.test(lower); // dimensions like 500x500
    return isLikelyProduct || !lower.includes('thumb');
  });

  // Deduplicate and limit
  return [...new Set(productImages)].slice(0, 5);
}

// ============================================
// FETCH IMAGE AS BASE64
// ============================================

async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*',
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Skip tiny images (likely icons)
    if (buffer.byteLength < 10000) return null; // Less than 10KB

    // Map content type to Anthropic's expected format
    let mediaType = contentType.split(';')[0].trim();
    if (mediaType === 'image/jpg') mediaType = 'image/jpeg';

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(mediaType)) return null;

    return { base64, mediaType };
  } catch {
    return null;
  }
}

// ============================================
// ANALYZE IMAGES WITH VISION
// ============================================

async function analyzeImageWithModel(
  imageData: { base64: string; mediaType: string },
  model: string,
  anthropicClient: Anthropic
): Promise<ScannedSupplement | null> {
  try {
    const response = await anthropicClient.messages.create({
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
                media_type: imageData.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageData.base64,
              },
            },
            {
              type: 'text',
              text: IMAGE_EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') return null;

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
    if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
    if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
    jsonText = jsonText.trim();

    const data = JSON.parse(jsonText);

    // Skip if no supplement info found
    if (data.noSupplementInfo) return null;

    // Check if we got useful data (at least 3 ingredients for a good extraction)
    if (data.ingredients && data.ingredients.length >= 3) {
      return data as ScannedSupplement;
    }

    return null;
  } catch (error) {
    console.error(`Error analyzing image with ${model}:`, error);
    return null;
  }
}

async function analyzeImagesForSupplementData(
  imageUrls: string[],
  anthropicClient: Anthropic
): Promise<ScannedSupplement | null> {
  for (const imageUrl of imageUrls) {
    const imageData = await fetchImageAsBase64(imageUrl);
    if (!imageData) continue;

    // Try Haiku first (much cheaper)
    console.log('Trying image analysis with Haiku...');
    let result = await analyzeImageWithModel(imageData, 'claude-haiku-4-5-20251001', anthropicClient);

    if (result) {
      console.log(`Haiku found ${result.ingredients.length} ingredients from image`);
      return result;
    }

    // Fall back to Sonnet only if Haiku didn't get good results
    console.log('Haiku failed, trying Sonnet for image...');
    result = await analyzeImageWithModel(imageData, 'claude-sonnet-4-20250514', anthropicClient);

    if (result) {
      console.log(`Sonnet found ${result.ingredients.length} ingredients from image`);
      return result;
    }
  }

  return null;
}

// ============================================
// EXTRACT STRUCTURED DATA (JSON-LD, etc.)
// ============================================

function extractStructuredData(html: string): string {
  const structuredData: string[] = [];

  // Extract JSON-LD (Schema.org data - often contains product info)
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      structuredData.push(`JSON-LD Product Data: ${JSON.stringify(data, null, 2)}`);
    } catch {
      // Invalid JSON, skip
    }
  }

  // Extract Shopify product JSON (common pattern)
  const shopifyProductRegex = /var\s+product\s*=\s*(\{[\s\S]*?\});/i;
  const shopifyMatch = html.match(shopifyProductRegex);
  if (shopifyMatch) {
    try {
      structuredData.push(`Shopify Product Data: ${shopifyMatch[1]}`);
    } catch {
      // Skip
    }
  }

  // Look for window.__INITIAL_STATE__ or similar
  const initialStateRegex = /window\.__(?:INITIAL_STATE__|PRELOADED_STATE__|APP_STATE__)__?\s*=\s*(\{[\s\S]*?\});/i;
  const stateMatch = html.match(initialStateRegex);
  if (stateMatch) {
    structuredData.push(`Initial State Data: ${stateMatch[1].substring(0, 5000)}`);
  }

  return structuredData.join('\n\n');
}

// ============================================
// EXTRACT ACCORDION/COLLAPSED CONTENT
// ============================================

function extractCollapsedContent(html: string): string {
  const collapsedContent: string[] = [];

  // Common accordion patterns - extract content even if hidden
  // Look for elements with aria-hidden, hidden attribute, or display:none that contain supplement-related text

  // Pattern 1: Elements with hidden/collapsed classes but containing supplement facts
  const hiddenPanelRegex = /<(?:div|section|article)[^>]*(?:class="[^"]*(?:hidden|collapsed|accordion|panel|tab-content|details)[^"]*"|hidden|aria-hidden="true")[^>]*>([\s\S]*?)<\/(?:div|section|article)>/gi;
  let match;
  while ((match = hiddenPanelRegex.exec(html)) !== null) {
    const content = match[1];
    // Only include if it looks like it might have supplement info
    if (/supplement|vitamin|mineral|serving|daily.?value|amount|mcg|mg\b/i.test(content)) {
      collapsedContent.push(content);
    }
  }

  // Pattern 2: Details/summary elements (HTML5 accordion)
  const detailsRegex = /<details[^>]*>([\s\S]*?)<\/details>/gi;
  while ((match = detailsRegex.exec(html)) !== null) {
    collapsedContent.push(match[1]);
  }

  // Pattern 3: Elements with data-content or data-accordion-content
  const dataContentRegex = /data-(?:content|accordion-content|panel-content|tab-content)=["']([^"']+)["']/gi;
  while ((match = dataContentRegex.exec(html)) !== null) {
    try {
      // Sometimes content is HTML-encoded
      const decoded = match[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');
      collapsedContent.push(decoded);
    } catch {
      // Skip
    }
  }

  return collapsedContent.join('\n\n');
}

// ============================================
// HTML CLEANING (keeps hidden content!)
// ============================================

function cleanHtml(html: string): string {
  // First, extract structured data and collapsed content BEFORE cleaning
  const structuredData = extractStructuredData(html);
  const collapsedContent = extractCollapsedContent(html);

  // Remove script tags BUT keep their text content if it contains product data
  let cleaned = html;

  // Remove non-data scripts
  cleaned = cleaned.replace(/<script(?![^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove style tags
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove nav, header, footer (but NOT if they contain supplement keywords)
  cleaned = cleaned.replace(/<nav\b[^>]*>(?![\s\S]*(?:supplement|vitamin|ingredient))[\s\S]*?<\/nav>/gi, '');
  cleaned = cleaned.replace(/<footer\b[^>]*>(?![\s\S]*(?:supplement|vitamin|ingredient))[\s\S]*?<\/footer>/gi, '');

  // Remove SVG content
  cleaned = cleaned.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');

  // Remove noscript tags
  cleaned = cleaned.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // IMPORTANT: Do NOT remove hidden/display:none elements - they may contain accordion content!
  // Only remove inline event handlers
  cleaned = cleaned.replace(/\s*on\w+="[^"]*"/gi, '');

  // Keep data attributes that might contain content
  // Only remove tracking-related data attributes
  cleaned = cleaned.replace(/\s*data-(?:track|analytics|gtm|ga|pixel)[a-z-]*="[^"]*"/gi, '');

  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Prepend extracted structured data and collapsed content
  let result = '';
  if (structuredData) {
    result += `\n\n=== STRUCTURED DATA ===\n${structuredData}\n\n`;
  }
  if (collapsedContent) {
    result += `\n\n=== COLLAPSED/ACCORDION CONTENT ===\n${collapsedContent}\n\n`;
  }
  result += `\n\n=== PAGE CONTENT ===\n${cleaned}`;

  // Truncate if too long (keep first 80KB to accommodate extra data)
  if (result.length > 80000) {
    result = result.substring(0, 80000);
  }

  return result.trim();
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

    // Call Claude Haiku first (much cheaper - ~10x less than Sonnet)
    // Reduced max_tokens since supplement JSON is typically small
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
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

    // If we didn't get enough ingredients from text, try analyzing images
    const hasGoodIngredientData = extractedData.ingredients && extractedData.ingredients.length >= 3;

    if (!hasGoodIngredientData) {
      console.log('Text extraction found few/no ingredients, trying image analysis...');

      // Extract image URLs from the page
      const imageUrls = extractImageUrls(html, url);
      console.log(`Found ${imageUrls.length} potential product images`);

      if (imageUrls.length > 0) {
        const imageData = await analyzeImagesForSupplementData(imageUrls, anthropic);

        if (imageData && imageData.ingredients && imageData.ingredients.length > 0) {
          console.log(`Image analysis found ${imageData.ingredients.length} ingredients`);

          // Merge with text data (prefer image data for ingredients, text for name/brand if missing)
          extractedData = {
            ...extractedData,
            ...imageData,
            name: imageData.name || extractedData.name,
            brand: imageData.brand || extractedData.brand,
          };
        }
      }
    }

    // Validate required fields
    if (!extractedData.name || !extractedData.ingredients || extractedData.ingredients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract supplement information from text or images. Please ensure the URL points to a supplement product page with visible ingredient information.',
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
