"use client";

import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useSiteInfo, formatAddress } from "@/hooks/useSiteSettings";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribeStatus, setSubscribeStatus] = useState("");
  const { data: siteInfo } = useSiteInfo();

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
    // { label: "Blog", href: "/blog" },
    { label: "Product", href: "/product" },

    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms & Conditions", href: "/terms-conditions" },
    { label: "Returns & Refunds", href: "/returns-refunds" },
  ];

  const socialLinks = [
    {
      label: "Instagram",
      href: "https://www.instagram.com/art_kolkata1349/",
      icon: Instagram,
      color: "text-[#E4405F]",
    },

    {
      label: "Facebook",
      href: " https://www.facebook.com/sujansarkar1349/",
      icon: Facebook,
      color: "text-[#1877F2]",
    },
    {
      label: "Twitter",
      href: "https://x.com/artkolkata1",
      icon: Twitter,
      color: "text-[#1DA1F2]",
    },
    {
      label: "Youtube",
      href: "https://www.youtube.com/channel/UC96zR5UuNfReQHaoHwMax9g",
      icon: Youtube,
      color: "text-[#FF0000]",
    },
  ];

  const contactLinks = [];
  if (siteInfo?.contact_emails?.length) {
    const primaryEmail =
      siteInfo.contact_emails.find((e) => e.is_primary) ??
      siteInfo.contact_emails[0];
    if (primaryEmail)
      contactLinks.push({
        label: primaryEmail.value,
        href: `mailto:${primaryEmail.value}`,
        icon: Mail,
      });
  } else {
    contactLinks.push({
      label: "artkolkata921@gmail.com",
      href: "mailto:artkolkata921@gmail.com",
      icon: Mail,
    });
  }

  if (siteInfo?.contact_phones?.length) {
    const primaryPhone =
      siteInfo.contact_phones.find((p) => p.is_primary) ??
      siteInfo.contact_phones[0];
    if (primaryPhone)
      contactLinks.push({
        label: primaryPhone.value,
        href: `tel:${primaryPhone.value.replace(/\s/g, "")}`,
        icon: Phone,
      });
  } else {
    contactLinks.push({
      label: "+91 8621803898",
      href: "tel:+918621803898",
      icon: Phone,
    });
  }

  if (siteInfo?.site_addresses?.length) {
    const primaryAddress =
      siteInfo.site_addresses.find((a) => a.is_primary) ??
      siteInfo.site_addresses[0];
    if (primaryAddress)
      contactLinks.push({
        label: formatAddress(primaryAddress),
        href: primaryAddress.map_url || "#",
        icon: MapPin,
      });
  } else {
    contactLinks.push({
      label: (
        <>
          Duttapukur, arabinda pally
          <br />
          Near - Mahesh school
          <br />
          Pin- 743248
        </>
      ),
      href: "https://maps.app.goo.gl/rZFptT31uftFVGTP9?g_st=ac",
      icon: MapPin,
    });
  }

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
                src={siteInfo?.site_logo || "/Art-Kolkata-Logo.png"}
                alt={siteInfo?.site_logo_alt || "Art Kolkata Logo"}
                className="h-16 brightness-0 invert object-contain"
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
                      className="hover:opacity-80 text-sm transition-opacity flex items-center gap-2"
                    >
                      <Icon className={`w-4 h-4 ${link.color}`} />
                      <span className="text-gray-300">{link.label}</span>
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
              {contactLinks.map((link: any) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link?.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-full border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all group"
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-orange-600" />
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
            © 2026 ART KOLKATA. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
