"use client";

import { useState } from "react";

export default function ContactUsForm() {
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <input
          type="email"
          placeholder="pomoloj523@roratu.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-0 py-3 border-0 border-b-2 border-gray-300 focus:border-black focus:outline-none transition-colors placeholder-gray-400"
        />
        <input
          type="email"
          placeholder="pomoloj523@roratu.com"
          className="w-full px-0 py-3 border-0 border-b-2 border-gray-300 focus:border-black focus:outline-none transition-colors placeholder-gray-400"
        />
      </div>

      <input
        type="tel"
        placeholder="Phone Number"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        className="w-full px-0 py-3 border-0 border-b-2 border-gray-300 focus:border-black focus:outline-none transition-colors placeholder-gray-400"
      />

      <textarea
        placeholder="Message"
        value={formData.message}
        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
        rows={6}
        className="w-full px-0 py-3 border-0 border-b-2 border-gray-300 focus:border-black focus:outline-none transition-colors resize-none placeholder-gray-400"
      ></textarea>

      <div className="text-center pt-6">
        <button
          type="submit"
          className="bg-black text-white px-12 py-4 font-semibold tracking-wider hover:bg-gray-800 transition-colors"
        >
          SEND MESSAGE
        </button>
      </div>
    </form>
  );
}
