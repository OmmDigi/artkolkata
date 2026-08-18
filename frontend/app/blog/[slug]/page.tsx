"use client";

import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const renderEditorJsBlocks = (blocks: any[]) => {
  if (!blocks || !Array.isArray(blocks)) return null;

  return blocks.map((block, index) => {
    switch (block.type) {
      case "header": {
        const level = block.data.level || 2;
        const HeaderTag = `h${level}` as
          | "h1"
          | "h2"
          | "h3"
          | "h4"
          | "h5"
          | "h6";
        return (
          <HeaderTag
            key={block.id || index}
            dangerouslySetInnerHTML={{ __html: block.data.text }}
          />
        );
      }
      case "paragraph":
        return (
          <p
            key={block.id || index}
            dangerouslySetInnerHTML={{ __html: block.data.text }}
          />
        );
      case "list":
        const ListTag = block.data.style === "ordered" ? "ol" : "ul";
        return (
          <ListTag key={block.id || index}>
            {block.data.items.map((item: any, i: number) => (
              <li
                key={i}
                dangerouslySetInnerHTML={{
                  __html: typeof item === "string" ? item : item.content,
                }}
              />
            ))}
          </ListTag>
        );
      case "image":
        return (
          <img
            key={block.id || index}
            src={block.data.file?.url}
            alt={block.data.caption || "Image"}
            className="w-full h-auto rounded-lg my-4"
          />
        );
      default:
        console.warn("Unknown block type", block.type);
        return null;
    }
  });
};

export default function SingleBlogPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["blog", slug],
    queryFn: () => getRequest<any>(`/api/v1/blogs/${slug}`),
    enabled: !!slug,
  });

  const blog = data?.data || data; // Assuming API might wrap response in data or just return the object

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#02F8C5] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError || !blog) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-5 text-center">
        <h1 className="text-3xl font-bold mb-4">Blog Not Found</h1>
        <p className="text-gray-600 mb-8">
          The blog post you're looking for doesn't exist or has been removed.
        </p>
        <button
          onClick={() => router.push("/blog")}
          className="bg-[#02F8C5] text-black rounded-full px-8 py-3 font-medium transition-all duration-300 hover:opacity-90"
        >
          Back to Blogs
        </button>
      </div>
    );
  }

  return (
    <article className="min-h-screen bg-white pb-20">
      {/* Hero Section */}
      <div className="w-full bg-gray-50 py-12 px-5 border-b border-gray-100">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/blog"
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-black transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to all blogs
          </Link>

          <div className="text-sm text-[#02F8C5] font-semibold tracking-wider uppercase mb-4">
            {blog.tags || "Blog Post"}
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
            {blog.title}
          </h1>

          <div className="flex items-center text-gray-500 text-sm">
            <span>{blog.created_at}</span>
            {blog.author_name && (
              <>
                <span className="mx-3">•</span>
                <span>By {blog.author_name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cover Image */}
      {blog.cover_image && (
        <div className="max-w-5xl mx-auto px-5 -mt-8 relative z-10">
          <div className="rounded-2xl overflow-hidden shadow-xl aspect-video bg-gray-200">
            <img
              src={blog.cover_image}
              alt={blog.cover_image_alt || blog.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-3xl mx-auto px-5 mt-16 prose prose-lg prose-gray prose-a:text-[#02F8C5] hover:prose-a:opacity-80">
        {/* Render EditorJS content JSON if available, fallback to content html or excerpt */}
        {blog.content_json?.blocks ? (
          <div className="editorjs-content text-gray-700">
            {renderEditorJsBlocks(blog.content_json.blocks)}
          </div>
        ) : blog.content ? (
          <div dangerouslySetInnerHTML={{ __html: blog.content }} />
        ) : (
          <p className="text-gray-600 text-xl leading-relaxed">
            {blog.excerpt ||
              "Detailed content for this blog post is coming soon."}
          </p>
        )}
      </div>
    </article>
  );
}
