"use client";

import ContactUsForm from "@/Component1/ContactUsForm";
import PromoSection from "@/Component1/PromoSection";
import {
  Mail,
  Phone,
  MapPin,
  Search,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Dribbble,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSiteInfo, formatAddress } from "@/hooks/useSiteSettings";

export default function page() {
  const { data: siteInfo } = useSiteInfo();

  const primaryPhone =
    siteInfo?.contact_phones?.find((p) => p.is_primary) ??
    siteInfo?.contact_phones?.[0];
  const phoneText = primaryPhone?.value || "8621803898";

  const primaryAddress =
    siteInfo?.site_addresses?.find((a) => a.is_primary) ??
    siteInfo?.site_addresses?.[0];
  const addressText = primaryAddress
    ? formatAddress(primaryAddress)
    : "Arabinda Pally, Duttapukur, Kolkata, N. 24 Pgs, 743248, West Bengal";

  const primaryEmail =
    siteInfo?.contact_emails?.find((e) => e.is_primary) ??
    siteInfo?.contact_emails?.[0];
  const emailText = primaryEmail?.value || "artkolkata921@gmail.com";

  return (
    <main className="*:font-spartan bg-gray-50 text-black">
      <section className="w-full relative bg-gray-100  overflow-hidden">
        {/* <Image
          src={"bg-breadcrumb_1920x.jpg"}
          alt="Banner image"
          className="size-full"
          height={1920}
          width={1920}
        /> */}

        <div className=" h-60 w-full  bg-black/50 flex items-center justify-center">
          <div className="container mx-auto px-4 space-y-3.5 flex items-center justify-center flex-col">
            <h3 className="text-3xl text-white font-bold font-open tracking-wide">
              Contact Us
            </h3>
            {/* Breadcrumb */}
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-300">
              <Link href={"/"}>Home</Link>
              <span>/</span>
              <Link href={"/account"}>Contact-Us</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Info Section */}
      <div className="max-w-7xl mx-auto px-4 py-16 ">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center mb-16">
          {/* Call Us */}
          <div>
            <h3 className="font-bold text-sm tracking-wider mb-4">CALL US</h3>
            {/* <p className="text-gray-600 text-sm mb-4 leading-relaxed">
              Send us a text & an ambassador will respond when available.
            </p> */}
            <p className="font-semibold">{phoneText}</p>
          </div>

          {/* Address */}
          <div>
            <h3 className="font-bold text-sm tracking-wider mb-4">ADDRESS</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              {addressText}
            </p>
            <p className="text-gray-600 text-sm mt-4">{emailText}</p>
          </div>

          {/* We're Open */}
          <div>
            <h3 className="font-bold text-sm tracking-wider mb-4">
              WE'RE OPEN
            </h3>
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">
              Our store has re-opened for shopping, exchanges
            </p>
            <p className="font-semibold">Every day 10am to 6pm</p>
          </div>

          {/* Social Media */}
          <div>
            <h3 className="font-bold text-sm tracking-wider mb-4">
              SOCIAL MEDIA
            </h3>
            <div className="flex justify-center gap-4">
              <a
                href="https://www.facebook.com/sujansarkar1349/"
                className="text-[#1877F2] hover:opacity-80 transition-opacity"
              >
                <Facebook size={20} />
              </a>
              <a
                href="https://x.com/artkolkata1"
                className="text-[#1DA1F2] hover:opacity-80 transition-opacity"
              >
                <Twitter size={20} />
              </a>
              <a
                href="https://www.youtube.com/channel/UC96zR5UuNfReQHaoHwMax9g"
                className="text-[#FF0000] hover:opacity-80 transition-opacity"
              >
                <Youtube size={20} />
              </a>
              <a
                href="https://www.instagram.com/art_kolkata1349/"
                className="text-[#E4405F] hover:opacity-80 transition-opacity"
              >
                <Instagram size={20} />
              </a>
            </div>
          </div>
        </div>

        {/* Map Section */}
        <div className="mb-16">
          <div className="w-full h-96 bg-gray-200 rounded-lg overflow-hidden">
            <iframe
              src="https://maps.google.com/maps?q=Duttapukur,%20arabinda%20pally,%20Near%20-%20Mahesh%20school,%20Pin-%20743248&t=&z=15&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>

        {/* Get In Touch Form */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">GET IN TOUCH</h2>

          <ContactUsForm />
        </div>
      </div>

      {/* Features Section */}
      {/* <PromoSection /> */}
    </main>
  );
}
