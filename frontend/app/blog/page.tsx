"use client";

import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Empty State */}
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
            We're working on some amazing content to share with you. Check back
            soon for style guides, fashion tips, and lifestyle insights.
          </p>

          <p className="text-lg text-gray-500 mb-12">
            In the meantime, explore our collections and discover your next
            favorite piece.
          </p>

          <Link
            href="/"
            className="group inline-flex items-center justify-center gap-3 bg-black hover:bg-gray-900 text-white rounded-full px-10 py-4 font-medium transition-all duration-300"
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
