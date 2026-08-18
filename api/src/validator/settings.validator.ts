import Joi from "joi";

export const VSaveSettings = Joi.object({
  gst_percentage: Joi.number().min(0).max(100).required().label("GST %"),
  shipping_charge: Joi.number().min(0).required().label("Shipping charge"),
});

const VContactEntry = Joi.object({
  label: Joi.string().allow("", null).default(""),
  value: Joi.string().required(),
  is_primary: Joi.boolean().default(false),
});

const VAddressEntry = Joi.object({
  label: Joi.string().allow("", null).default(""),
  line1: Joi.string().required(),
  line2: Joi.string().allow("", null).default(""),
  city: Joi.string().allow("", null).default(""),
  state: Joi.string().allow("", null).default(""),
  pincode: Joi.string().allow("", null).default(""),
  country: Joi.string().allow("", null).default(""),
  map_url: Joi.string().allow("", null).default(""),
  is_primary: Joi.boolean().default(false),
});

export const VSaveSiteInfo = Joi.object({
  site_logo: Joi.string().allow("", null).default(""),
  site_logo_alt: Joi.string().allow("", null).default(""),
  contact_emails: Joi.array()
    .items(
      VContactEntry.keys({
        value: Joi.string().email({ tlds: false }).required().label("Email"),
      }),
    )
    .default([]),
  contact_phones: Joi.array()
    .items(VContactEntry.keys({ value: Joi.string().required().label("Phone") }))
    .default([]),
  site_addresses: Joi.array().items(VAddressEntry).default([]),
});

export const VCreateBanner = Joi.object({
  image_url: Joi.string().required().label("Banner image"),
  mobile_image_url: Joi.string()
    .allow("", null)
    .optional()
    .label("Mobile banner image"),
  tablet_image_url: Joi.string()
    .allow("", null)
    .optional()
    .label("Tablet banner image"),
  alt_text: Joi.string().allow("", null).optional(),
  link_url: Joi.string().allow("", null).optional(),
  position: Joi.number().integer().min(0).default(0),
  is_active: Joi.boolean().default(true),
});

export const VUpdateBanner = VCreateBanner.keys({
  id: Joi.number().integer().required(),
});

export const VReorderBanners = Joi.object({
  banners: Joi.array()
    .items(
      Joi.object({
        id: Joi.number().integer().required(),
        position: Joi.number().integer().min(0).required(),
      }),
    )
    .min(1)
    .required(),
});
