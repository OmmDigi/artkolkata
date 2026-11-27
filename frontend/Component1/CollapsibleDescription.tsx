"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export const CollapsibleDescription = ({ htmlContent }: { htmlContent: string }) => {
  const [sections, setSections] = useState<
    { id: string; headingHtml: string; contentHtml: string; isOpen: boolean }[]
  >([]);

  useEffect(() => {
    if (!htmlContent) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const childNodes = Array.from(doc.body.childNodes);

    let currentHeading = "";
    let currentContent = "";
    const newSections: any[] = [];

    childNodes.forEach((node) => {
      const isHeading =
        node.nodeName === "H1" ||
        node.nodeName === "H2" ||
        node.nodeName === "H3";

      if (isHeading) {
        if (currentHeading || currentContent) {
          newSections.push({
            id: Math.random().toString(),
            headingHtml: currentHeading,
            contentHtml: currentContent,
            isOpen: newSections.length === 0, // first section open by default
          });
        }
        currentHeading = (node as HTMLElement).outerHTML;
        currentContent = "";
      } else {
        currentContent +=
          (node as HTMLElement).outerHTML || node.textContent || "";
      }
    });

    if (currentHeading || currentContent) {
      newSections.push({
        id: Math.random().toString(),
        headingHtml: currentHeading,
        contentHtml: currentContent,
        isOpen: newSections.length === 0,
      });
    }

    setSections(newSections);
  }, [htmlContent]);

  if (!sections.length) {
    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  }

  if (sections.length === 1 && !sections[0].headingHtml) {
    return (
      <div
        style={{ whiteSpace: "pre-wrap" }}
        dangerouslySetInnerHTML={{ __html: sections[0].contentHtml }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-4">
      {sections.map((section, idx) => (
        <div key={section.id} className="border-b border-gray-200 pb-2">
          {section.headingHtml ? (
            <button
              onClick={() => {
                const newSec = [...sections];
                newSec[idx].isOpen = !newSec[idx].isOpen;
                setSections(newSec);
              }}
              className="w-full flex justify-between items-center text-left py-2"
            >
              <div
                dangerouslySetInnerHTML={{ __html: section.headingHtml }}
                className="pointer-events-none [&>h1]:text-lg [&>h1]:font-semibold [&>h2]:text-lg [&>h2]:font-semibold [&>h3]:text-lg [&>h3]:font-semibold [&>h1]:m-0 [&>h2]:m-0 [&>h3]:m-0"
              />
              <ChevronDown
                className={`transition-transform duration-300 ${
                  section.isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          ) : null}

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              section.isOpen
                ? "max-h-[2000px] opacity-100 mt-2"
                : "max-h-0 opacity-0"
            }`}
          >
            <div
              dangerouslySetInnerHTML={{ __html: section.contentHtml }}
              style={{ whiteSpace: "pre-wrap" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
