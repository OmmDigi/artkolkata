import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";

export interface IResponse<T> {
  statusCode: number;
  message: string;
  success: boolean;
  data: T;
  key: string[];
  totalPage: number;
}

export interface IContactEntry {
  label: string;
  value: string;
  is_primary: boolean;
}

export interface IAddressEntry {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  map_url: string;
  is_primary: boolean;
}

export interface IPaymentMethodSettings {
  online_enabled: boolean;
  cod_enabled: boolean;
}

export interface IGuestCheckoutSettings {
  enabled: boolean;
}

export interface ISiteInfo {
  site_logo: string;
  site_logo_alt: string;
  contact_emails: IContactEntry[];
  contact_phones: IContactEntry[];
  site_addresses: IAddressEntry[];
  payment_methods?: IPaymentMethodSettings;
  // Absent means allowed — a store that has never saved the setting takes
  // guest orders, and the API defaults the same way.
  guest_checkout?: IGuestCheckoutSettings;
}

/** Guest checkout is on unless the CMS has explicitly turned it off. */
export const isGuestCheckoutEnabled = (siteInfo?: ISiteInfo | null) =>
  siteInfo?.guest_checkout?.enabled !== false;

export interface IBanner {
  id: number;
  image_url: string;
  // device specific artwork, both optional : image_url is the fallback
  mobile_image_url: string | null;
  tablet_image_url: string | null;
  alt_text: string | null;
  link_url: string | null;
  position: number;
  is_active: boolean;
}

export const formatAddress = (a: IAddressEntry) =>
  [a.line1, a.line2, a.city, a.state, a.pincode, a.country]
    .filter(Boolean)
    .join(", ");

export const useSiteInfo = () => {
  return useQuery({
    queryKey: ["site-info"],
    queryFn: async () => {
      const res = await getRequest<IResponse<ISiteInfo>>("/api/v1/settings/site-info");
      return res?.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useBanners = () => {
  return useQuery({
    queryKey: ["banners"],
    queryFn: async () => {
      const res = await getRequest<IResponse<IBanner[]>>("/api/v1/settings/banners?active=true");
      return res?.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};
