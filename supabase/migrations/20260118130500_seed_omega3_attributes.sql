-- Seed omega-3-related attributes for existing system products.
-- Attributes based on known product specifications from manufacturer data.

-- Nordic Naturals Ultimate Omega (fish oil)
-- IFOS 5-star certified, uses fish gelatin soft gels
UPDATE public.supplements
SET attributes = jsonb_set(
  COALESCE(attributes, '{}'::jsonb),
  '{omega3}',
  jsonb_build_object(
    'oilForm', 'fish_oil',
    'source', 'fish',
    'gelatin', 'fish',
    'thirdPartyTested', 'yes',
    'heavyMetalsTested', 'yes',
    'pregnancySafety', 'caution'
  ),
  true
)
WHERE name = 'Ultimate Omega' AND brand = 'Nordic Naturals';

-- Ritual Essential for Women 18+ (algae DHA)
-- Vegan formula with plant-based capsule, third-party tested
UPDATE public.supplements
SET attributes = jsonb_set(
  COALESCE(attributes, '{}'::jsonb),
  '{omega3}',
  jsonb_build_object(
    'oilForm', 'algal_oil',
    'source', 'algae',
    'gelatin', 'none',
    'thirdPartyTested', 'yes',
    'heavyMetalsTested', 'yes',
    'pregnancySafety', 'unknown'
  ),
  true
)
WHERE name = 'Essential for Women 18+' AND brand = 'Ritual';

-- NATURELO Prenatal Whole Food Multivitamin (algae DHA)
-- Vegan prenatal, specifically formulated for pregnancy
UPDATE public.supplements
SET attributes = jsonb_set(
  COALESCE(attributes, '{}'::jsonb),
  '{omega3}',
  jsonb_build_object(
    'oilForm', 'algal_oil',
    'source', 'algae',
    'gelatin', 'none',
    'thirdPartyTested', 'yes',
    'heavyMetalsTested', 'yes',
    'pregnancySafety', 'generally_safe'
  ),
  true
)
WHERE name = 'Prenatal Whole Food Multivitamin' AND brand = 'NATURELO';

