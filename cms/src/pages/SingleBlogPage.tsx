import Editor from "@/components/Editor";
import FilePicker from "@/components/FilePicker";
import LabelInput from "@/components/LabelInput";
import LabelTextArea from "@/components/LabelTextArea";
import Section from "@/components/Section";
import SelectInput from "@/components/SelectInput";
import { ButtonLoading } from "@/components/ui/button-loading";
import { useDoMutation } from "@/hooks/useDoMutation";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IBlog, IError, IResponse, IUploadedFile } from "@/types";
import { api } from "@/utils/api";
import { createSlug } from "@/utils/createSlug";
import type { OutputData } from "@editorjs/editorjs";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { MoveLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

const getSingleBlog = async (id: string) => {
  return (await api.get(`/api/v1/blogs/${id}`)).data;
};

const STATUS_OPTIONS = [
  { value: "draft", text: "Draft" },
  { value: "published", text: "Published" },
];

export default function SingleBlogPage() {
  const params = useParams();
  const navigate = useNavigate();
  const isNew = params?.id === "new";

  const editorData = useRef<OutputData | undefined>(undefined);
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [coverImage, setCoverImage] = useState<string | null>(null);

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
      setCoverImage(blog.cover_image ?? null);
      editorData.current = blog.content_json ?? undefined;
    }
  }, [isFetching]);

  const { isLoading, mutate } = useDoMutation();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!editorData.current || !editorData.current.blocks?.length) {
      alert("Blog content cannot be empty.");
      return;
    }

    const formEl = e.currentTarget;
    const title = (formEl.elements.namedItem("title") as HTMLInputElement)
      .value;
    const excerpt = (
      formEl.elements.namedItem("excerpt") as HTMLTextAreaElement
    ).value;
    const meta_title = (
      formEl.elements.namedItem("meta_title") as HTMLInputElement
    ).value;
    const meta_description = (
      formEl.elements.namedItem("meta_description") as HTMLTextAreaElement
    ).value;
    const tags = (formEl.elements.namedItem("tags") as HTMLInputElement).value;
    const cover_image_alt = (
      formEl.elements.namedItem("cover_image_alt") as HTMLInputElement
    ).value;

    const payload = {
      title,
      slug,
      excerpt: excerpt || null,
      content_json: editorData.current,
      cover_image: coverImage || null,
      cover_image_alt: cover_image_alt || null,
      tags: tags || null,
      status,
      meta_title: meta_title || null,
      meta_description: meta_description || null,
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
          </Section>

          <Section>
            <h3 className="font-semibold text-lg">Cover Image</h3>
            <FilePicker
              label="Cover Image"
              name="cover_image"
              accept="image/*"
              folder="/blog-assets"
              fileLink={blog?.cover_image ?? undefined}
              onUploaded={(file: IUploadedFile | null) => {
                setCoverImage(file?.url ?? null);
              }}
              onRemoved={() => setCoverImage(null)}
            />
            <LabelInput
              label="Cover Image Alt Text"
              name="cover_image_alt"
              defaultValue={blog?.cover_image_alt ?? ""}
              placeholder="Describe the image for accessibility"
            />
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
