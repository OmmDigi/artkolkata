import Joi from "joi";
import { VShippingAddress } from "./order.validator";

// Storefront signup: the phone number is the account and is verified by SMS,
// so email is optional.
export const VSignUp = Joi.object({
  name: Joi.string().required().label("Full name"),
  email: Joi.string().trim().email().allow("", null).optional().label("Email"),
  phone_no: Joi.string().required().label("Phone number"),
  password: Joi.string().required().label("Password"),
});

/**
 * Login, otp and reset requests name the account by `identifier` — an email
 * or a phone number. `email` is still accepted for callers written before
 * phone login (the CMS login form), and means the same thing.
 */
const identifierFields = {
  identifier: Joi.string().trim().label("Email or phone number"),
  email: Joi.string().trim().label("Email"),
};

export const VLogin = Joi.object({
  ...identifierFields,
  password: Joi.string().required().label("Password"),
}).or("identifier", "email");

export const VValidateOtp = Joi.object({
  ...identifierFields,
  otp: Joi.string().required(),
  password: Joi.string().optional(),
}).or("identifier", "email");

export const VResendOtp = Joi.object(identifierFields).or("identifier", "email");

// CMS create/edit. Email is optional here too, or a customer who signed up by
// phone could not be edited. Not a concat of VSignUp: this one does not insist
// on an email-shaped string, as it never has.
export const VSaveUserInfo = Joi.object({
  name: Joi.string().required().label("Full name"),
  email: Joi.string().trim().allow("", null).optional().label("Email"),
  phone_no: Joi.string().required().label("Phone number"),
  password: Joi.string().required().label("Password"),
  user_id: Joi.number().optional(),
  is_verified: Joi.bool().required(),
  is_active: Joi.bool().required(),
  action : Joi.string().valid("Add", "Update").default("Update"),
  role : Joi.string().valid("User", "Employee").default("User"),
  is_guest : Joi.bool().required()
});

export const VSaveUserAddress = VShippingAddress.concat(
  Joi.object({
    address_id: Joi.number().optional(),
    user_id: Joi.number().optional(),
  }),
);

export const VSaveUserPermissions = Joi.object({
  permissions : Joi.string().required(),
  user_id : Joi.number().required()
})
