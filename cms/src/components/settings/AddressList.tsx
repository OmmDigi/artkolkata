import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IAddressEntry } from "@/types";
import { Plus, Trash2 } from "lucide-react";

const EMPTY_ADDRESS: IAddressEntry = {
  label: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  map_url: "",
  is_primary: false,
};

interface IProps {
  addresses: IAddressEntry[];
  onChange: (addresses: IAddressEntry[]) => void;
}

export default function AddressList({ addresses, onChange }: IProps) {
  const updateAddress = (index: number, patch: Partial<IAddressEntry>) => {
    onChange(
      addresses.map((address, i) =>
        i === index ? { ...address, ...patch } : address,
      ),
    );
  };

  const removeAddress = (index: number) => {
    onChange(addresses.filter((_, i) => i !== index));
  };

  // only one address can carry the primary flag
  const setPrimary = (index: number) => {
    onChange(
      addresses.map((address, i) => ({ ...address, is_primary: i === index })),
    );
  };

  return (
    <div className="space-y-4">
      {addresses.length === 0 ? (
        <p className="text-sm text-gray-400 border border-dashed rounded-lg p-6 text-center">
          No address added yet.
        </p>
      ) : null}

      {addresses.map((address, index) => (
        <div key={index} className="border rounded-lg p-4 space-y-4 bg-white">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={address.label ?? ""}
                onChange={(e) => updateAddress(index, { label: e.target.value })}
                placeholder="e.g. Head Office"
              />
            </div>

            <div className="space-y-2">
              <Label>Google Maps URL</Label>
              <Input
                value={address.map_url ?? ""}
                onChange={(e) =>
                  updateAddress(index, { map_url: e.target.value })
                }
                placeholder="https://maps.google.com/…"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address Line 1</Label>
            <Input
              value={address.line1 ?? ""}
              onChange={(e) => updateAddress(index, { line1: e.target.value })}
              placeholder="Street address"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Address Line 2</Label>
            <Input
              value={address.line2 ?? ""}
              onChange={(e) => updateAddress(index, { line2: e.target.value })}
              placeholder="Area, landmark (optional)"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={address.city ?? ""}
                onChange={(e) => updateAddress(index, { city: e.target.value })}
                placeholder="Kolkata"
              />
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={address.state ?? ""}
                onChange={(e) => updateAddress(index, { state: e.target.value })}
                placeholder="West Bengal"
              />
            </div>

            <div className="space-y-2">
              <Label>Pincode</Label>
              <Input
                value={address.pincode ?? ""}
                onChange={(e) =>
                  updateAddress(index, { pincode: e.target.value })
                }
                placeholder="700016"
              />
            </div>

            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={address.country ?? ""}
                onChange={(e) =>
                  updateAddress(index, { country: e.target.value })
                }
                placeholder="India"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio"
                name="primary-address"
                checked={address.is_primary}
                onChange={() => setPrimary(index)}
                className="cursor-pointer"
              />
              Mark as primary
            </label>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => removeAddress(index)}
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
        onClick={() => onChange([...addresses, { ...EMPTY_ADDRESS }])}
        className="flex items-center gap-1.5"
      >
        <Plus size={14} /> Add Address
      </Button>
    </div>
  );
}
