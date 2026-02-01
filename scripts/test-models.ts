/**
 * Model Comparison Test for Supplement Extraction
 *
 * Tests Haiku 3.5 vs 4.5 and Sonnet 4 vs 4.5 for accuracy and cost
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Test URLs - real supplement product pages with static HTML
const TEST_URLS = [
  'https://www.vitacost.com/nordic-naturals-ultimate-omega-lemon', // Has static supplement facts
  'https://www.iherb.com/pr/nordic-naturals-ultimate-omega-lemon-1-280-mg-60-soft-gels/6018',
];

const EXTRACTION_PROMPT = `You are an expert supplement product analyzer. Extract ALL supplement information from this webpage content.

Return a JSON object with this structure:
{
  "name": "Full product name",
  "brand": "Brand name or null",
  "servingSize": "Serving size as written",
  "servingsPerContainer": number or null,
  "ingredients": [
    {
      "name": "Nutrient name",
      "amount": numeric_value,
      "unit": "unit string",
      "dailyValue": percentage_or_null,
      "form": "specific form or null"
    }
  ],
  "otherIngredients": ["ingredient1", "ingredient2"],
  "certifications": ["cert1", "cert2"]
}

Return ONLY the JSON object.

HTML CONTENT:
`;

interface TestResult {
  model: string;
  url: string;
  ingredientsFound: number;
  hasName: boolean;
  hasBrand: boolean;
  hasServingSize: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  responseTimeMs: number;
  error?: string;
}

// Pricing per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 }, // base rate for <200K
};

async function fetchAndCleanHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  let html = await response.text();

  // Basic cleaning
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');
  html = html.replace(/\s+/g, ' ');

  // Truncate to ~40K chars to keep costs reasonable
  if (html.length > 40000) {
    html = html.substring(0, 40000);
  }

  return html;
}

async function testModel(model: string, html: string, url: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: EXTRACTION_PROMPT + html,
        },
      ],
    });

    const responseTime = Date.now() - startTime;
    const textContent = response.content.find(c => c.type === 'text');

    if (!textContent || textContent.type !== 'text') {
      return {
        model,
        url,
        ingredientsFound: 0,
        hasName: false,
        hasBrand: false,
        hasServingSize: false,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        estimatedCost: 0,
        responseTimeMs: responseTime,
        error: 'No text response',
      };
    }

    // Parse JSON
    let jsonText = textContent.text.trim();
    if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
    if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
    if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
    jsonText = jsonText.trim();

    // Debug: show first 200 chars of response
    console.log(`  Raw response preview: ${jsonText.substring(0, 200)}...`);

    const data = JSON.parse(jsonText);

    // Calculate cost
    const pricing = PRICING[model];
    const inputCost = (response.usage.input_tokens / 1_000_000) * pricing.input;
    const outputCost = (response.usage.output_tokens / 1_000_000) * pricing.output;

    return {
      model,
      url,
      ingredientsFound: data.ingredients?.length || 0,
      hasName: !!data.name,
      hasBrand: !!data.brand,
      hasServingSize: !!data.servingSize,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      estimatedCost: inputCost + outputCost,
      responseTimeMs: responseTime,
    };
  } catch (error) {
    return {
      model,
      url,
      ingredientsFound: 0,
      hasName: false,
      hasBrand: false,
      hasServingSize: false,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      responseTimeMs: Date.now() - startTime,
      error: String(error),
    };
  }
}

async function main() {
  console.log('=== Supplement Extraction Model Comparison ===\n');

  const haikuModels = ['claude-3-5-haiku-20241022', 'claude-haiku-4-5-20251001'];
  const sonnetModels = ['claude-sonnet-4-20250514', 'claude-sonnet-4-5-20250929'];

  let totalCost = 0;
  const results: TestResult[] = [];

  // Use larger sample HTML with noise (simulating real e-commerce page)
  const testUrl = 'sample-supplement-page-large';
  const noiseHtml = Array(50).fill(`
    <div class="recommended-product">
      <h3>You might also like</h3>
      <a href="/product/123">Other Supplement</a>
      <p class="price">$24.99</p>
      <p class="rating">4.5 stars</p>
    </div>
    <div class="review">
      <p>Great product! I've been taking this for 3 months and feel great.</p>
      <span class="reviewer">John D.</span>
    </div>
  `).join('\n');

  const html = `
    <html>
    <head>
      <title>Nordic Naturals Ultimate Omega - Lemon, 60 Soft Gels | Best Fish Oil</title>
      <meta name="description" content="Buy Nordic Naturals Ultimate Omega..."/>
    </head>
    <body>
    <header>
      <nav>Home > Supplements > Fish Oil > Nordic Naturals</nav>
      <div class="cart">Cart (0)</div>
    </header>

    ${noiseHtml.slice(0, noiseHtml.length / 2)}

    <div class="product-page">
      <div class="product-images">
        <img src="/images/nordic-omega-1.jpg" alt="Product Image 1"/>
        <img src="/images/nordic-omega-2.jpg" alt="Product Image 2"/>
      </div>

      <h1>Nordic Naturals Ultimate Omega</h1>
      <div class="brand">By: Nordic Naturals</div>
      <div class="price-box">
        <span class="price">$27.99</span>
        <span class="original-price">$34.99</span>
        <span class="discount">20% OFF</span>
      </div>

      <div class="product-info">
        <p>Concentrated Omega-3 Fish Oil. Supports Heart, Brain & Immune Health.</p>
        <p>1280 mg Omega-3s per serving. Award-winning formula.</p>
        <ul class="benefits">
          <li>Supports cardiovascular health</li>
          <li>Promotes brain function</li>
          <li>Helps maintain healthy mood</li>
        </ul>
      </div>

      <div class="supplement-facts" id="supplement-facts">
        <h2>Supplement Facts</h2>
        <p><strong>Serving Size:</strong> 2 Soft Gels</p>
        <p><strong>Servings Per Container:</strong> 30</p>

        <table class="nutrients">
          <thead>
            <tr><th>Nutrient</th><th>Amount Per Serving</th><th>% Daily Value</th></tr>
          </thead>
          <tbody>
            <tr><td>Calories</td><td>20</td><td></td></tr>
            <tr><td>Total Fat</td><td>2 g</td><td>3%</td></tr>
            <tr><td>Saturated Fat</td><td>0.5 g</td><td>3%</td></tr>
            <tr><td>Trans Fat</td><td>0 g</td><td></td></tr>
            <tr><td>Cholesterol</td><td>10 mg</td><td>3%</td></tr>
            <tr><td>Total Omega-3s</td><td>1280 mg</td><td>†</td></tr>
            <tr><td>EPA (Eicosapentaenoic Acid)</td><td>650 mg</td><td>†</td></tr>
            <tr><td>DHA (Docosahexaenoic Acid)</td><td>450 mg</td><td>†</td></tr>
            <tr><td>Other Omega-3s</td><td>180 mg</td><td>†</td></tr>
            <tr><td>Oleic Acid (Omega-9)</td><td>100 mg</td><td>†</td></tr>
          </tbody>
        </table>
        <p class="footnote">† Daily Value not established</p>

        <div class="other-ingredients">
          <h3>Other Ingredients:</h3>
          <p>Soft gel capsule (fish gelatin from tilapia, water, glycerin, natural lemon flavor),
          natural lemon flavor, d-alpha tocopherol (vitamin E from sunflower oil, antioxidant),
          rosemary extract (a natural preservative).</p>
        </div>

        <div class="allergens">
          <h3>Allergen Warning:</h3>
          <p><strong>Contains:</strong> Fish (anchovy, sardine, mackerel).</p>
          <p>Free from: Milk, eggs, peanuts, tree nuts, wheat, soy.</p>
        </div>

        <div class="certifications">
          <h3>Quality Certifications:</h3>
          <ul>
            <li>Non-GMO Project Verified</li>
            <li>Friend of the Sea Certified</li>
            <li>Third Party Purity Tested</li>
            <li>USP Verified</li>
            <li>cGMP Certified Facility</li>
            <li>No artificial colors, flavors, or preservatives</li>
          </ul>
        </div>

        <div class="warnings">
          <h3>Warnings:</h3>
          <p>Consult your physician before using if you are pregnant, nursing,
          taking medication, or have a medical condition. Keep out of reach of children.
          Store in a cool, dry place.</p>
        </div>
      </div>

      <div class="product-description">
        <h2>Product Description</h2>
        <p>Nordic Naturals Ultimate Omega is our most popular concentrate,
        recommended by doctors worldwide. It offers high-intensity support for both
        the heart and brain in one delicious serving.</p>
      </div>
    </div>

    ${noiseHtml.slice(noiseHtml.length / 2)}

    <footer>
      <p>© 2024 Health Store. All rights reserved.</p>
    </footer>
    </body>
    </html>
  `;
  console.log(`Using realistic supplement HTML: ${html.length} chars (~${Math.round(html.length/4)} tokens)\n`);

  // Test Haiku models
  console.log('--- HAIKU COMPARISON ---\n');
  for (const model of haikuModels) {
    if (totalCost > 0.90) {
      console.log('Budget limit approaching, stopping Haiku tests');
      break;
    }

    console.log(`Testing ${model}...`);
    const result = await testModel(model, html, testUrl);
    results.push(result);
    totalCost += result.estimatedCost;

    console.log(`  Ingredients: ${result.ingredientsFound}`);
    console.log(`  Has name/brand/serving: ${result.hasName}/${result.hasBrand}/${result.hasServingSize}`);
    console.log(`  Tokens: ${result.inputTokens} in / ${result.outputTokens} out`);
    console.log(`  Cost: $${result.estimatedCost.toFixed(4)}`);
    console.log(`  Time: ${result.responseTimeMs}ms`);
    if (result.error) console.log(`  Error: ${result.error}`);
    console.log('');
  }

  // Test Sonnet models
  console.log('--- SONNET COMPARISON ---\n');
  for (const model of sonnetModels) {
    if (totalCost > 1.80) {
      console.log('Budget limit approaching, stopping Sonnet tests');
      break;
    }

    console.log(`Testing ${model}...`);
    const result = await testModel(model, html, testUrl);
    results.push(result);
    totalCost += result.estimatedCost;

    console.log(`  Ingredients: ${result.ingredientsFound}`);
    console.log(`  Has name/brand/serving: ${result.hasName}/${result.hasBrand}/${result.hasServingSize}`);
    console.log(`  Tokens: ${result.inputTokens} in / ${result.outputTokens} out`);
    console.log(`  Cost: $${result.estimatedCost.toFixed(4)}`);
    console.log(`  Time: ${result.responseTimeMs}ms`);
    if (result.error) console.log(`  Error: ${result.error}`);
    console.log('');
  }

  console.log('=== SUMMARY ===\n');
  console.log(`Total cost: $${totalCost.toFixed(4)}\n`);

  // Compare Haiku
  const haiku35 = results.find(r => r.model.includes('3-5-haiku'));
  const haiku45 = results.find(r => r.model.includes('haiku-4-5'));
  if (haiku35 && haiku45) {
    console.log('Haiku 3.5 vs 4.5:');
    console.log(`  Ingredients: ${haiku35.ingredientsFound} vs ${haiku45.ingredientsFound}`);
    console.log(`  Cost: $${haiku35.estimatedCost.toFixed(4)} vs $${haiku45.estimatedCost.toFixed(4)}`);
    console.log(`  Speed: ${haiku35.responseTimeMs}ms vs ${haiku45.responseTimeMs}ms`);
    console.log(`  Winner: ${haiku35.ingredientsFound >= haiku45.ingredientsFound && haiku35.estimatedCost <= haiku45.estimatedCost ? 'Haiku 3.5 (cheaper, same quality)' : 'Haiku 4.5 (better quality)'}`);
    console.log('');
  }

  // Compare Sonnet
  const sonnet4 = results.find(r => r.model.includes('sonnet-4-2025'));
  const sonnet45 = results.find(r => r.model.includes('sonnet-4-5'));
  if (sonnet4 && sonnet45) {
    console.log('Sonnet 4 vs 4.5:');
    console.log(`  Ingredients: ${sonnet4.ingredientsFound} vs ${sonnet45.ingredientsFound}`);
    console.log(`  Cost: $${sonnet4.estimatedCost.toFixed(4)} vs $${sonnet45.estimatedCost.toFixed(4)}`);
    console.log(`  Speed: ${sonnet4.responseTimeMs}ms vs ${sonnet45.responseTimeMs}ms`);
    console.log(`  Winner: ${sonnet4.ingredientsFound >= sonnet45.ingredientsFound ? 'Sonnet 4 (same quality, proven)' : 'Sonnet 4.5 (better quality)'}`);
  }
}

main().catch(console.error);
