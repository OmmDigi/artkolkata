/**
 * Text colour, shared by the inline tool and the fixed toolbar.
 *
 * Both entry points have to produce identical markup and obey the same
 * sanitizer rule, so the behaviour lives here once rather than being written
 * twice and drifting apart.
 */

export const TEXT_COLOURS = [
  { name: "Black", value: "#111827" },
  { name: "Grey", value: "#6B7280" },
  { name: "Green", value: "#16A34A" },
  { name: "Dark Green", value: "#15803D" },
  { name: "Red", value: "#DC2626" },
  { name: "Orange", value: "#EA580C" },
  { name: "Amber", value: "#D97706" },
  { name: "Blue", value: "#2563EB" },
  { name: "Indigo", value: "#4F46E5" },
  { name: "Purple", value: "#9333EA" },
  { name: "Pink", value: "#DB2777" },
];

export const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** what the picker needs: computed colours come back as rgb(), not as hex */
export const rgbToHex = (value: string) => {
  if (HEX.test(value.trim())) return value.trim();

  const parts = value.match(/\d+/g);
  if (!parts || parts.length < 3) return null;

  return (
    "#" +
    parts
      .slice(0, 3)
      .map((part) => parseInt(part, 10).toString(16).padStart(2, "0"))
      .join("")
  );
};

export const isPresetColour = (colour: string) =>
  TEXT_COLOURS.some(
    (preset) => preset.value.toLowerCase() === colour.toLowerCase(),
  );

const RECENT_KEY = "cms:editor:recent-text-colours";
const RECENT_LIMIT = 6;

// localStorage is per browser and can throw outright in a locked down one, so
// a failure here costs the shortcut and nothing else
export const readRecentColours = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string" && HEX.test(item))
      : [];
  } catch {
    return [];
  }
};

export const rememberColour = (colour: string) => {
  // only colours outside the palette are worth remembering: a preset is
  // already one click away, and storing it would push a picked shade out of
  // the short recents list
  if (isPresetColour(colour)) return;

  try {
    const next = [
      colour,
      ...readRecentColours().filter(
        (item) => item.toLowerCase() !== colour.toLowerCase(),
      ),
    ].slice(0, RECENT_LIMIT);

    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // nothing to do, the palette still works
  }
};

export const swatchIcon = (colour: string) =>
  `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="14" height="14" rx="4" fill="${colour}" stroke="rgba(0,0,0,0.18)"/></svg>`;

// a plain boolean rather than a type predicate: narrowing on the false branch
// would leave the loops below walking a `never`
const isColoured = (el: Element | null) =>
  el instanceof HTMLElement &&
  ((el.tagName === "SPAN" && el.style.color !== "") ||
    (el.tagName === "FONT" && el.hasAttribute("color")));

/** drops the element but keeps everything it was wrapping */
const unwrap = (el: HTMLElement) => {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
};

const elementOf = (node: Node | null) =>
  node instanceof HTMLElement ? node : (node?.parentElement ?? null);

/** the nearest wrapper carrying a colour, or null when the text is uncoloured */
export const colouredAncestor = () => {
  const selection = window.getSelection();
  let el = elementOf(selection?.anchorNode ?? null);

  while (el && !el.classList.contains("ce-block")) {
    if (isColoured(el)) return el;
    el = el.parentElement;
  }

  return null;
};

export const selectedColourHex = () => {
  const el = colouredAncestor();
  if (!el) return null;

  return rgbToHex(el.style.color || el.getAttribute("color") || "");
};

export const saveSelection = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  return selection.getRangeAt(0).cloneRange();
};

/**
 * Clicking a toolbar does not normally clear the selection, but the native
 * colour dialog takes focus outright, so the range is put back before the
 * colour lands.
 */
export const restoreSelection = (range: Range | null) => {
  const selection = window.getSelection();
  const live =
    selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed;

  if (live || !range || !selection) return;

  selection.removeAllRanges();
  selection.addRange(range);
};

export const applyTextColour = (colour: string, savedRange?: Range | null) => {
  restoreSelection(savedRange ?? null);
  rememberColour(colour);

  // styleWithCSS makes the browser write <span style="color: …"> instead of
  // the legacy <font color>, which is the markup the website can style
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("foreColor", false, colour);
  document.execCommand("styleWithCSS", false, "false");
};

/**
 * Removing a colour is not "apply black": that would leave the text pinned to
 * a colour it can never inherit from. Every coloured wrapper the selection
 * touches is stripped instead, and a wrapper left carrying nothing is removed.
 */
export const stripTextColour = (savedRange?: Range | null) => {
  restoreSelection(savedRange ?? null);

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const start = elementOf(range.commonAncestorContainer);
  if (!start) return;

  const block = start.closest(".ce-block") ?? start;

  // wrappers inside the selection, plus any the selection sits within
  const candidates = new Set<HTMLElement>(
    Array.from(
      block.querySelectorAll<HTMLElement>("span[style*='color'], font[color]"),
    ).filter((el) => range.intersectsNode(el)),
  );

  let ancestor: HTMLElement | null = start;
  while (ancestor && ancestor !== block) {
    if (isColoured(ancestor)) candidates.add(ancestor);
    ancestor = ancestor.parentElement;
  }

  candidates.forEach((el) => {
    el.style.removeProperty("color");
    el.removeAttribute("color");

    if (el.getAttribute("style") === "") el.removeAttribute("style");
    if (el.attributes.length === 0) unwrap(el);
  });
};

/**
 * The browser's own colour dialog, raised by a hidden input. That picker is
 * better than anything worth hand building here.
 */
export const openColourPicker = (
  initial: string,
  onPick: (colour: string) => void,
) => {
  const input = document.createElement("input");
  input.type = "color";

  // a browser with no native colour input leaves type as "text" — asking for
  // the hex outright beats handing over a text box that does nothing
  if (input.type !== "color") {
    const typed = window.prompt("Enter a colour hex, for example #16A34A");
    const colour = typed?.trim();
    if (colour && HEX.test(colour)) onPick(colour);
    return;
  }

  input.value = initial;
  input.style.position = "fixed";
  input.style.left = "-9999px";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";
  document.body.appendChild(input);

  const cleanUp = () => input.remove();

  // "change" is the committed value. "input" fires on every drag step, and
  // applying each one would bury the block's history under near identical
  // shades
  input.addEventListener("change", () => {
    onPick(input.value);
    cleanUp();
  });
  input.addEventListener("cancel", cleanUp);

  input.click();
};
