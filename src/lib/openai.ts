import { ScannedDish } from '../pages/RestaurantOnboarding';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Common allergens list for reference (FDA Big 9 + EU allergens)
export const COMMON_ALLERGENS = [
  'Milk',
  'Eggs',
  'Fish',
  'Shellfish',
  'Tree Nuts',
  'Peanuts',
  'Wheat',
  'Soy',
  'Sesame',
  'Gluten',
  'Mustard',
  'Celery',
  'Lupin',
  'Mollusks',
  'Sulfites',
  'Onion',
  'Garlic',
] as const;

// Comprehensive allergen mapping reference for AI prompts
export const ALLERGEN_MAPPING_REFERENCE = `
ALLERGEN CATEGORY MAPPINGS - Use these to correctly identify allergens:

MILK/DAIRY:
- Direct: milk, cream, butter, cheese, yogurt, ice cream, whey, casein, lactose, ghee
- Hidden: many breads, baked goods, chocolate, caramel, nougat, ranch dressing, cream sauces

EGGS:
- Direct: eggs, egg whites, egg yolks, mayonnaise, meringue, custard
- Hidden: pasta (some), baked goods, marshmallows, some sauces, tempura batter

FISH:
- Direct: salmon, tuna, cod, halibut, bass, trout, tilapia, anchovy, sardine, mackerel
- Hidden: Worcestershire sauce, Caesar dressing, fish sauce, some Asian sauces

SHELLFISH (Crustaceans):
- Crustaceans: shrimp, prawns, crab, lobster, crayfish/crawfish, langoustine
- This is different from Mollusks - keep them separate

MOLLUSKS:
- Direct: clams, mussels, oysters, scallops, squid/calamari, octopus, snails/escargot

TREE NUTS:
- Direct: almonds, walnuts, cashews, pecans, pistachios, macadamia, hazelnuts/filberts, Brazil nuts, pine nuts, chestnuts
- Hidden: pesto (pine nuts), marzipan (almonds), praline, nougat, some oils
- Note: Coconut is NOT a tree nut (FDA classifies as fruit)

PEANUTS (Legume, not a nut):
- Direct: peanuts, peanut butter, peanut oil, peanut flour
- Hidden: many Asian dishes, African dishes, some chili recipes, satay sauce

WHEAT:
- Direct: wheat flour, bread, pasta, couscous, bulgur, semolina, durum, spelt, farina
- Hidden: soy sauce (most contain wheat), many sauces, breaded items, beer

GLUTEN (Protein in certain grains):
- Contains gluten: wheat, barley, rye, triticale, spelt, kamut, farro
- Hidden: soy sauce, malt, beer, some oats (cross-contamination), seitan

SOY:
- Direct: soybeans, edamame, tofu, tempeh, miso, soy sauce, soy milk, soy protein
- Hidden: vegetable oil (often soybean), lecithin (soy-based), many processed foods
- Note: Chickpeas, lentils, other beans are NOT soy (they're different legumes)

SESAME:
- Direct: sesame seeds, tahini, sesame oil, hummus (contains tahini), halvah
- Hidden: many Middle Eastern foods, some breads, bagels, Asian dishes

MUSTARD:
- Direct: mustard seeds, mustard powder, prepared mustard, mustard oil
- Hidden: many sauces, dressings, marinades, curry powder, pickles

CELERY:
- Direct: celery stalks, celery root/celeriac, celery seeds, celery salt
- Hidden: stocks, soups, spice blends, Bloody Mary mix

LUPIN/LUPINE:
- Direct: lupin beans, lupin flour, lupin seeds
- Hidden: some gluten-free products, European breads and pastries

SULFITES:
- Direct: sulfur dioxide, sodium sulfite, sodium bisulfite
- Found in: wine, dried fruits, some seafood, pickled foods, grape juice

ONION:
- Direct: onion, onion powder, dried onion, shallots, scallions/green onions, leeks, chives
- Hidden: many soups, stocks, sauces, seasonings, French onion dip, onion rings

GARLIC:
- Direct: garlic, garlic powder, garlic salt, minced garlic, roasted garlic
- Hidden: many sauces, marinades, seasoning blends, garlic bread, aioli, pesto

SPECIAL NOTES:
- Nightshades (tomatoes, peppers, eggplant, potatoes) are not major allergens but some people are sensitive
- Corn is not a major allergen but can cause reactions in some people
`;

// Concise allergen list for prompts
const ALLERGEN_CATEGORIES = COMMON_ALLERGENS.join(', ');

export interface IngredientWithAllergens {
  name: string;
  allergens: string[];
}

export interface SuggestedIngredient {
  name: string;
  existingId?: string; // If matches an existing ingredient in DB
  allergens: string[];
  confidence: number; // 0-100, how confident AI is this ingredient belongs
}

export interface MenuItemAllergenAnalysis {
  directAllergens: string[]; // From ingredients
  crossContaminationRisks: CrossContaminationRisk[];
  allAllergens: string[]; // Combined unique list
  warnings: string[]; // Human-readable warnings
  safetyNotes: string[]; // Additional safety information
}

export interface CrossContaminationRisk {
  allergen: string;
  reason: string;
}

// Type for allergen category (derived from COMMON_ALLERGENS)
export type AllergenCategory = typeof COMMON_ALLERGENS[number];

// Helper function to check if a string is a valid allergen category
function isValidAllergen(value: string): value is AllergenCategory {
  return COMMON_ALLERGENS.includes(value as AllergenCategory);
}

// Types for OpenAI API response parsing
interface RawScannedDish {
  name?: string;
  category?: string;
  price?: string | number;
  description?: string;
}

interface RawIngredientWithAllergens {
  name?: string;
  allergens?: string[];
}

interface RawSuggestedIngredient {
  name?: string;
  allergens?: string[];
  confidence?: number;
  isExisting?: boolean;
}

interface RawCrossContaminationAnalysis {
  crossContaminationRisks?: Array<{
    allergen?: string;
    reason?: string;
  }>;
  warnings?: string[];
  safetyNotes?: string[];
}

export async function analyzeMenuImage(imageBase64: string): Promise<ScannedDish[]> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
    throw new Error('OpenAI API key not configured. Please set VITE_OPENAI_API_KEY in your .env file.');
  }

  // Ensure the image is in the correct data URL format
  const imageUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cost-effective vision model
        messages: [
          {
            role: 'system',
            content: `You are a menu analysis assistant. Extract dish information from menu images.
Return ONLY valid JSON array with this exact structure, no markdown code blocks or extra text:
[{"name": "Dish Name", "category": "Category", "price": "00.00", "description": "Brief description"}]

Rules:
- Categories: Appetizers, Main Courses, Sides, Desserts, Beverages, or Other
- Price: numbers only (e.g., "12.99" not "$12.99")
- If price is not visible, use "0.00"
- Extract ALL dishes you can see clearly
- Keep descriptions brief (under 100 characters)`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this menu image and extract all dishes with their names, categories, prices, and descriptions. Return only the JSON array.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high', // Use high detail for better text recognition
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1, // Low temperature for more consistent output
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `API request failed with status ${response.status}`;

      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your VITE_OPENAI_API_KEY in .env file.');
      }
      if (response.status === 429) {
        throw new Error('OpenAI rate limit exceeded. Please wait a moment and try again.');
      }
      if (response.status === 400 && errorMessage.includes('image')) {
        throw new Error('Image could not be processed. Please try a different image format (JPEG, PNG, GIF, or WebP).');
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI. Please try again.');
    }

    // Parse the JSON response - handle potential markdown code blocks
    let jsonString = content;

    // Remove markdown code blocks if present
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    }

    // Find JSON array in the content
    const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Could not find JSON array in response:', content);
      throw new Error('Could not parse menu data. The AI response was not in the expected format.');
    }

    const dishes: RawScannedDish[] = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(dishes) || dishes.length === 0) {
      throw new Error('No dishes detected in the image. Please ensure the menu text is clearly visible.');
    }

    // Transform to ScannedDish format with IDs
    return dishes.map((dish: RawScannedDish, index: number): ScannedDish => ({
      id: `dish-${Date.now()}-${index}`,
      name: String(dish.name || 'Unknown Dish').trim(),
      category: String(dish.category || 'Other').trim(),
      price: String(dish.price || '0.00').replace(/[^0-9.]/g, '') || '0.00',
      description: String(dish.description || '').trim(),
    }));
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('JSON parse error:', error);
      throw new Error('Failed to parse menu data. Please try again with a clearer image.');
    }
    throw error;
  }
}

/**
 * Detect common allergens for a single ingredient
 * Uses comprehensive allergen mapping to correctly identify allergen categories
 */
export async function detectAllergens(ingredientName: string): Promise<string[]> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
    return [];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a food allergen expert. Your task is to identify which ALLERGEN CATEGORIES an ingredient belongs to.

IMPORTANT: You must map ingredients to their correct allergen CATEGORY, not just repeat the ingredient name.

VALID ALLERGEN CATEGORIES (only use these exact names):
${ALLERGEN_CATEGORIES}

${ALLERGEN_MAPPING_REFERENCE}

CRITICAL RULES:
1. Map ingredients to their allergen CATEGORY (e.g., "shrimp" -> "Shellfish", NOT "Shrimp")
2. "Celery" IS a valid allergen category - celery stalks, celery salt, celeriac all map to "Celery"
3. Multiple categories can apply (e.g., "soy sauce" -> ["Soy", "Wheat", "Gluten"])
4. If no major allergens apply, return empty array []
5. Chickpeas, lentils, black beans are legumes but NOT "Soy" - only soybeans are "Soy"

EXAMPLES:
- "shrimp" -> ["Shellfish"]
- "crab" -> ["Shellfish"]
- "squid" -> ["Mollusks"]
- "butter" -> ["Milk"]
- "parmesan cheese" -> ["Milk"]
- "soy sauce" -> ["Soy", "Wheat", "Gluten"]
- "tofu" -> ["Soy"]
- "edamame" -> ["Soy"]
- "bread crumbs" -> ["Wheat", "Gluten"]
- "pesto" -> ["Tree Nuts", "Milk"]
- "tahini" -> ["Sesame"]
- "hummus" -> ["Sesame"]
- "celery" -> ["Celery"]
- "celery salt" -> ["Celery"]
- "almonds" -> ["Tree Nuts"]
- "peanut butter" -> ["Peanuts"]
- "Worcestershire sauce" -> ["Fish"]
- "fish sauce" -> ["Fish"]
- "olive oil" -> []
- "garlic" -> []
- "onion" -> []
- "chickpeas" -> []
- "black beans" -> []
- "rice" -> []
- "tomato" -> []

Return ONLY a JSON array of allergen category names. No explanation.`,
          },
          {
            role: 'user',
            content: `Ingredient: "${ingredientName}"

What allergen categories does this ingredient belong to? Return only the JSON array.`,
          },
        ],
        max_tokens: 150,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('Failed to detect allergens:', response.status);
      return [];
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content || '[]';

    // Parse JSON array
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const allergens: string[] = JSON.parse(jsonMatch[0]);
      // Validate that returned allergens are from our valid list
      if (Array.isArray(allergens)) {
        return allergens
          .filter((a): a is string => typeof a === 'string')
          .filter(isValidAllergen);
      }
    }
    return [];
  } catch (error) {
    console.error('Error detecting allergens:', error);
    return [];
  }
}

/**
 * Detect allergens for multiple ingredients in batch
 * Uses comprehensive allergen mapping to correctly identify allergen categories
 */
export async function detectAllergensForIngredients(
  ingredientNames: string[]
): Promise<IngredientWithAllergens[]> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here' || ingredientNames.length === 0) {
    return ingredientNames.map(name => ({ name, allergens: [] }));
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a food allergen expert. Your task is to identify which ALLERGEN CATEGORIES each ingredient belongs to.

IMPORTANT: You must map ingredients to their correct allergen CATEGORY, not just repeat the ingredient name.

VALID ALLERGEN CATEGORIES (only use these exact names):
${ALLERGEN_CATEGORIES}

${ALLERGEN_MAPPING_REFERENCE}

CRITICAL RULES:
1. Map ingredients to their allergen CATEGORY (e.g., "shrimp" -> "Shellfish", NOT "Shrimp")
2. "Celery" IS a valid allergen category - celery stalks, celery salt, celeriac all map to "Celery"
3. Multiple categories can apply (e.g., "soy sauce" -> ["Soy", "Wheat", "Gluten"])
4. If no major allergens apply, use empty array []
5. Chickpeas, lentils, black beans are legumes but NOT "Soy" - only soybeans are "Soy"

Return ONLY a JSON array with this exact structure:
[{"name": "ingredient name", "allergens": ["AllergenCategory1", "AllergenCategory2"]}]`,
          },
          {
            role: 'user',
            content: `Identify allergen categories for each ingredient:
${ingredientNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Return the JSON array.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('Failed to detect allergens:', response.status);
      return ingredientNames.map(name => ({ name, allergens: [] }));
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content || '[]';

    // Parse JSON array
    let jsonString = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    }

    const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const results: RawIngredientWithAllergens[] = JSON.parse(jsonMatch[0]);
      if (Array.isArray(results)) {
        return results.map((r: RawIngredientWithAllergens): IngredientWithAllergens => ({
          name: String(r.name || ''),
          // Validate that returned allergens are from our valid list
          allergens: Array.isArray(r.allergens)
            ? r.allergens.filter((a): a is string => typeof a === 'string').filter(isValidAllergen)
            : [],
        }));
      }
    }
    return ingredientNames.map(name => ({ name, allergens: [] }));
  } catch (error) {
    console.error('Error detecting allergens:', error);
    return ingredientNames.map(name => ({ name, allergens: [] }));
  }
}

/**
 * Suggest ingredients for a dish based on its name/description and existing ingredients in DB
 * Uses comprehensive allergen mapping to correctly identify allergen categories
 */
export async function suggestIngredientsForDish(
  dishName: string,
  dishDescription: string,
  existingIngredients: { id: string; name: string; allergens: string[] }[]
): Promise<SuggestedIngredient[]> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
    return [];
  }

  const existingNames = existingIngredients.map(i => i.name);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a culinary and allergen expert. Given a dish name and description, suggest likely ingredients WITH their correct allergen categories.

IMPORTANT: Prefer suggesting ingredients from the existing database when they match.
Existing ingredients in database: ${existingNames.length > 0 ? existingNames.join(', ') : 'None yet'}

VALID ALLERGEN CATEGORIES (only use these exact names for allergens):
${ALLERGEN_CATEGORIES}

${ALLERGEN_MAPPING_REFERENCE}

Return ONLY a JSON array with this structure:
[{"name": "Ingredient Name", "allergens": ["AllergenCategory1"], "confidence": 90, "isExisting": true}]

CRITICAL RULES:
- "allergens" must contain CATEGORY names, not ingredient names (e.g., "Shellfish" not "shrimp")
- "confidence" is 0-100, how likely this ingredient is in the dish
- "isExisting" is true if the ingredient matches one from the existing database (case-insensitive)
- Include 5-15 most likely ingredients
- Sort by confidence (highest first)
- Be specific (e.g., "Olive Oil" not just "Oil")
- For each ingredient, correctly identify all applicable allergen categories`,
          },
          {
            role: 'user',
            content: `Suggest ingredients for: "${dishName}"${dishDescription ? `\nDescription: ${dishDescription}` : ''}`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('Failed to suggest ingredients:', response.status);
      return [];
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content || '[]';

    // Parse JSON array
    let jsonString = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    }

    const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const results: RawSuggestedIngredient[] = JSON.parse(jsonMatch[0]);
      if (Array.isArray(results)) {
        return results.map((r: RawSuggestedIngredient): SuggestedIngredient => {
          const name = String(r.name || '').trim();
          // Check if this matches an existing ingredient (case-insensitive)
          const existingMatch = existingIngredients.find(
            e => e.name.toLowerCase() === name.toLowerCase()
          );

          // Validate allergens against COMMON_ALLERGENS list
          const rawAllergens: string[] = Array.isArray(r.allergens) ? r.allergens : (existingMatch?.allergens || []);
          const validatedAllergens = rawAllergens
            .filter((a): a is string => typeof a === 'string')
            .filter(isValidAllergen);

          return {
            name,
            existingId: existingMatch?.id,
            allergens: validatedAllergens,
            confidence: typeof r.confidence === 'number' ? r.confidence : 50,
          };
        }).sort((a, b) => b.confidence - a.confidence);
      }
    }
    return [];
  } catch (error) {
    console.error('Error suggesting ingredients:', error);
    return [];
  }
}

/**
 * Comprehensive allergen analysis for a menu item
 * Combines ingredient allergens + preparation cross-contamination analysis
 * Uses comprehensive allergen mapping to correctly identify allergen categories
 */
export async function analyzeMenuItemAllergens(
  dishName: string,
  ingredients: { name: string; allergens: string[] }[],
  preparationText: string
): Promise<MenuItemAllergenAnalysis> {
  // Collect direct allergens from ingredients (already validated)
  const directAllergens = Array.from(
    new Set(ingredients.flatMap(ing => ing.allergens))
  ).filter(isValidAllergen);

  // Default result if API call fails
  const defaultResult: MenuItemAllergenAnalysis = {
    directAllergens,
    crossContaminationRisks: [],
    allAllergens: directAllergens,
    warnings: directAllergens.length > 0
      ? [`Contains: ${directAllergens.join(', ')}`]
      : [],
    safetyNotes: [],
  };

  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here' || !preparationText.trim()) {
    return defaultResult;
  }

  try {
    const ingredientsList = ingredients.map(i =>
      `${i.name}${i.allergens.length > 0 ? ` (contains: ${i.allergens.join(', ')})` : ''}`
    ).join('\n- ');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a food safety and allergen expert. Analyze the preparation process for potential cross-contamination risks.

VALID ALLERGEN CATEGORIES (only use these exact names):
${ALLERGEN_CATEGORIES}

${ALLERGEN_MAPPING_REFERENCE}

Your task:
1. Identify cross-contamination risks from the preparation description
2. Look for mentions of: shared fryers, grills, surfaces, utensils, oils used for other foods
3. Consider cooking methods that might introduce allergens (e.g., "fried in peanut oil", "cooked on shared grill")
4. Generate clear warnings for customers with allergies

Return ONLY valid JSON with this exact structure:
{
  "crossContaminationRisks": [
    {"allergen": "AllergenCategoryName", "reason": "Brief explanation of the risk"}
  ],
  "warnings": ["Human-readable warning message 1", "Warning 2"],
  "safetyNotes": ["Additional safety note if relevant"]
}

CRITICAL RULES:
- Use ALLERGEN CATEGORY names only (e.g., "Shellfish" not "shrimp", "Tree Nuts" not "almonds")
- Only include risks that are actually mentioned or strongly implied in the preparation text
- Be specific about the source of contamination risk
- Keep warnings concise but clear
- If no cross-contamination risks are found, return empty arrays`,
          },
          {
            role: 'user',
            content: `Analyze this dish for cross-contamination risks:

DISH: ${dishName}

INGREDIENTS:
- ${ingredientsList || 'No ingredients listed'}

PREPARATION PROCESS:
${preparationText}

Identify any cross-contamination risks from the preparation method.`,
          },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error('Failed to analyze allergens:', response.status);
      return defaultResult;
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content || '{}';

    // Parse JSON response
    let jsonString = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    }

    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result: RawCrossContaminationAnalysis = JSON.parse(jsonMatch[0]);

      // Validate and filter cross-contamination risks to only include valid allergen categories
      const crossContaminationRisks: CrossContaminationRisk[] = Array.isArray(result.crossContaminationRisks)
        ? result.crossContaminationRisks
            .filter((r): r is { allergen: string; reason: string } =>
              typeof r.allergen === 'string' &&
              typeof r.reason === 'string' &&
              isValidAllergen(r.allergen)
            )
        : [];

      const crossContaminationAllergens: string[] = crossContaminationRisks.map(r => r.allergen);
      const allAllergens = Array.from(new Set([...directAllergens, ...crossContaminationAllergens]))
        .filter(isValidAllergen);

      // Build comprehensive warnings
      const warnings: string[] = [];
      if (directAllergens.length > 0) {
        warnings.push(`Contains: ${directAllergens.join(', ')}`);
      }
      if (crossContaminationRisks.length > 0) {
        warnings.push(`Cross-contamination risk: ${crossContaminationAllergens.join(', ')}`);
      }
      if (Array.isArray(result.warnings)) {
        warnings.push(...result.warnings.filter((w): w is string => typeof w === 'string'));
      }

      return {
        directAllergens,
        crossContaminationRisks,
        allAllergens,
        warnings: Array.from(new Set(warnings)),
        safetyNotes: Array.isArray(result.safetyNotes)
          ? result.safetyNotes.filter((n): n is string => typeof n === 'string')
          : [],
      };
    }

    return defaultResult;
  } catch (error) {
    console.error('Error analyzing allergens:', error);
    return defaultResult;
  }
}

/**
 * Detect cross-contact allergen risks from a cooking step description
 * Returns an array of allergen categories that might be cross-contamination risks
 */
export async function detectCrossContactRisks(stepDescription: string): Promise<string[]> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here' || !stepDescription.trim()) {
    return [];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a food safety expert. Analyze cooking step descriptions for potential cross-contamination risks.

VALID ALLERGEN CATEGORIES (only use these exact names):
${ALLERGEN_CATEGORIES}

${ALLERGEN_MAPPING_REFERENCE}

Your task:
- Identify any cross-contamination risks mentioned or implied in the cooking step
- Look for: shared equipment (fryers, grills, pans), cooking oils, shared surfaces, utensils
- Look for mentions of allergen-containing foods being prepared nearby or with shared equipment
- Examples:
  - "fried in the same oil as shrimp" -> ["Shellfish"]
  - "grilled on shared surface with fish" -> ["Fish"]
  - "cooked in butter" -> ["Milk"] (if it's cross-contact, not an ingredient)
  - "uses same cutting board as nuts" -> ["Tree Nuts"]
  - "prepared in kitchen that handles peanuts" -> ["Peanuts"]

Return ONLY a JSON array of allergen category names that are cross-contamination risks.
If no risks detected, return empty array [].
Do NOT include allergens that are actual ingredients - only cross-contamination from shared equipment/environment.`,
          },
          {
            role: 'user',
            content: `Cooking step: "${stepDescription}"

What cross-contamination allergen risks are present? Return only the JSON array.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('Failed to detect cross-contact risks:', response.status);
      return [];
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content || '[]';

    // Parse JSON array
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const allergens: string[] = JSON.parse(jsonMatch[0]);
      if (Array.isArray(allergens)) {
        return allergens
          .filter((a): a is string => typeof a === 'string')
          .filter(isValidAllergen);
      }
    }
    return [];
  } catch (error) {
    console.error('Error detecting cross-contact risks:', error);
    return [];
  }
}

/**
 * Detect allergens mentioned in a dish description text
 * Returns an array of allergen categories found in the description
 */
export async function detectAllergensFromDescription(description: string): Promise<string[]> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here' || !description.trim()) {
    return [];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a food allergen expert. Analyze dish descriptions to identify allergens that are explicitly mentioned or strongly implied.

VALID ALLERGEN CATEGORIES (only use these exact names):
${ALLERGEN_CATEGORIES}

${ALLERGEN_MAPPING_REFERENCE}

Your task:
- Identify allergens that are EXPLICITLY mentioned in the description
- Also identify allergens that are STRONGLY IMPLIED by ingredients/preparations mentioned
- Examples:
  - "served with a creamy peanut sauce" -> ["Peanuts", "Milk"]
  - "topped with parmesan and walnuts" -> ["Milk", "Tree Nuts"]
  - "breaded and deep fried" -> ["Wheat", "Gluten"]
  - "made with our signature tahini dressing" -> ["Sesame"]
  - "grilled salmon fillet" -> ["Fish"]
  - "shrimp scampi in garlic butter" -> ["Shellfish", "Milk"]

Return ONLY a JSON array of allergen category names found in the description.
If no allergens are detected, return empty array [].
Be conservative - only include allergens that are clearly indicated.`,
          },
          {
            role: 'user',
            content: `Dish description: "${description}"

What allergens are mentioned or implied? Return only the JSON array.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('Failed to detect allergens from description:', response.status);
      return [];
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content || '[]';

    // Parse JSON array
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const allergens: string[] = JSON.parse(jsonMatch[0]);
      if (Array.isArray(allergens)) {
        return allergens
          .filter((a): a is string => typeof a === 'string')
          .filter(isValidAllergen);
      }
    }
    return [];
  } catch (error) {
    console.error('Error detecting allergens from description:', error);
    return [];
  }
}

/**
 * Quick allergen summary for display (combines ingredients + preparation analysis)
 */
export async function getMenuItemAllergenSummary(
  dishName: string,
  ingredients: { name: string; allergens: string[] }[],
  preparationText: string
): Promise<{
  allergens: string[];
  hasDirectAllergens: boolean;
  hasCrossContamination: boolean;
  summary: string;
}> {
  const analysis = await analyzeMenuItemAllergens(dishName, ingredients, preparationText);

  const hasDirectAllergens = analysis.directAllergens.length > 0;
  const hasCrossContamination = analysis.crossContaminationRisks.length > 0;

  let summary = '';
  if (analysis.allAllergens.length === 0) {
    summary = 'No common allergens detected';
  } else if (hasDirectAllergens && hasCrossContamination) {
    summary = `Contains ${analysis.directAllergens.join(', ')}. May contain traces of ${analysis.crossContaminationRisks.map(r => r.allergen).join(', ')} due to preparation.`;
  } else if (hasDirectAllergens) {
    summary = `Contains ${analysis.directAllergens.join(', ')}`;
  } else if (hasCrossContamination) {
    summary = `May contain traces of ${analysis.crossContaminationRisks.map(r => r.allergen).join(', ')} due to preparation`;
  }

  return {
    allergens: analysis.allAllergens,
    hasDirectAllergens,
    hasCrossContamination,
    summary,
  };
}

/**
 * Nutrition estimation types and functions
 */
export interface IngredientForNutrition {
  name: string;
  amount: number | null;
  unit: string | null;
}

export interface NutritionEstimate {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  carbs_fiber_g: number | null;
  carbs_sugar_g: number | null;
  carbs_added_sugar_g: number | null;
  fat_g: number | null;
  fat_saturated_g: number | null;
  fat_trans_g: number | null;
  fat_polyunsaturated_g: number | null;
  fat_monounsaturated_g: number | null;
  sodium_mg: number | null;
  cholesterol_mg: number | null;
}

const DEFAULT_NUTRITION: NutritionEstimate = {
  calories: null,
  protein_g: null,
  carbs_g: null,
  carbs_fiber_g: null,
  carbs_sugar_g: null,
  carbs_added_sugar_g: null,
  fat_g: null,
  fat_saturated_g: null,
  fat_trans_g: null,
  fat_polyunsaturated_g: null,
  fat_monounsaturated_g: null,
  sodium_mg: null,
  cholesterol_mg: null,
};

/**
 * Estimate full nutrition for a dish based on its ingredients and amounts
 */
export async function estimateNutrition(
  dishName: string,
  ingredients: IngredientForNutrition[]
): Promise<NutritionEstimate> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
    return DEFAULT_NUTRITION;
  }

  // Filter out ingredients without amounts
  const validIngredients = ingredients.filter(ing => ing.amount && ing.amount > 0);
  if (validIngredients.length === 0) {
    return DEFAULT_NUTRITION;
  }

  const ingredientList = validIngredients
    .map(ing => `- ${ing.name}: ${ing.amount} ${ing.unit || 'g'}`)
    .join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a nutrition expert. Estimate the complete nutritional information for a dish based on its ingredients and amounts.

Guidelines:
- Use standard USDA nutritional values for each ingredient
- Account for cooking methods (e.g., frying adds fat)
- Round values appropriately (calories to nearest 5, grams to 1 decimal, mg to nearest integer)
- Be conservative - slightly overestimate unhealthy nutrients
- Consider typical serving sizes and preparation methods

Return ONLY a valid JSON object with these exact keys (use null if unable to estimate):
{
  "calories": <integer>,
  "protein_g": <number>,
  "carbs_g": <number>,
  "carbs_fiber_g": <number>,
  "carbs_sugar_g": <number>,
  "carbs_added_sugar_g": <number>,
  "fat_g": <number>,
  "fat_saturated_g": <number>,
  "fat_trans_g": <number>,
  "fat_polyunsaturated_g": <number>,
  "fat_monounsaturated_g": <number>,
  "sodium_mg": <integer>,
  "cholesterol_mg": <integer>
}

Notes:
- carbs_g is TOTAL carbs (includes fiber and sugars)
- fat_g is TOTAL fat (includes all fat types)
- carbs_added_sugar_g is sugars added during preparation (not naturally occurring)
- Return ONLY the JSON, no explanation or markdown.`,
          },
          {
            role: 'user',
            content: `Dish: ${dishName}

Ingredients:
${ingredientList}

Estimate the complete nutritional information for one serving. Return only the JSON object.`,
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error('Failed to estimate nutrition:', response.status);
      return DEFAULT_NUTRITION;
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content || '{}';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        calories: typeof parsed.calories === 'number' ? Math.round(parsed.calories) : null,
        protein_g: typeof parsed.protein_g === 'number' ? Math.round(parsed.protein_g * 10) / 10 : null,
        carbs_g: typeof parsed.carbs_g === 'number' ? Math.round(parsed.carbs_g * 10) / 10 : null,
        carbs_fiber_g: typeof parsed.carbs_fiber_g === 'number' ? Math.round(parsed.carbs_fiber_g * 10) / 10 : null,
        carbs_sugar_g: typeof parsed.carbs_sugar_g === 'number' ? Math.round(parsed.carbs_sugar_g * 10) / 10 : null,
        carbs_added_sugar_g: typeof parsed.carbs_added_sugar_g === 'number' ? Math.round(parsed.carbs_added_sugar_g * 10) / 10 : null,
        fat_g: typeof parsed.fat_g === 'number' ? Math.round(parsed.fat_g * 10) / 10 : null,
        fat_saturated_g: typeof parsed.fat_saturated_g === 'number' ? Math.round(parsed.fat_saturated_g * 10) / 10 : null,
        fat_trans_g: typeof parsed.fat_trans_g === 'number' ? Math.round(parsed.fat_trans_g * 10) / 10 : null,
        fat_polyunsaturated_g: typeof parsed.fat_polyunsaturated_g === 'number' ? Math.round(parsed.fat_polyunsaturated_g * 10) / 10 : null,
        fat_monounsaturated_g: typeof parsed.fat_monounsaturated_g === 'number' ? Math.round(parsed.fat_monounsaturated_g * 10) / 10 : null,
        sodium_mg: typeof parsed.sodium_mg === 'number' ? Math.round(parsed.sodium_mg) : null,
        cholesterol_mg: typeof parsed.cholesterol_mg === 'number' ? Math.round(parsed.cholesterol_mg) : null,
      };
    }
    return DEFAULT_NUTRITION;
  } catch (error) {
    console.error('Error estimating nutrition:', error);
    return DEFAULT_NUTRITION;
  }
}

/**
 * Estimate calories only (backwards compatibility wrapper)
 */
export async function estimateCalories(
  dishName: string,
  ingredients: IngredientForNutrition[]
): Promise<number | null> {
  const nutrition = await estimateNutrition(dishName, ingredients);
  return nutrition.calories;
}

/**
 * Dietary menu analysis types and functions
 */
export interface DietaryMenuCategory {
  id: string;
  name: string;
  description: string;
  type: 'allergen-free' | 'dietary-style' | 'health-focused';
}

export const DIETARY_MENU_CATEGORIES: DietaryMenuCategory[] = [
  { id: 'shellfish-free', name: 'Shellfish-Free', description: 'No shrimp, crab, lobster, or other crustaceans', type: 'allergen-free' },
  { id: 'nut-free', name: 'Nut-Free', description: 'No tree nuts (almonds, walnuts, cashews, etc.)', type: 'allergen-free' },
  { id: 'peanut-free', name: 'Peanut-Free', description: 'No peanuts or peanut-derived products', type: 'allergen-free' },
  { id: 'dairy-free', name: 'Dairy-Free', description: 'No milk, cheese, butter, or other dairy products', type: 'allergen-free' },
  { id: 'gluten-free', name: 'Gluten-Free', description: 'No wheat, barley, rye, or gluten-containing ingredients', type: 'allergen-free' },
  { id: 'egg-free', name: 'Egg-Free', description: 'No eggs or egg-derived products', type: 'allergen-free' },
  { id: 'soy-free', name: 'Soy-Free', description: 'No soybeans, tofu, soy sauce, or soy products', type: 'allergen-free' },
  { id: 'fish-free', name: 'Fish-Free', description: 'No fish or fish-derived products', type: 'allergen-free' },
  { id: 'sesame-free', name: 'Sesame-Free', description: 'No sesame seeds, tahini, or sesame oil', type: 'allergen-free' },
  { id: 'vegetarian', name: 'Vegetarian', description: 'No meat, poultry, or fish (dairy/eggs allowed)', type: 'dietary-style' },
  { id: 'vegan', name: 'Vegan', description: 'No animal products (meat, dairy, eggs, honey)', type: 'dietary-style' },
  { id: 'low-carb', name: 'Low-Carb', description: 'Less than 20g net carbs per serving', type: 'health-focused' },
  { id: 'low-sodium', name: 'Low-Sodium', description: 'Less than 600mg sodium per serving', type: 'health-focused' },
];

export interface DishForDietaryAnalysis {
  id: string;
  name: string;
  description: string | null;
  description_allergens: string[];
  carbs_g: number | null;
  sodium_mg: number | null;
  ingredients: {
    name: string;
    allergens: string[];
    is_removable: boolean;
    is_substitutable: boolean;
    substitutes: { name: string; allergens: string[] }[];
  }[];
  cookingSteps: {
    description: string;
    cross_contact_risk: string[];
  }[];
}

export interface DietaryMenuAnalysisResult {
  categoryId: string;
  status: 'available' | 'limited' | 'unavailable';
  availableDishes: { id: string; name: string; requiresModification: boolean; modifications?: string[] }[];
  totalAvailable: number;
  reason?: string;
  warning?: string;
}

/**
 * Map dietary category to allergens to avoid
 */
function getAllergensForCategory(categoryId: string): string[] {
  switch (categoryId) {
    case 'shellfish-free': return ['Shellfish'];
    case 'nut-free': return ['Tree Nuts'];
    case 'peanut-free': return ['Peanuts'];
    case 'dairy-free': return ['Milk'];
    case 'gluten-free': return ['Gluten', 'Wheat'];
    case 'egg-free': return ['Eggs'];
    case 'soy-free': return ['Soy'];
    case 'fish-free': return ['Fish'];
    case 'sesame-free': return ['Sesame'];
    default: return [];
  }
}

/**
 * Check if a dish is safe for an allergen-free diet
 */
function analyzeDishForAllergenFree(
  dish: DishForDietaryAnalysis,
  allergensToAvoid: string[]
): { safe: boolean; requiresModification: boolean; modifications: string[]; blockers: string[] } {
  const allergensLower = allergensToAvoid.map(a => a.toLowerCase());
  const modifications: string[] = [];
  const blockers: string[] = [];
  let hasBlockingAllergen = false;

  // Check description allergens
  for (const descAllergen of dish.description_allergens) {
    const descLower = descAllergen.toLowerCase();
    if (allergensLower.some(a => descLower.includes(a) || a.includes(descLower))) {
      blockers.push(`Mentioned in description: ${descAllergen}`);
      hasBlockingAllergen = true;
    }
  }

  // Check ingredients
  for (const ing of dish.ingredients) {
    const ingAllergensLower = ing.allergens.map(a => a.toLowerCase());
    const hasAllergen = allergensLower.some(a =>
      ingAllergensLower.includes(a) || ing.name.toLowerCase().includes(a)
    );

    if (hasAllergen) {
      if (ing.is_removable) {
        modifications.push(`Remove ${ing.name}`);
      } else if (ing.is_substitutable) {
        // Check if any substitute is safe
        const safeSubstitutes = ing.substitutes.filter(sub => {
          const subAllergensLower = sub.allergens.map(a => a.toLowerCase());
          return !allergensLower.some(a => subAllergensLower.includes(a));
        });
        if (safeSubstitutes.length > 0) {
          modifications.push(`Substitute ${ing.name} with ${safeSubstitutes.map(s => s.name).join(' or ')}`);
        } else {
          blockers.push(`${ing.name} cannot be safely substituted`);
          hasBlockingAllergen = true;
        }
      } else {
        blockers.push(`Contains ${ing.name} (non-removable)`);
        hasBlockingAllergen = true;
      }
    }
  }

  // Check cooking steps for cross-contamination
  for (const step of dish.cookingSteps) {
    for (const risk of step.cross_contact_risk) {
      const riskLower = risk.toLowerCase();
      if (allergensLower.some(a => riskLower.includes(a))) {
        blockers.push(`Cross-contamination risk: ${risk}`);
        hasBlockingAllergen = true;
      }
    }
  }

  return {
    safe: !hasBlockingAllergen,
    requiresModification: modifications.length > 0,
    modifications,
    blockers,
  };
}

/**
 * Analyze dietary menu possibilities using OpenAI for complex dietary styles
 */
export async function analyzeDietaryMenuWithAI(
  dishes: DishForDietaryAnalysis[],
  categoryId: string
): Promise<{ dishes: { id: string; name: string; safe: boolean; requiresModification: boolean; modifications: string[]; reason?: string }[] }> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
    return { dishes: [] };
  }

  const dishList = dishes.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    ingredients: d.ingredients.map(i => ({
      name: i.name,
      removable: i.is_removable,
      substitutable: i.is_substitutable,
      substitutes: i.substitutes.map(s => s.name),
    })),
    carbs_g: d.carbs_g,
    sodium_mg: d.sodium_mg,
  }));

  let categoryDescription = '';
  switch (categoryId) {
    case 'vegetarian':
      categoryDescription = 'VEGETARIAN: No meat (beef, pork, lamb, poultry, game), no fish, no seafood. Eggs and dairy ARE allowed. Gelatin is NOT vegetarian.';
      break;
    case 'vegan':
      categoryDescription = 'VEGAN: No animal products at all - no meat, fish, seafood, dairy, eggs, honey, gelatin, or any animal-derived ingredients.';
      break;
    case 'low-carb':
      categoryDescription = 'LOW-CARB: Less than 20g net carbs per serving. Focus on proteins, fats, and non-starchy vegetables. No bread, pasta, rice, potatoes, sugar.';
      break;
    case 'low-sodium':
      categoryDescription = 'LOW-SODIUM: Less than 600mg sodium per serving. Avoid processed foods, soy sauce, pickled items, cured meats, high-sodium seasonings.';
      break;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a dietary expert. Analyze menu items to determine if they can be served for a specific dietary requirement.

${categoryDescription}

For each dish, determine:
1. Is it naturally compliant with the diet?
2. Can it become compliant by removing or substituting ingredients?
3. What modifications are needed?

IMPORTANT:
- Be strict about the dietary requirements
- Consider hidden ingredients (e.g., butter in sauces, chicken broth, etc.)
- If an ingredient is marked as "removable", it CAN be removed
- If an ingredient is marked as "substitutable", check the substitutes list
- For low-carb/low-sodium, use the provided nutrition values if available

Return ONLY a JSON object with this structure:
{
  "dishes": [
    {
      "id": "dish-id",
      "name": "Dish Name",
      "safe": true/false,
      "requiresModification": true/false,
      "modifications": ["Remove X", "Substitute Y with Z"],
      "reason": "Brief explanation if not safe"
    }
  ]
}`,
          },
          {
            role: 'user',
            content: `Analyze these dishes for ${categoryDescription.split(':')[0]} diet:

${JSON.stringify(dishList, null, 2)}

Return the JSON analysis.`,
          },
        ],
        max_tokens: 3000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error('Failed to analyze dietary menu:', response.status);
      return { dishes: [] };
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content || '{}';

    // Parse JSON from response
    let jsonString = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    }

    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.dishes && Array.isArray(parsed.dishes)) {
        return {
          dishes: parsed.dishes.map((d: { id?: string; name?: string; safe?: boolean; requiresModification?: boolean; modifications?: string[]; reason?: string }) => ({
            id: String(d.id || ''),
            name: String(d.name || ''),
            safe: d.safe === true,
            requiresModification: d.requiresModification === true,
            modifications: Array.isArray(d.modifications) ? d.modifications : [],
            reason: d.reason || undefined,
          })),
        };
      }
    }
    return { dishes: [] };
  } catch (error) {
    console.error('Error analyzing dietary menu:', error);
    return { dishes: [] };
  }
}

/**
 * Comprehensive dietary menu analysis for all categories
 */
export async function analyzeDietaryMenuPossibilities(
  dishes: DishForDietaryAnalysis[]
): Promise<DietaryMenuAnalysisResult[]> {
  const results: DietaryMenuAnalysisResult[] = [];

  for (const category of DIETARY_MENU_CATEGORIES) {
    if (category.type === 'allergen-free') {
      // Use local analysis for allergen-free categories
      const allergensToAvoid = getAllergensForCategory(category.id);
      const availableDishes: DietaryMenuAnalysisResult['availableDishes'] = [];

      for (const dish of dishes) {
        const analysis = analyzeDishForAllergenFree(dish, allergensToAvoid);
        if (analysis.safe) {
          availableDishes.push({
            id: dish.id,
            name: dish.name,
            requiresModification: analysis.requiresModification,
            modifications: analysis.modifications.length > 0 ? analysis.modifications : undefined,
          });
        }
      }

      let status: 'available' | 'limited' | 'unavailable' = 'available';
      let reason: string | undefined;
      let warning: string | undefined;

      if (availableDishes.length === 0) {
        status = 'unavailable';
        reason = `No ${category.name.toLowerCase()} items on your menu. All dishes contain ${allergensToAvoid.join(' or ')} or have cross-contamination risks that cannot be eliminated.`;
      } else if (availableDishes.length < 5) {
        status = 'limited';
        warning = `Only ${availableDishes.length} dish${availableDishes.length === 1 ? '' : 'es'} available. Consider adding more ${category.name.toLowerCase()} options for better accessibility.`;
      }

      results.push({
        categoryId: category.id,
        status,
        availableDishes,
        totalAvailable: availableDishes.length,
        reason,
        warning,
      });
    } else {
      // Use AI analysis for dietary styles (vegetarian, vegan, low-carb, low-sodium)
      const aiAnalysis = await analyzeDietaryMenuWithAI(dishes, category.id);
      const availableDishes: DietaryMenuAnalysisResult['availableDishes'] = [];

      for (const dishAnalysis of aiAnalysis.dishes) {
        if (dishAnalysis.safe) {
          availableDishes.push({
            id: dishAnalysis.id,
            name: dishAnalysis.name,
            requiresModification: dishAnalysis.requiresModification,
            modifications: dishAnalysis.modifications.length > 0 ? dishAnalysis.modifications : undefined,
          });
        }
      }

      let status: 'available' | 'limited' | 'unavailable' = 'available';
      let reason: string | undefined;
      let warning: string | undefined;

      if (availableDishes.length === 0) {
        status = 'unavailable';
        const categoryName = category.name.toLowerCase();
        reason = `No ${categoryName} items on your menu. ${
          category.id === 'vegetarian' ? 'All dishes contain meat, fish, or seafood.' :
          category.id === 'vegan' ? 'All dishes contain animal products.' :
          category.id === 'low-carb' ? 'All dishes exceed 20g carbs per serving.' :
          'All dishes exceed 600mg sodium per serving.'
        }`;
      } else if (availableDishes.length < 5) {
        status = 'limited';
        warning = `Only ${availableDishes.length} dish${availableDishes.length === 1 ? '' : 'es'} available. Consider adding more ${category.name.toLowerCase()} options.`;
      }

      results.push({
        categoryId: category.id,
        status,
        availableDishes,
        totalAvailable: availableDishes.length,
        reason,
        warning,
      });
    }
  }

  return results;
}

/**
 * Menu Photo Analysis - OCR and dish detection
 */
export interface DetectedMenuItem {
  name: string;
  boundingBox: {
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    width: number; // percentage 0-100
    height: number; // percentage 0-100
  };
  confidence: number;
  price?: string;
}

export interface MenuPhotoAnalysisResult {
  detectedItems: DetectedMenuItem[];
  totalItems: number;
}

/**
 * Analyze a menu photo using OpenAI Vision to extract dish names and approximate positions
 */
export async function analyzeMenuPhoto(
  imageBase64: string
): Promise<MenuPhotoAnalysisResult> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
    console.error('OpenAI API key not configured for menu photo analysis');
    throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file.');
  }

  // Ensure the image is in the correct data URL format
  const imageUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a menu OCR expert. Your job is to read menu images and extract food/dish names.

TASK: Look at this menu image and find ALL food items, dishes, and beverages listed.

For EACH item found, provide:
1. name: The dish/item name as written (e.g., "Caesar Salad", "Grilled Chicken", "Margherita Pizza")
2. boundingBox: Approximate position as percentages (0-100) where x,y is top-left corner
3. confidence: How sure you are this is a menu item (0-100)
4. price: The price if visible (e.g., "$12.99")

RULES:
- Extract EVERY food/drink item you can see
- Include appetizers, mains, desserts, drinks, sides - everything edible
- Include items even if you can only partially read them
- Ignore section headers like "APPETIZERS" or "MAIN COURSES" - only include actual dish names
- Ignore restaurant name, addresses, hours
- Approximate the bounding box - it doesn't need to be perfect
- If the menu is handwritten, do your best to read it
- If text is unclear, provide your best guess with lower confidence

CRITICAL: You MUST find menu items. Even a simple menu has at least a few items. If you truly cannot read ANY text, say so, but try your best first.

Return ONLY valid JSON:
{
  "items": [
    {"name": "Dish Name", "boundingBox": {"x": 10, "y": 20, "width": 30, "height": 5}, "confidence": 95, "price": "$12.99"}
  ]
}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Read this menu image and extract all dish/food item names. Find every food or drink item listed.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high', // High detail for better text recognition
                },
              },
            ],
          },
        ],
        max_tokens: 3000,
        temperature: 0.1, // Low temperature for more consistent output
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `API request failed with status ${response.status}`;
      console.error('Failed to analyze menu photo:', errorMessage);

      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your VITE_OPENAI_API_KEY.');
      }
      if (response.status === 429) {
        throw new Error('OpenAI rate limit exceeded. Please wait a moment and try again.');
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content || '{}';

    console.log('OpenAI menu analysis response:', content);

    // Parse JSON from response
    let jsonString = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    }

    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.items && Array.isArray(parsed.items)) {
        const detectedItems: DetectedMenuItem[] = parsed.items
          .filter((item: { name?: string }) => item.name && String(item.name).trim().length > 0)
          .map((item: {
            name?: string;
            boundingBox?: { x?: number; y?: number; width?: number; height?: number };
            confidence?: number;
            price?: string;
          }, index: number) => ({
            name: String(item.name || '').trim(),
            boundingBox: {
              x: typeof item.boundingBox?.x === 'number' ? item.boundingBox.x : 5 + (index % 2) * 45,
              y: typeof item.boundingBox?.y === 'number' ? item.boundingBox.y : 10 + Math.floor(index / 2) * 8,
              width: typeof item.boundingBox?.width === 'number' ? item.boundingBox.width : 40,
              height: typeof item.boundingBox?.height === 'number' ? item.boundingBox.height : 6,
            },
            confidence: typeof item.confidence === 'number' ? item.confidence : 70,
            price: item.price,
          }));

        console.log(`Detected ${detectedItems.length} menu items`);

        return {
          detectedItems,
          totalItems: detectedItems.length,
        };
      }
    }

    console.warn('Could not parse menu items from response');
    return { detectedItems: [], totalItems: 0 };
  } catch (error) {
    console.error('Error analyzing menu photo:', error);
    throw error; // Re-throw to let caller handle it
  }
}

/**
 * Fuzzy string matching for dish names
 * Returns a score from 0-100 (100 = exact match)
 */
export function fuzzyMatchScore(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    return Math.round((shorter.length / longer.length) * 90);
  }

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLen = Math.max(s1.length, s2.length);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.round(similarity);
}

/**
 * Find the best matching database dish for a detected menu item
 */
export function findBestMatch(
  detectedName: string,
  dbDishes: { id: string; name: string }[],
  threshold: number = 60
): { dish: { id: string; name: string } | null; score: number } {
  let bestMatch: { id: string; name: string } | null = null;
  let bestScore = 0;

  for (const dish of dbDishes) {
    const score = fuzzyMatchScore(detectedName, dish.name);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = dish;
    }
  }

  return { dish: bestMatch, score: bestScore };
}
