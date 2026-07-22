import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDoMutation } from "@/hooks/useDoMutation";
import type { IError, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ISettings {
  gst_percentage: number;
  shipping_charge: number;
}

export default function SettingsPage() {
  const [gst, setGst] = useState("");
  const [shipping, setShipping] = useState("");

  const { data, isFetching } = useQuery<
    IResponse<ISettings>,
    AxiosError<IError>
  >({
    queryKey: ["store-settings"],
    queryFn: () => api.get("/api/v1/settings").then((r) => r.data),
  });

  useEffect(() => {
    if (data?.data) {
      setGst(data.data.gst_percentage.toString());
      setShipping(data.data.shipping_charge.toString());
    }
  }, [data]);

  const { mutate, isLoading } = useDoMutation();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      apiPath: "/api/v1/settings",
      method: "post",
      formData: {
        gst_percentage: parseFloat(gst),
        shipping_charge: parseFloat(shipping),
      },
    });
  };

  return (
    <main className="space-y-6 max-w-lg">
      <h2 className="font-semibold text-2xl">Store Settings</h2>

      {isFetching ? (
        <span className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </span>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="border rounded-lg p-6 space-y-5">
            <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
              Order Charges
            </h3>

            <div className="space-y-2">
              <Label htmlFor="gst">GST Percentage (%)</Label>
              <Input
                id="gst"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={gst}
                onChange={(e) => setGst(e.target.value)}
                placeholder="e.g. 18"
                required
              />
              <p className="text-xs text-gray-400">
                Applied on (subtotal − discount + shipping). Set 0 to disable.
              </p>
            </div>

            {/* <div className="space-y-2">
              <Label htmlFor="shipping">Shipping Charge (₹)</Label>
              <Input
                id="shipping"
                type="number"
                min="0"
                step="0.01"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                placeholder="e.g. 100"
                required
              />
              <p className="text-xs text-gray-400">
                Fixed shipping fee per order. Set 0 for free shipping.
              </p>
            </div> */}
          </div>

          <Button
            type="submit"
            variant="own"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            Save Settings
          </Button>
        </form>
      )}
    </main>
  );
}
