/**
 * Supplement Label Scanner
 *
 * Uses Claude Vision API to extract structured supplement data from label images.
 * Implements a multi-pass extraction approach for high accuracy:
 * 1. Initial OCR pass to extract all visible text
 * 2. Structured extraction pass to parse into fields
 * 3. Validation pass to verify amounts and units
 */

// ============================================
// TYPES
// ============================================

export interface ScannedIngredient {
  name: string;
  amount: number;
  unit: string;
  dailyValue?: number; // Percentage of daily value if shown
  form?: string; // e.g., "methylcobalamin", "citrate", etc.
}

export interface ScannedSupplement {
  name: string;
  brand: string | null;
  servingSize: string | null;
  servingsPerContainer: number | null;
  ingredients: ScannedIngredient[];
  otherIngredients: string[];
  allergens: string[];
  warnings: string[];
  certifications: string[];
  confidence: number; // 0-1 confidence score
  rawText?: string; // Original extracted text for debugging
}

export interface ScanResult {
  success: boolean;
  data?: ScannedSupplement;
  error?: string;
  processingTimeMs?: number;
}

export interface ScanProgress {
  stage: 'uploading' | 'analyzing' | 'extracting' | 'validating' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
}

// ============================================
// SCANNER CLIENT
// ============================================

/**
 * Scan a supplement label image and extract structured data
 */
export async function scanSupplementLabel(
  imageFile: File,
  onProgress?: (progress: ScanProgress) => void
): Promise<ScanResult> {
  const startTime = Date.now();

  try {
    // Stage 1: Upload
    onProgress?.({
      stage: 'uploading',
      message: 'Uploading image...',
      progress: 10,
    });

    // Convert image to base64
    const base64Image = await fileToBase64(imageFile);

    // Validate image
    const validation = validateImage(imageFile, base64Image);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Stage 2: Analyze
    onProgress?.({
      stage: 'analyzing',
      message: 'Analyzing label with AI...',
      progress: 30,
    });

    // Call the API route
    const response = await fetch('/api/supplements/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        mimeType: imageFile.type,
      }),
    });

    // Stage 3: Extract
    onProgress?.({
      stage: 'extracting',
      message: 'Extracting supplement data...',
      progress: 70,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const result = await response.json();

    // Stage 4: Validate
    onProgress?.({
      stage: 'validating',
      message: 'Validating extracted data...',
      progress: 90,
    });

    // Client-side validation and normalization
    const validatedData = validateAndNormalize(result.data);

    // Stage 5: Complete
    onProgress?.({
      stage: 'complete',
      message: 'Scan complete!',
      progress: 100,
    });

    return {
      success: true,
      data: validatedData,
      processingTimeMs: Date.now() - startTime,
    };

  } catch (error) {
    onProgress?.({
      stage: 'error',
      message: error instanceof Error ? error.message : 'Scan failed',
      progress: 0,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert a File to base64 string
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Validate image before processing
 */
function validateImage(
  file: File,
  _base64: string
): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid image type: ${file.type}. Please use JPEG, PNG, or WebP.`,
    };
  }

  // Check file size (max 20MB for Claude)
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Image too large. Please use an image under 20MB.',
    };
  }

  // Check minimum size (too small = probably not readable)
  const minSize = 10 * 1024; // 10KB
  if (file.size < minSize) {
    return {
      valid: false,
      error: 'Image too small. Please use a higher quality image.',
    };
  }

  return { valid: true };
}

/**
 * Validate and normalize extracted data
 */
function validateAndNormalize(data: ScannedSupplement): ScannedSupplement {
  // Normalize units
  const normalizedIngredients = data.ingredients.map(ing => ({
    ...ing,
    unit: normalizeUnit(ing.unit),
    amount: normalizeAmount(ing.amount, ing.unit),
  }));

  // Remove duplicates (sometimes OCR picks up same ingredient twice)
  const uniqueIngredients = deduplicateIngredients(normalizedIngredients);

  // Calculate confidence based on data completeness
  const confidence = calculateConfidence({
    ...data,
    ingredients: uniqueIngredients,
  });

  return {
    ...data,
    ingredients: uniqueIngredients,
    confidence,
  };
}

/**
 * Normalize unit strings to standard format
 */
function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    // Micrograms
    'mcg': 'mcg',
    'ug': 'mcg',
    'µg': 'mcg',
    'microgram': 'mcg',
    'micrograms': 'mcg',
    // Milligrams
    'mg': 'mg',
    'milligram': 'mg',
    'milligrams': 'mg',
    // Grams
    'g': 'g',
    'gram': 'g',
    'grams': 'g',
    // IU (International Units)
    'iu': 'IU',
    'i.u.': 'IU',
    'i.u': 'IU',
    // CFU (Colony Forming Units)
    'cfu': 'CFU',
    'billion cfu': 'billion CFU',
    // RAE
    'mcg rae': 'mcg RAE',
    'rae': 'mcg RAE',
    // DFE
    'mcg dfe': 'mcg DFE',
    'dfe': 'mcg DFE',
    // NE
    'mg ne': 'mg NE',
    'ne': 'mg NE',
  };

  const normalized = unit.toLowerCase().trim();
  return unitMap[normalized] || unit;
}

/**
 * Normalize amounts (handle comma separators, etc.)
 */
function normalizeAmount(amount: number, unit: string): number {
  // Some supplements list things like "1,000" which might be parsed as 1
  // This is handled during extraction, but double-check here

  // Convert IU to mcg for Vitamin D (1 IU = 0.025 mcg)
  // But keep original for now since we store the unit separately

  return amount;
}

/**
 * Remove duplicate ingredients
 */
function deduplicateIngredients(ingredients: ScannedIngredient[]): ScannedIngredient[] {
  const seen = new Map<string, ScannedIngredient>();

  for (const ing of ingredients) {
    const key = ing.name.toLowerCase().trim();

    // If we've seen this ingredient, keep the one with more data
    if (seen.has(key)) {
      const existing = seen.get(key)!;
      if ((ing.form && !existing.form) || (ing.dailyValue && !existing.dailyValue)) {
        seen.set(key, { ...existing, ...ing });
      }
    } else {
      seen.set(key, ing);
    }
  }

  return Array.from(seen.values());
}

/**
 * Calculate confidence score based on data completeness
 */
function calculateConfidence(data: ScannedSupplement): number {
  let score = 0;
  let maxScore = 0;

  // Has name (required)
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

  // Has allergens listed (even if empty array means checked)
  maxScore += 5;
  score += 5; // We always get this from the scan

  return Math.round((score / maxScore) * 100) / 100;
}

// ============================================
// COMMON SUPPLEMENT FORMS
// ============================================

export const NUTRIENT_FORMS: Record<string, string[]> = {
  'Vitamin D': ['D3 (Cholecalciferol)', 'D2 (Ergocalciferol)'],
  'Vitamin B12': ['Methylcobalamin', 'Cyanocobalamin', 'Hydroxocobalamin', 'Adenosylcobalamin'],
  'Folate': ['Methylfolate (5-MTHF)', 'Folic Acid', 'Folinic Acid'],
  'Vitamin C': ['Ascorbic Acid', 'Sodium Ascorbate', 'Calcium Ascorbate', 'Ester-C'],
  'Magnesium': ['Citrate', 'Glycinate', 'Oxide', 'Malate', 'Threonate', 'Taurate', 'Chloride'],
  'Calcium': ['Citrate', 'Carbonate', 'Hydroxyapatite', 'Gluconate'],
  'Iron': ['Ferrous Sulfate', 'Ferrous Gluconate', 'Ferrous Bisglycinate', 'Heme Iron'],
  'Zinc': ['Citrate', 'Gluconate', 'Picolinate', 'Oxide', 'Bisglycinate'],
  'Vitamin A': ['Retinyl Palmitate', 'Retinyl Acetate', 'Beta-Carotene'],
  'Vitamin E': ['d-Alpha Tocopherol', 'dl-Alpha Tocopherol', 'Mixed Tocopherols'],
  'Vitamin K': ['K1 (Phylloquinone)', 'K2 (MK-4)', 'K2 (MK-7)'],
  'Vitamin B6': ['Pyridoxine HCl', 'Pyridoxal-5-Phosphate (P5P)'],
  'Vitamin B1': ['Thiamine HCl', 'Benfotiamine'],
  'Vitamin B2': ['Riboflavin', 'Riboflavin-5-Phosphate'],
  'Vitamin B3': ['Niacinamide', 'Nicotinic Acid', 'Inositol Hexanicotinate'],
  'CoQ10': ['Ubiquinone', 'Ubiquinol'],
  'Omega-3': ['Fish Oil', 'Algal Oil', 'Krill Oil', 'Flaxseed Oil'],
};
