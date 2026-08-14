import LabelInput from "@/components/LabelInput";
import LabelTextArea from "@/components/LabelTextArea";
import LoadingLayout from "@/components/LoadingLayout";
import OrderInvoice from "@/components/OrderInvoice";
import Section from "@/components/Section";
import ShipmentBoxes from "@/components/ShipmentBoxes";
import SelectInput from "@/components/SelectInput";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ORDER_PACKED,
  // ORDER_CANCELLED,
  // ORDER_CONFIRMED,
  // ORDER_DELIVERED,
  // ORDER_PACKED,
  // ORDER_PENDING,
  ORDER_RETURN_INITIATED,
  ORDER_RETURNED,
  ORDER_SHIPPED,
  // ORDER_SHIPPED,
  ORDER_STATUS,
  OUT_FOR_DELIVERY,
  // OUT_FOR_DELIVERY,
  PAYMENT_STATUS,
} from "@/constant";
import { useDoMutation } from "@/hooks/useDoMutation";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IResponse, OrderResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { MoveLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const getSingleOrder = async (orderid: number) => {
  return (await api.get(`/api/v1/orders/${orderid}`)).data;
};

export default function SingleOrderPage() {
  const params = useParams();
  const [orderStatus, setOrderStatus] = useState("");

  if (!params?.id) return <Label>Order id is required</Label>;

  const { error, data, isFetching, refetch } = useQuery<
    IResponse<OrderResponse>,
    AxiosError<IError>
  >({
    queryKey: ["get-single-order-info", params?.id],
    queryFn: () => getSingleOrder(parseInt(params.id ?? "0")),
  });

  const { isLoading, mutate } = useDoMutation();

  useEffect(() => {
    if (data?.data.orderInfo.order_status) {
      setOrderStatus(data?.data.orderInfo.order_status);
    }
  }, [isFetching, params?.id]);

  return (
    <>
      {isLoading ? (
        <div className="fixed inset-0 bg-[#000000d0] z-50 flex items-center justify-center text-white">
          <LoadingLayout loadingTxt="Applying.." />
        </div>
      ) : null}

      <LoadingHandler loading={isFetching} error={error} length={1}>
        <main className="space-y-5">
          <Link
            to={"/orders"}
            className="font-semibold text-2xl inline-flex items-center gap-3.5 cursor-pointer hover:underline"
          >
            <MoveLeft className="mt-1" />
            <span>Single Order {data?.data.orderInfo.order_number}</span>
          </Link>

          <div className="grid grid-cols-3 gap-3.5">
            <div className="col-span-2 space-y-7">
              <Section>
                <Label className="text-xl">Shipping Details</Label>
                <LabelInput
                  label="Full Name"
                  disabled={true}
                  defaultValue={data?.data.addressInfo.name}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <LabelInput
                    label="Email"
                    disabled={true}
                    defaultValue={data?.data.addressInfo.email}
                  />
                  <LabelInput
                    label="Phone Number"
                    disabled={true}
                    defaultValue={data?.data.addressInfo.phone}
                  />
                </div>

                <LabelTextArea
                  label="Address"
                  disabled={true}
                  defaultValue={data?.data.addressInfo.address_line1}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <LabelInput
                    label="City"
                    disabled={true}
                    defaultValue={data?.data.addressInfo.city}
                  />
                  <LabelInput
                    label="State"
                    disabled={true}
                    defaultValue={data?.data.addressInfo.state}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <LabelInput
                    label="Pincode"
                    disabled={true}
                    defaultValue={data?.data.addressInfo.pincode}
                  />
                  <LabelInput
                    label="Country"
                    disabled={true}
                    defaultValue={"India"}
                  />
                </div>
              </Section>

              <Section>
                <Label className="text-xl">Order Summary</Label>

                <ul className="space-y-6">
                  {data?.data.orderItemsInfo.map((item) => (
                    <li
                      key={item.order_item_id}
                      className="flex items-start gap-3.5"
                    >
                      <img
                        onClick={() => {
                          window.open(item.images?.image);
                        }}
                        src={item.images?.image}
                        alt=""
                        className="cursor-pointer aspect-square w-28 object-cover shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] rounded-md"
                      />

                      <div className="space-y-1.5">
                        <h2>{item.product_name}</h2>
                        <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
                          {item.sku ? <Badge>Variant: {item.sku}</Badge> : null}
                          {item.price ? (
                            <Badge>₹{item.price} Each</Badge>
                          ) : null}
                          {item.quantity ? (
                            <Badge>Quantity: {item.quantity}</Badge>
                          ) : null}
                        </div>

                        {/* {item.status === ORDER_PENDING ? (
                          <Button
                            type="button"
                            className="bg-green-700 hover:bg-green-900"
                            onClick={() => {
                              if (
                                !confirm(
                                  "Are you sure you want to confirm the order ?"
                                )
                              )
                                return;
                              mutate({
                                apiPath: `/api/v1/orders`,
                                method: "patch",
                                formData: {
                                  status: ORDER_CONFIRMED,
                                  order_item_id: item.order_item_id,
                                },
                              });
                            }}
                          >
                            Confirm Order
                          </Button>
                        ) : (
                          <span className="inline-block font-semibold">
                            Status : {item.status}
                          </span>
                        )} */}

                        {/* <SelectInput
                          onValueChange={(value) => {
                            if (
                              !confirm(
                                "Are you sure you want to change the order item status ?"
                              )
                            )
                              return;
                            mutate({
                              apiPath: `/api/v1/orders`,
                              method: "patch",
                              formData: {
                                status: value,
                                order_item_id: item.order_item_id,
                              },
                            });
                          }}
                          options={ORDER_STATUS}
                          defaultValue={item.status}
                          disabledValues={[
                            ORDER_PACKED,
                            ORDER_SHIPPED,
                            ORDER_DELIVERED,
                            ORDER_CANCELLED,
                            ORDER_RETURNED,
                            ORDER_RETURN_INITIATED,
                          ]}
                        /> */}
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              {data?.data.orderInfo && params.id ? (
                <>
                  <ShipmentBoxes
                    key={data.data.orderInfo.bigship_order_id ?? "unbooked"}
                    orderId={params.id}
                    orderInfo={data.data.orderInfo}
                    onSaved={() => refetch()}
                  />

                  <OrderInvoice
                    orderId={params.id}
                    orderInfo={data.data.orderInfo}
                    onChanged={() => refetch()}
                  />
                </>
              ) : null}

              <Section>
                <Label className="text-xl">Payment Info</Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <LabelInput
                    label="Payment Provider"
                    disabled={true}
                    defaultValue={data?.data.paymentInfo.provider}
                  />
                  <LabelInput
                    label="Payment Order ID"
                    disabled={true}
                    defaultValue={data?.data.paymentInfo.provider_order_id}
                  />
                  <LabelInput
                    label="Payment ID"
                    disabled={true}
                    defaultValue={data?.data.paymentInfo.provider_payment_id}
                  />
                  <LabelInput
                    label="Total Amount Paid"
                    disabled={true}
                    defaultValue={data?.data.orderInfo.total_amount}
                  />

                  <LabelInput
                    label="Payment Method"
                    disabled={true}
                    defaultValue={data?.data.orderInfo.payment_method}
                  />

                  <SelectInput
                    onValueChange={(value) => {
                      if (
                        !confirm(
                          "Are you sure you want to change the payment status ?",
                        )
                      )
                        return;
                      mutate({
                        apiPath: `/api/v1/payments/${params.id}`,
                        method: "patch",
                        formData: {
                          status: value,
                        },
                      });
                    }}
                    disabled={data?.data.orderInfo.payment_method == "ONLINE"}
                    label="Payment Status"
                    options={PAYMENT_STATUS}
                    defaultValue={data?.data.paymentInfo.status}
                  />
                </div>
              </Section>
            </div>
            <div className="space-y-7">
              <Section>
                {data?.data.orderInfo.coupon_code ? (
                  <>
                    <LabelInput
                      label="Applied Coupon"
                      disabled={true}
                      defaultValue={data?.data.orderInfo.coupon_code}
                    />
                    <div className="w-full border-t border-gray-300"></div>
                  </>
                ) : null}

                <div className="flex items-center justify-between">
                  <span className="font-semibold">Subtotal</span>
                  <span>₹{data?.data.orderInfo.subtotal}</span>
                </div>
                {data?.data.orderInfo.coupon_code ? (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Discount</span>
                    <span>₹{data?.data.orderInfo.discount}</span>
                  </div>
                ) : null}

                {data?.data.orderInfo.price_breakdown ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        GST ({data.data.orderInfo.price_breakdown.gst_percentage}%)
                      </span>
                      <span>₹{data.data.orderInfo.price_breakdown.gst_amount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Shipping</span>
                      <span>
                        {data.data.orderInfo.price_breakdown.shipping_charge > 0
                          ? `₹${data.data.orderInfo.price_breakdown.shipping_charge}`
                          : "FREE"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Shipping</span>
                    <span>
                      {parseFloat(data?.data.orderInfo.shipping_charge ?? "0") > 0
                        ? `₹${data?.data.orderInfo.shipping_charge}`
                        : "FREE"}
                    </span>
                  </div>
                )}
                <div className="w-full border-t border-gray-300"></div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">TOTAL</span>
                  <span>₹{data?.data.orderInfo.total_amount}</span>
                </div>
              </Section>
              <Section>
                {/* {data?.data.orderInfo.order_status === ORDER_PENDING ? (
                  <Button
                    type="button"
                    className="bg-green-700 hover:bg-green-900"
                    onClick={() => {
                      if (
                        !confirm("Are you sure you want to confirm the order ?")
                      )
                        return;
                      mutate({
                        apiPath: `/api/v1/orders`,
                        method: "patch",
                        formData: {
                          status: ORDER_CONFIRMED,
                          order_id: params.id,
                        },
                      });
                    }}
                  >
                    Confirm Order
                  </Button>
                ) : (
                  <span className="inline-block font-semibold">
                    Status : {data?.data.orderInfo.order_status}
                  </span>
                )} */}
                <SelectInput
                  onValueChange={(value) => {
                    if (
                      !confirm(
                        "Are you sure you want to change the order status ?",
                      )
                    )
                      return;
                    mutate({
                      apiPath: `/api/v1/orders`,
                      method: "patch",
                      formData: {
                        status: value,
                        order_id: params.id,
                      },
                      onSuccess() {
                        setOrderStatus(value);
                        // Confirming books the shipment and locks the boxes,
                        // so pull the order back down rather than leaving the
                        // page showing what was true before the change.
                        refetch();
                      },
                    });
                  }}
                  label="Order Status"
                  options={ORDER_STATUS}
                  value={orderStatus}
                  disabled={!!data?.data.orderInfo.shiprocket_order_id}
                  disabledValues={[
                    ORDER_PACKED,
                    ORDER_SHIPPED,
                    OUT_FOR_DELIVERY,
                    ORDER_RETURN_INITIATED,
                    ORDER_RETURNED
                  ]}
                  // disabledValues={[
                  //   ORDER_PENDING,
                  //   data?.data.orderInfo.order_status != ORDER_PENDING ? ORDER_CONFIRMED : "",
                  //   ORDER_PACKED,
                  //   ORDER_SHIPPED,
                  //   OUT_FOR_DELIVERY,
                  //   ORDER_DELIVERED,
                  //   ORDER_CANCELLED,
                  //   ORDER_RETURNED,
                  //   data?.data.orderInfo.order_status === ORDER_DELIVERED
                  //     ? ""
                  //     : ORDER_RETURN_INITIATED,
                  // ]}
                />
              </Section>
            </div>
          </div>
        </main>
      </LoadingHandler>
    </>
  );
}
