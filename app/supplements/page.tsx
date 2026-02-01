"use client";

import { useState, useRef } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Check,
  Search,
  Camera,
  Link as LinkIcon,
  Edit3,
  ChevronDown,
  ChevronUp,
  Shield,
  Pill,
  X,
  Loader2,
  Upload,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useSupplementLogsByDate,
  useCreateSupplementLog,
  useDeleteSupplementLog,
  useSupplementsList,
  useCreateUserSupplement,
} from "@/lib/hooks";
import type {
  SupplementIngredient,
  NutrientForm,
  NutrientSource,
} from "@/types/supplements";
import { FORM_LABELS, SOURCE_LABELS } from "@/types/supplements";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  scanSupplementLabel,
  type ScannedSupplement,
  type ScanProgress,
} from "@/lib/api/supplement-scanner";
import {
  importSupplementFromUrl,
  type ImportProgress,
} from "@/lib/api/url-importer";
import { ScannedSupplementReview } from "@/components/supplements/scanned-supplement-review";
import { ScanProgressDisplay } from "@/components/supplements/scan-progress";
import { ManualEntryForm } from "@/components/supplements/manual-entry-form";
import { IngredientList } from "@/components/supplements/ingredient-list";
import { SupplementCard } from "@/components/supplements/supplement-card";
import { SupplementDetailModal } from "@/components/supplements/supplement-detail-modal";
import { QuickLogModal } from "@/components/supplements/quick-log-modal";
import { useToast } from "@/components/ui/toast";

// Type for dietary attributes stored in database
interface DatabaseDietaryAttributes {
  thirdPartyTested?: boolean;
  thirdPartyTesters?: string[];
  cgmpCertified?: boolean;
  heavyMetalsTested?: boolean;
  vegetarian?: boolean;
  vegan?: boolean;
  meatFree?: boolean;
  porkFree?: boolean;
  shellfishFree?: boolean;
  fishFree?: boolean;
  gelatinFree?: boolean;
  animalGelatinFree?: boolean;
  usesVegetarianCapsule?: boolean;
  usesFishGelatin?: boolean;
  usesPorkGelatin?: boolean;
  usesBeefGelatin?: boolean;
  capsuleType?: string;
  kosher?: boolean;
  kosherCertifier?: string;
  halal?: boolean;
  halalCertifier?: string;
  glutenFree?: boolean;
  dairyFree?: boolean;
  soyFree?: boolean;
  nutFree?: boolean;
  eggFree?: boolean;
  cornFree?: boolean;
  nonGMO?: boolean;
  organic?: boolean;
  organicCertifier?: string;
  sustainablySourced?: boolean;
  pregnancySafe?: boolean;
  nursingSafe?: boolean;
  madeInUSA?: boolean;
  countryOfOrigin?: string;
}

// Type for database supplement
interface DatabaseSupplement {
  id: string;
  name: string;
  brand: string | null;
  type: string;
  serving_size: string | null;
  servings_per_container: number | null;
  other_ingredients: string[] | null;
  allergens: string[] | null;
  certifications: string[] | null;
  attributes: DatabaseDietaryAttributes | null;
  is_verified: boolean;
  supplement_ingredients: Array<{
    id: string;
    nutrient_name: string;
    amount: number;
    unit: string;
    daily_value_percent: number | null;
    form: string | null;
    source: string | null;
    notes: string | null;
  }>;
}

// Type for database supplement log
interface DatabaseSupplementLog {
  id: string;
  supplement_id: string | null;
  supplement_name: string;
  dosage: number;
  unit: string;
  logged_at: string;
  notes: string | null;
  supplement: DatabaseSupplement | null;
}

export default function SupplementsPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDetailedSupplement, setSelectedDetailedSupplement] =
    useState<DatabaseSupplement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [kosherFilter, setKosherFilter] = useState<string>("all"); // "all", "any", or specific certifier
  const [dietaryFilters, setDietaryFilters] = useState<{
    thirdPartyTested: boolean;
    vegan: boolean;
    vegetarian: boolean;
    glutenFree: boolean;
    halal: boolean;
    nonGMO: boolean;
  }>({
    thirdPartyTested: false,
    vegan: false,
    vegetarian: false,
    glutenFree: false,
    halal: false,
    nonGMO: false,
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"browse" | "photo" | "url" | "manual">(
    "browse"
  );

  // Photo scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scannedData, setScannedData] = useState<ScannedSupplement | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL import state
  const [urlInput, setUrlInput] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Supabase hooks
  const { data: todaysLogs = [], isLoading: logsLoading } = useSupplementLogsByDate(selectedDate);
  const { data: databaseSupplements = [], isLoading: supplementsLoading } = useSupplementsList();
  const createLog = useCreateSupplementLog();
  const deleteLog = useDeleteSupplementLog();
  const createSupplement = useCreateUserSupplement();
  const toast = useToast();

  const navigateDate = (direction: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + direction);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const availableTypes = Array.from(
    new Set(databaseSupplements.map((s) => s.type).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // Get unique kosher certifiers from supplements
  const availableKosherCertifiers = Array.from(
    new Set(
      databaseSupplements
        .map((s) => s.attributes?.kosherCertifier)
        .filter((c): c is string => Boolean(c))
    )
  ).sort((a, b) => a.localeCompare(b));

  // Filter supplements by search + type + dietary attributes
  const filteredSupplements = databaseSupplements
    .filter((s) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.brand?.toLowerCase().includes(q)
      );
    })
    .filter((s) => (typeFilter === "all" ? true : s.type === typeFilter))
    .filter((s) => {
      // Kosher filter
      if (kosherFilter === "all") return true;
      if (kosherFilter === "any") return s.attributes?.kosher === true;
      // Specific certifier
      return s.attributes?.kosherCertifier === kosherFilter;
    })
    .filter((s) => {
      // Dietary filters (must match all selected filters)
      const attrs = s.attributes;
      if (dietaryFilters.thirdPartyTested && !attrs?.thirdPartyTested) return false;
      if (dietaryFilters.vegan && !attrs?.vegan) return false;
      if (dietaryFilters.vegetarian && !attrs?.vegetarian) return false;
      if (dietaryFilters.glutenFree && !attrs?.glutenFree) return false;
      if (dietaryFilters.halal && !attrs?.halal) return false;
      if (dietaryFilters.nonGMO && !attrs?.nonGMO) return false;
      return true;
    });

  const handleLogDetailedSupplement = (supplement: DatabaseSupplement) => {
    const supplementName = `${supplement.brand ? supplement.brand + " " : ""}${supplement.name}`;
    createLog.mutate(
      {
        supplement_id: supplement.id,
        supplement_name: supplementName,
        dosage: 1,
        unit: supplement.serving_size || "serving",
        notes: supplement.supplement_ingredients?.length
          ? `${supplement.supplement_ingredients.length} nutrients`
          : undefined,
      },
      {
        onSuccess: () => {
          toast.success(`${supplement.name} logged`);
        },
        onError: (error) => {
          console.error("Failed to log supplement:", error);
          toast.error("Failed to log supplement");
        },
      }
    );
  };

  const quickLog = (supplement: Pick<DatabaseSupplement, "id" | "name" | "brand" | "serving_size">) => {
    const supplementName = `${supplement.brand ? supplement.brand + " " : ""}${supplement.name}`;
    createLog.mutate(
      {
        supplement_id: supplement.id,
        supplement_name: supplementName,
        dosage: 1,
        unit: supplement.serving_size || "serving",
      },
      {
        onSuccess: () => {
          toast.success(`${supplement.name} logged`);
        },
        onError: (error) => {
          console.error("Failed to log supplement:", error);
          toast.error("Failed to log supplement");
        },
      }
    );
  };

  const handleDeleteLog = (id: string) => {
    deleteLog.mutate(id);
  };

  const takenSupplements = new Set(
    todaysLogs.map((log) => log.supplement_name)
  );

  // Photo scanning handlers
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset state
    setScanError(null);
    setScannedData(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Start scanning
    setIsScanning(true);

    try {
      const result = await scanSupplementLabel(file, (progress) => {
        setScanProgress(progress);
      });

      if (result.success && result.data) {
        setScannedData(result.data);
        setIsScanning(false);
        setScanProgress(null);
      } else {
        setScanError(result.error || "Failed to scan supplement label");
        setIsScanning(false);
        setScanProgress(null);
      }
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Unknown error occurred");
      setIsScanning(false);
      setScanProgress(null);
    }

    // Clear the file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleScanConfirm = async (data: ScannedSupplement) => {
    const supplementName = data.brand ? `${data.brand} ${data.name}` : data.name;

    try {
      // Save supplement to database first
      // Category is already set in the review modal (user can edit it there)
      const newSupplement = await createSupplement.mutateAsync({
        name: data.name,
        brand: data.brand || undefined,
        type: data.category || "other",
        serving_size: data.servingSize || "1 serving",
        servings_per_container: data.servingsPerContainer || undefined,
        other_ingredients: data.otherIngredients.length > 0 ? data.otherIngredients : undefined,
        allergens: data.allergens.length > 0 ? data.allergens : undefined,
        certifications: data.certifications.length > 0 ? data.certifications : undefined,
        // Store dietary attributes (third-party testing, kosher, halal, vegan, gelatin type, etc.)
        attributes: (data.dietaryAttributes || {}) as Record<string, unknown>,
        ingredients: data.ingredients.map((ing) => ({
          nutrient_name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          daily_value_percent: ing.dailyValue,
          form: ing.form,
        })),
      });

      // Then create log entry with the supplement ID
      createLog.mutate({
        supplement_id: newSupplement.id,
        supplement_name: supplementName,
        dosage: 1,
        unit: data.servingSize || "serving",
      });

      // Show success toast
      toast.success(`${supplementName} saved and logged`);

      // Reset all state
      setScannedData(null);
      setPreviewImage(null);
      setScanError(null);
      setUrlInput("");
      setImportError(null);
      setAddMode("browse");
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string; details?: string };
      console.error("Failed to save supplement:", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        raw: error,
      });
      toast.error(err?.message || "Failed to save supplement. Please try again.");
      // Still reset state even on error
      setScannedData(null);
      setPreviewImage(null);
    }
  };

  const handleScanCancel = () => {
    setScannedData(null);
    setPreviewImage(null);
    setScanError(null);
    setIsScanning(false);
    setScanProgress(null);
    // Also reset URL import state
    setUrlInput("");
    setImportError(null);
    setIsImporting(false);
    setImportProgress(null);
  };

  // URL import handler
  const handleUrlImport = async () => {
    if (!urlInput.trim() || isImporting) return;

    // Reset state
    setImportError(null);
    setScannedData(null);
    setIsImporting(true);

    try {
      const result = await importSupplementFromUrl(urlInput, (progress) => {
        setImportProgress(progress);
      });

      if (result.success && result.data) {
        setScannedData(result.data);
        setIsImporting(false);
        setImportProgress(null);
      } else {
        setImportError(result.error || "Failed to import from URL");
        setIsImporting(false);
        setImportProgress(null);
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unknown error occurred");
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  // Find supplement details for a log
  const getSupplementDetails = (log: { supplement_id?: string | null; supplement?: unknown }): DatabaseSupplement | null => {
    if (log.supplement) return log.supplement as DatabaseSupplement;
    if (log.supplement_id) {
      return databaseSupplements.find(s => s.id === log.supplement_id) || null;
    }
    return null;
  };

  if (logsLoading && supplementsLoading) return <SupplementsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Supplements"
        description="Track your supplements and keep a clean record over time."
        action={
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Log
          </Button>
        }
      />

      {/* Tabs */}
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-11 border border-[color:var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl p-1">
          <TabsTrigger
            value="today"
            className="w-full aria-selected:!bg-slate-900 aria-selected:!text-white dark:aria-selected:!bg-slate-100 dark:aria-selected:!text-slate-900 aria-selected:shadow-none"
          >
            Today
          </TabsTrigger>
          <TabsTrigger
            value="database"
            className="w-full aria-selected:!bg-slate-900 aria-selected:!text-white dark:aria-selected:!bg-slate-100 dark:aria-selected:!text-slate-900 aria-selected:shadow-none"
          >
            Database
          </TabsTrigger>
          <TabsTrigger
            value="add"
            className="w-full aria-selected:!bg-slate-900 aria-selected:!text-white dark:aria-selected:!bg-slate-100 dark:aria-selected:!text-slate-900 aria-selected:shadow-none"
          >
            Add New
          </TabsTrigger>
        </TabsList>

        {/* Today Tab */}
        <TabsContent value="today" className="space-y-4">
          {/* Date Navigation */}
          <div className="flex items-center justify-between rounded-[28px] border border-[color:var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] p-3">
            <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="font-medium">
              {isToday
                ? "Today"
                : new Date(selectedDate).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateDate(1)}
              disabled={isToday}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* My Pill Organizer */}
          <Card className="rounded-[28px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">My Pill Organizer</CardTitle>
            </CardHeader>
            <CardContent>
              {supplementsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
                </div>
              ) : databaseSupplements.length === 0 ? (
                <EmptyState
                  icon={Pill}
                  title="No supplements yet"
                  description="Add your first supplement to start tracking."
                  className="py-4"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {databaseSupplements.slice(0, 8).map((supplement) => {
                    const displayName = `${supplement.brand ? supplement.brand + " " : ""}${supplement.name}`;
                    const taken = takenSupplements.has(displayName);
                    return (
                      <button
                        key={supplement.id}
                        onClick={() => !taken && quickLog(supplement)}
                        disabled={taken || createLog.isPending}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-2xl text-left transition-colors border",
                          taken
                            ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                            : "border-[color:var(--glass-border)] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                        )}
                      >
                        <span className="font-medium text-sm truncate">{supplement.name}</span>
                        {taken && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Today's Supplements */}
          <Card className="rounded-[28px]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Taken Today</CardTitle>
                <Badge variant="secondary">
                  {todaysLogs.length} supplement{todaysLogs.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
                </div>
              ) : todaysLogs.length === 0 ? (
                <EmptyState
                  icon={Pill}
                  title="No supplements today"
                  description="Log your supplements to keep track of your daily intake."
                  className="py-4"
                />
              ) : (
                <ul className="space-y-2">
                  {todaysLogs.map((log) => {
                    const detailedInfo = getSupplementDetails(log);
                    const isExpanded = expandedLogId === log.id;

                    return (
                      <li
                        key={log.id}
                        className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                      >
                        <div className="flex items-center justify-between p-3">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() =>
                              setExpandedLogId(isExpanded ? null : log.id)
                            }
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{log.supplement_name}</p>
                              {detailedInfo && (
                                <Badge variant="outline" className="text-xs">
                                  {detailedInfo.supplement_ingredients?.length || 0} nutrients
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {log.dosage} {log.unit} at{" "}
                              {new Date(log.logged_at).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {detailedInfo && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setExpandedLogId(isExpanded ? null : log.id)
                                }
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-500 dark:text-slate-400 hover:text-destructive"
                              onClick={() => handleDeleteLog(log.id)}
                              disabled={deleteLog.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Expanded Ingredient List */}
                        {isExpanded && detailedInfo && (
                          <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/30 p-3">
                            <IngredientList
                              ingredients={detailedInfo.supplement_ingredients || []}
                            />
                            {detailedInfo.certifications &&
                              detailedInfo.certifications.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                    Certifications
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {detailedInfo.certifications.map((cert) => (
                                      <Badge
                                        key={cert}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        <Shield className="w-3 h-3 mr-1" />
                                        {cert}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database" className="space-y-4">
          {/* Search + Type Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search supplements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-2xl border-[color:var(--glass-border)] bg-[var(--glass-bg)] focus-visible:ring-slate-900/10 dark:focus-visible:ring-slate-100/10"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-12 rounded-2xl border border-[color:var(--glass-border)] bg-[var(--glass-bg)] px-4 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
            >
              <option value="all">All types</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Button
              variant={showAdvancedFilters ? "default" : "outline"}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="h-12 rounded-2xl shrink-0"
            >
              <Shield className="w-4 h-4 mr-2" />
              Filters
              {Object.values(dietaryFilters).some(Boolean) || kosherFilter !== "all" ? (
                <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {Object.values(dietaryFilters).filter(Boolean).length +
                    (kosherFilter !== "all" ? 1 : 0)}
                </Badge>
              ) : null}
            </Button>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <Card className="rounded-2xl p-4">
              <div className="space-y-4">
                {/* Kosher Filter */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Kosher Certification
                  </label>
                  <select
                    value={kosherFilter}
                    onChange={(e) => setKosherFilter(e.target.value)}
                    className="w-full h-10 rounded-xl border border-[color:var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
                  >
                    <option value="all">Any (no filter)</option>
                    <option value="any">Kosher (any certifier)</option>
                    {availableKosherCertifiers.map((certifier) => (
                      <option key={certifier} value={certifier}>
                        {certifier}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dietary Attribute Filters */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Dietary & Quality Attributes
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "thirdPartyTested", label: "Third-Party Tested" },
                      { key: "vegan", label: "Vegan" },
                      { key: "vegetarian", label: "Vegetarian" },
                      { key: "glutenFree", label: "Gluten-Free" },
                      { key: "halal", label: "Halal" },
                      { key: "nonGMO", label: "Non-GMO" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() =>
                          setDietaryFilters((prev) => ({
                            ...prev,
                            [key]: !prev[key as keyof typeof prev],
                          }))
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm transition-colors border",
                          dietaryFilters[key as keyof typeof dietaryFilters]
                            ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                            : "bg-white dark:bg-slate-800 border-[color:var(--glass-border)] hover:bg-slate-50 dark:hover:bg-slate-700"
                        )}
                      >
                        {dietaryFilters[key as keyof typeof dietaryFilters] && (
                          <Check className="w-3 h-3 inline mr-1" />
                        )}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Filters */}
                {(Object.values(dietaryFilters).some(Boolean) || kosherFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setKosherFilter("all");
                      setDietaryFilters({
                        thirdPartyTested: false,
                        vegan: false,
                        vegetarian: false,
                        glutenFree: false,
                        halal: false,
                        nonGMO: false,
                      });
                    }}
                    className="text-slate-500"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear all filters
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Supplement List */}
          {supplementsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
            </div>
          ) : filteredSupplements.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No results found"
              description="Try adjusting your search or filters to find what you're looking for."
              className="py-8"
            />
          ) : (
            <div className="space-y-3">
              {filteredSupplements.map((supplement) => (
                <SupplementCard
                  key={supplement.id}
                  supplement={supplement}
                  onLog={() => handleLogDetailedSupplement(supplement)}
                  onViewDetails={() => setSelectedDetailedSupplement(supplement)}
                  isLogging={createLog.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Add New Tab */}
        <TabsContent value="add" className="space-y-4">
          <Card className="rounded-[28px]">
            <CardHeader>
              <CardTitle className="text-lg">Add New Supplement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Mode Selection */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAddMode("browse")}
                  className={cn(
                    "p-4 rounded-2xl text-left transition-colors border",
                    addMode === "browse"
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-[color:var(--glass-border)] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                  )}
                >
                  <Search
                    className={cn(
                      "w-5 h-5 mb-2",
                      addMode === "browse" ? "text-white dark:text-slate-900" : "text-slate-900 dark:text-slate-100"
                    )}
                  />
                  <p className="font-medium text-sm">Browse Database</p>
                  <p
                    className={cn(
                      "text-xs",
                      addMode === "browse" ? "text-white/80 dark:text-slate-900/80" : "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    Search existing supplements
                  </p>
                </button>

                <button
                  onClick={() => setAddMode("photo")}
                  className={cn(
                    "p-4 rounded-2xl text-left transition-colors border",
                    addMode === "photo"
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-[color:var(--glass-border)] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                  )}
                >
                  <Camera
                    className={cn(
                      "w-5 h-5 mb-2",
                      addMode === "photo" ? "text-white dark:text-slate-900" : "text-slate-900 dark:text-slate-100"
                    )}
                  />
                  <p className="font-medium text-sm">Scan Label</p>
                  <p
                    className={cn(
                      "text-xs",
                      addMode === "photo" ? "text-white/80 dark:text-slate-900/80" : "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    AI reads your supplement
                  </p>
                </button>

                <button
                  onClick={() => setAddMode("url")}
                  className={cn(
                    "p-4 rounded-2xl text-left transition-colors border",
                    addMode === "url"
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-[color:var(--glass-border)] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                  )}
                >
                  <LinkIcon
                    className={cn(
                      "w-5 h-5 mb-2",
                      addMode === "url" ? "text-white dark:text-slate-900" : "text-slate-900 dark:text-slate-100"
                    )}
                  />
                  <p className="font-medium text-sm">Product Link</p>
                  <p
                    className={cn(
                      "text-xs",
                      addMode === "url" ? "text-white/80 dark:text-slate-900/80" : "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    Paste URL to import
                  </p>
                </button>

                <button
                  onClick={() => setAddMode("manual")}
                  className={cn(
                    "p-4 rounded-2xl text-left transition-colors border",
                    addMode === "manual"
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-[color:var(--glass-border)] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                  )}
                >
                  <Edit3
                    className={cn(
                      "w-5 h-5 mb-2",
                      addMode === "manual" ? "text-white dark:text-slate-900" : "text-slate-900 dark:text-slate-100"
                    )}
                  />
                  <p className="font-medium text-sm">Manual Entry</p>
                  <p
                    className={cn(
                      "text-xs",
                      addMode === "manual" ? "text-white/80 dark:text-slate-900/80" : "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    Enter details yourself
                  </p>
                </button>
              </div>

              {/* Add Mode Content */}
              {addMode === "browse" && (
                <div className="space-y-3">
                  <Input
                    placeholder="Search supplements to add..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 rounded-2xl border-[color:var(--glass-border)] bg-[var(--glass-bg)] focus-visible:ring-slate-900/10 dark:focus-visible:ring-slate-100/10"
                  />
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredSupplements.slice(0, 10).map((supplement) => (
                      <button
                        key={supplement.id}
                        onClick={() => handleLogDetailedSupplement(supplement)}
                        disabled={createLog.isPending}
                        className="w-full p-4 rounded-2xl border border-[color:var(--glass-border)] bg-white dark:bg-slate-800 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        <p className="font-medium">
                          {supplement.brand && (
                            <span className="text-slate-500">
                              {supplement.brand}{" "}
                            </span>
                          )}
                          {supplement.name}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {supplement.type} - {supplement.supplement_ingredients?.length || 0}{" "}
                          nutrients
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {addMode === "photo" && (
                <div className="space-y-4">
                  {/* Scanning Progress */}
                  {isScanning && scanProgress && (
                    <ScanProgressDisplay
                      progress={scanProgress}
                      onCancel={handleScanCancel}
                    />
                  )}

                  {/* Error Display */}
                  {scanError && !isScanning && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <X className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-800 dark:text-red-300">Scan Failed</p>
                          <p className="text-sm text-red-700 dark:text-red-400 mt-1">{scanError}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              setScanError(null);
                              setPreviewImage(null);
                            }}
                          >
                            Try Again
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Upload UI - Show when not scanning and no error */}
                  {!isScanning && !scanError && (
                    <>
                      {/* Image Preview */}
                      {previewImage && (
                        <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                          <img
                            src={previewImage}
                            alt="Supplement label preview"
                            className="w-full max-h-48 object-contain bg-gray-50"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                            onClick={() => setPreviewImage(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}

                      {/* Upload Area */}
                      <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                        <div className="flex justify-center mb-3">
                          <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-primary-500" />
                          </div>
                        </div>
                        <p className="font-medium mb-1">AI Label Scanner</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                          Take a photo or upload an image of your supplement label
                        </p>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                          capture="environment"
                          className="hidden"
                          id="photo-upload"
                          onChange={handleFileSelect}
                        />

                        <div className="flex flex-col sm:flex-row gap-2 justify-center">
                          <label htmlFor="photo-upload">
                            <Button asChild className="cursor-pointer">
                              <span>
                                <Camera className="w-4 h-4 mr-2" />
                                Take Photo
                              </span>
                            </Button>
                          </label>
                          <label htmlFor="photo-upload">
                            <Button asChild variant="outline" className="cursor-pointer">
                              <span>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Image
                              </span>
                            </Button>
                          </label>
                        </div>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                        <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">
                          Tips for best results:
                        </p>
                        <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                          <li>- Capture the full "Supplement Facts" panel</li>
                          <li>- Ensure good lighting with no glare</li>
                          <li>- Hold camera steady for a sharp image</li>
                          <li>- Include all ingredient amounts and %DV</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}

              {addMode === "url" && (
                <div className="space-y-4">
                  {/* Show import progress or error */}
                  {isImporting && importProgress && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                            {importProgress.message}
                          </p>
                          <div className="mt-2 bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${importProgress.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {importError && (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <p className="text-sm text-red-700 dark:text-red-400">{importError}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        onClick={() => setImportError(null)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}

                  {!isImporting && !importError && (
                    <>
                      <div>
                        <label className="text-sm font-medium">Product URL</label>
                        <Input
                          placeholder="https://amazon.com/dp/... or https://iherb.com/..."
                          className="mt-1"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleUrlImport()}
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleUrlImport}
                        disabled={!urlInput.trim()}
                      >
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Import from URL
                      </Button>
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                        Works with Amazon, iHerb, Thorne, and most supplement
                        retailers
                      </p>
                    </>
                  )}
                </div>
              )}

              {addMode === "manual" && <ManualEntryForm />}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Detailed Supplement Modal */}
      {selectedDetailedSupplement && (
        <SupplementDetailModal
          supplement={selectedDetailedSupplement}
          onClose={() => setSelectedDetailedSupplement(null)}
          onLog={() => {
            handleLogDetailedSupplement(selectedDetailedSupplement);
            setSelectedDetailedSupplement(null);
          }}
          isLogging={createLog.isPending}
        />
      )}

      {/* Quick Log Modal */}
      {showAddForm && (
        <QuickLogModal
          supplements={databaseSupplements}
          isLoading={supplementsLoading}
          isLogging={createLog.isPending}
          onLog={(supplement) => {
            quickLog(supplement);
            setShowAddForm(false);
          }}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Scanned Supplement Review Modal */}
      {scannedData && (
        <ScannedSupplementReview
          data={scannedData}
          onConfirm={handleScanConfirm}
          onCancel={handleScanCancel}
          isSaving={createSupplement.isPending || createLog.isPending}
        />
      )}
    </div>
  );
}

function SupplementsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-[var(--radius-xl)] animate-pulse w-48" />
      <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-[var(--radius-lg)] animate-pulse" />
      <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-[var(--radius-xl)] animate-pulse" />
      <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-[var(--radius-xl)] animate-pulse" />
    </div>
  );
}
