import ContactUsForm from "@/Component1/ContactUsForm";
import PromoSection from "@/Component1/PromoSection";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function page() {
  return (
    <main className="*:font-spartan bg-gray-50 text-black">
      <section className="w-full relative bg-gray-100  overflow-hidden">
        <Image
          src={"bg-breadcrumb_1920x.jpg"}
          alt="Banner image"
          className="size-full"
          height={1920}
          width={1920}
        />

        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
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
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">
              Send us a text & an ambassador will respond when available.
            </p>
            <p className="font-semibold">1-814-251-9966</p>
          </div>

          {/* Address */}
          <div>
            <h3 className="font-bold text-sm tracking-wider mb-4">ADDRESS</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              PO Box 1622 Visvaasang Street
              <br />
              West
            </p>
            <p className="text-gray-600 text-sm mt-4">info@example.com</p>
          </div>

          {/* We're Open */}
          <div>
            <h3 className="font-bold text-sm tracking-wider mb-4">
              WE'RE OPEN
            </h3>
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">
              Our store has re-opened for shopping, exchanges
            </p>
            <p className="font-semibold">Every day 11am to 7pm</p>
          </div>

          {/* Social Media */}
          <div>
            <h3 className="font-bold text-sm tracking-wider mb-4">
              SOCIAL MEDIA
            </h3>
            <div className="flex justify-center gap-4">
              <a
                href="#"
                className="text-gray-600 hover:text-black transition-colors"
              >
                <Facebook size={20} />
              </a>
              <a
                href="#"
                className="text-gray-600 hover:text-black transition-colors"
              >
                <Twitter size={20} />
              </a>
              <a
                href="#"
                className="text-gray-600 hover:text-black transition-colors"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </a>
              <a
                href="#"
                className="text-gray-600 hover:text-black transition-colors"
              >
                <Youtube size={20} />
              </a>
              <a
                href="#"
                className="text-gray-600 hover:text-black transition-colors"
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
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2886.267890933394!2d-79.37869!3d43.65321!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x882b34d68bf33a9b%3A0x9c19e5e1a926f0d7!2s100%20King%20St%20W%2C%20Toronto%2C%20ON%20M5X%201A9%2C%20Canada!5e0!3m2!1sen!2sus!4v1234567890"
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
      <PromoSection />
    </main>
  );
}
