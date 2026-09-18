import Editor from "@/components/Editor";
import FilePicker from "@/components/FilePicker";
import LabelInput from "@/components/LabelInput";
import LabelTextArea from "@/components/LabelTextArea";
import MediaManager from "@/components/MediaManager";
import Section from "@/components/Section";
import SelectInput from "@/components/SelectInput";
import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/ui/button-loading";
import { Label } from "@/components/ui/label";
import { useBlogAuthors } from "@/hooks/useBlogAuthors";
import { useDoMutation } from "@/hooks/useDoMutation";
import LoadingHandler from "@/middleware/LoadingHandler";
import type {
  IBlog,
  IBlogMedia,
  IError,
  IResponse,
  IUploadedFile,
} from "@/types";
import { api } from "@/utils/api";
import { createSlug } from "@/utils/createSlug";
import { toDateTimeLocal, toIsoInstant } from "@/utils/dateTimeLocal";
import type { OutputData } from "@editorjs/editorjs";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { MoveLeft, Pencil, Plus, Trash, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

const getSingleBlog = async (id: string) => {
  return (await api.get(`/api/v1/blogs/${id}`)).data;
};

const STATUS_OPTIONS = [
  { value: "draft", text: "Draft" },
  { value: "published", text: "Published" },
];

const TWITTER_CARD_OPTIONS = [
  { value: "summary_large_image", text: "Summary with large image" },
  { value: "summary", text: "Summary" },
];

const OG_TYPE_OPTIONS = [
  { value: "article", text: "Article" },
  { value: "website", text: "Website" },
];

const EMPTY_AUTHOR = {
  id: 0,
  name: "",
  designation: "",
  bio: "",
  image: "",
  email: "",
  website_url: "",
};

const NO_AUTHOR = "none";

export default function SingleBlogPage() {
  const params = useParams();
  const navigate = useNavigate();
  const isNew = params?.id === "new";

  const editorData = useRef<OutputData | undefined>(undefined);
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [publishedAt, setPublishedAt] = useState("");
  const [media, setMedia] = useState<IBlogMedia[]>([]);
  const [ogImage, setOgImage] = useState<string | null>(null);
  const [twitterImage, setTwitterImage] = useState<string | null>(null);
  const [ogType, setOgType] = useState("article");
  const [twitterCard, setTwitterCard] = useState("summary_large_image");
  const [authorId, setAuthorId] = useState<string>(NO_AUTHOR);

  // the author form doubles as create and edit, authorDraft.id tells them apart
  const [authorDraft, setAuthorDraft] = useState(EMPTY_AUTHOR);
  const [showAuthorForm, setShowAuthorForm] = useState(false);

  // The value is read here rather than inside the updater below on purpose:
  // React nulls currentTarget once the handler returns, and a functional
  // updater runs later, during the re-render — by then there is no event left
  // to read and typing throws.
  const updateAuthorDraft = (
    field: Exclude<keyof typeof EMPTY_AUTHOR, "id">,
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = e.currentTarget.value;
    setAuthorDraft((prev) => ({ ...prev, [field]: value }));
  };

  const { blogAuthorData, refetchBlogAuthors } = useBlogAuthors();
  const { mutate: mutateAuthor, isLoading: isAuthorMutating } = useDoMutation();

  const { data, isFetching, error } = useQuery<
    IResponse<IBlog>,
    AxiosError<IError>
  >({
    queryKey: ["get-single-blog", params?.id],
    queryFn: () => getSingleBlog(params?.id ?? ""),
    enabled: !isNew,
  });

  const blog = data?.data;

  useEffect(() => {
    if (blog) {
      setSlug(blog.slug);
      setStatus(blog.status);
      setPublishedAt(toDateTimeLocal(blog.published_at));
      setOgImage(blog.og_image ?? null);
      setTwitterImage(blog.twitter_image ?? null);
      setOgType(blog.og_type || "article");
      setTwitterCard(blog.twitter_card || "summary_large_image");
      setAuthorId(blog.blog_author_id ? blog.blog_author_id.toString() : NO_AUTHOR);
      editorData.current = blog.content_json ?? undefined;

      // a post written before the gallery existed still has its single cover,
      // so it opens as a one item gallery instead of an empty one
      const savedMedia = blog.media ?? [];
      setMedia(
        savedMedia.length > 0
          ? savedMedia
          : blog.cover_image
            ? [
                {
                  image: blog.cover_image,
                  alt_tag: blog.cover_image_alt ?? null,
                  type: "image",
                },
              ]
            : [],
      );
    }
  }, [isFetching]);

  const { isLoading, mutate } = useDoMutation();

  const selectedAuthor = blogAuthorData.find(
    (author) => author.id.toString() === authorId,
  );

  const isScheduled =
    status === "published" &&
    publishedAt !== "" &&
    new Date(publishedAt).getTime() > Date.now();

  const handleSaveAuthor = () => {
    const name = authorDraft.name.trim();
    if (name === "") return;

    const payload = {
      name,
      designation: authorDraft.designation || null,
      bio: authorDraft.bio || null,
      image: authorDraft.image || null,
      email: authorDraft.email || null,
      website_url: authorDraft.website_url || null,
    };

    mutateAuthor({
      apiPath: authorDraft.id
        ? `/api/v1/blogs/authors/${authorDraft.id}`
        : "/api/v1/blogs/authors",
      method: authorDraft.id ? "put" : "post",
      formData: payload,
      onSuccess(response) {
        // a created author is selected straight away, that is why the form was
        // opened in the first place
        const createdId = response?.data?.id ?? authorDraft.id;
        if (createdId) setAuthorId(createdId.toString());
        setAuthorDraft(EMPTY_AUTHOR);
        setShowAuthorForm(false);
        refetchBlogAuthors();
      },
    });
  };

  const handleDeleteAuthor = (id: number, name: string) => {
    if (
      !confirm(
        `Delete author "${name}"? Posts written by them keep their content but lose the byline.`,
      )
    )
      return;

    mutateAuthor({
      apiPath: "/api/v1/blogs/authors",
      method: "delete",
      id,
      onSuccess() {
        if (authorId === id.toString()) setAuthorId(NO_AUTHOR);
        refetchBlogAuthors();
      },
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!editorData.current || !editorData.current.blocks?.length) {
      alert("Blog content cannot be empty.");
      return;
    }

    const formEl = e.currentTarget;
    const fieldValue = (name: string) =>
      (
        formEl.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | null
      )?.value ?? "";

    const cleanedMedia = media
      .filter((item) => item.image.trim() !== "")
      .map((item) => ({
        image: item.image.trim(),
        alt_tag: item.alt_tag || null,
        type: item.type ?? "image",
      }));

    const payload = {
      title: fieldValue("title"),
      slug,
      excerpt: fieldValue("excerpt") || null,
      content_json: editorData.current,
      media: cleanedMedia,
      tags: fieldValue("tags") || null,
      status,
      // sent as an absolute instant so the api can compare it against its own
      // clock no matter which timezone either side runs in
      published_at: toIsoInstant(publishedAt),
      blog_author_id: authorId === NO_AUTHOR ? null : Number(authorId),
      meta_title: fieldValue("meta_title") || null,
      meta_description: fieldValue("meta_description") || null,
      og_title: fieldValue("og_title") || null,
      og_description: fieldValue("og_description") || null,
      og_image: ogImage || null,
      og_type: ogType || null,
      canonical_url: fieldValue("canonical_url") || null,
      twitter_card: twitterCard || null,
      twitter_title: fieldValue("twitter_title") || null,
      twitter_description: fieldValue("twitter_description") || null,
      twitter_image: twitterImage || null,
    };

    if (isNew) {
      mutate({
        apiPath: "/api/v1/blogs",
        method: "post",
        formData: payload,
        onSuccess() {
          navigate("/blogs");
        },
      });
    } else {
      mutate({
        apiPath: `/api/v1/blogs/${params?.id}`,
        method: "put",
        formData: payload,
        onSuccess() {},
      });
    }
  };

  return (
    <main className="space-y-4">
      <Link
        to="/blogs"
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-black w-fit"
      >
        <MoveLeft size={16} />
        Back to Blogs
      </Link>

      <h2 className="font-semibold text-2xl">
        {isNew ? "New Blog Post" : "Edit Blog Post"}
      </h2>

      <LoadingHandler
        loading={!isNew && isFetching}
        error={!isNew ? error : null}
        length={!isNew ? (blog ? 1 : 0) : 1}
        noDataMsg="Blog post not found"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Section>
            <h3 className="font-semibold text-lg">Post Details</h3>
            <LabelInput
              label="Title *"
              name="title"
              required
              defaultValue={blog?.title ?? ""}
              placeholder="Enter blog title"
              onChange={(e) => {
                if (isNew) setSlug(createSlug(e.target.value));
              }}
            />
            <LabelInput
              label="Slug *"
              name="slug"
              required
              value={slug}
              placeholder="blog-post-slug"
              onChange={(e) => setSlug(e.target.value)}
            />
            <LabelTextArea
              label="Excerpt"
              name="excerpt"
              defaultValue={blog?.excerpt ?? ""}
              placeholder="Short description shown in blog listing"
              rows={3}
            />
            <SelectInput
              label="Status *"
              options={STATUS_OPTIONS}
              value={status}
              onValueChange={setStatus}
            />

            <div className="grid gap-3">
              <Label className="font-semibold">Publish Date & Time</Label>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.currentTarget.value)}
                  className="border border-green-600 rounded-md h-9 px-3 text-sm w-full md:w-72"
                />
                {publishedAt === "" ? null : (
                  <button
                    type="button"
                    onClick={() => setPublishedAt("")}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-black cursor-pointer"
                  >
                    <X size={14} />
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                A published post with a future date stays hidden from the
                website until that moment, then appears on its own. Leave empty
                to publish immediately.
              </p>
              {isScheduled ? (
                <p className="text-xs font-semibold text-yellow-600">
                  Scheduled — this post goes live on{" "}
                  {new Date(publishedAt).toLocaleString()}.
                </p>
              ) : null}
            </div>
          </Section>

          <Section>
            {/* multiple covers plus YouTube links, first image is the cover */}
            <MediaManager
              title="Cover Images & Videos"
              items={media}
              onChange={setMedia}
              namePrefix="blog-image"
              folder="/blog-assets"
              showAltText
              gridClassName="grid grid-cols-2 md:grid-cols-4 gap-2.5"
            />
            <p className="text-xs text-gray-500">
              The first image is used as the cover in the blog listing and in
              share previews. Video links accept YouTube urls.
            </p>
          </Section>

          <Section>
            <h3 className="font-semibold text-lg">Author</h3>
            <SelectInput
              label="Byline"
              options={[
                { value: NO_AUTHOR, text: "No author" },
                ...blogAuthorData.map((author) => ({
                  value: author.id.toString(),
                  text: author.designation
                    ? `${author.name} — ${author.designation}`
                    : author.name,
                })),
              ]}
              value={authorId}
              onValueChange={setAuthorId}
            />

            {selectedAuthor ? (
              <div className="flex items-start gap-3 rounded-md border border-gray-200 p-3">
                {selectedAuthor.image ? (
                  <img
                    src={selectedAuthor.image}
                    alt={selectedAuthor.name}
                    className="size-12 rounded-full object-cover"
                  />
                ) : null}
                <div className="text-sm">
                  <p className="font-semibold">{selectedAuthor.name}</p>
                  {selectedAuthor.designation ? (
                    <p className="text-gray-600">{selectedAuthor.designation}</p>
                  ) : null}
                  {selectedAuthor.bio ? (
                    <p className="text-gray-500 text-xs mt-1">
                      {selectedAuthor.bio}
                    </p>
                  ) : null}
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    title="Edit author"
                    onClick={() => {
                      setAuthorDraft({
                        id: selectedAuthor.id,
                        name: selectedAuthor.name,
                        designation: selectedAuthor.designation ?? "",
                        bio: selectedAuthor.bio ?? "",
                        image: selectedAuthor.image ?? "",
                        email: selectedAuthor.email ?? "",
                        website_url: selectedAuthor.website_url ?? "",
                      });
                      setShowAuthorForm(true);
                    }}
                  >
                    <Pencil size={16} className="cursor-pointer" />
                  </button>
                  <button
                    type="button"
                    title="Delete author"
                    onClick={() =>
                      handleDeleteAuthor(selectedAuthor.id, selectedAuthor.name)
                    }
                  >
                    <Trash size={16} className="cursor-pointer text-red-500" />
                  </button>
                </div>
              </div>
            ) : null}

            {showAuthorForm ? (
              <div className="space-y-3 rounded-md border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">
                    {authorDraft.id ? "Edit author" : "New author"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorDraft(EMPTY_AUTHOR);
                      setShowAuthorForm(false);
                    }}
                    className="text-sm text-gray-600 hover:text-black cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <LabelInput
                  label="Name *"
                  value={authorDraft.name}
                  maxLength={120}
                  placeholder="Author name"
                  onChange={(e) => updateAuthorDraft("name", e)}
                />
                <LabelInput
                  label="Designation"
                  value={authorDraft.designation}
                  placeholder="e.g. Content Writer"
                  onChange={(e) => updateAuthorDraft("designation", e)}
                />
                <LabelTextArea
                  label="Bio"
                  value={authorDraft.bio}
                  rows={3}
                  placeholder="Short bio shown under the post"
                  onChange={(e) => updateAuthorDraft("bio", e)}
                />
                <FilePicker
                  label="Author Photo"
                  name="author_image"
                  accept="image/*"
                  folder="/blog-assets"
                  fileLink={authorDraft.image || undefined}
                  onUploaded={(file: IUploadedFile | null) =>
                    setAuthorDraft((prev) => ({
                      ...prev,
                      image: file?.url ?? "",
                    }))
                  }
                  onRemoved={() =>
                    setAuthorDraft((prev) => ({ ...prev, image: "" }))
                  }
                />
                <LabelInput
                  label="Email"
                  type="email"
                  value={authorDraft.email}
                  placeholder="author@example.com"
                  onChange={(e) => updateAuthorDraft("email", e)}
                />
                <LabelInput
                  label="Website / Profile Url"
                  value={authorDraft.website_url}
                  placeholder="https://"
                  onChange={(e) => updateAuthorDraft("website_url", e)}
                />

                <ButtonLoading
                  type="button"
                  variant="own"
                  loading={isAuthorMutating}
                  disabled={authorDraft.name.trim() === ""}
                  onClick={handleSaveAuthor}
                >
                  {authorDraft.id ? "Save Author" : "Create Author"}
                </ButtonLoading>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => {
                  setAuthorDraft(EMPTY_AUTHOR);
                  setShowAuthorForm(true);
                }}
              >
                <Plus size={14} />
                Add New Author
              </Button>
            )}
          </Section>

          <Section>
            <Editor
              label="Content *"
              onSave={(data) => {
                editorData.current = data;
              }}
              initData={blog?.content_json ?? undefined}
            />
          </Section>

          <Section>
            <h3 className="font-semibold text-lg">Tags & SEO</h3>
            <LabelInput
              label="Tags"
              name="tags"
              defaultValue={blog?.tags ?? ""}
              placeholder="Comma-separated tags (e.g. fashion, style, trends)"
            />
            <LabelInput
              label="Meta Title"
              name="meta_title"
              defaultValue={blog?.meta_title ?? ""}
              placeholder="SEO page title"
            />
            <LabelTextArea
              label="Meta Description"
              name="meta_description"
              defaultValue={blog?.meta_description ?? ""}
              placeholder="SEO page description"
              rows={3}
            />
            <LabelInput
              label="Canonical Url"
              name="canonical_url"
              defaultValue={blog?.canonical_url ?? ""}
              placeholder="https://example.com/blogs/this-post"
            />
          </Section>

          <Section>
            <h3 className="font-semibold text-lg">
              Social Share (Open Graph & Twitter)
            </h3>
            <p className="text-xs text-gray-500">
              Everything here is optional. Left empty, a share card falls back
              to the meta title, meta description and the cover image above.
            </p>

            <LabelInput
              label="OG Title"
              name="og_title"
              defaultValue={blog?.og_title ?? ""}
              placeholder="Title shown when the post is shared"
            />
            <LabelTextArea
              label="OG Description"
              name="og_description"
              defaultValue={blog?.og_description ?? ""}
              placeholder="Description shown when the post is shared"
              rows={3}
            />
            <FilePicker
              label="OG Image (1200x630 recommended)"
              name="og_image"
              accept="image/*"
              folder="/blog-assets"
              fileLink={blog?.og_image ?? undefined}
              onUploaded={(file: IUploadedFile | null) =>
                setOgImage(file?.url ?? null)
              }
              onRemoved={() => setOgImage(null)}
            />
            <SelectInput
              label="OG Type"
              options={OG_TYPE_OPTIONS}
              value={ogType}
              onValueChange={setOgType}
            />

            <SelectInput
              label="Twitter Card"
              options={TWITTER_CARD_OPTIONS}
              value={twitterCard}
              onValueChange={setTwitterCard}
            />
            <LabelInput
              label="Twitter Title"
              name="twitter_title"
              defaultValue={blog?.twitter_title ?? ""}
              placeholder="Falls back to the OG title"
            />
            <LabelTextArea
              label="Twitter Description"
              name="twitter_description"
              defaultValue={blog?.twitter_description ?? ""}
              placeholder="Falls back to the OG description"
              rows={3}
            />
            <FilePicker
              label="Twitter Image"
              name="twitter_image"
              accept="image/*"
              folder="/blog-assets"
              fileLink={blog?.twitter_image ?? undefined}
              onUploaded={(file: IUploadedFile | null) =>
                setTwitterImage(file?.url ?? null)
              }
              onRemoved={() => setTwitterImage(null)}
            />
          </Section>

          <div className="flex justify-end pb-4">
            <ButtonLoading
              type="submit"
              variant="own"
              loading={isLoading}
              className="min-w-36"
            >
              {isNew ? "Publish Post" : "Save Changes"}
            </ButtonLoading>
          </div>
        </form>
      </LoadingHandler>
    </main>
  );
}
