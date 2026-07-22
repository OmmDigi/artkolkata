import { useState } from "react";

import Editor, {
  BtnBold,
  BtnItalic,
  Toolbar,
  BtnBulletList,
  BtnClearFormatting,
  BtnLink,
  BtnNumberedList,
  BtnRedo,
  BtnStrikeThrough,
  BtnStyles,
  BtnUnderline,
  BtnUndo,
  createButton,
} from "react-simple-wysiwyg";
import { Label } from "./ui/label";

interface IProps {
  onChange?: (data: string) => void;
  initialData?: string;
  label?: string;
  name?: string;
}

const BtnAlignCenter = createButton("Align center", "≡", "justifyCenter");
export default function MyEditor({
  onChange,
  initialData,
  label,
  name,
}: IProps) {
  const [value, setValue] = useState(initialData);

  return (
    <div className="grid gap-3">
      {label ? <Label className="font-semibold">{label}</Label> : null}
      <Editor
        name={name}
        className="border-1 border-green-600"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          onChange?.(event.target.value);
        }}
      >
        <Toolbar>
          <BtnUndo />
          <BtnRedo />
          <BtnBold />
          <BtnItalic />
          <BtnBulletList />
          <BtnClearFormatting />
          <BtnLink />
          <BtnNumberedList />
          <BtnStrikeThrough />
          <BtnStyles />
          <BtnUnderline />
          <BtnAlignCenter />
        </Toolbar>
      </Editor>
    </div>
  );
}
