# Tibera Health

A comprehensive health tracking platform for nutrition, sleep, symptoms, and supplements with personalized recommendations based on health conditions.

## Features

- **Food Tracker** - Log meals and track macros/nutrients with USDA FoodData Central integration
- **Nutrient Analysis** - Track vitamins, minerals, and identify deficiencies
- **Meal Planner** - Weekly calendar view for planning meals
- **Shopping List** - Organized by store section with check-off functionality
- **Sleep Tracker** - Log sleep duration, quality, and patterns
- **Symptom Tracker** - Track symptoms with severity and correlation analysis
- **Supplement Tracker** - Log supplements and get recommendations
- **Personalized Goals** - Condition-based recommendations (pregnancy, athletic, etc.)

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand + React Query
- **Charts**: Recharts
- **Food Data**: USDA FoodData Central API

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tibera-health.git
cd tibera-health
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Get a USDA API key from [FoodData Central](https://fdc.nal.usda.gov/api-key-signup.html) and add it to `.env.local`:
```
NEXT_PUBLIC_USDA_API_KEY=your_api_key_here
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
tibera-health/
├── app/                    # Next.js app router pages
│   ├── food/              # Food tracker
│   ├── planner/           # Meal planner
│   ├── shopping/          # Shopping lists
│   ├── sleep/             # Sleep tracker
│   ├── symptoms/          # Symptom tracker
│   ├── supplements/       # Supplement tracker
│   └── settings/          # User settings
├── components/            # React components
│   ├── ui/               # UI primitives
│   ├── charts/           # Chart components
│   ├── food/             # Food-related components
│   └── layout/           # Layout components
├── lib/                   # Utilities and stores
│   ├── api/              # API clients
│   ├── stores/           # Zustand stores
│   └── utils/            # Helper functions
└── types/                # TypeScript types
```

## Data Storage

All data is stored locally in the browser using localStorage. No account required.

- Export your data from Settings
- Clear all data from Settings if needed

## License

MIT
