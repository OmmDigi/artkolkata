import { ICreateShipment } from "../types";
import { api } from "./axios";

export const isDelhiveryAvilable = async (pincode: string) => {
  const result = (
    await api.get(`/c/api/pin-codes/json/?filter_codes=${pincode}`)
  ).data;
  return result.delivery_codes.length !== 0;
};

export const createShipment = async (data: ICreateShipment) => {
  await api.post(
    `/api/cmu/create.json`,
    {
      ...data,
      pickup_location: {
        name: process.env.PICKUP_LOCATION,
      },
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );
};
