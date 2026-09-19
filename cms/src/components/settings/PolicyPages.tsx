import Editor from "@/components/Editor";
import LabelInput from "@/components/LabelInput";
import LabelTextArea from "@/components/LabelTextArea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSitePages } from "@/hooks/useSitePages";
import type { ISitePage } from "@/types";
import type { OutputData } from "@editorjs/editorjs";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The legal pages tab: terms and conditions, privacy policy, return and refund
 * policy.
 *
 * The api owns the set — it has no create or delete — so this is a picker over
 * whatever it returns plus one editor. Nothing here can add or remove a page.
 */
export default function PolicyPages() {
  const { sitePages, isSitePagesFetching, isSavingSitePage, saveSitePage } =
    useSitePages();

  const [activeSlug, setActiveSlug] = useState<string>("");

  // the editor is uncontrolled: it reports its blocks on every change and the
  // last report is what gets saved. Null means the admin never touched it, in
  // which case the page's stored content goes back unchanged.
  const editorData = useRef<OutputData | null>(null);

  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  const activePage: ISitePage | undefined = useMemo(
    () => sitePages.find((page) => page.slug === activeSlug) ?? sitePages[0],
    [sitePages, activeSlug],
  );

  // one page's identity for the form: the slug plus the moment it was last
  // saved, so switching pages and a fresh copy of the same page both reload it
  const formKey = activePage
    ? `${activePage.slug}-${activePage.updated_at}`
    : "";
  const loadedKey = useRef("");

  // the first load picks a page, and every later switch reloads the form from
  // the page that was picked
  useEffect(() => {
    if (!activePage || loadedKey.current === formKey) return;

    loadedKey.current = formKey;
    setActiveSlug(activePage.slug);
    setMetaTitle(activePage.meta_title ?? "");
    setMetaDescription(activePage.meta_description ?? "");
    setIsPublished(activePage.status === "published");
    editorData.current = null;
  }, [activePage, formKey]);

  if (isSitePagesFetching && sitePages.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={16} />
        Loading pages...
      </div>
    );
  }

  if (!activePage) {
    return (
      <p className="text-sm text-muted-foreground">
        No pages found. Run the database init once so the policy pages are
        seeded.
      </p>
    );
  }

  const handleSave = () => {
    saveSitePage(activePage.slug, {
      content_json: editorData.current ?? activePage.content_json ?? { blocks: [] },
      meta_title: metaTitle.trim(),
      meta_description: metaDescription.trim(),
      status: isPublished ? "published" : "draft",
    });
  };

  return (
    <div className="space-y-6">
      {/* the fixed set of pages */}
      <div className="flex flex-wrap gap-2">
        {sitePages.map((page) => (
          <Button
            key={page.slug}
            type="button"
            variant={page.slug === activePage.slug ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSlug(page.slug)}
          >
            {page.title}
            {page.status === "draft" ? (
              <span className="ml-1 text-xs opacity-70">(draft)</span>
            ) : null}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border rounded-lg p-4">
        <div>
          <h3 className="font-semibold text-lg">{activePage.title}</h3>
          <p className="text-sm text-muted-foreground">
            /{activePage.slug}
            {activePage.updated_at_label
              ? ` · last updated ${activePage.updated_at_label}`
              : null}
          </p>
        </div>

        {/* a draft is hidden from the storefront — the page still exists, its
            body just stops being served until this goes back on */}
        <div className="flex items-center gap-3">
          <Switch
            id="page-published"
            checked={isPublished}
            onCheckedChange={setIsPublished}
          />
          <Label htmlFor="page-published" className="font-semibold">
            {isPublished ? "Published" : "Draft"}
          </Label>
        </div>
      </div>

      {/* remounted per page: EditorJS takes its content once, at mount, so a
          switch between pages has to build a new instance */}
      <Editor
        key={formKey}
        label="Content"
        initData={activePage.content_json ?? undefined}
        onSave={(data) => {
          editorData.current = data;
        }}
      />

      <div className="grid gap-4">
        <h3 className="font-semibold text-lg">SEO</h3>
        <LabelInput
          label="Meta Title"
          value={metaTitle}
          onChange={(e) => setMetaTitle(e.target.value)}
          placeholder={activePage.title}
        />
        <LabelTextArea
          label="Meta Description"
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          placeholder="Short description for search results"
          rows={3}
        />
      </div>

      <Button type="button" onClick={handleSave} disabled={isSavingSitePage}>
        {isSavingSitePage ? <Loader2 className="animate-spin" size={16} /> : null}
        Save Page
      </Button>
    </div>
  );
}
