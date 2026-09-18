import type { API } from "@editorjs/editorjs";
import {
  applyTextColour,
  colouredAncestor,
  isPresetColour,
  openColourPicker,
  readRecentColours,
  saveSelection,
  selectedColourHex,
  stripTextColour,
  swatchIcon,
  TEXT_COLOURS,
} from "./textColour";

/**
 * Text colour as an EditorJS inline tool — the palette that appears when text
 * is selected. The fixed toolbar above the editor offers the same thing; both
 * call into ./textColour so the markup and the sanitizer rule stay identical.
 */

export interface ITextColorConfig {
  colors?: { name: string; value: string }[];
}

const BUTTON_ICON = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.2 14 8 5h1.7l3.8 9h-1.8l-.9-2.3H6.9L6 14H4.2Zm3.2-3.7h2.9L8.9 6.8 7.4 10.3Z" fill="currentColor"/><rect x="3" y="15.4" width="14" height="2.6" rx="1.3" fill="#16A34A"/></svg>`;

const REMOVE_ICON = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

const CUSTOM_ICON = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="6.6" fill="url(#tc-wheel)" stroke="rgba(0,0,0,0.18)"/><defs><linearGradient id="tc-wheel" x1="3" y1="3" x2="17" y2="17"><stop offset="0%" stop-color="#DC2626"/><stop offset="35%" stop-color="#D97706"/><stop offset="65%" stop-color="#16A34A"/><stop offset="100%" stop-color="#2563EB"/></linearGradient></defs></svg>`;

export default class TextColor {
  static get isInline() {
    return true;
  }

  static get title() {
    return "Text Colour";
  }

  /**
   * Without this the colour is stripped the moment the post is saved: the
   * sanitizer keeps only what the enabled tools declare.
   */
  static get sanitize() {
    return {
      span: { style: true },
      font: { color: true, face: true, size: true },
    };
  }

  private colors: { name: string; value: string }[];
  // the selection as it stood when the toolbar opened, used only as a fallback
  // if clicking through the nested menu ever loses it
  private savedRange: Range | null = null;

  constructor({ config }: { api: API; config?: ITextColorConfig }) {
    this.colors = config?.colors?.length ? config.colors : TEXT_COLOURS;
  }

  render() {
    this.savedRange = saveSelection();

    return {
      icon: BUTTON_ICON,
      name: "textColor",
      title: "Text Colour",
      isActive: () => colouredAncestor() !== null,
      children: {
        items: [
          ...this.colors.map((colour) =>
            this.colourItem(colour.name, colour.value),
          ),
          // picked colours sit under the fixed palette so the brand colours
          // stay first, and a shade reused across a post stays one click away
          ...readRecentColours()
            .filter((colour) => !isPresetColour(colour))
            .map((colour) => this.colourItem(colour, colour)),
          {
            icon: CUSTOM_ICON,
            title: "Custom Colour",
            name: "text-colour-custom",
            closeOnActivate: true,
            onActivate: () =>
              openColourPicker(selectedColourHex() ?? "#16A34A", (colour) =>
                applyTextColour(colour, this.savedRange),
              ),
          },
          {
            icon: REMOVE_ICON,
            title: "Remove Colour",
            name: "text-colour-remove",
            closeOnActivate: true,
            onActivate: () => stripTextColour(this.savedRange),
          },
        ],
      },
    };
  }

  private colourItem(title: string, value: string) {
    return {
      icon: swatchIcon(value),
      title,
      name: `text-colour-${value.replace("#", "").toLowerCase()}`,
      closeOnActivate: true,
      onActivate: () => applyTextColour(value, this.savedRange),
    };
  }
}
