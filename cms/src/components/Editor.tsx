import { useEffect, useRef } from "react";
import EditorJS, { type OutputData } from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import ImageTool from "@editorjs/image";
import Quote from "@editorjs/quote";
import Table from "@editorjs/table";
import Code from "@editorjs/code";
import Paragraph from "@editorjs/paragraph";
import { Label } from "./ui/label";
import { uploadFiles } from "@/utils/uploadFiles";

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
        header: Header,
        list: List,
        quote: Quote,
        table: Table,
        code: Code,
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
      <div
        // style={{ border: "1px solid #ccc", padding: "10px" }}
        className="border-1 border-green-600 px-6 py-5 rounded-lg"
        ref={containerRef}
      ></div>
    </div>
  );
}
