import editorjsHTML from "editorjs-html";

type ListItem = string | { content: string; items?: ListItem[] };

function renderListItems(items: ListItem[], tag: "ul" | "ol"): string {
  const lis = items
    .map((item) => {
      if (typeof item === "string") {
        return `<li>${item}</li>`;
      }
      const nested =
        item.items?.length
          ? `<${tag}>${renderListItems(item.items, tag)}</${tag}>`
          : "";
      return `<li>${item.content}${nested}</li>`;
    })
    .join("");
  return lis;
}

const parser = editorjsHTML({
  image: (block: any) => {
    return `<img src="${block.data.file?.url ?? block.data.url ?? ""}" alt="${block.data.caption ?? ""}" loading="lazy" />`;
  },

  table: (block: any) => {
    const rows = block.data.content
      .map(
        (row: string[]) =>
          `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`,
      )
      .join("");
    return `<table>${rows}</table>`;
  },

  code: (block: any) => {
    return `<pre><code>${block.data.code}</code></pre>`;
  },

  list: (block: any) => {
    const tag = block.data.style === "ordered" ? "ol" : "ul";
    return `<${tag}>${renderListItems(block.data.items ?? [], tag)}</${tag}>`;
  },
});

export function editorJsonToHtml(json: any) {
  return parser.parse(json);
}
