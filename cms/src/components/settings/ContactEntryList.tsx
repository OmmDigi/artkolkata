import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IContactEntry } from "@/types";
import { Plus, Trash2 } from "lucide-react";

interface IProps {
  entries: IContactEntry[];
  onChange: (entries: IContactEntry[]) => void;
  valueLabel: string;
  valueType?: string;
  valuePlaceholder?: string;
  labelPlaceholder?: string;
  addButtonText: string;
  emptyText: string;
}

export default function ContactEntryList({
  entries,
  onChange,
  valueLabel,
  valueType = "text",
  valuePlaceholder,
  labelPlaceholder,
  addButtonText,
  emptyText,
}: IProps) {
  const updateEntry = (index: number, patch: Partial<IContactEntry>) => {
    onChange(
      entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const addEntry = () => {
    onChange([...entries, { label: "", value: "", is_primary: false }]);
  };

  // only one entry can carry the primary flag
  const setPrimary = (index: number) => {
    onChange(entries.map((entry, i) => ({ ...entry, is_primary: i === index })));
  };

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 border border-dashed rounded-lg p-6 text-center">
          {emptyText}
        </p>
      ) : null}

      {entries.map((entry, index) => (
        <div
          key={index}
          className="border rounded-lg p-4 space-y-4 bg-white relative"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={entry.label ?? ""}
                onChange={(e) => updateEntry(index, { label: e.target.value })}
                placeholder={labelPlaceholder ?? "e.g. Support"}
              />
            </div>

            <div className="space-y-2">
              <Label>{valueLabel}</Label>
              <Input
                type={valueType}
                value={entry.value ?? ""}
                onChange={(e) => updateEntry(index, { value: e.target.value })}
                placeholder={valuePlaceholder}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio"
                name={`primary-${valueLabel}`}
                checked={entry.is_primary}
                onChange={() => setPrimary(index)}
                className="cursor-pointer"
              />
              Mark as primary
            </label>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => removeEntry(index)}
              className="flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Remove
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addEntry}
        className="flex items-center gap-1.5"
      >
        <Plus size={14} /> {addButtonText}
      </Button>
    </div>
  );
}
