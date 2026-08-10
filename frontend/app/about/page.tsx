"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Globe, Settings, Shield } from "lucide-react";
import Image from "next/image";

function AnimatedCounter({
  end,
  duration = 2000,
  suffix = "",
}: {
  end: number;
  duration?: number;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // ease out quad
      const easeOut = progress * (2 - progress);
      setCount(Math.floor(easeOut * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [isVisible, end, duration]);

  return (
    <div ref={ref} className="text-5xl font-bold mb-2">
      {count}
      {suffix}
    </div>
  );
}

export default function AboutPage() {
  const team = [
    {
      name: "Mr. Sujon Sarkar",
      role: "Director",
      description:
        "Mr. Sujon Sarkar leads Art Kolkata with a vision focused on quality, innovation, customer satisfaction, and long-term growth. His focus on product quality, business development, and customer trust continues to guide the company toward new opportunities.",
      image: "/about/Director.png",
    },
    {
      name: "Mrs. Megha Sarkar",
      role: "Manager",
      description:
        "Mrs. Megha Sarkar plays an important role in the day-to-day management and smooth operation of Art Kolkata. Her dedication to organization and customer service helps ensure customers receive a professional experience.",
      image: "/about/Manager.png",
    },
    {
      name: "Mr. Kajal Das",
      role: "Social Media Manager",
      description:
        "Mr. Kajal Das manages Art Kolkata's social media presence and digital communication. He helps showcase our products, designs, projects, craftsmanship, and latest updates to customers worldwide.",
      image: "/about/Social Media Manager.png",
    },
  ];

  const values = [
    {
      icon: CheckCircle,
      title: "Quality Craftsmanship",
      description:
        "We are committed to delivering exceptional quality in every product we manufacture. Premium materials, modern techniques, and skilled craftsmanship help us create products with durability, precision, and beautiful finishes.",
    },
    {
      icon: Settings,
      title: "Innovation & Customization",
      description:
        "With 300+ products, we continuously develop new and elegant designs. We also provide customized moulds and architectural solutions according to individual customer and project requirements.",
    },
    {
      icon: Shield,
      title: "Customer Satisfaction",
      description:
        "Our customers are at the center of our business. We believe in clear communication, reliable service, quality products, and professional support throughout the customer journey.",
    },
    {
      icon: Globe,
      title: "Global Delivery",
      description:
        "We proudly serve customers across India and worldwide through trusted and legitimate courier and logistics services. Our goal is to make our products accessible to customers wherever they are.",
    },
  ];

  const productsList = [
    "POP Moulds",
    "RCC Moulds",
    "FRP Moulds",
    "GRC Moulds",
    "Decorative Wall Panels",
    "Wall Cladding",
    "Decorative Columns & Pillars",
    "Cornices & Ceiling Designs",
    "Temple Decorative Elements",
    "Sculptures & Statues",
    "Garden Ornaments",
    "Architectural Decorations",
    "Customized Moulds",
    "Custom Architectural Products",
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero / About Art Kolkata */}
      <section className="py-10 md:py-20 px-5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-bold text-black mb-4">
              About Art Kolkata
            </h1>
            <p className="text-xl text-gray-500 font-medium mb-6">
              Creating Beautiful Spaces Since 2015
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              Welcome to Art Kolkata, a trusted manufacturer and supplier of
              premium decorative moulds and architectural products. Established
              in 2015, we began with a simple vision—to bring creativity,
              quality, and craftsmanship together to create beautiful products
              that transform spaces.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              Over the years, Art Kolkata has grown into a recognized name in
              the decorative and architectural industry, with a collection of
              300+ premium products and customers across India and around the
              world.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Our products are designed for residential, commercial,
              hospitality, religious, landscaping, and architectural projects.
              From elegant home interiors to magnificent temples, hotels,
              gardens, commercial buildings, and landmark projects, our products
              are created to add beauty, character, and lasting value to every
              space.
            </p>
          </div>
          <div className="relative h-96 md:h-full min-h-[400px] rounded-2xl overflow-hidden shadow-xl">
            <img
              src="/about/office.png"
              alt="Art Kolkata Office"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Our Journey */}
      <section className="py-10 md:py-20 px-5 bg-gray-50">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="relative h-96 md:h-full min-h-[400px] rounded-2xl overflow-hidden order-last md:order-first shadow-xl">
            <img
              src="/about/Factory final.png"
              alt="Art Kolkata Factory"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-3xl md:text-5xl font-bold text-black mb-6">
              Our Journey
            </h2>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              Since our beginning in 2015, our journey has been driven by
              continuous innovation, skilled craftsmanship, customer
              satisfaction, and a commitment to quality.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              What started as a vision to create premium decorative products has
              grown into a diverse collection of 300+ products serving
              homeowners, architects, interior designers, builders, contractors,
              hotels, resorts, temples, commercial projects, and landscape
              developers.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              Our growth has been built on the trust of our customers and our
              commitment to delivering products that combine design, durability,
              precision, and value.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Today, Art Kolkata continues to expand its product range, improve
              its manufacturing capabilities, and reach customers not only
              across India but also internationally.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-10 md:py-16 px-5 bg-black text-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Art Kolkata Today
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <AnimatedCounter end={2015} />
              <p className="text-gray-400 text-lg">Established</p>
            </div>
            <div>
              <AnimatedCounter end={300} suffix="+" />
              <p className="text-gray-400 text-lg">Premium Products</p>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2 text-[#02F8C5]">
                India
              </div>
              <p className="text-gray-400 text-lg">Service Area</p>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2 text-[#02F8C5]">
                Global
              </div>
              <p className="text-gray-400 text-lg">Worldwide Delivery</p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values Section */}
      <section className="py-10 md:py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-black mb-6">
              Our Values
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              These principles guide everything we do
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div
                  key={index}
                  className="bg-gray-50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300"
                >
                  <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-6">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-black mb-4">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-10 md:py-20 px-5 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-black mb-6">
              Meet Our Team
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              The People Behind Art Kolkata
            </p>
            <p className="text-gray-500 mt-4 max-w-3xl mx-auto">
              Behind every product is a dedicated team working together to
              maintain our standards of quality, service, innovation, and
              customer satisfaction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {team.map((member, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group"
              >
                <div className="relative h-80 overflow-hidden bg-gradient-to-b from-gray-100 to-gray-200 flex justify-center items-end pt-4">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-auto h-[95%] object-cover group-hover:scale-105 transition-transform duration-500 drop-shadow-xl"
                  />
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-black mb-1">
                    {member.name}
                  </h3>
                  <p className="text-[#02F8C5] font-semibold text-lg mb-4">
                    {member.role}
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {member.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products List & Why Choose */}
      <section className="py-10 md:py-20 px-5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-black mb-6">
              Our Products
            </h2>
            <p className="text-lg text-gray-700 mb-6">
              We offer an extensive range of decorative and architectural
              products, including:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {productsList.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-black"></div>
                  <span className="text-gray-800 font-medium">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-700 mt-6 italic">
              With 300+ designs, our collection offers solutions for a wide
              variety of styles, spaces, and project requirements.
            </p>

            <div className="mt-10">
              <h3 className="text-2xl font-bold text-black mb-4">
                Quality, Craftsmanship, Innovation & Customization
              </h3>
              <p className="text-gray-700 mb-4">
                At Art Kolkata, quality is at the heart of everything we do.
                Every product is manufactured with careful attention to detail
                using quality materials, modern production techniques, and
                experienced craftsmanship.
              </p>
              <p className="text-gray-700">
                Every project is different, and sometimes a standard design is
                not enough. That's why Art Kolkata also provides custom
                manufacturing solutions to turn concepts into practical,
                beautifully crafted products.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-black mb-6">
              Why Choose Art Kolkata?
            </h2>
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-xl">
                <h4 className="text-xl font-bold text-black mb-2">
                  Established Since 2015
                </h4>
                <p className="text-gray-600">
                  More than a decade of experience in decorative and
                  architectural products.
                </p>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl">
                <h4 className="text-xl font-bold text-black mb-2">
                  300+ Products & Custom Solutions
                </h4>
                <p className="text-gray-600">
                  A growing collection of more than 300 designs, plus customized
                  moulds and architectural products based on project
                  requirements.
                </p>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl">
                <h4 className="text-xl font-bold text-black mb-2">
                  Quality Manufacturing
                </h4>
                <p className="text-gray-600">
                  Careful craftsmanship, quality materials, and attention to
                  detail for a wide range of applications.
                </p>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl">
                <h4 className="text-xl font-bold text-black mb-2">
                  Fast Delivery & Worldwide Shipping
                </h4>
                <p className="text-gray-600">
                  Reliable delivery services across India (approx. 1 week), and
                  international shipping through trusted logistics partners.
                </p>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl">
                <h4 className="text-xl font-bold text-black mb-2">
                  Professional Service
                </h4>
                <p className="text-gray-600">
                  Dedicated management and customer support throughout the
                  ordering process.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-10 md:py-20 px-5 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="bg-gray-800 p-10 rounded-3xl">
            <h3 className="text-3xl font-bold mb-4 text-[#02F8C5]">
              Our Mission
            </h3>
            <p className="text-gray-300 leading-relaxed text-lg">
              Our mission is to manufacture and supply premium decorative and
              architectural products that combine creativity, quality,
              durability, and affordability. We aim to provide our customers
              with beautiful products, dependable service, customized solutions,
              and reliable delivery while continuously improving our designs and
              manufacturing capabilities.
            </p>
          </div>
          <div className="bg-gray-800 p-10 rounded-3xl">
            <h3 className="text-3xl font-bold mb-4 text-[#02F8C5]">
              Our Vision
            </h3>
            <p className="text-gray-300 leading-relaxed text-lg">
              Our vision is to become a globally recognized brand in decorative
              moulds and architectural products, known for exceptional
              craftsmanship, innovative designs, reliable service, and customer
              satisfaction. We aspire to take the creativity and craftsmanship
              of Art Kolkata to customers across India and around the world.
            </p>
          </div>
        </div>
      </section>

      {/* Commitment / CTA Section */}
      <section className="py-16 md:py-24 px-5 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
            Our Commitment
          </h2>
          <p className="text-xl text-gray-700 mb-8 leading-relaxed">
            At Art Kolkata, we believe that every space deserves timeless
            beauty. Whether you are building a home, designing a commercial
            property, creating a temple, developing a hotel or resort,
            decorating a garden, or working on a large architectural project, we
            are committed to helping you bring your vision to life.
          </p>
          <p className="text-xl text-gray-700 mb-12 leading-relaxed font-semibold">
            We don't simply manufacture decorative products—we help create
            spaces that people remember. From our hands to your space, we bring
            art to architecture.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/product"
              className="group inline-flex items-center justify-center gap-2 bg-[#02F8C5] hover:bg-gray-800 hover:text-white text-black rounded-full px-10 py-4 font-medium transition-all duration-300"
            >
              Explore Products
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/contact"
              className="group inline-flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-black rounded-full px-10 py-4 font-medium transition-all duration-300"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
