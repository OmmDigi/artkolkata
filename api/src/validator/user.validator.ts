import Joi from "joi";
import { VShippingAddress } from "./order.validator";

export const VSignUp = Joi.object({
  name: Joi.string().required().label("Full name"),
  email: Joi.string().required().label("Email"),
  phone_no: Joi.string().required().label("Phone number"),
  password: Joi.string().required().label("Password"),
});

export const VLogin = Joi.object({
  email: Joi.string().required().label("Email"),
  password: Joi.string().required().label("Password"),
});

export const VValidateOtp = Joi.object({
  otp: Joi.string().required(),
  email: Joi.string().required(),
  password: Joi.string().optional(),
});

export const VResendOtp = Joi.object({
  email: Joi.string().email().required().label("Email id"),
});

export const VSaveUserInfo = VSignUp.concat(
  Joi.object({
    user_id: Joi.number().optional(),
    is_verified: Joi.bool().required(),
    is_active: Joi.bool().required(),
    action : Joi.string().valid("Add", "Update").default("Update"),
    role : Joi.string().valid("User", "Employee").default("User")
  }),
);

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
