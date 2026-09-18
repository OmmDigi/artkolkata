import Joi from "joi";

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

// the strip of text shown across the site, the link behind it is optional and
// an empty one is stored as null instead of ""
const VRibbonSection = Joi.object({
  text: Joi.string().allow("", null).empty(null).default("").label("Ribbon text"),
  link: Joi.string()
    .allow("", null)
    .empty(Joi.valid("", null))
    .default(null)
    .label("Ribbon link"),
}).default({ text: "", link: null });

// Which payment methods checkout offers. Turning both off would leave the
// storefront with no way to pay at all, so that one combination is refused
// here rather than being left for a customer to discover.
const VPaymentMethods = Joi.object({
  cod_enabled: Joi.boolean().default(true).label("Cash on delivery"),
  online_enabled: Joi.boolean().default(true).label("Online payment"),
})
  .default({ cod_enabled: true, online_enabled: true })
  .custom((value, helpers) => {
    if (!value.cod_enabled && !value.online_enabled) {
      return helpers.message({
        custom:
          "At least one payment method must stay enabled, otherwise customers cannot place an order",
      } as any);
    }
    return value;
  });

// Whether checkout accepts an order from someone who is not logged in. Unlike
// the payment methods above there is no combination to refuse: turning this off
// simply means checkout asks for a login first, which is where the store was
// before guest checkout existed.
const VGuestCheckout = Joi.object({
  enabled: Joi.boolean().default(true).label("Guest checkout"),
}).default({ enabled: true });

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
  ribbon_section: VRibbonSection,
  payment_methods: VPaymentMethods,
  guest_checkout: VGuestCheckout,
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

// One slab of the shipping charge table. min is inclusive, max is exclusive,
// so (0 → 1000) and (1000 → empty) cover everything without overlapping.
export const VCreateShippingRule = Joi.object({
  title: Joi.string().required().label("Rule name"),

  min_order_amount: Joi.number()
    .min(0)
    .default(0)
    .label("Order amount from"),

  // empty means the slab has no upper bound
  max_order_amount: Joi.number()
    .min(0)
    .allow(null, "")
    .optional()
    .label("Order amount below"),

  type: Joi.string().valid("flat", "percentage", "free").required(),

  // a 'free' rule charges nothing, so its value is ignored and defaults to 0
  value: Joi.number()
    .min(0)
    .when("type", {
      is: "free",
      then: Joi.number().default(0),
      otherwise: Joi.number()
        .greater(0)
        .when("type", {
          is: "percentage",
          then: Joi.number().max(100).label("Charge percentage"),
        })
        .required(),
    })
    .label("Charge value"),

  // only meaningful for percentage rules, null/0 means no cap
  max_charge_amount: Joi.number().min(0).allow(null, "").optional(),

  payment_method: Joi.string().valid("ALL", "COD", "ONLINE").default("ALL"),

  status: Joi.string().valid("active", "disabled").default("active"),

  priority: Joi.number().integer().min(0).default(0),

  // "YYYY-MM-DDTHH:mm" like the discount dates, empty means no boundary
  starts_at: Joi.string().allow(null, "").optional(),
  ends_at: Joi.string().allow(null, "").optional(),
}).custom((value, helpers) => {
  // a slab that ends before it starts can never match anything
  if (
    value.max_order_amount !== null &&
    value.max_order_amount !== undefined &&
    value.max_order_amount !== "" &&
    Number(value.max_order_amount) <= Number(value.min_order_amount)
  ) {
    return helpers.message({
      custom: "Order amount below must be greater than order amount from",
    } as any);
  }
  return value;
});

export const VUpdateShippingRule = VCreateShippingRule.keys({
  id: Joi.number().required(),
});
