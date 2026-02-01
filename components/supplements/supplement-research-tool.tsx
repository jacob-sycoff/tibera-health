"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSupplementsList } from "@/lib/hooks";
import type { DatabaseSupplement } from "@/lib/supabase/queries/reference";
import {
  getOmega3Attributes,
  getOmega3Metrics,
  supplementLooksLikeOmega3,
  type GelatinType,
  type OmegaOilForm,
  type OmegaSource,
  type PregnancySafety,
  type YesNoUnknown,
} from "@/lib/supplements/omega3";
import { cn } from "@/lib/utils/cn";

type AnyOr<T extends string> = "any" | T;

export type ResearchPreset = "all" | "omega3" | "omega3-pregnancy";

export interface SupplementResearchToolProps {
  preset?: ResearchPreset;
  title?: string;
  description?: string;
}

interface ResearchFilters {
  query: string;
  supplementType: AnyOr<string>;
  omega3Only: boolean;

  minEpaMg: string;
  minDhaMg: string;
  minDpaMg: string;
  minEpaPlusDhaMg: string;
  minEpaToDhaRatio: string;
  maxEpaToDhaRatio: string;

  oilForm: AnyOr<OmegaOilForm>;
  source: AnyOr<OmegaSource>;
  gelatin: AnyOr<GelatinType>;
  thirdPartyTested: AnyOr<YesNoUnknown>;
  heavyMetalsTested: AnyOr<YesNoUnknown>;
  pregnancySafety: AnyOr<PregnancySafety>;

  certificationQuery: string;
  requireKosher: boolean;
  requireHalal: boolean;
}

function getPresetFilters(preset: ResearchPreset): Partial<ResearchFilters> {
  if (preset === "omega3") {
    return {
      omega3Only: true,
      supplementType: "any",
    };
  }

  if (preset === "omega3-pregnancy") {
    return {
      omega3Only: true,
      supplementType: "any",
      minDhaMg: "200",
      pregnancySafety: "any",
    };
  }

  return {};
}

function parseNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMg(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1000) return `${Math.round(value)} mg`;
  return `${Math.round(value)} mg`;
}

function formatRatio(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(2);
}

function includesText(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function arrayIncludesText(haystack: string[] | null | undefined, needle: string): boolean {
  if (!haystack || haystack.length === 0) return false;
  return haystack.some((value) => includesText(value, needle));
}

function supplementMatchesQuery(s: DatabaseSupplement, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const nameMatch = includesText(s.name, q);
  const brandMatch = includesText(s.brand ?? undefined, q);
  const typeMatch = includesText(s.type, q);
  const certificationsMatch = arrayIncludesText(s.certifications, q);
  const otherIngredientsMatch = arrayIncludesText(s.other_ingredients, q);

  const ingredientMatch =
    (s.supplement_ingredients ?? []).some((ing) =>
      includesText(ing.nutrient_name, q)
    );

  return (
    nameMatch ||
    brandMatch ||
    typeMatch ||
    certificationsMatch ||
    otherIngredientsMatch ||
    ingredientMatch
  );
}

function getAllTypes(supplements: DatabaseSupplement[]): string[] {
  const types = new Set<string>();
  for (const s of supplements) {
    if (s.type) types.add(s.type);
  }
  return Array.from(types).sort((a, b) => a.localeCompare(b));
}

const TYPE_LABELS: Record<string, string> = {
  multivitamin: "Multivitamin",
  single: "Single nutrient",
  mineral: "Mineral",
  herbal: "Herbal",
  amino: "Amino acid",
  probiotic: "Probiotic",
  omega: "Omega-3 / Fish oil",
  other: "Other",
};

function formatType(type: string | null | undefined): string {
  if (!type) return "Unknown";
  return TYPE_LABELS[type] ?? type;
}

export function SupplementResearchTool({
  preset = "all",
  title = "Research supplements",
  description = "Search, filter, and compare products. Add your own via Supplements → Add New to make the database more complete.",
}: SupplementResearchToolProps) {
  const { data: supplements = [], isLoading, error } = useSupplementsList();

  const [filters, setFilters] = useState<ResearchFilters>(() => ({
    query: "",
    supplementType: "any",
    omega3Only: false,

    minEpaMg: "",
    minDhaMg: "",
    minDpaMg: "",
    minEpaPlusDhaMg: "",
    minEpaToDhaRatio: "",
    maxEpaToDhaRatio: "",

    oilForm: "any",
    source: "any",
    gelatin: "any",
    thirdPartyTested: "any",
    heavyMetalsTested: "any",
    pregnancySafety: "any",

    certificationQuery: "",
    requireKosher: false,
    requireHalal: false,

    ...getPresetFilters(preset),
  }));

  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const availableTypes = useMemo(() => getAllTypes(supplements), [supplements]);

  const results = useMemo(() => {
    const minEpa = parseNumberOrNull(filters.minEpaMg);
    const minDha = parseNumberOrNull(filters.minDhaMg);
    const minDpa = parseNumberOrNull(filters.minDpaMg);
    const minEpaPlusDha = parseNumberOrNull(filters.minEpaPlusDhaMg);
    const minRatio = parseNumberOrNull(filters.minEpaToDhaRatio);
    const maxRatio = parseNumberOrNull(filters.maxEpaToDhaRatio);

    const certificationQuery = filters.certificationQuery.trim();

    return supplements
      .filter((s) => supplementMatchesQuery(s, filters.query))
      .filter((s) => (filters.supplementType === "any" ? true : s.type === filters.supplementType))
      .filter((s) => (filters.omega3Only ? supplementLooksLikeOmega3(s) : true))
      .map((s) => {
        const metrics = getOmega3Metrics(s);
        const omega3 = getOmega3Attributes(s);
        return { s, metrics, omega3 };
      })
      .filter(({ metrics, omega3, s }) => {
        if (minEpa != null && (metrics.epaMg ?? 0) < minEpa) return false;
        if (minDha != null && (metrics.dhaMg ?? 0) < minDha) return false;
        if (minDpa != null && (metrics.dpaMg ?? 0) < minDpa) return false;
        if (minEpaPlusDha != null && (metrics.epaPlusDhaMg ?? 0) < minEpaPlusDha) return false;

        if (minRatio != null) {
          const ratio = metrics.epaToDhaRatio;
          if (ratio == null || ratio < minRatio) return false;
        }
        if (maxRatio != null) {
          const ratio = metrics.epaToDhaRatio;
          if (ratio == null || ratio > maxRatio) return false;
        }

        if (filters.oilForm !== "any" && omega3.oilForm !== filters.oilForm) return false;
        if (filters.source !== "any" && omega3.source !== filters.source) return false;
        if (filters.gelatin !== "any" && omega3.gelatin !== filters.gelatin) return false;
        if (filters.thirdPartyTested !== "any" && omega3.thirdPartyTested !== filters.thirdPartyTested) return false;
        if (filters.heavyMetalsTested !== "any" && omega3.heavyMetalsTested !== filters.heavyMetalsTested) return false;
        if (filters.pregnancySafety !== "any" && omega3.pregnancySafety !== filters.pregnancySafety) return false;

        if (filters.requireKosher && !arrayIncludesText(s.certifications, "kosher")) return false;
        if (filters.requireHalal && !arrayIncludesText(s.certifications, "halal")) return false;

        if (certificationQuery) {
          if (!arrayIncludesText(s.certifications, certificationQuery)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aScore = a.metrics.epaPlusDhaMg ?? 0;
        const bScore = b.metrics.epaPlusDhaMg ?? 0;
        if (bScore !== aScore) return bScore - aScore;
        const aName = `${a.s.brand ?? ""} ${a.s.name}`.trim().toLowerCase();
        const bName = `${b.s.brand ?? ""} ${b.s.name}`.trim().toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [filters, supplements]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="text-sm text-gray-600">{description}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search products, brands, ingredients..."
                value={filters.query}
                onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
                className="pl-10"
              />
            </div>

            <Button
              variant="outline"
              className="justify-between"
              onClick={() => setShowFilters((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </span>
              {showFilters ? (
                <ChevronUp className="w-4 h-4 ml-2" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-2" />
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                <p className="text-sm font-medium text-gray-900">Basics</p>
                <div className="grid grid-cols-1 gap-2">
                  <label className="text-xs font-medium text-gray-700">Supplement type</label>
                  <select
                    value={filters.supplementType}
                    onChange={(e) => setFilters((prev) => ({ ...prev, supplementType: e.target.value }))}
                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                  >
                    <option value="any">Any</option>
                    {availableTypes.map((type) => (
                      <option key={type} value={type}>
                        {formatType(type)}
                      </option>
                    ))}
                  </select>

                  <label className="inline-flex items-center gap-2 text-sm mt-1">
                    <input
                      type="checkbox"
                      checked={filters.omega3Only}
                      onChange={(e) => setFilters((prev) => ({ ...prev, omega3Only: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Show only products with omega-3s
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                <p className="text-sm font-medium text-gray-900">Omega-3 targets (mg)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Min DHA</label>
                    <Input
                      inputMode="numeric"
                      placeholder="e.g., 200"
                      value={filters.minDhaMg}
                      onChange={(e) => setFilters((prev) => ({ ...prev, minDhaMg: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Min EPA</label>
                    <Input
                      inputMode="numeric"
                      placeholder="e.g., 300"
                      value={filters.minEpaMg}
                      onChange={(e) => setFilters((prev) => ({ ...prev, minEpaMg: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Min DPA</label>
                    <Input
                      inputMode="numeric"
                      placeholder="e.g., 50"
                      value={filters.minDpaMg}
                      onChange={(e) => setFilters((prev) => ({ ...prev, minDpaMg: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Min EPA+DHA</label>
                    <Input
                      inputMode="numeric"
                      placeholder="e.g., 500"
                      value={filters.minEpaPlusDhaMg}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, minEpaPlusDhaMg: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Min EPA:DHA</label>
                    <Input
                      inputMode="decimal"
                      placeholder="e.g., 1"
                      value={filters.minEpaToDhaRatio}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, minEpaToDhaRatio: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Max EPA:DHA</label>
                    <Input
                      inputMode="decimal"
                      placeholder="e.g., 3"
                      value={filters.maxEpaToDhaRatio}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, maxEpaToDhaRatio: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                <p className="text-sm font-medium text-gray-900">Quality & constraints</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Oil form</label>
                    <select
                      value={filters.oilForm}
                      onChange={(e) => setFilters((prev) => ({ ...prev, oilForm: e.target.value as AnyOr<OmegaOilForm> }))}
                      className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                    >
                      <option value="any">Any</option>
                      <option value="fish_oil">Fish oil</option>
                      <option value="algal_oil">Algal oil</option>
                      <option value="krill_oil">Krill oil</option>
                      <option value="flaxseed_oil">Flaxseed oil</option>
                      <option value="other">Other</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700">Source</label>
                    <select
                      value={filters.source}
                      onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value as AnyOr<OmegaSource> }))}
                      className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                    >
                      <option value="any">Any</option>
                      <option value="fish">Fish</option>
                      <option value="algae">Algae</option>
                      <option value="plant">Plant</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700">Gelatin / capsule</label>
                    <select
                      value={filters.gelatin}
                      onChange={(e) => setFilters((prev) => ({ ...prev, gelatin: e.target.value as AnyOr<GelatinType> }))}
                      className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                    >
                      <option value="any">Any</option>
                      <option value="animal">Animal gelatin</option>
                      <option value="fish">Fish gelatin</option>
                      <option value="plant">Plant-based</option>
                      <option value="none">None</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700">Pregnancy safety</label>
                    <select
                      value={filters.pregnancySafety}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, pregnancySafety: e.target.value as AnyOr<PregnancySafety> }))
                      }
                      className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                    >
                      <option value="any">Any</option>
                      <option value="generally_safe">Generally safe</option>
                      <option value="caution">Use caution</option>
                      <option value="avoid">Avoid</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700">Third-party tested</label>
                    <select
                      value={filters.thirdPartyTested}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, thirdPartyTested: e.target.value as AnyOr<YesNoUnknown> }))
                      }
                      className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                    >
                      <option value="any">Any</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700">Heavy metals tested</label>
                    <select
                      value={filters.heavyMetalsTested}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, heavyMetalsTested: e.target.value as AnyOr<YesNoUnknown> }))
                      }
                      className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                    >
                      <option value="any">Any</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <p className="text-xs font-medium text-gray-700">Certifications</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={filters.requireKosher}
                        onChange={(e) => setFilters((prev) => ({ ...prev, requireKosher: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Kosher
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={filters.requireHalal}
                        onChange={(e) => setFilters((prev) => ({ ...prev, requireHalal: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Halal
                    </label>
                  </div>
                  <Input
                    placeholder="Search within certifications (e.g., IFOS, NSF, Non-GMO)"
                    value={filters.certificationQuery}
                    onChange={(e) => setFilters((prev) => ({ ...prev, certificationQuery: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-gray-600">
            <p>
              {isLoading ? "Loading…" : `${results.length} result${results.length === 1 ? "" : "s"}`}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  query: "",
                  supplementType: "any",
                  omega3Only: preset === "omega3" || preset === "omega3-pregnancy",
                  minEpaMg: "",
                  minDhaMg: preset === "omega3-pregnancy" ? "200" : "",
                  minDpaMg: "",
                  minEpaPlusDhaMg: "",
                  minEpaToDhaRatio: "",
                  maxEpaToDhaRatio: "",
                  oilForm: "any",
                  source: "any",
                  gelatin: "any",
                  thirdPartyTested: "any",
                  heavyMetalsTested: "any",
                  pregnancySafety: "any",
                  certificationQuery: "",
                  requireKosher: false,
                  requireHalal: false,
                }))
              }
            >
              Reset
            </Button>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Failed to load supplements.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-sm text-gray-600">Loading products…</div>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-600">
            No products match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map(({ s, metrics, omega3 }) => {
            const isExpanded = expandedId === s.id;
            const title = `${s.brand ? `${s.brand} ` : ""}${s.name}`.trim();
            const certifications = s.certifications ?? [];
            const otherIngredients = s.other_ingredients ?? [];

            return (
              <Card key={s.id}>
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{title}</CardTitle>
                      <p className="text-sm text-gray-600">{formatType(s.type)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedId((prev) => (prev === s.id ? null : s.id))}
                    >
                      {isExpanded ? "Hide" : "Details"}
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {metrics.epaPlusDhaMg != null && (
                      <Badge variant="secondary">EPA+DHA {formatMg(metrics.epaPlusDhaMg)}</Badge>
                    )}
                    {metrics.dhaMg != null && <Badge variant="secondary">DHA {formatMg(metrics.dhaMg)}</Badge>}
                    {metrics.epaMg != null && <Badge variant="secondary">EPA {formatMg(metrics.epaMg)}</Badge>}
                    {metrics.dpaMg != null && <Badge variant="secondary">DPA {formatMg(metrics.dpaMg)}</Badge>}
                    {metrics.epaToDhaRatio != null && (
                      <Badge variant="secondary">EPA:DHA {formatRatio(metrics.epaToDhaRatio)}</Badge>
                    )}
                    {omega3.oilForm && omega3.oilForm !== "unknown" && (
                      <Badge variant="outline">{omega3.oilForm.replace(/_/g, " ")}</Badge>
                    )}
                    {omega3.source && omega3.source !== "unknown" && (
                      <Badge variant="outline">source: {omega3.source}</Badge>
                    )}
                    {omega3.gelatin && omega3.gelatin !== "unknown" && (
                      <Badge variant="outline">capsule: {omega3.gelatin}</Badge>
                    )}
                  </div>

                  {certifications.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {certifications.slice(0, 6).map((cert) => (
                        <Badge key={cert} variant="outline" className="text-xs">
                          {cert}
                        </Badge>
                      ))}
                      {certifications.length > 6 && (
                        <Badge variant="outline" className="text-xs">
                          +{certifications.length - 6}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="text-xs font-medium text-gray-700">Omega-3 metadata</p>
                        <div className="mt-2 space-y-1 text-gray-700">
                          <p>
                            Oil form: <span className="font-medium">{omega3.oilForm ?? "unknown"}</span>
                          </p>
                          <p>
                            Source: <span className="font-medium">{omega3.source ?? "unknown"}</span>
                          </p>
                          <p>
                            Capsule: <span className="font-medium">{omega3.gelatin ?? "unknown"}</span>
                          </p>
                          <p>
                            Third-party tested:{" "}
                            <span className="font-medium">{omega3.thirdPartyTested ?? "unknown"}</span>
                          </p>
                          <p>
                            Heavy metals tested:{" "}
                            <span className="font-medium">{omega3.heavyMetalsTested ?? "unknown"}</span>
                          </p>
                          <p>
                            Pregnancy safety:{" "}
                            <span className="font-medium">{omega3.pregnancySafety ?? "unknown"}</span>
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="text-xs font-medium text-gray-700">Serving</p>
                        <div className="mt-2 space-y-1 text-gray-700">
                          <p>
                            Serving size:{" "}
                            <span className="font-medium">{s.serving_size ?? "—"}</span>
                          </p>
                          <p>
                            Servings/container:{" "}
                            <span className="font-medium">
                              {s.servings_per_container ?? "—"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs font-medium text-gray-700">Supplement facts (parsed)</p>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {(s.supplement_ingredients ?? [])
                          .slice()
                          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                          .map((ing) => (
                            <div
                              key={ing.id}
                              className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2"
                            >
                              <span className="text-gray-800 truncate">{ing.nutrient_name}</span>
                              <span className="text-gray-700">
                                {Number(ing.amount)} {ing.unit}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {otherIngredients.length > 0 && (
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="text-xs font-medium text-gray-700">Other ingredients</p>
                        <p className="mt-2 text-sm text-gray-700">
                          {otherIngredients.join(", ")}
                        </p>
                      </div>
                    )}

                    {s.product_url ? (
                      <a
                        href={s.product_url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm",
                          "hover:bg-gray-50"
                        )}
                      >
                        View product page
                      </a>
                    ) : null}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
