"use client";

import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Instagram,
  Dribbble,
  Facebook,
  Twitter,
  Youtube,
} from "lucide-react";
import { FormEvent, useState } from "react";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribeStatus, setSubscribeStatus] = useState("");

  const handleSubscribe = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email) {
      setSubscribeStatus("success");
      setEmail("");
      setTimeout(() => setSubscribeStatus(""), 3000);
    }
  };

  const quickLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Shop", href: "/shop" },
    { label: "Reviews", href: "/#reviews" },
    { label: "Styles", href: "/#styles" },
  ];

  const socialLinks = [
    { label: "Instagram", href: "https://instagram.com", icon: Instagram },
    { label: "Dribbble", href: "https://dribbble.com", icon: Dribbble },
    { label: "Facebook", href: "https://facebook.com", icon: Facebook },
    { label: "Twitter", href: "https://x.com", icon: Twitter },
    { label: "Youtube", href: "https://youtube.com", icon: Youtube },
  ];

  const contactLinks = [
    { label: "test@gmail.com", href: "mailto:test@gmail.com", icon: Mail },
    { label: "+001 234 567 890", href: "tel:+001234567890", icon: Phone },
    {
      label: "London, England",
      href: "https://www.google.com/maps/place/London",
      icon: MapPin,
    },
  ];

  return (
    <footer className="bg-black text-white py-3 md:py-5">
      <div className="max-w-7xl mx-auto px-5">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-2">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <Link
              href="/"
              className="text-2xl font-bold text-gray-900 transition"
            >
              <img
                src="/Art-Kolkata-Logo.png"
                alt="Art Kolkata Logo"
                className="h-16 brightness-0 invert"
              />
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              A sophisticated e-commerce template designed for modern and
              minimalist brands.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-black rounded-full px-6 py-3 font-medium transition-colors text-sm"
            >
              Contact ART KOLKATA
            </Link>
          </div>
          <div className="flex  gap-20 md:gap-30 ">

            {/* Quick Links */}
            <div>
              <h5 className="text-lg font-semibold mb-6">Quick Links</h5>
              <div className="space-y-3">
                {quickLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors block"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Social Links */}
            <div>
              <h5 className="text-lg font-semibold mb-6">Follow us:</h5>
              <div className="space-y-3">
                {socialLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-2"
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Get In Touch */}
          <div>
            <h5 className="text-lg font-semibold mb-6">Get in touch</h5>
            <div className="space-y-3">
              {contactLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-full border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all group"
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-400 group-hover:text-white text-sm transition-colors">
                      {link.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-white/15 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <Link href="/" className="text-white font-bold text-lg">
            ART KOLKATA
          </Link>
          <p className="text-gray-400 text-sm text-center md:text-right">
            © 2024 ART KOLKATA. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
