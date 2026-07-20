"use client";
import React, { useState } from "react";

interface Category {
  id: number;
  name: string;
  slug: string;
  itemCount: number;
  imageUrl: string;
}

interface CategoryImageProps {
  categories?: Category[];
  limit?: number;
}

const Segment: React.FC<CategoryImageProps> = ({
  categories = [
    {
      id: 3,
      name: "Stools",
      slug: "stools",
      itemCount: 4,
      imageUrl: "/segment/h1-bn-1.jpg",
    },
    {
      id: 6,
      name: "Sofas",
      slug: "sofas",
      itemCount: 4,
      imageUrl: "/segment/h1-bn-2.jpg",
    },
  ],
  limit = 5,
}) => {
  const [showAll, setShowAll] = useState(false);
  const displayedCategories = showAll ? categories : categories.slice(0, limit);
  const hasMore = categories.length > limit;

  return (
    <div className="w-full bg-white px-5 py-10">
      <div className="widget-category-image block">
        <div className="block-content">
          <ul className=" grid grid-cols-1 md:grid-cols-2 list-none p-0 m-0 space-y-4  gap-20">
            {displayedCategories.map((category) => (
              <li key={category.id} className={`cate-${category.id}`}>
                <div
                  // href={`/en/${category.id}-${category.slug}`}
                  className="block relative group overflow-hidden rounded-lg"
                >
                  <div className="flex items-center relative ">
                    <div className="absolute inset-0  to-transparent flex items-end p-6">
                      <div className="text-gray-900">
                        <div className="block text-2xl font-semibold mb-1 text-gray-900">
                          {category.name}
                        </div>
                        <div className="text-sm opacity-90">
                          {category.itemCount} <span>items</span>
                        </div>
                      </div>
                    </div>
                    <div className="cover-img flex-shrink-0 w-full overflow-hidden">
                      <img
                        src={category.imageUrl}
                        alt={category.name}
                        className="w-full h-auto object-cover
                         transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Segment;
