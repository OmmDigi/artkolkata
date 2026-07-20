import Joi, { ValidationOptions } from "joi";
import { ErrorHandler } from "./ErrorHandler";

export const doValidate = <T = any>(
  schema: Joi.Schema<any>,
  value: any,
  options?: ValidationOptions
) => {
  const { error, value: myValue } = schema.validate(value, options);
  if (error) {
    throw new ErrorHandler(400, error.message);
  }
  return myValue as T;
};
