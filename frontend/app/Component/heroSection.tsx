"use client";
import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const HeroSlideshow = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const slides = [
    {
      image: "/hero/h1-slide1.jpg",
      category: "lighting",
      year: "2019",
      title: "Etna",
      price: "6500.00",
      link: "#",
    },
    {
      image: "/hero/h1-slide2.jpg",
      category: "lighting",
      year: "2019",
      title: "Etna",
      price: "6500.00",
      link: "#",
    },
    {
      image: "/hero/h1-slide3.jpg",
      category: "lighting",
      year: "2019",
      title: "Etna",
      price: "6500.00",
      link: "#",
    },
  ];

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [isPlaying, slides.length]);

  const goToSlide = (index: any) => {
    setCurrentSlide(index);
  };

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  return (
    <div className="relative w-full h-screen min-h-[430px] overflow-hidden bg-white px-5">
      <div className="relative w-full h-full">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${
              index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            {/* Background Image */}
            <Image
              src={slide.image}
              alt={slide.title}
              fill
              priority={index === 0}
              className="object-cover"
            />
            <div className=" inset-0 bg-black bg-opacity-30"></div>

            {/* Content */}
            <div
              className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                index === currentSlide
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-100"
              }`}
            >
              <div className="relative z-10 h-full flex items-center">
                <div className="container mx-auto px-4">
                  <div className="max-w-7xl mx-auto pl-8 md:pl-36">
                    <div className="text-black space-y-4 md:space-y-6">
                      <div className="flex gap-5">
                        <div className="border-l-1 h-10"></div>
                        <div className="text-sm md:text-base font-light tracking-widest uppercase opacity-90">
                          {slide.category}
                          <br />
                          {slide.year}
                        </div>
                      </div>

                      <h2
                        className="text-4xl md:text-5xl lg:text-7xl font-bold leading-none
                      uppercase tracking-widest"
                      >
                        {slide.title}
                      </h2>

                      <div className="text-base md:text-xl font-light">
                        <span className="text-gray-900 opacity-80">From</span>{" "}
                        <span className="font-semibold text-gray-900">
                          ₹{slide.price}
                        </span>
                      </div>

                      <div className="pt-2 md:pt-4">
                        <Link
                          href={`/product`}
                          className="inline-block bg-white text-gray-900 px-8 py-3.5 font-semibold text-sm uppercase tracking-wider hover:bg-gray-100 transition-all duration-300 shadow-lg"
                        >
                          Shop Now
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <div className="absolute bottom-6 md:bottom-8 right-0 px-4 md:px-8 pointer-events-none z-20">
        <button
          onClick={goToPrevious}
          className="pointer-events-auto bg-white bg-opacity-10 hover:bg-opacity-30 text-white p-5  transition-all duration-300 opacity-60 hover:opacity-100 backdrop-blur-sm"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-gray-800" />
        </button>
        <button
          onClick={goToNext}
          className="pointer-events-auto bg-white bg-opacity-10 hover:bg-opacity-30 text-white p-5  transition-all duration-300 opacity-60 hover:opacity-100 backdrop-blur-sm"
          aria-label="Next slide"
        >
          <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-gray-800" />
        </button>
      </div>

      {/* Slide Indicators */}
      {/* <div className="absolute bottom-6 md:bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-3 z-20">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? "bg-white w-10"
                : "bg-white bg-opacity-40 hover:bg-opacity-70 w-2"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div> */}

      {/* Play/Pause Button */}
      {/* <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="absolute top-4 md:top-6 right-4 md:right-6 bg-black bg-opacity-40 hover:bg-opacity-60 text-white px-4 py-2 rounded text-xs font-medium transition-all duration-300 z-20 backdrop-blur-sm"
      >
        {isPlaying ? "Pause" : "Play"}
      </button> */}
    </div>
  );
};

export default HeroSlideshow;
