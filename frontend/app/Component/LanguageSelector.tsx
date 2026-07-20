"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English - EN" },
  { code: "hi", label: "हिन्दी - HI - अनुवाद" },
  { code: "ta", label: "தமிழ் - TA - மொழிபெயர்ப்பு" },
  { code: "te", label: "తెలుగు - TE - అనువాదం" },
  { code: "kn", label: "ಕನ್ನಡ - KN - ಭಾಷಾಂತರ" },
  { code: "ml", label: "മലയാളം - ML - വിവർത്തനം" },
  { code: "bn", label: "বাংলা - BN - অনুবাদ" },
  { code: "mr", label: "मराठी - MR - भाषांतर" },
];

export default function LanguageSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("en");
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Read the current language from the googtrans cookie on mount
    const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
    if (match && match[1]) {
      const parts = match[1].split('/');
      const lang = parts[parts.length - 1]; // e.g., "/en/hi" -> "hi"
      if (lang) {
        setCurrentLang(lang);
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const changeLanguage = (langCode: string) => {
    if (langCode === currentLang) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(false);

    // Set the cookie for future visits and navigations
    document.cookie = `googtrans=/en/${langCode}; path=/`;

    // Sometimes Google Translate requires domain wide cookie setting
    const domain = window.location.hostname;
    document.cookie = `googtrans=/en/${langCode}; domain=${domain}; path=/`;
    document.cookie = `googtrans=/en/${langCode}; domain=.${domain}; path=/`;

    // Trigger Google Translate manually if the element exists
    const selectElement = document.querySelector(".goog-te-combo") as HTMLSelectElement;
    if (selectElement) {
      selectElement.value = langCode;
      selectElement.dispatchEvent(new Event("change"));

      setCurrentLang(langCode);

      // Hide loader after a simulated delay to let translations apply
      setTimeout(() => {
        setIsLoading(false);
      }, 1500);
    } else {
      // Fallback: reload the page to apply the cookie if widget hasn't loaded
      window.location.reload();
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => !isLoading && setIsOpen(!isOpen)}
          disabled={isLoading}
          className={`flex text-black items-center gap-1.5 px-3 py-2 text-sm rounded-md transition border border-transparent ${isLoading ? 'opacity-70 cursor-wait' : 'hover:text-black hover:bg-gray-100 hover:border-gray-200 text-gray-700'}`}
          title="Select Language"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <img src="https://flagcdn.com/w20/in.png" width="18" alt="Indian Flag" />
          )}
          <span className="font-medium uppercase hidden xl:block">{currentLang}</span>
          <ChevronDown size={14} className={`transition ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-1 w-74 bg-white border border-gray-200 shadow-xl rounded-md z-50 text-black overflow-hidden notranslate">
            <div className="px-4 py-3 text-sm text-gray-600 font-medium border-b border-gray-100">
              Change Language
            </div>
            <div className="py-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition hover:bg-gray-50 ${currentLang === lang.code ? 'bg-gray-50' : 'text-gray-800'}`}
                >
                  {currentLang === lang.code ? (
                    <div className="w-[14px] h-[14px] rounded-full border border-orange-500 flex items-center justify-center flex-shrink-0">
                      <div className="w-[6px] h-[6px] rounded-full bg-orange-500"></div>
                    </div>
                  ) : (
                    <div className="w-[14px] h-[14px] rounded-full border border-gray-400 flex-shrink-0"></div>
                  )}
                  <span className={`${currentLang === lang.code ? 'font-medium' : ''}`}>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
