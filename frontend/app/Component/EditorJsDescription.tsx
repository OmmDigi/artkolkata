"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import CustomImage from "@/Component1/CustomImage";

/**
 * Renders the EditorJS document the CMS saves in `products.description_json`.
 *
 * The API also stores a flattened `description` html, but that html loses the
 * block boundaries this view needs: every h1-h6 block starts a collapsible
 * section and everything after it - paragraphs, lists, tables, images - is the
 * body of that section. So the json is rendered directly instead.
 *
 * Only the *inline* markup inside a block (bold, links, the TextColor spans the
 * editor writes) is injected as html, and it is scrubbed first: the content is
 * admin authored, but it still travels through the database and an editor that
 * accepts pasted markup.
 */

type EditorBlock = {
  id?: string;
  type?: string;
  data?: any;
};

type EditorDocument = {
  blocks?: EditorBlock[];
} | null;

const HEADER_TYPES = ["header", "heading"];

const sanitizeInline = (html: unknown) =>
  String(html ?? "")
    .replace(
      /<\s*\/?\s*(script|style|iframe|object|embed|form|input)[^>]*>/gi,
      "",
    )
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]*)/gi,
      ' $1="#"',
    );

/** Editor json arrives as an object, but a column read raw can still be a string. */
const toDocument = (input: unknown): EditorDocument => {
  if (!input) return null;
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (Array.isArray(input)) return { blocks: input as EditorBlock[] };
  return input as EditorDocument;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * The editor stores inline content as html, so `&` arrives as `&amp;`. Block
 * bodies are injected as html and the browser decodes them, but a heading is
 * rendered as a text node - it has to be decoded here or it shows the entity.
 */
const decodeEntities = (text: string) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(
      /&(\w+);/g,
      (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match,
    );

const plainText = (html: unknown) =>
  decodeEntities(String(html ?? "").replace(/<[^>]+>/g, "")).trim();

const isHeaderBlock = (block: EditorBlock) => {
  if (!HEADER_TYPES.includes(String(block.type).toLowerCase())) return false;
  const level = Number(block.data?.level ?? 2);
  return level >= 1 && level <= 6;
};

const Inline = ({
  html,
  className,
}: {
  html?: unknown;
  className?: string;
}) => (
  <span
    className={className}
    dangerouslySetInnerHTML={{ __html: sanitizeInline(html) }}
  />
);

/* ------------------------------ list rendering ----------------------------- */

type ListItem = { content?: string; items?: ListItem[]; meta?: any };

/** @editorjs/list v2 nests objects; older saves are a flat array of strings. */
const normalizeItems = (items: any[]): ListItem[] =>
  (items ?? []).map((item) =>
    typeof item === "string" ? { content: item } : (item ?? {}),
  );

const COUNTER_TYPES: Record<string, string> = {
  numeric: "decimal",
  "lower-roman": "lower-roman",
  "upper-roman": "upper-roman",
  "lower-alpha": "lower-alpha",
  "upper-alpha": "upper-alpha",
};

function BlockList({
  style,
  items,
  meta,
  nested = false,
}: {
  style?: string;
  items: any[];
  meta?: any;
  nested?: boolean;
}) {
  const list = normalizeItems(items);
  if (list.length === 0) return null;

  const isChecklist = style === "checklist";
  const isOrdered = style === "ordered";
  const Tag = (isOrdered ? "ol" : "ul") as "ol" | "ul";

  return (
    <Tag
      start={isOrdered && meta?.start ? Number(meta.start) : undefined}
      style={{
        listStyleType: isChecklist
          ? "none"
          : isOrdered
            ? (COUNTER_TYPES[meta?.counterType] ?? "decimal")
            : "disc",
      }}
      className={`${nested ? "mt-1" : "mb-3"} ${isChecklist ? "pl-0" : "pl-5"} space-y-1`}
    >
      {list.map((item, index) => {
        const checked = isChecklist && Boolean(item.meta?.checked);
        return (
          <li key={index} className={isChecklist ? "flex gap-2" : ""}>
            {isChecklist && (
              <span
                aria-hidden="true"
                className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none ${
                  checked
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white text-transparent"
                }`}
              >
                ✓
              </span>
            )}
            <span className={isChecklist ? "flex-1" : undefined}>
              <Inline html={item.content} />
              {item.items && item.items.length > 0 && (
                <BlockList
                  style={style}
                  items={item.items}
                  meta={item.meta}
                  nested
                />
              )}
            </span>
          </li>
        );
      })}
    </Tag>
  );
}

/* ----------------------------- block rendering ----------------------------- */

const HEADING_SIZES: Record<number, string> = {
  1: "text-xl md:text-2xl",
  2: "text-lg md:text-xl",
  3: "text-base md:text-lg",
  4: "text-base",
  5: "text-sm",
  6: "text-sm",
};

function Block({ block }: { block: EditorBlock }) {
  const type = String(block.type ?? "").toLowerCase();
  const data = block.data ?? {};

  switch (type) {
    case "paragraph": {
      if (!plainText(data.text)) return null;
      return (
        <p
          className="mb-3 last:mb-0"
          style={data.alignment ? { textAlign: data.alignment } : undefined}
          dangerouslySetInnerHTML={{ __html: sanitizeInline(data.text) }}
        />
      );
    }

    // In accordion mode a header only reaches here when it is nested inside a
    // section - the top level ones are consumed as section titles before this
    // point. In flat mode every header is rendered here.
    case "header":
    case "heading": {
      const level = Math.min(Math.max(Number(data.level ?? 2), 1), 6);
      const Tag = `h${level}` as "h1";
      return (
        <Tag
          className={`mt-5 mb-2 font-semibold text-gray-900 first:mt-0 ${HEADING_SIZES[level]}`}
        >
          <Inline html={data.text} />
        </Tag>
      );
    }

    case "list":
    case "checklist":
      return (
        <BlockList
          style={type === "checklist" ? "checklist" : data.style}
          items={data.items ?? []}
          meta={data.meta}
        />
      );

    case "quote":
      return (
        <blockquote
          className="mb-3 border-l-2 border-gray-300 pl-3 italic text-gray-600"
          style={data.alignment ? { textAlign: data.alignment } : undefined}
        >
          <Inline html={data.text} />
          {plainText(data.caption) && (
            <cite className="mt-1 block text-xs not-italic text-gray-500">
              — <Inline html={data.caption} />
            </cite>
          )}
        </blockquote>
      );

    case "table": {
      const rows: string[][] = data.content ?? [];
      if (rows.length === 0) return null;
      const [firstRow, ...restRows] = rows;
      const bodyRows = data.withHeadings ? restRows : rows;
      return (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            {data.withHeadings && (
              <thead>
                <tr>
                  {firstRow.map((cell, i) => (
                    <th
                      key={i}
                      className="border border-gray-200 bg-gray-50 px-2 py-1 font-semibold text-gray-900"
                    >
                      <Inline html={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border border-gray-200 px-2 py-1">
                      <Inline html={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "code":
      if (!String(data.code ?? "").trim()) return null;
      return (
        <pre className="mb-3 overflow-x-auto rounded bg-gray-900 p-3 text-xs leading-relaxed text-gray-100">
          <code>{data.code}</code>
        </pre>
      );

    case "image": {
      const src = data.file?.url ?? data.url;
      if (!src) return null;
      return (
        <figure className={`mb-3 ${data.stretched ? "-mx-1" : ""}`}>
          <CustomImage
            src={src}
            alt={plainText(data.caption) || "Product description image"}
            loading="lazy"
            sizes="(max-width: 768px) 100vw, 40vw"
            className={`h-auto w-full rounded ${
              data.withBorder ? "border border-gray-200" : ""
            } ${data.withBackground ? "bg-gray-100 p-3" : ""}`}
          />
          {plainText(data.caption) && (
            <figcaption className="mt-1 text-center text-xs text-gray-500">
              <Inline html={data.caption} />
            </figcaption>
          )}
        </figure>
      );
    }

    case "embed": {
      if (!data.embed) return null;
      return (
        <figure className="mb-3">
          <div className="relative w-full overflow-hidden rounded pt-[56.25%]">
            <iframe
              src={data.embed}
              title={
                plainText(data.caption) || data.service || "Embedded media"
              }
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
          {plainText(data.caption) && (
            <figcaption className="mt-1 text-center text-xs text-gray-500">
              <Inline html={data.caption} />
            </figcaption>
          )}
        </figure>
      );
    }

    case "delimiter":
      return <hr className="my-4 border-gray-200" />;

    case "raw":
      if (!String(data.html ?? "").trim()) return null;
      return (
        <div
          className="mb-3"
          dangerouslySetInnerHTML={{ __html: sanitizeInline(data.html) }}
        />
      );

    // A tool added in the CMS later still shows its text instead of vanishing.
    default: {
      const text = data.text ?? data.message ?? data.title;
      if (!plainText(text)) return null;
      return (
        <p
          className="mb-3 last:mb-0"
          dangerouslySetInnerHTML={{ __html: sanitizeInline(text) }}
        />
      );
    }
  }
}

/* -------------------------------- sections -------------------------------- */

type Section = { heading: string | null; blocks: EditorBlock[] };

const buildSections = (blocks: EditorBlock[]): Section[] => {
  const sections: Section[] = [];
  let current: Section = { heading: null, blocks: [] };

  for (const block of blocks) {
    if (isHeaderBlock(block)) {
      if (current.blocks.length > 0) sections.push(current);
      current = {
        heading: plainText(block.data?.text) || "Description",
        blocks: [],
      };
    } else {
      current.blocks.push(block);
    }
  }
  if (current.blocks.length > 0) sections.push(current);

  return sections;
};

function AccordionItem({
  heading,
  blocks,
  isOpen,
  onClick,
  hideToggle = false,
}: {
  heading: string;
  blocks: EditorBlock[];
  isOpen: boolean;
  onClick: () => void;
  hideToggle?: boolean;
}) {
  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        onClick={onClick}
        disabled={hideToggle}
        aria-expanded={isOpen}
        className={`w-full flex justify-between items-center py-4 text-left font-bold text-gray-900 focus:outline-none ${
          hideToggle ? "cursor-default" : "cursor-pointer hover:text-black"
        }`}
      >
        <span className="text-sm md:text-base">{heading}</span>
        {!hideToggle && (
          <ChevronDown
            size={18}
            className={`transition-transform duration-300 text-gray-500 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen
            ? "grid-rows-[1fr] opacity-100 pb-4"
            : "grid-rows-[0fr] opacity-0 pb-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="text-sm text-gray-700 leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_b]:font-semibold [&_strong]:font-semibold">
            {blocks.map((block, index) => (
              <Block key={block.id ?? index} block={block} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditorJsDescription({
  data,
  headingToDropdown = true,
}: {
  data: unknown;
  /** Turn every top level heading into a collapsible section. When false the
   *  document is rendered straight through, headings included. */
  headingToDropdown?: boolean;
}) {
  const [openSectionIndex, setOpenSectionIndex] = useState(0);

  const blocks = useMemo(() => toDocument(data)?.blocks ?? [], [data]);
  const sections = useMemo(() => buildSections(blocks), [blocks]);

  if (!headingToDropdown) {
    if (blocks.length === 0) return null;
    return (
      <div className="text-sm text-gray-700 leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_b]:font-semibold [&_strong]:font-semibold">
        {blocks.map((block, index) => (
          <Block key={block.id ?? index} block={block} />
        ))}
      </div>
    );
  }

  if (sections.length === 0) return null;

  if (sections.length === 1) {
    return (
      <div className="flex flex-col border-t border-gray-200 mt-2">
        <AccordionItem
          heading={sections[0].heading ?? "Description"}
          blocks={sections[0].blocks}
          isOpen
          onClick={() => {}}
          hideToggle
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col border-t border-gray-200 mt-2">
      {sections.map((section, index) => (
        <AccordionItem
          key={index}
          heading={section.heading ?? "Description"}
          blocks={section.blocks}
          isOpen={openSectionIndex === index}
          onClick={() =>
            setOpenSectionIndex(openSectionIndex === index ? -1 : index)
          }
        />
      ))}
    </div>
  );
}

export default EditorJsDescription;
