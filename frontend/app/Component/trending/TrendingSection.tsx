"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "./ProductCard";
import { getRequest } from "@/lib/fetcher";
const TrendingSection = () => {
  // const products = [
  //   {
  //     id: 1,
  //     name: "Teapot",
  //     price: "$23.90",
  //     image:
  //       "https://apollotran.b-cdn.net/demo/at_auros/24-home_default/hummingbird-printed-t-shirt.jpg",
  //     hoverImage:
  //       "https://apollotran.b-cdn.net/demo/at_auros/29-home_default/brown-bear-printed-sweater.jpg",
  //     colors: ["#ffffff", "#434A54"],
  //   },
  //   {
  //     id: 2,
  //     name: "Miro Dining Table",
  //     price: "$35.90",
  //     image:
  //       "https://apollotran.b-cdn.net/demo/at_auros/35-home_default/the-best-is-yet-to-come-framed-poster.jpg",
  //     hoverImage:
  //       "https://apollotran.b-cdn.net/demo/at_auros/36-home_default/the-adventure-begins-framed-poster.jpg",
  //   },
  //   {
  //     id: 3,
  //     name: "Janus Table Lamp",
  //     price: "$29.00",
  //     image:
  //       "https://apollotran.b-cdn.net/demo/at_auros/24-home_default/hummingbird-printed-t-shirt.jpg",
  //     hoverImage:
  //       "https://apollotran.b-cdn.net/demo/at_auros/36-home_default/the-adventure-begins-framed-poster.jpg",
  //   },
  //   {
  //     id: 4,
  //     name: "Discus Floor And Table",
  //     price: "$29.00",
  //     image:
  //       "https://apollotran.b-cdn.net/demo/at_auros/38-home_default/today-is-a-good-day-framed-poster.jpg",
  //     hoverImage:
  //       "https://apollotran.b-cdn.net/demo/at_auros/43-home_default/mug-the-best-is-yet-to-come.jpg",
  //   },
  // ];

  const {
    isLoading,
    isError,
    data: products,
    error,
    refetch,
  } = useQuery({
    queryKey: ["all-products"],
    queryFn: () => getRequest(`/api/v1/products`),
  });

  return (
    <section className="px-1 md:px-4 lg:px-6 py-12 bg-white text-gray-800">
      <div className="max-w-screen-xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-20">
          <h2 className="text-2xl md:text-4xl font-semibold">
            Trending This Week
          </h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
            Find a bright ideal to suit your taste with our great selection of
            suspension, wall, floor and table lights.
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-16">
          {(products as any)?.data
            ?.slice(0, 4)
            ?.map((item: any, index: number) => (
              <div key={index}>
                <ProductCard
                  product={item}
                  ids={item?.id}
                  image={item?.images?.[0]?.image}
                  hoverImage={item?.images?.[1]?.image}
                  colors={item?.colors}
                  name={item?.name}
                  price={item?.price}
                  slug={item?.slug}
                />
              </div>
            ))}
        </div>
      </div>

      {/* See All Products */}
      <div className="mt-10 flex justify-center">
        <button className="group relative text-sm md:text-base font-semibold text-gray-900 transition-transform duration-300 hover:scale-105">
          +See All Products
          {/* Underline */}
          <span
            className="
        absolute
        left-0
        -bottom-1
        w-full
        h-[3px]
        bg-[#f2d2c5]
        transition-all
        duration-300
        group-hover:h-[5px]
      "
          ></span>
        </button>
      </div>
    </section>
  );
};

export default TrendingSection;
