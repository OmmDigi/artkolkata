"use client";
import React, { FC } from "react";
import { Star, Quote } from "lucide-react";

interface Testimonial {
  id: number;
  content: string;
  name: string;
  role: string;
  image?: string;
  rating?: number;
}

interface TestimonialProps {
  testimonials?: Testimonial[];
  backgroundColor?: string;
  variant?: "single" | "carousel" | "grid";
}

const TestimonialComponent: FC<TestimonialProps> = ({
  testimonials = [
    {
      id: 1,
      content: "Very good Design. Flexible. Fast Support.",
      name: "Steve John",
      role: "customer",
      rating: 5,
    },
  ],
  backgroundColor = "#ffd8d4",
  variant = "single",
}) => {
  const renderStars = (rating: number): React.ReactNode => {
    return (
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={16}
            className={
              i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }
          />
        ))}
      </div>
    );
  };

  const SingleTestimonial: FC<{ testimonial: Testimonial }> = ({
    testimonial,
  }) => (
    <div
      className="w-full py-16 px-8 rounded-lg flex items-center justify-center"
      style={{ backgroundColor }}
    >
      <div className="max-w-3xl w-full">
        {/* Quote Icon */}
        <div className="mb-6">
          <Quote size={40} className="text-white opacity-70" />
        </div>

        {/* Content */}
        <p className="text-2xl md:text-3xl font-semibold text-gray-800 mb-8 leading-relaxed">
          "{testimonial.content}"
        </p>

        {/* Rating */}
        {testimonial.rating && (
          <div className="mb-6">{renderStars(testimonial.rating)}</div>
        )}

        {/* Details */}
        <div className="flex items-center gap-4">
          {testimonial.image && (
            <img
              src={testimonial.image}
              alt={testimonial.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          )}
          <div>
            <div className="font-bold text-gray-900">{testimonial.name}</div>
            <div className="text-sm text-gray-600">({testimonial.role})</div>
          </div>
        </div>
      </div>
    </div>
  );

  const CarouselTestimonial: FC<{ testimonials: Testimonial[] }> = ({
    testimonials,
  }) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const currentTestimonial = testimonials[currentIndex];

    const handleNext = (): void => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    };

    const handlePrev = (): void => {
      setCurrentIndex((prev) =>
        prev === 0 ? testimonials.length - 1 : prev - 1
      );
    };

    return (
      <div className="w-full py-16 px-8 rounded-lg" style={{ backgroundColor }}>
        <div className="max-w-3xl mx-auto">
          {/* Quote Icon */}
          <div className="mb-6">
            <Quote size={40} className="text-white opacity-70" />
          </div>

          {/* Content */}
          <p className="text-2xl md:text-3xl font-semibold text-gray-800 mb-8 leading-relaxed min-h-24">
            "{currentTestimonial.content}"
          </p>

          {/* Rating */}
          {currentTestimonial.rating && (
            <div className="mb-6">{renderStars(currentTestimonial.rating)}</div>
          )}

          {/* Details */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              {currentTestimonial.image && (
                <img
                  src={currentTestimonial.image}
                  alt={currentTestimonial.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div>
                <div className="font-bold text-gray-900">
                  {currentTestimonial.name}
                </div>
                <div className="text-sm text-gray-600">
                  ({currentTestimonial.role})
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors"
              aria-label="Previous testimonial"
            >
              ← Previous
            </button>

            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentIndex ? "bg-gray-800 w-8" : "bg-gray-400"
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors"
              aria-label="Next testimonial"
            >
              Next →
            </button>
          </div>

          <div className="text-center mt-4 text-sm text-gray-600">
            {currentIndex + 1} / {testimonials.length}
          </div>
        </div>
      </div>
    );
  };

  const GridTestimonial: FC<{ testimonials: Testimonial[] }> = ({
    testimonials,
  }) => (
    <div className="w-full py-16 px-8 rounded-lg" style={{ backgroundColor }}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
          What Our Customers Say
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow"
            >
              {/* Quote Icon */}
              <Quote size={32} className="text-gray-400 mb-4" />

              {/* Content */}
              <p className="text-gray-700 mb-6 line-clamp-4">
                "{testimonial.content}"
              </p>

              {/* Rating */}
              {testimonial.rating && (
                <div className="mb-6">{renderStars(testimonial.rating)}</div>
              )}

              {/* Details */}
              <div className="flex items-center gap-3 pt-6 border-t">
                {testimonial.image && (
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <div>
                  <div className="font-semibold text-gray-900">
                    {testimonial.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {variant === "single" && (
        <SingleTestimonial testimonial={testimonials[0]} />
      )}
      {variant === "carousel" && (
        <CarouselTestimonial testimonials={testimonials} />
      )}
      {variant === "grid" && <GridTestimonial testimonials={testimonials} />}
    </div>
  );
};

// Demo Component
const CustomerReview: FC = () => {
  const sampleTestimonials: Testimonial[] = [
    {
      id: 1,
      content: "Very good Design. Flexible. Fast Support.",
      name: "Steve John",
      role: "customer",
      rating: 5,
    },
    {
      id: 2,
      content:
        "Excellent quality and amazing customer service. Highly recommended!",
      name: "Sarah Mitchell",
      role: "customer",
      rating: 5,
    },
    {
      id: 3,
      content: "The best experience I have had. Professional and reliable.",
      name: "Michael Chen",
      role: "customer",
      rating: 5,
    },
    {
      id: 4,
      content:
        "Outstanding products and outstanding support team. Worth every penny!",
      name: "Emma Davis",
      role: "customer",
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4 space-y-16">
        {/* Single Testimonial */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Single Testimonial
          </h2>
          <TestimonialComponent
            testimonials={[sampleTestimonials[0]]}
            backgroundColor="#ffd8d4"
            variant="single"
          />
        </div>

        {/* Carousel Testimonial */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Carousel Testimonial
          </h2>
          <TestimonialComponent
            testimonials={sampleTestimonials}
            backgroundColor="#e8f4f8"
            variant="carousel"
          />
        </div>

        {/* Grid Testimonial */}
        {/* <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Grid Testimonial
          </h2>
          <TestimonialComponent
            testimonials={sampleTestimonials}
            backgroundColor="#f0f0f0"
            variant="grid"
          />
        </div> */}
      </div>
    </div>
  );
};

export default CustomerReview;
