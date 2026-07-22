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