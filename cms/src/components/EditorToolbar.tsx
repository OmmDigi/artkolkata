import type EditorJS from "@editorjs/editorjs";
import { cn } from "@/lib/utils";
import {
  Bold,
  Code2,
  // Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Table as TableIcon,
  Unlink,
  Youtube,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { resolveEmbed } from "./editor-tools/embedUrl";
import {
  applyTextColour,
  openColourPicker,
  readRecentColours,
  saveSelection,
  selectedColourHex,
  stripTextColour,
  TEXT_COLOURS,
} from "./editor-tools/textColour";

/**
 * A fixed toolbar for the editor.
 *
 * EditorJS has no such thing of its own — every toolbar it ships is anchored
 * to the selection or the current block, and appears only once one exists.
 * This is a plain toolbar sitting above the editor that drives the same
 * public apis those toolbars use, so nothing here is a second implementation
 * of the editor's behaviour.
 */

interface IProps {
  /** reads the live editor, which only exists after onReady */
  getEditor: () => EditorJS | null;
}

const BLOCK_OPTIONS = [
  { label: "Paragraph", type: "paragraph" },
  { label: "Heading 1", type: "header", level: 1 },
  { label: "Heading 2", type: "header", level: 2 },
  { label: "Heading 3", type: "header", level: 3 },
  { label: "Heading 4", type: "header", level: 4 },
  { label: "Heading 5", type: "header", level: 5 },
  { label: "Heading 6", type: "header", level: 6 },
];

/**
 * A list handed no items renders with nothing to type into, so a new one is
 * given a single empty item. Quote, code, table and image are left to compose
 * their own defaults.
 */
const emptyList = (style: "ordered" | "unordered") => ({
  style,
  meta: {},
  items: [{ content: "", meta: {}, items: [] }],
});

const optionKey = (type: string, level?: number) =>
  level ? `${type}-${level}` : type;

export default function EditorToolbar({ getEditor }: IProps) {
  const [openPalette, setOpenPalette] = useState(false);
  const [blockKey, setBlockKey] = useState("paragraph");
  const paletteRef = useRef<HTMLDivElement>(null);

  /**
   * The select has to say what the caret is actually sitting in, otherwise it
   * keeps showing the last conversion while the cursor has moved on.
   */
  const syncBlockKey = useCallback(() => {
    const editor = getEditor();
    if (!editor) return;

    const index = editor.blocks.getCurrentBlockIndex();
    if (index < 0) return;

    const block = editor.blocks.getBlockByIndex(index);
    if (!block) return;

    if (block.name !== "header") {
      setBlockKey(block.name === "paragraph" ? "paragraph" : "other");
      return;
    }

    const heading = block.holder.querySelector("h1,h2,h3,h4,h5,h6");
    const level = heading ? Number(heading.tagName.slice(1)) : 2;
    setBlockKey(optionKey("header", level));
  }, [getEditor]);

  useEffect(() => {
    document.addEventListener("selectionchange", syncBlockKey);
    return () => document.removeEventListener("selectionchange", syncBlockKey);
  }, [syncBlockKey]);

  // the palette is a plain dropdown, so it has to close the way one does
  useEffect(() => {
    if (!openPalette) return;

    const onDocumentDown = (e: MouseEvent) => {
      if (!paletteRef.current?.contains(e.target as Node)) setOpenPalette(false);
    };

    document.addEventListener("mousedown", onDocumentDown);
    return () => document.removeEventListener("mousedown", onDocumentDown);
  }, [openPalette]);

  /**
   * Every button does this. A mousedown inside the toolbar would move focus
   * out of the editor and collapse the selection before the click ever fires,
   * and then there is nothing left to format.
   */
  const keepSelection = (e: React.MouseEvent) => e.preventDefault();

  const runCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  const changeBlock = async (key: string) => {
    const editor = getEditor();
    if (!editor) return;

    const option = BLOCK_OPTIONS.find(
      (item) => optionKey(item.type, item.level) === key,
    );
    if (!option) return;

    setBlockKey(key);

    const index = editor.blocks.getCurrentBlockIndex();
    const block = editor.blocks.getBlockByIndex(index);
    const data = option.level ? { level: option.level } : undefined;

    if (!block) {
      editor.blocks.insert(option.type, data);
      return;
    }

    try {
      await editor.blocks.convert(block.id, option.type, data);
      editor.caret.setToBlock(index, "end");
    } catch {
      // convert needs a conversionConfig on both tools. When one side does not
      // have it, a new block is the honest outcome rather than a dead button.
      editor.blocks.insert(option.type, data, undefined, index + 1, true);
    }
  };

  const insertBlock = (type: string, data?: object) => {
    const editor = getEditor();
    if (!editor) return;

    const index = editor.blocks.getCurrentBlockIndex();
    const block = editor.blocks.getBlockByIndex(index);

    // an empty block is replaced rather than pushed down, which is what
    // clicking "table" on a blank line is asking for. The last argument is
    // `replace`, so this is one operation and not a delete plus an insert.
    if (block?.isEmpty) {
      editor.blocks.insert(type, data, undefined, index, true, true);
      return;
    }

    editor.blocks.insert(type, data, undefined, index + 1, true);
  };

  const addVideo = () => {
    const url = window.prompt(
      "Paste a YouTube or Vimeo link, for example https://youtu.be/dQw4w9WgXcQ",
    );
    if (!url) return;

    // the embed tool renders an empty block for data with no service, so an
    // unrecognised url is refused here rather than inserted as a blank
    const data = resolveEmbed(url);
    if (!data) {
      alert("That does not look like a YouTube or Vimeo video link.");
      return;
    }

    insertBlock("embed", data);
  };

  const addLink = () => {
    const url = window.prompt("Link url, for example https://example.com");
    if (!url) return;

    runCommand("createLink", url.trim());
  };

  const pickColour = (colour: string) => {
    applyTextColour(colour);
    setOpenPalette(false);
  };

  const recent = readRecentColours();

  return (
    <div className="editor-toolbar">
      {/* No focus handling here on purpose: EditorJS remembers which block was
          current, so clicking the select does not lose it. Calling
          caret.focus() would jump to the first block instead. */}
      <select
        value={blockKey}
        onChange={(e) => changeBlock(e.currentTarget.value)}
        className="h-8 rounded-md border border-green-600 bg-white px-2 text-sm"
      >
        {BLOCK_OPTIONS.map((option) => (
          <option
            key={optionKey(option.type, option.level)}
            value={optionKey(option.type, option.level)}
          >
            {option.label}
          </option>
        ))}
        {/* what the select shows while the caret sits in a list, quote, table
            or image — none of which this menu converts between */}
        <option value="other" disabled>
          Other block
        </option>
      </select>

      <span className="editor-toolbar__divider" />

      <ToolbarButton title="Bold" onMouseDown={keepSelection} onClick={() => runCommand("bold")}>
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton title="Italic" onMouseDown={keepSelection} onClick={() => runCommand("italic")}>
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton title="Add link" onMouseDown={keepSelection} onClick={addLink}>
        <LinkIcon size={16} />
      </ToolbarButton>
      <ToolbarButton title="Remove link" onMouseDown={keepSelection} onClick={() => runCommand("unlink")}>
        <Unlink size={16} />
      </ToolbarButton>

      <span className="editor-toolbar__divider" />

      <div className="relative" ref={paletteRef}>
        <ToolbarButton
          title="Text colour"
          onMouseDown={keepSelection}
          onClick={() => setOpenPalette((prev) => !prev)}
        >
          <span className="text-sm font-semibold leading-none">A</span>
          <span
            className="block h-1 w-4 rounded-full"
            style={{ backgroundColor: selectedColourHex() ?? "#16A34A" }}
          />
        </ToolbarButton>

        {openPalette ? (
          <div className="editor-toolbar__palette" onMouseDown={keepSelection}>
            <div className="grid grid-cols-6 gap-1.5">
              {TEXT_COLOURS.map((colour) => (
                <button
                  key={colour.value}
                  type="button"
                  title={colour.name}
                  onClick={() => pickColour(colour.value)}
                  className="size-6 rounded-md border border-black/15 cursor-pointer"
                  style={{ backgroundColor: colour.value }}
                />
              ))}
              {recent.map((colour) => (
                <button
                  key={`recent-${colour}`}
                  type="button"
                  title={colour}
                  onClick={() => pickColour(colour)}
                  className="size-6 rounded-md border border-black/15 cursor-pointer"
                  style={{ backgroundColor: colour }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                className="text-xs text-gray-700 hover:text-black cursor-pointer"
                onClick={() => {
                  // the dialog takes focus, so the range is carried into it
                  const range = saveSelection();
                  openColourPicker(selectedColourHex() ?? "#16A34A", (colour) => {
                    applyTextColour(colour, range);
                    setOpenPalette(false);
                  });
                }}
              >
                Custom colour
              </button>
              <button
                type="button"
                className="text-xs text-red-600 hover:text-red-700 cursor-pointer"
                onClick={() => {
                  stripTextColour();
                  setOpenPalette(false);
                }}
              >
                Remove colour
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <span className="editor-toolbar__divider" />

      <ToolbarButton title="Bulleted list" onMouseDown={keepSelection} onClick={() => insertBlock("list", emptyList("unordered"))}>
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton title="Numbered list" onMouseDown={keepSelection} onClick={() => insertBlock("list", emptyList("ordered"))}>
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton title="Quote" onMouseDown={keepSelection} onClick={() => insertBlock("quote")}>
        <Quote size={16} />
      </ToolbarButton>
      <ToolbarButton title="Code" onMouseDown={keepSelection} onClick={() => insertBlock("code")}>
        <Code2 size={16} />
      </ToolbarButton>
      <ToolbarButton title="Table" onMouseDown={keepSelection} onClick={() => insertBlock("table")}>
        <TableIcon size={16} />
      </ToolbarButton>
      {/* <ToolbarButton title="Image" onMouseDown={keepSelection} onClick={() => insertBlock("image")}>
        <ImageIcon size={16} />
      </ToolbarButton> */}
      <ToolbarButton title="Video embed" onMouseDown={keepSelection} onClick={addVideo}>
        <Youtube size={16} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  title,
  className,
  children,
  ...rest
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      title={title}
      className={cn("editor-toolbar__button", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
