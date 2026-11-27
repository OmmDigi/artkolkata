import Joi from "joi";

//Enquiry
export const VAddEnquiry = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().required(),
  message: Joi.string().optional().allow(""),
  business_name : Joi.string().optional(),
  quantity : Joi.number().optional(),
  product_id : Joi.number().optional() //this is the product id
});

// Product enquiry, from the storefront's "enquire about a product" form.
// phone is checked as an Indian mobile number in the controller, where it is
// also reduced to its 10 digits.
export const PRODUCT_ENQUIRY_STATUSES = ["new", "contacted", "closed"] as const;
export type TProductEnquiryStatus = (typeof PRODUCT_ENQUIRY_STATUSES)[number];

// what the customer wants: an order in bulk, or a custom FRP mould made
export const PRODUCT_ENQUIRY_TYPES = ["bulk_order", "custom_frp_mould"] as const;
export type TProductEnquiryType = (typeof PRODUCT_ENQUIRY_TYPES)[number];
export const PRODUCT_ENQUIRY_TYPE_LABELS: Record<TProductEnquiryType, string> = {
  bulk_order: "Bulk Order",
  custom_frp_mould: "Custom FRP Mould",
};

export const VAddProductEnquiry = Joi.object({
  name: Joi.string().trim().max(120).required().label("Name"),
  phone: Joi.string().trim().max(20).required().label("Phone"),
  enquiry_type: Joi.string()
    .valid(...PRODUCT_ENQUIRY_TYPES)
    .required()
    .label("Enquiry type")
    .messages({ "any.only": "Please choose Bulk Order or Custom FRP Mould" }),
  category_id: Joi.number().integer().positive().required().label("Product category"),
  quantity: Joi.string().trim().max(100).allow("", null).optional().label("Quantity"),
  message: Joi.string().trim().max(2000).allow("", null).optional().label("Message"),
});

// CMS list filters, all optional
export const VProductEnquiryFilters = Joi.object({
  status: Joi.string().valid(...PRODUCT_ENQUIRY_STATUSES).allow("").optional(),
  enquiry_type: Joi.string().valid(...PRODUCT_ENQUIRY_TYPES).allow("").optional(),
  category_id: Joi.number().integer().positive().allow("").optional(),
  search: Joi.string().trim().max(100).allow("").optional(),
});

export const VProductEnquiryStatus = Joi.object({
  id: Joi.number().integer().required(),
  status: Joi.string()
    .valid(...PRODUCT_ENQUIRY_STATUSES)
    .required()
    .label("Status"),
});

export const VProductEnquiryId = Joi.object({
  id: Joi.number().integer().required(),
});
