/**
 * Meal Photo Logger
 *
 * Client utilities to analyze a meal photo (and optional note) into structured
 * food items with portion estimates.
 */

// ============================================
// TYPES
// ============================================

export interface MealPhotoItem {
  name: string;
  usdaQuery: string;
  servedGrams?: number | null;
  consumedGrams?: number | null;
  consumedFraction?: number | null;
  confidence: number; // 0-1
}

export interface MealPhotoAnalysis {
  items: MealPhotoItem[];
  assumptions: string[];
  overallConfidence: number; // 0-1
}

export interface MealPhotoAnalyzeResult {
  success: boolean;
  data?: MealPhotoAnalysis;
  error?: string;
  processingTimeMs?: number;
}

export interface MealPhotoAnalyzeProgress {
  stage: "uploading" | "analyzing" | "complete" | "error";
  message: string;
  progress: number; // 0-100
}

// ============================================
// API
// ============================================

export async function analyzeMealPhoto(
  imageFile: File,
  args?: {
    note?: string;
    onProgress?: (progress: MealPhotoAnalyzeProgress) => void;
  }
): Promise<MealPhotoAnalyzeResult> {
  const startTime = Date.now();

  try {
    args?.onProgress?.({
      stage: "uploading",
      message: "Preparing image...",
      progress: 10,
    });

    const base64Image = await fileToBase64(imageFile);
    const validation = validateImage(imageFile);
    if (!validation.valid) {
      return { success: false, error: validation.error, processingTimeMs: Date.now() - startTime };
    }

    args?.onProgress?.({
      stage: "analyzing",
      message: "Analyzing meal photo...",
      progress: 40,
    });

    const response = await fetch("/api/food/analyze-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: base64Image,
        mimeType: imageFile.type,
        note: args?.note,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const json = (await response.json()) as { success: boolean; data?: MealPhotoAnalysis; error?: string };

    if (!json.success || !json.data) {
      throw new Error(json.error || "Failed to analyze meal photo");
    }

    args?.onProgress?.({
      stage: "complete",
      message: "Analysis complete",
      progress: 100,
    });

    return {
      success: true,
      data: json.data,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    args?.onProgress?.({
      stage: "error",
      message: error instanceof Error ? error.message : "Analysis failed",
      progress: 0,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================
// HELPERS
// ============================================

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

function validateImage(file: File): { valid: boolean; error?: string } {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid image type: ${file.type}. Please use JPEG, PNG, or WebP.`,
    };
  }

  const maxSize = 15 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: "Image too large. Please use an image under 15MB." };
  }

  const minSize = 10 * 1024;
  if (file.size < minSize) {
    return { valid: false, error: "Image too small. Please use a higher quality image." };
  }

  return { valid: true };
}

