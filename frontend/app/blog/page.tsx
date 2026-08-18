"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";

export default function BlogPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["blogs"],
    queryFn: () => getRequest<any>("/api/v1/blogs?page=1"),
  });

  const blogs = data?.data || [];
  const blogList = Array.isArray(data) ? data : data?.data || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#02F8C5] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError || blogList.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <section className="py-5 md:py-10 px-5">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
              </div>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
              No Blogs Yet
            </h2>

            <p className="text-xl text-gray-600 mb-4 leading-relaxed">
              We're working on some amazing content to share with you. Check
              back soon.
            </p>

            <Link
              href="/"
              className="group inline-flex items-center justify-center gap-3 hover:bg-[#02F8C5] bg-[#02F8C5] text-black rounded-full px-10 py-4 font-medium transition-all duration-300"
            >
              <Home className="w-5 h-5" />
              Go to Home Page
              <span className="group-hover:translate-x-1 transition-transform">
                →
              </span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-5">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-700 text-center mb-12">
          Our Latest Blogs
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogList.map((blog: any) => (
            <Link
              href={`/blog/${blog.slug}`}
              key={blog.id}
              className="group flex flex-col rounded-2xl overflow-hidden bg-gray-50 hover:shadow-xl transition-all duration-300 border border-gray-100"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-200">
                <img
                  src={blog.cover_image || "/placeholder-image.jpg"}
                  alt={blog.title}
                  className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="text-sm text-gray-500 mb-3 font-medium">
                  {blog.created_at}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-pink-600 transition-colors">
                  {blog.title}
                </h3>
                <p className="text-gray-600 line-clamp-3 text-sm leading-relaxed mb-6 flex-1">
                  {blog.excerpt ||
                    "Read more about this topic in our detailed blog post."}
                </p>

                <div className="mt-auto flex items-center text-black font-semibold text-sm">
                  Read Article
                  <span className="ml-2 group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
