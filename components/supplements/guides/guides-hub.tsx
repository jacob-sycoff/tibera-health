"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Tag, BookOpen, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SUPPLEMENT_GUIDES,
  getAllGuideTags,
  type GuideTag,
} from "@/lib/supplements/guides";
import { cn } from "@/lib/utils/cn";

function formatTag(tag: GuideTag): string {
  return tag.replace(/_/g, " ");
}

function guideMatchesQuery(
  guide: (typeof SUPPLEMENT_GUIDES)[number],
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    guide.title.toLowerCase().includes(q) ||
    guide.description.toLowerCase().includes(q) ||
    guide.slug.toLowerCase().includes(q)
  );
}

export function GuidesHub() {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<GuideTag[]>([]);

  const tags = useMemo(() => getAllGuideTags(), []);

  const filteredGuides = useMemo(() => {
    return SUPPLEMENT_GUIDES.filter((g) => guideMatchesQuery(g, query)).filter(
      (g) =>
        selectedTags.length === 0 ||
        selectedTags.every((t) => g.tags.includes(t))
    );
  }, [query, selectedTags]);

  const toggleTag = (tag: GuideTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)]">
        <CardHeader className="space-y-1 px-5 py-5">
          <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
            <BookOpen className="w-5 h-5" />
            Find a guide
          </CardTitle>
          <p className="text-sm text-slate-600">
            Tip: use multiple tags to narrow down (e.g., pregnancy + deficiency).
          </p>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5 pt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search (omega-3, prenatal, vitamin D, iron, magnesium...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-12 rounded-2xl border-black/10 bg-white focus-visible:ring-slate-900/10"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Tag className="w-4 h-4 text-slate-500" />
              <span className="font-medium">Filter by goal</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors capitalize",
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-black/10 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {formatTag(tag)}
                  </button>
                );
              })}
            </div>

            {selectedTags.length > 0 ? (
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((t) => (
                    <Badge key={t} variant="secondary" className="capitalize">
                      {formatTag(t)}
                    </Badge>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedTags([])}
                  className="text-sm text-slate-900 font-medium hover:underline"
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <p>
          {filteredGuides.length} guide{filteredGuides.length === 1 ? "" : "s"}
        </p>
        <Link href="/supplements/research" className="text-slate-900 font-medium hover:underline">
          Open research tool
        </Link>
      </div>

      {filteredGuides.length === 0 ? (
        <Card className="rounded-[28px] border-black/10 bg-white/70 backdrop-blur-xl">
          <CardContent className="py-10 text-center text-slate-600">
            No guides match your search/filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredGuides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/supplements/guides/${guide.slug}`}
              className="group rounded-[28px] border border-black/10 bg-white/70 backdrop-blur-xl p-5 shadow-[0_12px_40px_-24px_rgba(2,6,23,0.35)] hover:border-slate-900/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{guide.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{guide.description}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {guide.tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="outline" className="capitalize border-black/10">
                    {formatTag(tag)}
                  </Badge>
                ))}
                {guide.tags.length > 4 ? (
                  <Badge variant="outline" className="border-black/10">
                    +{guide.tags.length - 4}
                  </Badge>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
