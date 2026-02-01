"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
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

type AnyOr<T extends string> = "any" | T;
type ResearchPreset = "all" | "omega3" | "omega3-pregnancy";
type FilterMode = "basic" | "advanced";

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

type SortKey = "epaPlusDhaDesc" | "dhaDesc" | "epaDesc" | "brandAsc" | "nameAsc";

function parseNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
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

  const ingredientMatch = (s.supplement_ingredients ?? []).some((ing) =>
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
  omega: "Omega-3",
  other: "Other",
};

function formatType(type: string | null | undefined): string {
  if (!type) return "Unknown";
  return TYPE_LABELS[type] ?? type;
}

function formatMg(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value)} mg`;
}

function formatRatio(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(2);
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

  return {
    omega3Only: false,
    supplementType: "any",
    minDhaMg: "",
    pregnancySafety: "any",
  };
}

function getDefaultFilters(preset: ResearchPreset): ResearchFilters {
  return {
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
  };
}

function getDisplayName(s: DatabaseSupplement): string {
  return `${s.brand ? `${s.brand} ` : ""}${s.name}`.trim();
}

function normalizeUnknown<T extends string>(value: T | null | undefined): T | "unknown" {
  if (!value) return "unknown";
  if (value === "unknown") return "unknown";
  return value;
}

function matchesWithUnknown<T extends string>(
  filter: AnyOr<T>,
  actual: T | null | undefined,
  includeUnknowns: boolean
): boolean {
  if (filter === "any") return true;

  const normalized = normalizeUnknown(actual);

  if (filter === "unknown") return normalized === "unknown";
  if (normalized === "unknown") return includeUnknowns;
  return normalized === filter;
}

function compareSupplements(a: DatabaseSupplement, b: DatabaseSupplement, sort: SortKey): number {
  const aName = getDisplayName(a).toLowerCase();
  const bName = getDisplayName(b).toLowerCase();

  const aBrand = (a.brand ?? "").toLowerCase();
  const bBrand = (b.brand ?? "").toLowerCase();

  const aMetrics = getOmega3Metrics(a);
  const bMetrics = getOmega3Metrics(b);

  const num = (v: number | null) => v ?? -1;

  if (sort === "epaPlusDhaDesc") return num(bMetrics.epaPlusDhaMg) - num(aMetrics.epaPlusDhaMg) || aName.localeCompare(bName);
  if (sort === "dhaDesc") return num(bMetrics.dhaMg) - num(aMetrics.dhaMg) || aName.localeCompare(bName);
  if (sort === "epaDesc") return num(bMetrics.epaMg) - num(aMetrics.epaMg) || aName.localeCompare(bName);
  if (sort === "brandAsc") return aBrand.localeCompare(bBrand) || aName.localeCompare(bName);
  return aName.localeCompare(bName);
}

type FilterChip = { id: string; label: string; onRemove: () => void };

export function SaarinenSupplementResearchTool() {
  const { data: supplements = [], isLoading, error } = useSupplementsList();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didInitFromUrl = useRef(false);
  const urlSyncTimeoutRef = useRef<number | null>(null);

  const [preset, setPreset] = useState<ResearchPreset>("all");
  const [filters, setFilters] = useState<ResearchFilters>(() => getDefaultFilters("all"));
  const [sort, setSort] = useState<SortKey>("epaPlusDhaDesc");
  const [filterMode, setFilterMode] = useState<FilterMode>("basic");
  const [includeUnknowns, setIncludeUnknowns] = useState(true);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [shortlistIds, setShortlistIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">(
    "idle"
  );

  const availableTypes = useMemo(() => getAllTypes(supplements), [supplements]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, [pathname, searchParams]);

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("copied");
      window.setTimeout(() => setShareStatus("idle"), 1200);
    } catch {
      setShareStatus("error");
      window.setTimeout(() => setShareStatus("idle"), 1500);
    }
  };

  const parsePreset = (value: string | null): ResearchPreset | null => {
    if (value === "all" || value === "omega3" || value === "omega3-pregnancy") return value;
    return null;
  };

  const parseMode = (value: string | null): FilterMode | null => {
    if (value === "basic" || value === "advanced") return value;
    return null;
  };

  const parseBoolean = (value: string | null): boolean | null => {
    if (value === "1" || value === "true") return true;
    if (value === "0" || value === "false") return false;
    return null;
  };

  const parseStringOrNull = (value: string | null): string | null => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const parseAnyOr = <T extends string>(value: string | null): AnyOr<T> | null => {
    if (!value) return null;
    return value as AnyOr<T>;
  };

  useEffect(() => {
    if (didInitFromUrl.current) return;

    const urlPreset = parsePreset(searchParams.get("preset"));
    const nextPreset = urlPreset ?? "all";
    const base = getDefaultFilters(nextPreset);
    const nextMode = parseMode(searchParams.get("mode")) ?? "basic";
    const nextIncludeUnknowns =
      parseBoolean(searchParams.get("unk")) ?? true;

    const nextFilters: ResearchFilters = {
      ...base,
      query: parseStringOrNull(searchParams.get("q")) ?? base.query,
      supplementType:
        parseStringOrNull(searchParams.get("type")) ?? base.supplementType,
      omega3Only:
        parseBoolean(searchParams.get("omega3")) ?? base.omega3Only,

      minDhaMg: parseStringOrNull(searchParams.get("minDha")) ?? base.minDhaMg,
      minEpaMg: parseStringOrNull(searchParams.get("minEpa")) ?? base.minEpaMg,
      minDpaMg: parseStringOrNull(searchParams.get("minDpa")) ?? base.minDpaMg,
      minEpaPlusDhaMg:
        parseStringOrNull(searchParams.get("minEpaDha")) ?? base.minEpaPlusDhaMg,
      minEpaToDhaRatio:
        parseStringOrNull(searchParams.get("minRatio")) ?? base.minEpaToDhaRatio,
      maxEpaToDhaRatio:
        parseStringOrNull(searchParams.get("maxRatio")) ?? base.maxEpaToDhaRatio,

      source: (parseAnyOr<OmegaSource>(searchParams.get("source")) ??
        base.source) as AnyOr<OmegaSource>,
      oilForm: (parseAnyOr<OmegaOilForm>(searchParams.get("form")) ??
        base.oilForm) as AnyOr<OmegaOilForm>,
      gelatin: (parseAnyOr<GelatinType>(searchParams.get("capsule")) ??
        base.gelatin) as AnyOr<GelatinType>,
      thirdPartyTested: (parseAnyOr<YesNoUnknown>(searchParams.get("tpt")) ??
        base.thirdPartyTested) as AnyOr<YesNoUnknown>,
      heavyMetalsTested: (parseAnyOr<YesNoUnknown>(searchParams.get("hm")) ??
        base.heavyMetalsTested) as AnyOr<YesNoUnknown>,
      pregnancySafety: (parseAnyOr<PregnancySafety>(searchParams.get("preg")) ??
        base.pregnancySafety) as AnyOr<PregnancySafety>,

      certificationQuery:
        parseStringOrNull(searchParams.get("cert")) ?? base.certificationQuery,
      requireKosher:
        parseBoolean(searchParams.get("kosher")) ?? base.requireKosher,
      requireHalal:
        parseBoolean(searchParams.get("halal")) ?? base.requireHalal,
    };

    const urlSort = parseStringOrNull(searchParams.get("sort")) as SortKey | null;
    const urlShortlist = parseStringOrNull(searchParams.get("shortlist"));
    const parsedShortlist =
      urlShortlist?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

    setPreset(nextPreset);
    setFilters(nextFilters);
    setSort(urlSort ?? (nextPreset === "all" ? "brandAsc" : "epaPlusDhaDesc"));
    setFilterMode(nextMode);
    setIncludeUnknowns(nextIncludeUnknowns);
    if (parsedShortlist.length > 0) setShortlistIds(parsedShortlist.slice(0, 3));

    didInitFromUrl.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("tibera.research.shortlist.v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const ids = parsed.filter((v) => typeof v === "string") as string[];
      if (ids.length > 0) setShortlistIds((prev) => (prev.length > 0 ? prev : ids.slice(0, 3)));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("tibera.research.shortlist.v1", JSON.stringify(shortlistIds));
    } catch {
      // ignore
    }
  }, [shortlistIds]);

  useEffect(() => {
    if (!didInitFromUrl.current) return;
    if (!router || !pathname) return;

    if (urlSyncTimeoutRef.current) window.clearTimeout(urlSyncTimeoutRef.current);

    urlSyncTimeoutRef.current = window.setTimeout(() => {
      const params = new URLSearchParams();

      if (preset !== "all") params.set("preset", preset);
      if (filters.query.trim()) params.set("q", filters.query.trim());
      if (filters.supplementType !== "any") params.set("type", filters.supplementType);
      if (filters.omega3Only) params.set("omega3", "1");

      if (filters.minDhaMg.trim()) params.set("minDha", filters.minDhaMg.trim());
      if (filters.minEpaMg.trim()) params.set("minEpa", filters.minEpaMg.trim());
      if (filters.minDpaMg.trim()) params.set("minDpa", filters.minDpaMg.trim());
      if (filters.minEpaPlusDhaMg.trim()) params.set("minEpaDha", filters.minEpaPlusDhaMg.trim());
      if (filters.minEpaToDhaRatio.trim()) params.set("minRatio", filters.minEpaToDhaRatio.trim());
      if (filters.maxEpaToDhaRatio.trim()) params.set("maxRatio", filters.maxEpaToDhaRatio.trim());

      if (filters.source !== "any") params.set("source", filters.source);
      if (filters.oilForm !== "any") params.set("form", filters.oilForm);
      if (filters.gelatin !== "any") params.set("capsule", filters.gelatin);
      if (filters.thirdPartyTested !== "any") params.set("tpt", filters.thirdPartyTested);
      if (filters.heavyMetalsTested !== "any") params.set("hm", filters.heavyMetalsTested);
      if (filters.pregnancySafety !== "any") params.set("preg", filters.pregnancySafety);

      if (filters.requireKosher) params.set("kosher", "1");
      if (filters.requireHalal) params.set("halal", "1");
      if (filters.certificationQuery.trim()) params.set("cert", filters.certificationQuery.trim());

      if (sort !== (preset === "all" ? "brandAsc" : "epaPlusDhaDesc")) params.set("sort", sort);
      if (filterMode !== "basic") params.set("mode", filterMode);
      if (!includeUnknowns) params.set("unk", "0");
      if (shortlistIds.length > 0) params.set("shortlist", shortlistIds.join(","));

      const next = params.toString();
      const current = searchParams.toString();
      if (next !== current) {
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      }
    }, 250);

    return () => {
      if (urlSyncTimeoutRef.current) window.clearTimeout(urlSyncTimeoutRef.current);
    };
  }, [filters, pathname, preset, router, searchParams, sort]);

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
      .filter((s) =>
        filters.supplementType === "any" ? true : s.type === filters.supplementType
      )
      .filter((s) => (filters.omega3Only ? supplementLooksLikeOmega3(s) : true))
      .filter((s) => {
        const metrics = getOmega3Metrics(s);
        const omega3 = getOmega3Attributes(s);

        const omegaMetaFiltersActive =
          filters.source !== "any" ||
          filters.oilForm !== "any" ||
          filters.gelatin !== "any" ||
          filters.thirdPartyTested !== "any" ||
          filters.heavyMetalsTested !== "any" ||
          filters.pregnancySafety !== "any";

        if (omegaMetaFiltersActive && !supplementLooksLikeOmega3(s)) return false;

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

        if (!matchesWithUnknown(filters.oilForm, omega3.oilForm ?? "unknown", includeUnknowns)) return false;
        if (!matchesWithUnknown(filters.source, omega3.source ?? "unknown", includeUnknowns)) return false;
        if (!matchesWithUnknown(filters.gelatin, omega3.gelatin ?? "unknown", includeUnknowns)) return false;
        if (!matchesWithUnknown(filters.thirdPartyTested, omega3.thirdPartyTested ?? "unknown", includeUnknowns)) return false;
        if (!matchesWithUnknown(filters.heavyMetalsTested, omega3.heavyMetalsTested ?? "unknown", includeUnknowns)) return false;
        if (!matchesWithUnknown(filters.pregnancySafety, omega3.pregnancySafety ?? "unknown", includeUnknowns)) return false;

        if (filters.requireKosher && !arrayIncludesText(s.certifications, "kosher")) return false;
        if (filters.requireHalal && !arrayIncludesText(s.certifications, "halal")) return false;

        if (certificationQuery && !arrayIncludesText(s.certifications, certificationQuery)) return false;

        return true;
      })
      .slice()
      .sort((a, b) => compareSupplements(a, b, sort));
  }, [filters, includeUnknowns, sort, supplements]);

  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    const defaults = getDefaultFilters(preset);

    const add = (id: string, label: string, onRemove: () => void) => {
      chips.push({ id, label, onRemove });
    };

    if (filters.supplementType !== defaults.supplementType) {
      add("type", `Type: ${formatType(filters.supplementType)}`, () =>
        setFilters((p) => ({ ...p, supplementType: defaults.supplementType }))
      );
    }
    if (filters.omega3Only !== defaults.omega3Only) {
      add("omega3Only", "Omega-3 only", () =>
        setFilters((p) => ({ ...p, omega3Only: defaults.omega3Only }))
      );
    }

    const numericFields: Array<[keyof ResearchFilters, string, string]> = [
      ["minDhaMg", "Min DHA", "mg"],
      ["minEpaMg", "Min EPA", "mg"],
      ["minDpaMg", "Min DPA", "mg"],
      ["minEpaPlusDhaMg", "Min EPA+DHA", "mg"],
      ["minEpaToDhaRatio", "Min EPA:DHA", ""],
      ["maxEpaToDhaRatio", "Max EPA:DHA", ""],
    ];
    for (const [field, label, suffix] of numericFields) {
      const v = filters[field];
      const d = defaults[field];
      if (v !== d && typeof v === "string" && v.trim()) {
        add(String(field), `${label}: ${v}${suffix ? ` ${suffix}` : ""}`, () =>
          setFilters((p) => ({ ...p, [field]: d }))
        );
      }
    }

    const stringFields: Array<[keyof ResearchFilters, string]> = [
      ["oilForm", "Oil form"],
      ["source", "Source"],
      ["gelatin", "Capsule"],
      ["thirdPartyTested", "3rd-party tested"],
      ["heavyMetalsTested", "Heavy metals tested"],
      ["pregnancySafety", "Pregnancy safety"],
    ];
    for (const [field, label] of stringFields) {
      const v = filters[field];
      const d = defaults[field];
      if (v !== d && v !== "any") {
        add(String(field), `${label}: ${String(v).replace(/_/g, " ")}`, () =>
          setFilters((p) => ({ ...p, [field]: d }))
        );
      }
    }

    if (filters.requireKosher !== defaults.requireKosher && filters.requireKosher) {
      add("kosher", "Kosher", () => setFilters((p) => ({ ...p, requireKosher: false })));
    }
    if (filters.requireHalal !== defaults.requireHalal && filters.requireHalal) {
      add("halal", "Halal", () => setFilters((p) => ({ ...p, requireHalal: false })));
    }
    if (
      filters.certificationQuery !== defaults.certificationQuery &&
      filters.certificationQuery.trim()
    ) {
      add("certQuery", `Cert: ${filters.certificationQuery.trim()}`, () =>
        setFilters((p) => ({ ...p, certificationQuery: "" }))
      );
    }

    if (!includeUnknowns) {
      add("unk", "Strict metadata", () => setIncludeUnknowns(true));
    }

    return chips;
  }, [filters, includeUnknowns, preset]);

  const compareSupplementsData = useMemo(() => {
    const byId = new Map(supplements.map((s) => [s.id, s] as const));
    return shortlistIds.map((id) => byId.get(id)).filter(Boolean) as DatabaseSupplement[];
  }, [shortlistIds, supplements]);

  const applyPreset = (nextPreset: ResearchPreset) => {
    setPreset(nextPreset);
    setFilters(getDefaultFilters(nextPreset));
    setSort(nextPreset === "all" ? "brandAsc" : "epaPlusDhaDesc");
    setExpandedId(null);
    setShortlistIds([]);
    setCompareOpen(false);
    setFilterMode("basic");
    setIncludeUnknowns(true);
  };

  const resetAll = () => {
    setFilters(getDefaultFilters(preset));
    setSort(preset === "all" ? "brandAsc" : "epaPlusDhaDesc");
    setExpandedId(null);
    setIncludeUnknowns(true);
  };

  const toggleCompare = (id: string) => {
    setShortlistIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const FiltersModeToggle = (
    <div className="inline-flex rounded-full border border-black/10 bg-white p-1">
      <button
        type="button"
        onClick={() => setFilterMode("basic")}
        className={cn(
          "h-8 px-3 rounded-full text-xs font-medium transition-colors",
          filterMode === "basic"
            ? "bg-slate-900 text-white"
            : "text-slate-700 hover:bg-slate-50"
        )}
      >
        Basic
      </button>
      <button
        type="button"
        onClick={() => setFilterMode("advanced")}
        className={cn(
          "h-8 px-3 rounded-full text-xs font-medium transition-colors",
          filterMode === "advanced"
            ? "bg-slate-900 text-white"
            : "text-slate-700 hover:bg-slate-50"
        )}
      >
        Advanced
      </button>
    </div>
  );

  const FiltersPanel = (
    <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]">
      <div className="p-5 border-b border-black/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900">Filters</p>
            <p className="mt-1 text-xs text-slate-600">
              Tighten the lens. Start broad, then narrow.
            </p>
          </div>
          {FiltersModeToggle}
        </div>
        <div className="mt-3">
          <Link
            href="/supplements/guides/omega-3"
            className="text-xs font-medium text-slate-900 hover:underline"
          >
            Learn: DHA vs EPA (guide)
          </Link>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700">Supplement type</label>
          <select
            value={filters.supplementType}
            onChange={(e) =>
              setFilters((p) => ({ ...p, supplementType: e.target.value }))
            }
            className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="any">Any type</option>
            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {formatType(type)}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-slate-900">Omega-3 only</p>
            <p className="text-xs text-slate-600">Show products with DHA/EPA/DPA/ALA</p>
          </div>
          <input
            type="checkbox"
            checked={filters.omega3Only}
            onChange={(e) =>
              setFilters((p) => ({ ...p, omega3Only: e.target.checked }))
            }
            className="h-5 w-5 rounded border-black/20"
          />
        </label>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">
            Omega-3 targets (mg)
            <HelpTip title="Targets help you quickly narrow products. Start with DHA if pregnancy-focused, then consider EPA and total EPA+DHA.">
              Targets help you narrow the list quickly. Start with DHA if pregnancy-focused, then
              consider EPA and total EPA+DHA.
            </HelpTip>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              inputMode="numeric"
              placeholder="Min DHA"
              value={filters.minDhaMg}
              onChange={(e) => setFilters((p) => ({ ...p, minDhaMg: e.target.value }))}
              className="h-11 rounded-2xl border-black/10 focus-visible:ring-slate-900/10"
            />
            <Input
              inputMode="numeric"
              placeholder="Min EPA"
              value={filters.minEpaMg}
              onChange={(e) => setFilters((p) => ({ ...p, minEpaMg: e.target.value }))}
              className="h-11 rounded-2xl border-black/10 focus-visible:ring-slate-900/10"
            />
          </div>

          {filterMode === "advanced" ? (
            <>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Input
                  inputMode="numeric"
                  placeholder="Min DPA"
                  value={filters.minDpaMg}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, minDpaMg: e.target.value }))
                  }
                  className="h-11 rounded-2xl border-black/10 focus-visible:ring-slate-900/10"
                />
                <Input
                  inputMode="numeric"
                  placeholder="Min EPA+DHA"
                  value={filters.minEpaPlusDhaMg}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, minEpaPlusDhaMg: e.target.value }))
                  }
                  className="h-11 rounded-2xl border-black/10 focus-visible:ring-slate-900/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-slate-600">
                    Min EPA:DHA
                    <HelpTip title="Ratio compares EPA relative to DHA. This is preference- and goal-dependent; there isn’t a universal best ratio.">
                      EPA:DHA is a ratio (EPA ÷ DHA). It’s goal-dependent; there isn’t a universal
                      “best” ratio.
                    </HelpTip>
                  </p>
                  <Input
                    inputMode="decimal"
                    placeholder="e.g., 1"
                    value={filters.minEpaToDhaRatio}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, minEpaToDhaRatio: e.target.value }))
                    }
                    className="h-11 rounded-2xl border-black/10 focus-visible:ring-slate-900/10"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-slate-600">
                    Max EPA:DHA
                    <HelpTip title="Use a max ratio if you prefer DHA-heavy products. If DHA is zero/unknown, ratio can’t be computed.">
                      Use a max ratio if you prefer DHA-heavy products. If DHA is zero/unknown, the
                      ratio can’t be computed.
                    </HelpTip>
                  </p>
                  <Input
                    inputMode="decimal"
                    placeholder="e.g., 3"
                    value={filters.maxEpaToDhaRatio}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, maxEpaToDhaRatio: e.target.value }))
                    }
                    className="h-11 rounded-2xl border-black/10 focus-visible:ring-slate-900/10"
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">Source & capsule</p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filters.source}
              onChange={(e) =>
                setFilters((p) => ({ ...p, source: e.target.value as AnyOr<OmegaSource> }))
              }
              className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="any">Any source</option>
              <option value="fish">Fish</option>
              <option value="algae">Algae</option>
              <option value="plant">Plant</option>
              <option value="unknown">Unknown</option>
            </select>

            {filterMode === "advanced" ? (
              <>
                <select
                  value={filters.oilForm}
                  onChange={(e) =>
                    setFilters((p) => ({
                      ...p,
                      oilForm: e.target.value as AnyOr<OmegaOilForm>,
                    }))
                  }
                  className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="any">Any form</option>
                  <option value="fish_oil">Fish oil</option>
                  <option value="algal_oil">Algal oil</option>
                  <option value="krill_oil">Krill oil</option>
                  <option value="flaxseed_oil">Flaxseed oil</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </select>

                <select
                  value={filters.gelatin}
                  onChange={(e) =>
                    setFilters((p) => ({
                      ...p,
                      gelatin: e.target.value as AnyOr<GelatinType>,
                    }))
                  }
                  className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="any">Any capsule</option>
                  <option value="animal">Animal gelatin</option>
                  <option value="fish">Fish gelatin</option>
                  <option value="plant">Plant-based</option>
                  <option value="none">None</option>
                  <option value="unknown">Unknown</option>
                </select>

                <select
                  value={filters.pregnancySafety}
                  onChange={(e) =>
                    setFilters((p) => ({
                      ...p,
                      pregnancySafety: e.target.value as AnyOr<PregnancySafety>,
                    }))
                  }
                  className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="any">Pregnancy safety</option>
                  <option value="generally_safe">Generally safe</option>
                  <option value="caution">Use caution</option>
                  <option value="avoid">Avoid</option>
                  <option value="unknown">Unknown</option>
                </select>
              </>
            ) : null}
          </div>
        </div>

        {filterMode === "advanced" ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700">
              Quality signals
              <HelpTip title="These fields are often missing. Keep “include unknowns” on if you want to avoid accidentally hiding products just because we haven’t captured metadata yet.">
                These fields are often missing. Keep “include unknowns” on if you want to avoid
                hiding products just because metadata hasn’t been captured yet.
              </HelpTip>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filters.thirdPartyTested}
                onChange={(e) =>
                  setFilters((p) => ({
                    ...p,
                    thirdPartyTested: e.target.value as AnyOr<YesNoUnknown>,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="any">3rd-party tested</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </select>

              <select
                value={filters.heavyMetalsTested}
                onChange={(e) =>
                  setFilters((p) => ({
                    ...p,
                    heavyMetalsTested: e.target.value as AnyOr<YesNoUnknown>,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="any">Heavy metals tested</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">Certifications</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900">
              <input
                type="checkbox"
                checked={filters.requireKosher}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, requireKosher: e.target.checked }))
                }
                className="h-4 w-4 rounded border-black/20"
              />
              Kosher
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900">
              <input
                type="checkbox"
                checked={filters.requireHalal}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, requireHalal: e.target.checked }))
                }
                className="h-4 w-4 rounded border-black/20"
              />
              Halal
            </label>
          </div>
          {filterMode === "advanced" ? (
            <Input
              placeholder="Search certs (IFOS, NSF, Non-GMO...)"
              value={filters.certificationQuery}
              onChange={(e) =>
                setFilters((p) => ({ ...p, certificationQuery: e.target.value }))
              }
              className="h-11 rounded-2xl border-black/10 focus-visible:ring-slate-900/10"
            />
          ) : null}
        </div>

        <label className="flex items-start justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
          <div className="space-y-0.5 pr-3">
            <p className="text-sm font-medium text-slate-900">
              Include unknown metadata
              <HelpTip title="If a product is missing metadata (e.g., testing status), keep it in results when filtering. Turn off if you want strict filtering only.">
                If a product is missing metadata (e.g., testing status), keep it in results when
                filtering. Turn off for strict “must match” filtering.
              </HelpTip>
            </p>
            <p className="text-xs text-slate-600">
              Recommended while the database is incomplete.
            </p>
          </div>
          <input
            type="checkbox"
            checked={includeUnknowns}
            onChange={(e) => setIncludeUnknowns(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-black/20"
          />
        </label>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11 rounded-2xl border-black/10 bg-white hover:bg-white"
            onClick={resetAll}
          >
            Reset
          </Button>
          <Button
            type="button"
            className="h-11 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => setMobileFiltersOpen(false)}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyPreset("all")}
            className={cn(
              "h-10 px-4 rounded-full border text-sm font-medium transition-colors",
              preset === "all"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-black/10 bg-white/70 text-slate-900 hover:bg-white"
            )}
          >
            All supplements
          </button>
          <button
            onClick={() => applyPreset("omega3")}
            className={cn(
              "h-10 px-4 rounded-full border text-sm font-medium transition-colors",
              preset === "omega3"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-black/10 bg-white/70 text-slate-900 hover:bg-white"
            )}
          >
            Omega-3
          </button>
          <button
            onClick={() => applyPreset("omega3-pregnancy")}
            className={cn(
              "h-10 px-4 rounded-full border text-sm font-medium transition-colors",
              preset === "omega3-pregnancy"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-black/10 bg-white/70 text-slate-900 hover:bg-white"
            )}
          >
            Omega-3 · Pregnancy
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-full border-black/10 bg-white/70 hover:bg-white lg:hidden"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <button
            onClick={handleCopyShareLink}
            className="inline-flex lg:hidden items-center h-10 px-4 rounded-full border border-black/10 bg-white/70 text-sm font-medium text-slate-900 hover:bg-white"
            type="button"
            title="Copy a shareable link (includes filters)"
          >
            {shareStatus === "copied"
              ? "Copied"
              : shareStatus === "error"
                ? "Copy failed"
                : "Share"}
          </button>
          <button
            onClick={handleCopyShareLink}
            className="hidden lg:inline-flex items-center h-10 px-4 rounded-full border border-black/10 bg-white/70 text-sm font-medium text-slate-900 hover:bg-white"
            type="button"
            title="Copy a shareable link (includes filters)"
          >
            {shareStatus === "copied"
              ? "Copied"
              : shareStatus === "error"
                ? "Copy failed"
                : "Share"}
          </button>
          <Link
            href="/supplements/guides"
            className="hidden lg:inline-flex items-center h-10 px-4 rounded-full border border-black/10 bg-white/70 text-sm font-medium text-slate-900 hover:bg-white"
          >
            Guides <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        <div className="hidden lg:block lg:sticky lg:top-6 h-fit">{FiltersPanel}</div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Search products, brands, ingredients…"
                  value={filters.query}
                  onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
                  className="h-12 pl-11 rounded-2xl border-black/10 bg-white focus-visible:ring-slate-900/10"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="epaPlusDhaDesc">Sort: EPA+DHA</option>
                  <option value="dhaDesc">Sort: DHA</option>
                  <option value="epaDesc">Sort: EPA</option>
                  <option value="brandAsc">Sort: Brand</option>
                  <option value="nameAsc">Sort: Name</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-600">
                {isLoading ? "Loading…" : `${results.length} result${results.length === 1 ? "" : "s"}`}
                {shortlistIds.length > 0 ? ` · ${shortlistIds.length} shortlisted` : ""}
              </p>

              {filterChips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {filterChips.slice(0, 8).map((chip) => (
                    <button
                      key={chip.id}
                      onClick={chip.onRemove}
                      className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                      title="Remove filter"
                    >
                      {chip.label}
                      <X className="w-3 h-3 text-slate-500" />
                    </button>
                  ))}
                  {filterChips.length > 8 ? (
                    <span className="text-xs text-slate-500">
                      +{filterChips.length - 8} more
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Use filters to narrow (and add your own products from Supplements → Add New).
                </p>
              )}
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                Failed to load supplements.
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-10 text-sm text-slate-600">
              Loading products…
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-10 text-center text-sm text-slate-600">
              No products match your filters.
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((s) => {
                const metrics = getOmega3Metrics(s);
                const omega3 = getOmega3Attributes(s);

                const expanded = expandedId === s.id;
                const displayName = getDisplayName(s);
                const certifications = s.certifications ?? [];

                const isSelected = shortlistIds.includes(s.id);
                const compareDisabled = !isSelected && shortlistIds.length >= 3;

                return (
                  <div
                    key={s.id}
                    className={cn(
                      "rounded-[28px] border bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)] transition-colors",
                      expanded ? "border-slate-900/20" : "border-black/10"
                    )}
                  >
                    <div className="p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-semibold tracking-tight text-slate-900 truncate">
                              {displayName}
                            </p>
                            <Badge
                              variant="outline"
                              className="rounded-full border-black/10 bg-white text-slate-700"
                            >
                              {formatType(s.type)}
                            </Badge>
                          </div>

                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <Metric label="EPA+DHA" value={formatMg(metrics.epaPlusDhaMg)} />
                            <Metric label="DHA" value={formatMg(metrics.dhaMg)} />
                            <Metric label="EPA" value={formatMg(metrics.epaMg)} />
                            <Metric label="EPA:DHA" value={formatRatio(metrics.epaToDhaRatio)} />
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {omega3.source && omega3.source !== "unknown" ? (
                              <PillChip>source: {omega3.source}</PillChip>
                            ) : null}
                            {omega3.oilForm && omega3.oilForm !== "unknown" ? (
                              <PillChip>{omega3.oilForm.replace(/_/g, " ")}</PillChip>
                            ) : null}
                            {omega3.gelatin && omega3.gelatin !== "unknown" ? (
                              <PillChip>capsule: {omega3.gelatin}</PillChip>
                            ) : null}
                            {omega3.thirdPartyTested && omega3.thirdPartyTested === "yes" ? (
                              <PillChip>
                                <Check className="w-3 h-3" /> 3rd-party tested
                              </PillChip>
                            ) : null}
                            {omega3.heavyMetalsTested && omega3.heavyMetalsTested === "yes" ? (
                              <PillChip>
                                <Check className="w-3 h-3" /> heavy metals tested
                              </PillChip>
                            ) : null}
                            {certifications.slice(0, 3).map((cert) => (
                              <PillChip key={cert}>{cert}</PillChip>
                            ))}
                            {certifications.length > 3 ? (
                              <PillChip>+{certifications.length - 3} more</PillChip>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 md:flex-col md:items-end">
                          <button
                            type="button"
                            onClick={() => toggleCompare(s.id)}
                            disabled={compareDisabled}
                            className={cn(
                              "h-10 px-4 rounded-full border text-sm font-medium transition-colors",
                              isSelected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-black/10 bg-white text-slate-900 hover:bg-slate-50",
                              compareDisabled ? "opacity-50 cursor-not-allowed" : ""
                            )}
                            title={compareDisabled ? "Shortlist up to 3" : "Add to shortlist"}
                          >
                            {isSelected ? "Shortlisted" : "Shortlist"}
                          </button>
                          {compareDisabled ? (
                            <p className="hidden md:block text-xs text-slate-500 mt-1">
                              Max 3
                            </p>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => setExpandedId((p) => (p === s.id ? null : s.id))}
                            className="h-10 px-4 rounded-full border border-black/10 bg-white text-sm font-medium text-slate-900 hover:bg-slate-50"
                          >
                            {expanded ? (
                              <span className="inline-flex items-center gap-2">
                                Hide <ChevronUp className="w-4 h-4" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                Details <ChevronDown className="w-4 h-4" />
                              </span>
                            )}
                          </button>

                          {s.product_url ? (
                            <a
                              href={s.product_url}
                              target="_blank"
                              rel="noreferrer"
                              className="h-10 px-4 rounded-full border border-black/10 bg-white text-sm font-medium text-slate-900 hover:bg-slate-50 inline-flex items-center gap-2"
                            >
                              Product <ExternalLink className="w-4 h-4" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="border-t border-black/5 p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-black/10 bg-white p-4">
                            <p className="text-xs font-medium text-slate-700">Serving</p>
                            <div className="mt-2 text-sm text-slate-900 space-y-1">
                              <p>
                                Size: <span className="font-medium">{s.serving_size ?? "—"}</span>
                              </p>
                              <p>
                                Servings:{" "}
                                <span className="font-medium">{s.servings_per_container ?? "—"}</span>
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-black/10 bg-white p-4">
                            <p className="text-xs font-medium text-slate-700">Omega-3 metadata</p>
                            <div className="mt-2 text-sm text-slate-900 space-y-1">
                              <p>
                                Pregnancy safety:{" "}
                                <span className="font-medium">{omega3.pregnancySafety ?? "unknown"}</span>
                              </p>
                              <p>
                                Capsule:{" "}
                                <span className="font-medium">{omega3.gelatin ?? "unknown"}</span>
                              </p>
                              <p>
                                3rd-party tested:{" "}
                                <span className="font-medium">{omega3.thirdPartyTested ?? "unknown"}</span>
                              </p>
                              <p>
                                Heavy metals tested:{" "}
                                <span className="font-medium">{omega3.heavyMetalsTested ?? "unknown"}</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-black/10 bg-white p-4">
                          <p className="text-xs font-medium text-slate-700">Supplement facts</p>
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-900">
                            {(s.supplement_ingredients ?? [])
                              .slice()
                              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                              .map((ing) => (
                                <div
                                  key={ing.id}
                                  className="flex items-center justify-between gap-2 rounded-xl border border-black/5 bg-slate-50 px-3 py-2"
                                >
                                  <span className="truncate">{ing.nutrient_name}</span>
                                  <span className="text-slate-700">
                                    {Number(ing.amount)} {ing.unit}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 p-3">
            {FiltersPanel}
          </div>
        </div>
      ) : null}

      {shortlistIds.length > 0 ? (
        <div className="fixed inset-x-0 bottom-20 lg:bottom-6 z-40 px-4">
          <div className="mx-auto max-w-6xl rounded-[28px] border border-black/10 bg-white/80 backdrop-blur-xl shadow-[0_18px_60px_-30px_rgba(2,6,23,0.5)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-slate-700">
                  Shortlist:{" "}
                  <span className="font-medium text-slate-900">{shortlistIds.length}</span> / 3
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {compareSupplementsData.map((s) => getDisplayName(s)).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-black/10 bg-white hover:bg-white"
                  onClick={() => setShortlistIds([])}
                >
                  Clear
                </Button>
                <Button
                  className="h-10 rounded-full bg-slate-900 text-white hover:bg-slate-800"
                  onClick={() => setCompareOpen(true)}
                >
                  Compare
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {compareOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setCompareOpen(false)}
          />
          <div className="absolute inset-x-0 top-10 px-4">
            <div className="mx-auto max-w-6xl rounded-[28px] border border-black/10 bg-white shadow-[0_20px_70px_-35px_rgba(2,6,23,0.6)] overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-black/5">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-slate-900">Compare</p>
                  <p className="text-xs text-slate-600">
                    Side-by-side metrics and key attributes.
                  </p>
                </div>
                <button
                  className="h-10 w-10 rounded-full border border-black/10 bg-white hover:bg-slate-50 inline-flex items-center justify-center"
                  onClick={() => setCompareOpen(false)}
                >
                  <X className="w-4 h-4 text-slate-700" />
                </button>
              </div>

              <div className="p-5 overflow-auto">
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(
                      1,
                      compareSupplementsData.length
                    )}, minmax(260px, 1fr))`,
                  }}
                >
                  {compareSupplementsData.map((s) => {
                    const metrics = getOmega3Metrics(s);
                    const omega3 = getOmega3Attributes(s);
                    return (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-black/10 bg-slate-50 p-4"
                      >
                        <p className="font-semibold text-slate-900">
                          {getDisplayName(s)}
                        </p>
                        <p className="text-sm text-slate-600">{formatType(s.type)}</p>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Metric label="EPA+DHA" value={formatMg(metrics.epaPlusDhaMg)} />
                          <Metric label="DHA" value={formatMg(metrics.dhaMg)} />
                          <Metric label="EPA" value={formatMg(metrics.epaMg)} />
                          <Metric label="DPA" value={formatMg(metrics.dpaMg)} />
                          <Metric label="EPA:DHA" value={formatRatio(metrics.epaToDhaRatio)} />
                          <Metric label="Source" value={omega3.source ?? "unknown"} />
                          <Metric label="Form" value={omega3.oilForm ?? "unknown"} />
                          <Metric label="Capsule" value={omega3.gelatin ?? "unknown"} />
                        </div>

                        {s.product_url ? (
                          <a
                            href={s.product_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-900 hover:underline"
                          >
                            Product page <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : null}

                        <button
                          onClick={() => toggleCompare(s.id)}
                          className="mt-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                        >
                          Remove <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white px-3 py-2">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PillChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-slate-700">
      {children}
    </span>
  );
}

function HelpTip({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <span className="relative inline-flex items-center group">
      <button
        type="button"
        aria-describedby={id}
        aria-label={title}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/10 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-0 top-full z-20 mt-2 w-[280px] rounded-2xl border border-black/10 bg-white p-3 text-xs text-slate-700 shadow-[0_18px_60px_-30px_rgba(2,6,23,0.5)]",
          "opacity-0 translate-y-1",
          "transition duration-150",
          "group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0"
        )}
      >
        {children}
      </span>
    </span>
  );
}
