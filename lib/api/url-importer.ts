/**
 * Supplement URL Importer
 *
 * Imports supplement data from product URLs using AI extraction.
 * Works with Amazon, iHerb, Thorne, and most supplement retailers.
 */

import type { ScannedSupplement, ScannedIngredient } from './supplement-scanner';

// Re-export types for convenience
export type { ScannedSupplement, ScannedIngredient };

// ============================================
// TYPES
// ============================================

export interface ImportResult {
  success: boolean;
  data?: ScannedSupplement;
  error?: string;
  processingTimeMs?: number;
}

export interface ImportProgress {
  stage: 'validating' | 'fetching' | 'analyzing' | 'extracting' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
}

// ============================================
// URL IMPORTER
// ============================================

/**
 * Import supplement data from a product URL
 */
export async function importSupplementFromUrl(
  url: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const startTime = Date.now();

  try {
    // Stage 1: Validate URL
    onProgress?.({
      stage: 'validating',
      message: 'Validating URL...',
      progress: 10,
    });

    const validation = validateUrl(url);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Stage 2: Fetch
    onProgress?.({
      stage: 'fetching',
      message: 'Fetching product page...',
      progress: 25,
    });

    // Stage 3: Analyze
    onProgress?.({
      stage: 'analyzing',
      message: 'Analyzing page with AI...',
      progress: 40,
    });

    // Call the API route
    const response = await fetch('/api/supplements/import-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    // Stage 4: Extract
    onProgress?.({
      stage: 'extracting',
      message: 'Extracting supplement data...',
      progress: 75,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to import from URL');
    }

    // Stage 5: Complete
    onProgress?.({
      stage: 'complete',
      message: 'Import complete!',
      progress: 100,
    });

    return {
      success: true,
      data: result.data,
      processingTimeMs: Date.now() - startTime,
    };

  } catch (error) {
    onProgress?.({
      stage: 'error',
      message: error instanceof Error ? error.message : 'Import failed',
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
 * Validate URL before processing
 */
function validateUrl(url: string): { valid: boolean; error?: string } {
  // Check if URL is provided
  if (!url || !url.trim()) {
    return {
      valid: false,
      error: 'Please enter a URL',
    };
  }

  // Basic URL format check
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Please enter a valid http or https URL',
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format. Please enter a complete URL starting with https://',
    };
  }

  return { valid: true };
}

// ============================================
// SUPPORTED RETAILERS
// ============================================

export const SUPPORTED_RETAILERS = [
  { name: 'Amazon', domain: 'amazon.com', icon: 'amazon' },
  { name: 'iHerb', domain: 'iherb.com', icon: 'iherb' },
  { name: 'Thorne', domain: 'thorne.com', icon: 'thorne' },
  { name: 'Vitacost', domain: 'vitacost.com', icon: 'vitacost' },
  { name: 'Life Extension', domain: 'lifeextension.com', icon: 'lifeextension' },
  { name: 'NOW Foods', domain: 'nowfoods.com', icon: 'nowfoods' },
  { name: 'Pure Encapsulations', domain: 'pureencapsulations.com', icon: 'pure' },
];

/**
 * Check if URL is from a known supplement retailer
 */
export function getRetailerFromUrl(url: string): typeof SUPPORTED_RETAILERS[0] | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SUPPORTED_RETAILERS.find(r => hostname.includes(r.domain)) || null;
  } catch {
    return null;
  }
}
