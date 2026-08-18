"use client";

import { useState } from "react";
import { postRequest } from "@/lib/fetcher";

export default function ContactUsForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Sending to /api/v1/enquiry or just /enquiry depending on the backend proxy setup
      // Most of the frontend requests are prefixed with /api/v1/
      await postRequest({ url: "/api/v1/website/enquiry", body: formData });
      alert("Your enquiry has been submitted successfully!");
      setFormData({ name: "", email: "", phone: "", message: "" });
    } catch (error) {
      console.error(error);
      alert("Failed to submit enquiry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <input
          type="text"
          placeholder="Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-0 py-3 border-0 border-b-2 border-gray-300 focus:border-black focus:outline-none transition-colors placeholder-gray-400"
        />
        <input
          type="email"
          placeholder="Email Address"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-0 py-3 border-0 border-b-2 border-gray-300 focus:border-black focus:outline-none transition-colors placeholder-gray-400"
        />
      </div>

      <input
        type="tel"
        placeholder="Phone Number"
        required
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        className="w-full px-0 py-3 border-0 border-b-2 border-gray-300 focus:border-black focus:outline-none transition-colors placeholder-gray-400"
      />

      <textarea
        placeholder="Message"
        required
        value={formData.message}
        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
        rows={6}
        className="w-full px-0 py-3 border-0 border-b-2 border-gray-300 focus:border-black focus:outline-none transition-colors resize-none placeholder-gray-400"
      ></textarea>

      <div className="text-center pt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-[#02F8C5] text-black rounded-full px-12 py-4 font-semibold tracking-wider transition-colors disabled:opacity-70"
        >
          {isSubmitting ? "SENDING..." : "SEND MESSAGE"}
        </button>
      </div>
    </form>
  );
}
