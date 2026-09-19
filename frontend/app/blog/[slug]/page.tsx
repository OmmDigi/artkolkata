"use client";
import React, { useState, useEffect, useRef } from "react";

import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlayCircle, ChevronLeft, ChevronRight } from "lucide-react";
import CustomImage from "@/Component1/CustomImage";

const getYoutubeId = (url: string) => {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

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
          <CustomImage
            key={block.id || index}
            src={`${process.env.NEXT_PUBLIC_UPLOAD_API_BASE_URL}${block.data.file?.url}`}
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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["blog", slug],
    queryFn: () => getRequest<any>(`/api/v1/blogs/${slug}`),
    enabled: !!slug,
  });

  const blog = data?.data || data;

  useEffect(() => {
    if (!blog?.media || blog.media.length <= 1) return;

    // Sort media to ensure we are checking the correct current item
    const sortedMedia = [...blog.media].sort(
      (a: any, b: any) => a.position - b.position,
    );
    const currentMedia = sortedMedia[currentSlide];

    // Halt auto-scroll if the current slide is a video AND it's playing, or just halt for all videos
    if (currentMedia?.type === "video" && playingVideoId !== null) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        setPlayingVideoId(null); // Reset playing video on slide change
        return (prev + 1) % blog.media.length;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [currentSlide, blog?.media, playingVideoId]);
  console.log("blog", blog);

  const handleSlideChange = (newIndex: number) => {
    setCurrentSlide(newIndex);
    setPlayingVideoId(null);
  };

  if (isLoading) {
    return (
      <div className=" bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#02F8C5] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError || !blog) {
    return (
      <div className=" bg-white flex flex-col items-center justify-center p-5 text-center">
        <h1 className="text-3xl font-bold text-black mb-4">Blog Not Found</h1>
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
    <article className="bg-white pb-10">
      {/* Hero Section */}
      <div className="w-full bg-gray-50 py-12 px-5 border-b border-gray-100">
        <div className="max-w-9xl mx-auto">
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

          <div className="flex items-center text-gray-500 text-sm mt-8">
            {blog.author?.image && (
              <CustomImage
                src={`${process.env.NEXT_PUBLIC_UPLOAD_API_BASE_URL}${blog.author.image}`}
                alt={blog.author.name}
                className="w-10 h-10 rounded-full object-cover mr-3 border border-gray-200"
              />
            )}
            <div className="flex flex-col">
              <span className="font-bold text-gray-800 text-base">
                {blog.author?.name || blog.author_name}
              </span>
              {blog.author?.designation && (
                <span className="text-xs text-gray-400">
                  {blog.author.designation}
                </span>
              )}
            </div>
            <span className="mx-4 text-gray-300">|</span>
            <span>{blog.published_at_label || blog.created_at}</span>
          </div>
        </div>
      </div>
      {/* Media Carousel */}
      {blog.media && blog.media.length > 0 && (
        <div className="max-w-5xl mx-auto px-5 -mt-8 relative z-10">
          <div className="relative w-full h-[300px] md:h-[400px] overflow-hidden rounded-2xl shadow-xl bg-gray-50">
            {blog.media
              .sort((a: any, b: any) => a.position - b.position)
              .map((item: any, index: number) => (
                <div
                  key={item.id}
                  className={`absolute inset-0 w-full h-full transition-opacity duration-1000 flex items-center justify-center ${
                    item.type === "video" ? "bg-black" : ""
                  } ${
                    index === currentSlide
                      ? "opacity-100 z-10"
                      : "opacity-0 z-0 pointer-events-none"
                  }`}
                >
                  {item.type === "video" ? (
                    playingVideoId === item.id ? (
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${item.image.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]}?autoplay=1`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    ) : (
                      <div
                        className="w-full h-full relative cursor-pointer group"
                        onClick={() => setPlayingVideoId(item.id)}
                      >
                        <CustomImage
                          src={`https://img.youtube.com/vi/${getYoutubeId(item.image)}/maxresdefault.jpg`}
                          alt="Video Thumbnail"
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-2"></div>
                          </div>
                        </div>
                      </div>
                    )
                  ) : (
                    <CustomImage
                      src={`${process.env.NEXT_PUBLIC_UPLOAD_API_BASE_URL}${item.image}`}
                      alt={item.alt_tag || "Blog Media"}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              ))}

            {/* Navigation Arrows */}
            {blog.media.length > 1 && (
              <div className="absolute bottom-4 right-0 px-4 pointer-events-none z-20 flex">
                <button
                  onClick={() =>
                    handleSlideChange(
                      (currentSlide - 1 + blog.media.length) %
                        blog.media.length,
                    )
                  }
                  className="pointer-events-auto bg-black bg-opacity-30 hover:bg-opacity-60 text-white p-3 transition-all duration-300 backdrop-blur-sm mr-1"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={() =>
                    handleSlideChange((currentSlide + 1) % blog.media.length)
                  }
                  className="pointer-events-auto bg-black bg-opacity-30 hover:bg-opacity-60 text-white p-3 transition-all duration-300 backdrop-blur-sm"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              </div>
            )}
          </div>
          {/* Slide Indicators */}
          {blog.media.length > 1 && (
            <div className="absolute mt-2 left-1/2 transform -translate-x-1/2 flex items-center space-x-3 z-20">
              {blog.media
                .sort((a: any, b: any) => a.position - b.position)
                .map((item: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => handleSlideChange(index)}
                    className={`flex items-center justify-center transition-all duration-300 shadow-md ${
                      index === currentSlide
                        ? "bg-red-600 scale-125"
                        : "bg-gray-300 bg-opacity-60 hover:bg-opacity-100"
                    } ${item.type === "video" ? "w-10 h-7 rounded-md" : "w-3 h-3 rounded-full"}`}
                    aria-label={`Go to slide ${index + 1}`}
                  >
                    {item.type === "video" && (
                      <div
                        className={`w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-b-[5px] border-b-transparent ml-0.5 ${index === currentSlide ? "border-l-white" : "border-l-gray-900"}`}
                      />
                    )}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="max-w-3xl mx-auto px-5 mt-16 prose prose-lg prose-gray prose-a:text-[#02F8C5] hover:prose-a:opacity-80">
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

      {/* Author Bio Section */}
      {blog.author && blog.author.bio && (
        <div className="max-w-3xl mx-auto px-5 mt-16 pt-12 border-t border-gray-200">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-gray-50 p-8 rounded-2xl">
            {blog.author.image && (
              <CustomImage
                src={`${process.env.NEXT_PUBLIC_UPLOAD_API_BASE_URL}${blog.author.image}`}
                alt={blog.author.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md flex-shrink-0"
              />
            )}
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {blog.author.name}
              </h3>
              {blog.author.designation && (
                <p className="text-sm font-medium text-[#02F8C5] mb-3 uppercase tracking-wider">
                  {blog.author.designation}
                </p>
              )}
              <p className="text-gray-600 text-base leading-relaxed">
                {blog.author.bio}
              </p>
              {blog.author.website_url && (
                <a
                  href={blog.author.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 text-sm font-bold text-gray-900 hover:text-[#02F8C5] transition-colors"
                >
                  Visit Website &rarr;
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
