"use client";

import { useState, useRef } from "react";
import {
  Pill,
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
  Leaf,
  FlaskConical,
  Info,
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
} from "@/lib/hooks";
import { SUPPLEMENTS_LIBRARY } from "@/lib/stores/supplements";
import type { Supplement } from "@/types";
import type {
  SupplementIngredient,
  NutrientForm,
  NutrientSource,
} from "@/types/supplements";
import { FORM_LABELS, SOURCE_LABELS } from "@/types/supplements";
import { cn } from "@/lib/utils/cn";
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
  const [selectedSupplement, setSelectedSupplement] = useState<Supplement | null>(
    null
  );
  const [selectedDetailedSupplement, setSelectedDetailedSupplement] =
    useState<DatabaseSupplement | null>(null);
  const [dosage, setDosage] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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

  const navigateDate = (direction: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + direction);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  // Filter supplements by search
  const filteredSupplements = searchQuery
    ? databaseSupplements.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.brand?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : databaseSupplements;

  const handleSelectSupplement = (supplement: Supplement) => {
    setSelectedSupplement(supplement);
    setDosage(supplement.recommendedDosage?.toString() || "");
    setNotes("");
  };

  const handleLogSupplement = () => {
    if (!selectedSupplement || !dosage) return;

    createLog.mutate({
      supplement_name: selectedSupplement.name,
      dosage: parseFloat(dosage),
      unit: selectedSupplement.dosageUnit,
      logged_at: new Date(`${selectedDate}T${new Date().toTimeString().slice(0, 5)}`).toISOString(),
      notes: notes || undefined,
    });

    setSelectedSupplement(null);
    setShowAddForm(false);
  };

  const handleLogDetailedSupplement = (supplement: DatabaseSupplement) => {
    createLog.mutate({
      supplement_id: supplement.id,
      supplement_name: `${supplement.brand ? supplement.brand + " " : ""}${supplement.name}`,
      dosage: 1,
      unit: supplement.serving_size || "serving",
      notes: `Detailed supplement with ${supplement.supplement_ingredients?.length || 0} nutrients`,
    });
  };

  const quickLog = (supplement: Supplement) => {
    createLog.mutate({
      supplement_name: supplement.name,
      dosage: supplement.recommendedDosage || 1,
      unit: supplement.dosageUnit,
    });
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
    // Log the scanned supplement
    const supplementName = data.brand ? `${data.brand} ${data.name}` : data.name;

    createLog.mutate({
      supplement_name: supplementName,
      dosage: 1,
      unit: data.servingSize || "serving",
      notes: `Imported supplement with ${data.ingredients.length} ingredients: ${data.ingredients.slice(0, 3).map(i => i.name).join(", ")}${data.ingredients.length > 3 ? "..." : ""}`,
    });

    // Reset scanning state
    setScannedData(null);
    setPreviewImage(null);
    setScanError(null);
    // Reset URL import state
    setUrlInput("");
    setImportError(null);
    setAddMode("browse");
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Pill className="w-5 h-5 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold">Supplements</h1>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Log
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="add">Add New</TabsTrigger>
        </TabsList>

        {/* Today Tab */}
        <TabsContent value="today" className="space-y-4">
          {/* Date Navigation */}
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
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

          {/* Quick Add */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Quick Add</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {SUPPLEMENTS_LIBRARY.slice(0, 8).map((supplement) => {
                  const taken = takenSupplements.has(supplement.name);
                  return (
                    <button
                      key={supplement.id}
                      onClick={() => !taken && quickLog(supplement)}
                      disabled={taken || createLog.isPending}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                        taken
                          ? "bg-primary-50 border-2 border-primary-200"
                          : "bg-gray-100 hover:bg-gray-200"
                      )}
                    >
                      <span className="font-medium text-sm">{supplement.name}</span>
                      {taken && <Check className="w-4 h-4 text-primary-600" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Today's Supplements */}
          <Card>
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
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : todaysLogs.length === 0 ? (
                <p className="text-center text-gray-500 py-6">
                  No supplements logged today
                </p>
              ) : (
                <ul className="space-y-2">
                  {todaysLogs.map((log) => {
                    const detailedInfo = getSupplementDetails(log);
                    const isExpanded = expandedLogId === log.id;

                    return (
                      <li
                        key={log.id}
                        className="border border-gray-200 rounded-lg overflow-hidden"
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
                            <p className="text-xs text-gray-500">
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
                              className="text-gray-500 hover:text-destructive"
                              onClick={() => handleDeleteLog(log.id)}
                              disabled={deleteLog.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Expanded Ingredient List */}
                        {isExpanded && detailedInfo && (
                          <div className="border-t border-gray-200 bg-gray-100/30 p-3">
                            <IngredientList
                              ingredients={detailedInfo.supplement_ingredients || []}
                            />
                            {detailedInfo.certifications &&
                              detailedInfo.certifications.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <p className="text-xs text-gray-500 mb-2">
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
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search supplements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Supplement List */}
          {supplementsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : filteredSupplements.length === 0 ? (
            <p className="text-center text-gray-500 py-12">
              No supplements found in database
            </p>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add New Supplement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Mode Selection */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAddMode("browse")}
                  className={cn(
                    "p-4 rounded-lg text-left transition-colors border-2",
                    addMode === "browse"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-400"
                  )}
                >
                  <Search className="w-5 h-5 mb-2 text-primary" />
                  <p className="font-medium text-sm">Browse Database</p>
                  <p className="text-xs text-gray-500">
                    Search existing supplements
                  </p>
                </button>

                <button
                  onClick={() => setAddMode("photo")}
                  className={cn(
                    "p-4 rounded-lg text-left transition-colors border-2",
                    addMode === "photo"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-400"
                  )}
                >
                  <Camera className="w-5 h-5 mb-2 text-primary" />
                  <p className="font-medium text-sm">Scan Label</p>
                  <p className="text-xs text-gray-500">
                    AI reads your supplement
                  </p>
                </button>

                <button
                  onClick={() => setAddMode("url")}
                  className={cn(
                    "p-4 rounded-lg text-left transition-colors border-2",
                    addMode === "url"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-400"
                  )}
                >
                  <LinkIcon className="w-5 h-5 mb-2 text-primary" />
                  <p className="font-medium text-sm">Product Link</p>
                  <p className="text-xs text-gray-500">
                    Paste URL to import
                  </p>
                </button>

                <button
                  onClick={() => setAddMode("manual")}
                  className={cn(
                    "p-4 rounded-lg text-left transition-colors border-2",
                    addMode === "manual"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-400"
                  )}
                >
                  <Edit3 className="w-5 h-5 mb-2 text-primary" />
                  <p className="font-medium text-sm">Manual Entry</p>
                  <p className="text-xs text-gray-500">
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
                  />
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredSupplements.slice(0, 10).map((supplement) => (
                      <button
                        key={supplement.id}
                        onClick={() => handleLogDetailedSupplement(supplement)}
                        disabled={createLog.isPending}
                        className="w-full p-3 rounded-lg bg-gray-100 text-left hover:bg-gray-100/80 transition-colors disabled:opacity-50"
                      >
                        <p className="font-medium">
                          {supplement.brand && (
                            <span className="text-gray-500">
                              {supplement.brand}{" "}
                            </span>
                          )}
                          {supplement.name}
                        </p>
                        <p className="text-xs text-gray-500">
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
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <X className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-800">Scan Failed</p>
                          <p className="text-sm text-red-700 mt-1">{scanError}</p>
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
                        <div className="relative rounded-lg overflow-hidden border border-gray-200">
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
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                        <div className="flex justify-center mb-3">
                          <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-primary-500" />
                          </div>
                        </div>
                        <p className="font-medium mb-1">AI Label Scanner</p>
                        <p className="text-sm text-gray-500 mb-4">
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

                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-sm text-blue-800 font-medium mb-1">
                          Tips for best results:
                        </p>
                        <ul className="text-xs text-blue-700 space-y-1">
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
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-800">
                            {importProgress.message}
                          </p>
                          <div className="mt-2 bg-blue-200 rounded-full h-1.5">
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
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-700">{importError}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-red-700 hover:text-red-800"
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
                      <p className="text-xs text-gray-500 text-center">
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
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4 mb-4 lg:mb-0 max-h-[85vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  {selectedDetailedSupplement.brand && (
                    <p className="text-sm text-gray-500">
                      {selectedDetailedSupplement.brand}
                    </p>
                  )}
                  <CardTitle>{selectedDetailedSupplement.name}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDetailedSupplement(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                <Badge>{selectedDetailedSupplement.type}</Badge>
                <Badge variant="outline">
                  {selectedDetailedSupplement.serving_size}
                </Badge>
                {selectedDetailedSupplement.is_verified && (
                  <Badge variant="secondary">
                    <Check className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>

              {/* Ingredients */}
              <div>
                <h3 className="font-medium mb-2">
                  Supplement Facts ({selectedDetailedSupplement.supplement_ingredients?.length || 0}{" "}
                  nutrients)
                </h3>
                <IngredientList
                  ingredients={selectedDetailedSupplement.supplement_ingredients || []}
                  showDetails
                />
              </div>

              {/* Other Ingredients */}
              {selectedDetailedSupplement.other_ingredients &&
                selectedDetailedSupplement.other_ingredients.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Other Ingredients</h3>
                    <p className="text-sm text-gray-500">
                      {selectedDetailedSupplement.other_ingredients.join(", ")}
                    </p>
                  </div>
                )}

              {/* Certifications */}
              {selectedDetailedSupplement.certifications &&
                selectedDetailedSupplement.certifications.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Certifications</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedDetailedSupplement.certifications.map((cert) => (
                        <Badge key={cert} variant="outline">
                          <Shield className="w-3 h-3 mr-1" />
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {/* Log Button */}
              <Button
                className="w-full"
                disabled={createLog.isPending}
                onClick={() => {
                  handleLogDetailedSupplement(selectedDetailedSupplement);
                  setSelectedDetailedSupplement(null);
                }}
              >
                {createLog.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Log This Supplement
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Simple Add Supplement Modal (legacy) */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4 mb-4 lg:mb-0 max-h-[80vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Log Supplement</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedSupplement(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedSupplement ? (
                <>
                  <p className="text-sm text-gray-500">
                    Select a supplement to log
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {SUPPLEMENTS_LIBRARY.map((supplement) => (
                      <button
                        key={supplement.id}
                        onClick={() => handleSelectSupplement(supplement)}
                        className="p-3 rounded-lg bg-gray-100 text-left hover:bg-gray-100/80 transition-colors"
                      >
                        <p className="font-medium text-sm">{supplement.name}</p>
                        {supplement.recommendedDosage && (
                          <p className="text-xs text-gray-500">
                            {supplement.recommendedDosage} {supplement.dosageUnit}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center py-4 bg-purple-50 rounded-lg">
                    <p className="text-lg font-bold text-purple-800">
                      {selectedSupplement.name}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Dosage</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        value={dosage}
                        onChange={(e) => setDosage(e.target.value)}
                        placeholder="Amount"
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-500">
                        {selectedSupplement.dosageUnit}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Notes (optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional details..."
                      className="mt-1 w-full min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedSupplement(null)}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleLogSupplement}
                      disabled={!dosage || createLog.isPending}
                    >
                      {createLog.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Log Supplement
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scanned Supplement Review Modal */}
      {scannedData && (
        <ScannedSupplementReview
          data={scannedData}
          onConfirm={handleScanConfirm}
          onCancel={handleScanCancel}
          isSaving={createLog.isPending}
        />
      )}
    </div>
  );
}

// Ingredient List Component
function IngredientList({
  ingredients,
  showDetails = false,
}: {
  ingredients: Array<{
    nutrient_name: string;
    amount: number;
    unit: string;
    daily_value_percent?: number | null;
    form?: string | null;
    source?: string | null;
    notes?: string | null;
  }>;
  showDetails?: boolean;
}) {
  return (
    <div className="space-y-2">
      {ingredients.map((ingredient, idx) => (
        <div
          key={idx}
          className="flex items-start justify-between py-2 border-b border-gray-200 last:border-0"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{ingredient.nutrient_name}</p>
              {ingredient.form && ingredient.form !== "unknown" && (
                <Badge variant="outline" className="text-xs">
                  {FORM_LABELS[ingredient.form as NutrientForm] || ingredient.form}
                </Badge>
              )}
            </div>
            {showDetails && ingredient.source && ingredient.source !== "unknown" && (
              <div className="flex items-center gap-1 mt-1">
                <SourceIcon source={ingredient.source as NutrientSource} />
                <span className="text-xs text-gray-500">
                  {SOURCE_LABELS[ingredient.source as NutrientSource] || ingredient.source}
                </span>
              </div>
            )}
            {ingredient.notes && (
              <p className="text-xs text-gray-500 mt-1">
                {ingredient.notes}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-medium text-sm">
              {ingredient.amount} {ingredient.unit}
            </p>
            {ingredient.daily_value_percent !== undefined && ingredient.daily_value_percent !== null && (
              <p className="text-xs text-gray-500">
                {ingredient.daily_value_percent}% DV
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Source Icon Component
function SourceIcon({ source }: { source: NutrientSource }) {
  switch (source) {
    case "plant":
    case "algae":
    case "whole_food":
      return <Leaf className="w-3 h-3 text-green-600" />;
    case "synthetic":
      return <FlaskConical className="w-3 h-3 text-blue-600" />;
    case "fermented":
    case "bacterial":
    case "yeast":
      return <FlaskConical className="w-3 h-3 text-purple-600" />;
    case "fish":
    case "animal":
      return <Info className="w-3 h-3 text-orange-600" />;
    default:
      return <Info className="w-3 h-3 text-gray-400" />;
  }
}

// Supplement Card Component
function SupplementCard({
  supplement,
  onLog,
  onViewDetails,
  isLogging,
}: {
  supplement: DatabaseSupplement;
  onLog: () => void;
  onViewDetails: () => void;
  isLogging: boolean;
}) {
  const topNutrients = (supplement.supplement_ingredients || []).slice(0, 4);

  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors">
      <CardContent className="p-4" onClick={onViewDetails}>
        <div className="flex items-start justify-between mb-3">
          <div>
            {supplement.brand && (
              <p className="text-xs text-gray-500">{supplement.brand}</p>
            )}
            <h3 className="font-medium">{supplement.name}</h3>
            <p className="text-xs text-gray-500 mt-1">
              {supplement.serving_size} - {supplement.supplement_ingredients?.length || 0} nutrients
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary" className="capitalize">
              {supplement.type}
            </Badge>
            {supplement.is_verified && (
              <Badge variant="outline" className="text-xs">
                <Check className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
        </div>

        {/* Preview of top nutrients */}
        <div className="space-y-1 mb-3">
          {topNutrients.map((nutrient, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-gray-500">
                {nutrient.nutrient_name}
              </span>
              <span>
                {nutrient.amount} {nutrient.unit}
                {nutrient.daily_value_percent !== undefined && nutrient.daily_value_percent !== null && (
                  <span className="text-gray-500">
                    {" "}
                    ({nutrient.daily_value_percent}%)
                  </span>
                )}
              </span>
            </div>
          ))}
          {(supplement.supplement_ingredients?.length || 0) > 4 && (
            <p className="text-xs text-gray-500">
              +{(supplement.supplement_ingredients?.length || 0) - 4} more nutrients
            </p>
          )}
        </div>

        {/* Certifications preview */}
        {supplement.certifications && supplement.certifications.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {supplement.certifications.slice(0, 3).map((cert) => (
              <Badge key={cert} variant="outline" className="text-xs">
                {cert}
              </Badge>
            ))}
          </div>
        )}

        <Button
          className="w-full"
          size="sm"
          disabled={isLogging}
          onClick={(e) => {
            e.stopPropagation();
            onLog();
          }}
        >
          {isLogging ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-1" />
          )}
          Log
        </Button>
      </CardContent>
    </Card>
  );
}

// Manual Entry Form Component
function ManualEntryForm() {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingSize, setServingSize] = useState("");
  const [ingredients, setIngredients] = useState<Array<{
    nutrientName: string;
    amount: number;
    unit: string;
  }>>([{ nutrientName: "", amount: 0, unit: "mg" }]);

  const createLog = useCreateSupplementLog();

  const addIngredient = () => {
    setIngredients([...ingredients, { nutrientName: "", amount: 0, unit: "mg" }]);
  };

  const updateIngredient = (
    index: number,
    field: "nutrientName" | "amount" | "unit",
    value: string | number
  ) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = () => {
    if (!name || !servingSize) return;

    // For now, just log the supplement directly
    createLog.mutate({
      supplement_name: brand ? `${brand} ${name}` : name,
      dosage: 1,
      unit: servingSize,
      notes: `Custom supplement with ${ingredients.filter(i => i.nutrientName).length} ingredients`,
    });

    // Reset form
    setName("");
    setBrand("");
    setServingSize("");
    setIngredients([{ nutrientName: "", amount: 0, unit: "mg" }]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Supplement Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Vitamin D3"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Brand</label>
          <Input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g., NOW Foods"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Serving Size *</label>
        <Input
          value={servingSize}
          onChange={(e) => setServingSize(e.target.value)}
          placeholder="e.g., 1 capsule"
          className="mt-1"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Ingredients</label>
          <Button variant="ghost" size="sm" onClick={addIngredient}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {ingredients.map((ingredient, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                placeholder="Nutrient name"
                value={ingredient.nutrientName}
                onChange={(e) =>
                  updateIngredient(idx, "nutrientName", e.target.value)
                }
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="Amount"
                value={ingredient.amount || ""}
                onChange={(e) =>
                  updateIngredient(idx, "amount", parseFloat(e.target.value) || 0)
                }
                className="w-24"
              />
              <select
                value={ingredient.unit}
                onChange={(e) => updateIngredient(idx, "unit", e.target.value)}
                className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
                <option value="g">g</option>
                <option value="IU">IU</option>
                <option value="CFU">CFU</option>
              </select>
              {ingredients.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIngredient(idx)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={!name || !servingSize || createLog.isPending}
      >
        {createLog.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Plus className="w-4 h-4 mr-2" />
        )}
        Add Supplement
      </Button>
    </div>
  );
}

function SupplementsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 bg-gray-100 rounded-lg animate-pulse w-48" />
      <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  );
}
