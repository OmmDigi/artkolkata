import FilePicker from "@/components/FilePicker";
import AddressList from "@/components/settings/AddressList";
import BannerManager from "@/components/settings/BannerManager";
import ContactEntryList from "@/components/settings/ContactEntryList";
import PolicyPages from "@/components/settings/PolicyPages";
import ShippingChargeRules from "@/components/settings/ShippingChargeRules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SITE_INFO_DEFAULTS, useSiteInfo } from "@/hooks/useSiteSettings";
import type { IPaymentMethodSettings, ISiteInfo } from "@/types";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  return (
    <main className="space-y-6">
      <h2 className="font-semibold text-2xl">Settings</h2>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="logo">Logo</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="phones">Phone Numbers</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="ribbon">Ribbon Section</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="shipping">Shipping Charge</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <SiteInfoTab section="general" />
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

        <TabsContent value="ribbon">
          <SiteInfoTab section="ribbon" />
        </TabsContent>

        <TabsContent value="banners">
          <div className="border rounded-lg p-6">
            <BannerManager />
          </div>
        </TabsContent>

        <TabsContent value="shipping">
          <div className="border rounded-lg p-6">
            <ShippingChargeRules />
          </div>
        </TabsContent>

        <TabsContent value="policies">
          <div className="border rounded-lg p-6">
            <PolicyPages />
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}

type SiteInfoSection =
  | "general"
  | "logo"
  | "emails"
  | "phones"
  | "addresses"
  | "ribbon";

function SiteInfoTab({ section }: { section: SiteInfoSection }) {
  const { siteInfo, isSiteInfoFetching, isSavingSiteInfo, saveSiteInfo } =
    useSiteInfo();

  // every tab edits one slice of the same site-info payload, so the whole
  // object is kept locally and posted back in full on save
  const [form, setForm] = useState<ISiteInfo>(SITE_INFO_DEFAULTS);

  useEffect(() => setForm(siteInfo), [siteInfo]);

  // older payloads may not carry the ribbon at all
  const ribbon = form.ribbon_section ?? SITE_INFO_DEFAULTS.ribbon_section;
  // same for the payment switches : a store saved before this setting existed
  // has both methods on, which is what the API assumes too
  const paymentMethods =
    form.payment_methods ?? SITE_INFO_DEFAULTS.payment_methods;

  const bothPaymentMethodsOff =
    !paymentMethods.cod_enabled && !paymentMethods.online_enabled;

  // and for the guest switch : a store saved before this setting existed allows
  // guest checkout, which is what the API assumes for a missing value too
  const guestCheckout = form.guest_checkout ?? SITE_INFO_DEFAULTS.guest_checkout;

  const setPaymentMethods = (patch: Partial<IPaymentMethodSettings>) =>
    setForm((prev) => ({
      ...prev,
      payment_methods: { ...paymentMethods, ...patch },
    }));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // the API rejects this too, this only saves the round trip
    if (bothPaymentMethodsOff) return;
    // an empty ribbon link is stored as null, never as an empty string
    saveSiteInfo({
      ...form,
      ribbon_section: {
        text: ribbon.text.trim(),
        link: ribbon.link?.trim() ? ribbon.link.trim() : null,
      },
      payment_methods: paymentMethods,
      guest_checkout: guestCheckout,
    });
  };

  if (isSiteInfoFetching) return <LoadingRow />;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="border rounded-lg p-6 space-y-5">
        {section === "general" ? (
          <>
            <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
              Payment Methods
            </h3>
            <p className="text-xs text-gray-500 max-w-lg">
              Choose what customers can pick at checkout. A method switched off
              here disappears from the storefront and is refused by the API even
              if someone tries it directly.
            </p>

            <div className="space-y-4 max-w-lg">
              <SettingToggle
                id="online_enabled"
                title="Online Payment"
                description="Cards, UPI and net banking through the payment gateway."
                checked={paymentMethods.online_enabled}
                onCheckedChange={(online_enabled) =>
                  setPaymentMethods({ online_enabled })
                }
              />

              <SettingToggle
                id="cod_enabled"
                title="Cash on Delivery"
                description="The customer pays the courier when the order arrives."
                checked={paymentMethods.cod_enabled}
                onCheckedChange={(cod_enabled) =>
                  setPaymentMethods({ cod_enabled })
                }
              />
            </div>

            {bothPaymentMethodsOff ? (
              <p className="text-xs text-red-600 max-w-lg">
                At least one payment method must stay enabled, otherwise
                customers cannot place an order.
              </p>
            ) : null}

            <div className="border-t pt-5 space-y-5">
              <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
                Checkout
              </h3>

              <div className="space-y-4 max-w-lg">
                <SettingToggle
                  id="guest_checkout_enabled"
                  title="Guest Checkout"
                  description="Let customers order without creating an account. Their email still gets the order confirmation, and they can turn it into a full account later by setting a password."
                  checked={guestCheckout.enabled}
                  onCheckedChange={(enabled) =>
                    setForm((prev) => ({
                      ...prev,
                      guest_checkout: { ...guestCheckout, enabled },
                    }))
                  }
                />
              </div>

              {!guestCheckout.enabled ? (
                <p className="text-xs text-gray-500 max-w-lg">
                  Checkout will ask every customer to log in or sign up first.
                  Orders already placed as a guest are not affected.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

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
                placeholder="e.g. Luvlette Curves"
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

        {section === "ribbon" ? (
          <>
            <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
              Ribbon Section
            </h3>

            <div className="space-y-2 max-w-lg">
              <Label htmlFor="ribbon_text">Ribbon Text</Label>
              <Input
                id="ribbon_text"
                value={ribbon.text}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    ribbon_section: { ...ribbon, text: e.target.value },
                  }))
                }
                placeholder="e.g. Free shipping on orders above ₹999"
              />
            </div>

            <div className="space-y-2 max-w-lg">
              <Label htmlFor="ribbon_link">Ribbon Link (optional)</Label>
              <Input
                id="ribbon_link"
                value={ribbon.link ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    ribbon_section: { ...ribbon, link: e.target.value },
                  }))
                }
                placeholder="https://example.com/offers"
              />
              <p className="text-xs text-gray-500">
                Leave it empty to show the text without a link.
              </p>
            </div>
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

      <SaveButton
        isLoading={isSavingSiteInfo}
        disabled={bothPaymentMethodsOff}
        text="Save Changes"
      />
    </form>
  );
}

// One labelled switch. Used for both the payment methods and the guest
// checkout setting, which are the same control with different copy.
function SettingToggle({
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border rounded-lg p-4">
      <div className="space-y-1">
        <Label htmlFor={id} className="cursor-pointer">
          {title}
        </Label>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SaveButton({
  isLoading,
  disabled,
  text,
}: {
  isLoading: boolean;
  // blocked for a reason other than a save in flight, so no spinner
  disabled?: boolean;
  text: string;
}) {
  return (
    <Button
      type="submit"
      variant="own"
      disabled={isLoading || disabled}
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
