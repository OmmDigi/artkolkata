"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Users, Leaf, Zap } from "lucide-react";

function AnimatedCounter({ end, duration = 2000, suffix = "" }: { end: number, duration?: number, suffix?: string }) {
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
      { threshold: 0.1 }
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

  return <div ref={ref} className="text-5xl font-bold mb-2">{count}{suffix}</div>;
}

export default function AboutPage() {
  const values = [
    {
      icon: Leaf,
      title: "Sustainable",
      description:
        "Crafted with eco-friendly materials and ethical manufacturing practices for a better tomorrow.",
    },
    {
      icon: Zap,
      title: "Innovation",
      description:
        "Cutting-edge designs that blend comfort with contemporary style for modern living.",
    },
    {
      icon: Users,
      title: "Community",
      description:
        "Building a community of individuals who value quality, style, and conscious consumption.",
    },
  ];

  const team = [
    {
      name: "Sarah Mitchell",
      role: "Founder & Creative Director",
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
    },
    {
      name: "James Chen",
      role: "Head of Design",
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    },
    {
      name: "Emma Rodriguez",
      role: "Sustainability Lead",
      image:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
    },
    {
      name: "Alex Thompson",
      role: "Production Manager",
      image:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}

      {/* Story Section */}
      <section className="py-5 md:py-10 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
                Our Story
              </h2>
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                Wearix was founded with a simple vision: to create clothing that
                doesn't compromise between style and comfort. We started as a
                small team of designers and developers who believed the fashion
                industry needed to change.
              </p>
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                Today, we work with sustainable manufacturers around the world
                to bring you collections that feel as good as they look. Every
                piece is designed with intention, crafted with care, and made to
                last.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Our mission is simple: elevate your daily style journey while
                respecting the planet and the people who make our clothes.
              </p>
            </div>
            <div className="relative h-96 md:h-full rounded-2xl overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=800&fit=crop"
                alt="Wearix Team"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-5 md:py-10 px-5 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
              Our Values
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              These principles guide everything we do
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-8 hover:shadow-2xl transition-all duration-300 group"
                >
                  <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-6 group-hover:bg-gray-800 transition-colors">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-black mb-4">
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
      <section className="py-5 md:py-10 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
              Meet Our Team
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Creative minds working together to elevate your style
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="text-center group">
                <div className="relative h-64 rounded-2xl overflow-hidden mb-6">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <h3 className="text-xl font-bold text-black mb-2">
                  {member.name}
                </h3>
                <p className="text-gray-600">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-5 md:py-10 px-5 bg-black text-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <AnimatedCounter end={50} suffix="K+" />
              <p className="text-gray-400 text-lg">Happy Customers</p>
            </div>
            <div>
              <AnimatedCounter end={15} suffix="+" />
              <p className="text-gray-400 text-lg">Countries</p>
            </div>
            <div>
              <AnimatedCounter end={100} suffix="%" />
              <p className="text-gray-400 text-lg">Sustainable</p>
            </div>
            <div>
              <AnimatedCounter end={2020} />
              <p className="text-gray-400 text-lg">Founded</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-5 md:py-10 px-5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
            Join Our Community
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Discover our latest collections and be the first to know about new
            releases and exclusive offers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/product"
              className="group inline-flex items-center justify-center gap-2 bg-black hover:bg-gray-900 text-white rounded-full px-10 py-4 font-medium transition-all duration-300"
            >
              See all collections
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/contact"
              className="group inline-flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-black rounded-full px-10 py-4 font-medium transition-all duration-300"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
