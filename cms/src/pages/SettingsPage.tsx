import FilePicker from "@/components/FilePicker";
import AddressList from "@/components/settings/AddressList";
import BannerManager from "@/components/settings/BannerManager";
import ContactEntryList from "@/components/settings/ContactEntryList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDoMutation } from "@/hooks/useDoMutation";
import { SITE_INFO_DEFAULTS, useSiteInfo } from "@/hooks/useSiteSettings";
import type { IError, IResponse, ISiteInfo } from "@/types";
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
  return (
    <main className="space-y-6">
      <h2 className="font-semibold text-2xl">Settings</h2>

      <Tabs defaultValue="charges">
        <TabsList className="flex-wrap">
          <TabsTrigger value="charges">Order Charges</TabsTrigger>
          <TabsTrigger value="logo">Logo</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="phones">Phone Numbers</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
        </TabsList>

        <TabsContent value="charges">
          <OrderChargesTab />
        </TabsContent>

        <TabsContent value="logo">
          <SiteInfoTab section="logo" />
        </TabsContent>

        <TabsContent value="emails">
          <SiteInfoTab section="emails" />
        </TabsContent>

        <TabsContent value="phones">
          <SiteInfoTab section="phones" />
        </TabsContent>

        <TabsContent value="addresses">
          <SiteInfoTab section="addresses" />
        </TabsContent>

        <TabsContent value="banners">
          <div className="border rounded-lg p-6">
            <BannerManager />
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function OrderChargesTab() {
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
        shipping_charge: parseFloat(shipping || "0"),
      },
    });
  };

  if (isFetching) return <LoadingRow />;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-lg">
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

      <SaveButton isLoading={isLoading} text="Save Settings" />
    </form>
  );
}

type SiteInfoSection = "logo" | "emails" | "phones" | "addresses";

function SiteInfoTab({ section }: { section: SiteInfoSection }) {
  const { siteInfo, isSiteInfoFetching, isSavingSiteInfo, saveSiteInfo } =
    useSiteInfo();

  // every tab edits one slice of the same site-info payload, so the whole
  // object is kept locally and posted back in full on save
  const [form, setForm] = useState<ISiteInfo>(SITE_INFO_DEFAULTS);

  useEffect(() => setForm(siteInfo), [siteInfo]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSiteInfo(form);
  };

  if (isSiteInfoFetching) return <LoadingRow />;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="border rounded-lg p-6 space-y-5">
        {section === "logo" ? (
          <>
            <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
              Website Logo
            </h3>

            <FilePicker
              name="site_logo"
              label="Pick Logo"
              accept="image/*"
              folder="/site"
              fileLink={form.site_logo || undefined}
              onUploaded={(image) =>
                setForm((prev) => ({
                  ...prev,
                  site_logo: image?.downloadUrl ?? "",
                }))
              }
              onRemoved={() => setForm((prev) => ({ ...prev, site_logo: "" }))}
            />

            <div className="space-y-2 max-w-lg">
              <Label htmlFor="site_logo_alt">Logo Alt Text</Label>
              <Input
                id="site_logo_alt"
                value={form.site_logo_alt ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    site_logo_alt: e.target.value,
                  }))
                }
                placeholder="e.g. Art Kolkata"
              />
            </div>
          </>
        ) : null}

        {section === "emails" ? (
          <>
            <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
              Contact Emails
            </h3>
            <ContactEntryList
              entries={form.contact_emails}
              onChange={(contact_emails) =>
                setForm((prev) => ({ ...prev, contact_emails }))
              }
              valueLabel="Email"
              valueType="email"
              valuePlaceholder="support@example.com"
              labelPlaceholder="e.g. Support"
              addButtonText="Add Email"
              emptyText="No email added yet."
            />
          </>
        ) : null}

        {section === "phones" ? (
          <>
            <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
              Phone Numbers
            </h3>
            <ContactEntryList
              entries={form.contact_phones}
              onChange={(contact_phones) =>
                setForm((prev) => ({ ...prev, contact_phones }))
              }
              valueLabel="Phone"
              valueType="tel"
              valuePlaceholder="+91 98300 00000"
              labelPlaceholder="e.g. Sales"
              addButtonText="Add Phone Number"
              emptyText="No phone number added yet."
            />
          </>
        ) : null}

        {section === "addresses" ? (
          <>
            <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
              Addresses
            </h3>
            <AddressList
              addresses={form.site_addresses}
              onChange={(site_addresses) =>
                setForm((prev) => ({ ...prev, site_addresses }))
              }
            />
          </>
        ) : null}
      </div>

      <SaveButton isLoading={isSavingSiteInfo} text="Save Changes" />
    </form>
  );
}

function SaveButton({
  isLoading,
  text,
}: {
  isLoading: boolean;
  text: string;
}) {
  return (
    <Button
      type="submit"
      variant="own"
      disabled={isLoading}
      className="flex items-center gap-2"
    >
      {isLoading && <Loader2 size={14} className="animate-spin" />}
      {text}
    </Button>
  );
}

function LoadingRow() {
  return (
    <span className="flex items-center gap-2 text-sm text-gray-500">
      <Loader2 size={16} className="animate-spin" /> Loading…
    </span>
  );
}
