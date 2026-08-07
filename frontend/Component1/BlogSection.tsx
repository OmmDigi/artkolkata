"use client";

import Link from "next/link";
import { Clock, Calendar, ChevronRight } from "lucide-react";

export default function BlogSection() {
  const blogPosts = [
    {
      id: 1,
      title: "How to master the art of minimal street style",
      description:
        "Build a timeless, comfortable wardrobe with high-quality fabrics, muted tones, and effortless oversized fits.",
      tag: "Style Guide",
      image:
        "https://framerusercontent.com/images/UVxenUklVk5C5hRgP2zTRqEdMPk.jpg",
      readTime: "8 min read",
      date: "Jan 29, 2026",
      featured: true,
      href: "/blog/how-to-master-the-art-of-minimal-street-style",
    },
    {
      id: 2,
      title: "Elevate everyday outfits using modern minimalist styling",
      tag: "Fashion Tips",
      image:
        "https://framerusercontent.com/images/UdKyQkva2vLQZ0vNuYpmKAdtzw.png",
      readTime: "8 min read",
      date: "12/30/25",
      featured: false,
      href: "/blog/elevate-everyday-outfits-using-modern-minimalist-styling",
    },
    {
      id: 3,
      title: "Build a capsule wardrobe that works year round",
      tag: "Style Guide",
      image:
        "https://framerusercontent.com/images/v4WTQ9WoN7RxeC3vNiZP9SvQcQ.png",
      readTime: "5 min read",
      date: "11/22/25",
      featured: false,
      href: "/blog/build-a-capsule-wardrobe-that-works-year-round",
    },
  ];

  return (
    <section className="py-2 md:py-2 px-5 md:px-10 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
          <div className="flex-1">
            <div className="inline-flex items-center gap-3 mb-6 bg-black rounded-full px-6 py-3">
              <span className="text-white text-sm font-medium">
                Wearix Voice
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black">
              Elevating your daily style journey
            </h2>
          </div>

          <Link
            href="/blog"
            className="group inline-flex items-center justify-center gap-2 bg-black hover:bg-[#02F8C5] text-black rounded-full px-8 py-4 font-medium transition-all duration-300 shrink-0"
          >
            Read all blogs
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Blog Grid */}
        <div className="space-y-8">
          {/* Featured Post - Full Width */}
          <Link
            href={blogPosts[0].href}
            className="group block overflow-hidden rounded-2xl bg-white hover:shadow-2xl transition-all duration-300"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div className="relative h-96 md:h-100 overflow-hidden bg-gray-200 order-2 md:order-1">
                <img
                  src={blogPosts[0].image}
                  alt={blogPosts[0].title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              <div className="bg-gray-100 p-8 md:p-12 flex flex-col justify-center order-1 md:order-2">
                <div className="inline-block bg-white rounded-full px-4 py-2 mb-6 w-fit">
                  <span className="text-xs font-semibold text-black uppercase tracking-wide">
                    {blogPosts[0].tag}
                  </span>
                </div>

                <h3 className="text-2xl md:text-3xl font-bold text-black mb-4 group-hover:text-gray-700 transition-colors leading-tight">
                  {blogPosts[0].title}
                </h3>

                <p className="text-base text-gray-600 mb-8 leading-relaxed">
                  {blogPosts[0].description}
                </p>

                <div className="flex items-center gap-4 text-sm text-black font-medium border-t border-gray-300 pt-6">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {blogPosts[0].readTime}
                  </div>
                  <div className="w-1 h-1 rounded-full bg-gray-400" />
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {blogPosts[0].date}
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Other Posts - 2 Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {blogPosts.slice(1).map((post) => (
              <Link
                key={post.id}
                href={post.href}
                className="group flex  rounded-2xl overflow-hidden bg-gray-100 hover:shadow-xl transition-all duration-300"
              >
                <div className="relative w-50 h-80 overflow-hidden bg-gray-300">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                <div className="p-6 md:p-8 flex flex-col justify-between flex-1">
                  <div>
                    <div className="inline-block bg-white rounded-full px-4 py-2 mb-4">
                      <span className="text-xs font-semibold text-black uppercase tracking-wide">
                        {post.tag}
                      </span>
                    </div>

                    <h3 className="text-lg md:text-xl font-bold text-black mb-2 group-hover:text-gray-700 transition-colors">
                      {post.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-700 font-medium pt-4 border-t border-gray-300">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {post.readTime}
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-400" />
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {post.date}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
