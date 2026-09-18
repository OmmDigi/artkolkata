import { useEffect, useRef } from "react";
import EditorJS, {
  type OutputData,
  type ToolConstructable,
} from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import ImageTool from "@editorjs/image";
import Quote from "@editorjs/quote";
import Table from "@editorjs/table";
import Code from "@editorjs/code";
import Embed from "@editorjs/embed";
import Paragraph from "@editorjs/paragraph";
import TextColor from "./editor-tools/TextColor";
import EditorToolbar from "./EditorToolbar";
import { Label } from "./ui/label";
import "./editor.css";
import { uploadFiles } from "@/utils/uploadFiles";
import { isAssetUrl } from "@/utils/assetUrl";

interface EditorProps {
  onSave?: (data: OutputData) => void;
  label?: string;
  initData?: OutputData;
}

export default function Editor({ onSave, label, initData }: EditorProps) {
  const editorRef = useRef<EditorJS | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (editorRef.current) return;

    // let parsedData: OutputData | undefined;

    // if (initData) {
    //   try {
    //     parsedData = JSON.parse(initData);
    //   } catch {
    //     console.error("Invalid EditorJS JSON");
    //   }
    // }

    const editor = new EditorJS({
      holder: containerRef.current,
      autofocus: true,
      data: initData,

      tools: {
        // inline tool, so it shows up in the selection toolbar of every block
        // that has the inline toolbar enabled
        textColor: {
          class: TextColor as unknown as ToolConstructable,
        },
        header: {
          class: Header,
          inlineToolbar: true,
          // every level is offered, and the stylesheet gives each one a
          // distinct size — that heading picker is the size control
          config: {
            levels: [1, 2, 3, 4, 5, 6],
            defaultLevel: 2,
          },
        },
        list: List,
        quote: Quote,
        table: Table,
        code: Code,
        // video embeds. Pasting a YouTube or Vimeo link onto an empty line
        // converts it into a player on its own — the tool registers those urls
        // as paste patterns — and the toolbar's video button does the same for
        // a link typed in rather than pasted.
        embed: {
          // cast because the tool types its own onPaste as pattern-paste only,
          // which is narrower than the BlockTool interface EditorJS declares —
          // a mismatch in the library's typings, not in how it is used here
          class: Embed as unknown as ToolConstructable,
          config: {
            services: {
              youtube: true,
              vimeo: true,
            },
          },
        },
        image: {
          class: ImageTool,
          config: {
            uploader: {
              async uploadByFile(file: File) {
                const { data, error } = await uploadFiles({
                  files: [file],
                  folder: "/product-editor-asset",
                });

                if (error || data.length === 0) {
                  alert("Uploading failed try again");
                  return { success: 0 };
                }

                return {
                  success: 1,
                  file: {
                    url: data[0].url,
                  },
                };
              },
              // lets the editor take an image that is already hosted elsewhere
              async uploadByUrl(url: string) {
                if (!isAssetUrl(url)) {
                  alert("Enter a full image url, for example https://cdn.site.com/a.jpg");
                  return { success: 0 };
                }

                return { success: 1, file: { url: url.trim() } };
              },
            },
          },
        },
        paragraph: {
          class: Paragraph as any,
          inlineToolbar: true,
        },
      },

      onReady: () => {
        editorRef.current = editor;
      },

      onChange: async (api) => {
        const output = await api.saver.save();
        onSave?.(output);
      },
    });

    return () => {
      editor.isReady
        .then(() => {
          editor.destroy();
          editorRef.current = null;
        })
        .catch(() => {});
    };
  }, []);

  return (
    <div className="grid gap-3">
      {label ? <Label className="font-semibold">{label}</Label> : null}
      <div className="border-1 border-green-600 rounded-lg">
        {/* the fixed toolbar: EditorJS only ever shows its own toolbars next
            to the selection, so this one sits above the content and stays */}
        <EditorToolbar getEditor={() => editorRef.current} />
        <div className="editor-content px-6 py-5" ref={containerRef}></div>
      </div>
    </div>
  );
}
