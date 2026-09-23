import LabelInput from "@/components/LabelInput";
import LabelTextArea from "@/components/LabelTextArea";
import LoadingLayout from "@/components/LoadingLayout";
import OrderDocuments from "@/components/OrderDocuments";
import OrderInvoice from "@/components/OrderInvoice";
import Section from "@/components/Section";
import ShipmentBoxes from "@/components/ShipmentBoxes";
import RefundDialog from "@/components/dialogs/RefundDialog";
import SelectInput from "@/components/SelectInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ORDER_CONFIRMED,
  ORDER_PENDING,
  ORDER_RETURNED,
  ORDER_STATUS,
  PAYMENT_STATUS,
  REPLACE_INITIATED,
} from "@/constant";
import { useDoMutation } from "@/hooks/useDoMutation";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IResponse, OrderResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Calendar, MoveLeft, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const getSingleOrder = async (orderid: number) => {
  return (await api.get(`/api/v1/orders/${orderid}`)).data;
};

export default function SingleOrderPage() {
  const params = useParams();
  const [orderStatus, setOrderStatus] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);

  if (!params?.id) return <Label>Order id is required</Label>;

  const { error, data, isFetching, refetch } = useQuery<
    IResponse<OrderResponse>,
    AxiosError<IError>
  >({
    queryKey: ["get-single-order-info", params?.id],
    queryFn: () => getSingleOrder(parseInt(params.id ?? "0")),
  });

  // Set by whichever partner booked the parcel.
  const booked = !!data?.data.orderInfo.partner_order_id;

  // Which courier is live right now, for the line under the status dropdown.
  // Whether one exists no longer decides what the admin may set — see the
  // dropdown itself.
  const shippingInfo = data?.data.shippingInfo;

  const { isLoading, mutate } = useDoMutation();

  // What the customer was actually billed for delivery. The price_breakdown
  // snapshot is what the checkout page and the payment slip both show, so it
  // wins; orders placed before that column existed fall back to the flat
  // shipping_charge column.
  const orderInfo = data?.data.orderInfo;
  const parsedShipping = parseFloat(
    String(
      orderInfo?.price_breakdown?.shipping_charge ??
        orderInfo?.shipping_charge ??
        0,
    ),
  );
  const shippingCharge = Number.isFinite(parsedShipping) ? parsedShipping : 0;
  // Absent on most orders; an empty object from an older row reads the same as
  // absent, so both the number and the name have to be there to show the block.
  const gstDetails =
    orderInfo?.gst_details?.gst_number && orderInfo?.gst_details?.business_name
      ? orderInfo.gst_details
      : null;

  const shippingRuleTitle =
    orderInfo?.price_breakdown?.shipping_rule?.title ?? null;

  // What the refund panel needs. The payments row carries what was actually
  // charged; the order total is only a fallback for a row written before the
  // amount was recorded. Rounded for the same reason the api rounds it — a
  // floating point remainder would otherwise offer a refund the api refuses.
  const paymentInfo = data?.data.paymentInfo;
  const paymentStatus = paymentInfo?.status ?? "";
  const paidAmount = parseFloat(
    paymentInfo?.amount ?? orderInfo?.total_amount ?? "0",
  );
  const refundedAmount = parseFloat(paymentInfo?.refunded_amount ?? "0");
  // How they actually paid. Only ever set once the gateway has reported the
  // attempt, so every field below is rendered only when it is there.
  const instrumentDetail = paymentInfo?.instrument_detail ?? null;
  const remainingRefund =
    Math.round((paidAmount - refundedAmount) * 100) / 100;
  // Only money that actually arrived can go back, and only what is left of it.
  const canRefund =
    (paymentStatus === "PAID" || paymentStatus === "REFUNDED") &&
    remainingRefund > 0;

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

          {orderInfo?.order_date ? (
            <p className="text-sm text-gray-600 flex items-center gap-1.5">
              <Calendar size={14} className="text-gray-500" />
              Placed on {orderInfo.order_date}
              {orderInfo.order_time ? ` at ${orderInfo.order_time}` : ""}
            </p>
          ) : null}

          {orderInfo?.is_draft ? (
            <p className="rounded-md border border-gray-300 bg-gray-100 text-gray-700 text-sm px-3.5 py-2.5">
              <strong className="font-semibold">Draft.</strong> This order is
              parked: the customer cannot see it, its emails are not sent, its
              stock has been given back and it counts towards nothing on the
              dashboard. Restore it to put it back exactly where it was
              {orderInfo.drafted_at ? ` (drafted on ${orderInfo.drafted_at})` : ""}.
            </p>
          ) : null}

          {data?.data.orderInfo.is_guest_order ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-sm px-3.5 py-2.5">
              <strong className="font-semibold">Guest order.</strong> This
              customer checked out without an account, so the shipping details
              below are the only contact information on file. They can turn it
              into a full account at any time by setting a password with this
              email address.
            </p>
          ) : null}

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

                {/*
                  Only a customer buying as a business gives these, so the
                  whole block is absent on an ordinary order rather than
                  showing two empty fields. This is what the invoice is billed
                  to — if it is wrong, it has to be corrected before the
                  invoice is generated.
                */}
                {gstDetails ? (
                  <div className="space-y-2.5 rounded-md border border-gray-300 bg-gray-50 p-3.5">
                    <Label>Customer GST Details</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <LabelInput
                        label="Business Name"
                        disabled={true}
                        defaultValue={gstDetails.business_name}
                      />
                      <LabelInput
                        label="GSTIN"
                        disabled={true}
                        defaultValue={gstDetails.gst_number}
                      />
                    </div>
                  </div>
                ) : null}
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
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              {data?.data.orderInfo && params.id ? (
                <>
                  <ShipmentBoxes
                    key={data.data.orderInfo.partner_order_id ?? "unbooked"}
                    orderId={params.id}
                    orderInfo={data.data.orderInfo}
                    onSaved={() => refetch()}
                  />

                  <OrderDocuments
                    orderId={params.id}
                    orderInfo={data.data.orderInfo}
                    onGenerated={() => refetch()}
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

                  {/* payment_method above only says ONLINE or COD. This is the
                      one the customer means when they ask which card was
                      charged — it is null until the gateway reports the
                      attempt, so an unpaid online order says so instead of
                      showing an empty box. */}
                  <LabelInput
                    label="Paid Using"
                    disabled={true}
                    key={paymentInfo?.instrument_label ?? "no-instrument"}
                    defaultValue={
                      paymentInfo?.instrument_label ??
                      (orderInfo?.payment_method === "ONLINE"
                        ? "Not reported by the gateway yet"
                        : "—")
                    }
                  />

                  {instrumentDetail?.upiId ? (
                    <LabelInput
                      label="UPI ID"
                      disabled={true}
                      key={instrumentDetail.upiId}
                      defaultValue={instrumentDetail.upiId}
                    />
                  ) : null}

                  {instrumentDetail?.bank ? (
                    <LabelInput
                      label={
                        instrumentDetail.type === "NETBANKING"
                          ? "Bank"
                          : "Issuing Bank"
                      }
                      disabled={true}
                      key={instrumentDetail.bank}
                      defaultValue={instrumentDetail.bank}
                    />
                  ) : null}

                  {/* The UTR or RRN. This is the number the customer reads off
                      their own bank statement when the money left but the
                      order did not confirm, so it is what a support ticket
                      gets matched on. */}
                  {instrumentDetail?.referenceId ? (
                    <LabelInput
                      label="Bank Reference (UTR / RRN)"
                      disabled={true}
                      key={instrumentDetail.referenceId}
                      defaultValue={instrumentDetail.referenceId}
                    />
                  ) : null}

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

                {/* Refunds do not go through the status dropdown. A refund is
                    an amount and a reason, not a status, and it may or may not
                    be the gateway that moves the money — so it gets its own
                    dialog. Only staff holding the Orders permission can call
                    the endpoint behind it. */}
                {data?.data.paymentInfo ? (
                  <div className="space-y-3 border-t border-gray-200 pt-4">
                    {refundedAmount > 0 ? (
                      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Refunded</span>
                          <span>
                            ₹{refundedAmount} of ₹{paidAmount}
                            {data.data.paymentInfo.refunded_via_gateway ===
                            false
                              ? " (recorded by hand)"
                              : ` (via ${data.data.paymentInfo.provider ?? "gateway"})`}
                          </span>
                        </div>
                        {data.data.paymentInfo.refund_note ? (
                          <p className="text-gray-600">
                            {data.data.paymentInfo.refund_note}
                          </p>
                        ) : null}
                        {data.data.paymentInfo.refunded_by_name ? (
                          <p className="text-xs text-gray-500">
                            by {data.data.paymentInfo.refunded_by_name}
                            {data.data.paymentInfo.refunded_at
                              ? ` on ${new Date(data.data.paymentInfo.refunded_at).toLocaleString("en-IN")}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {canRefund ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setRefundOpen(true)}
                      >
                        <Undo2 className="w-4 h-4" />
                        Refund {remainingRefund < paidAmount ? "remaining " : ""}
                        ₹{remainingRefund}
                      </Button>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {paymentStatus === "PAID" || paymentStatus === "REFUNDED"
                          ? "Nothing left to refund on this order."
                          : `A ${paymentStatus || "PENDING"} payment cannot be refunded.`}
                      </p>
                    )}
                  </div>
                ) : null}
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

                {data?.data.orderInfo.price_breakdown?.auto_discount ? (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {data.data.orderInfo.price_breakdown.auto_discount_rule
                        ?.title ?? "Offer Discount"}
                    </span>
                    <span>
                      ₹{data.data.orderInfo.price_breakdown.auto_discount}
                    </span>
                  </div>
                ) : null}

                {data?.data.orderInfo.price_breakdown ? (
                  // GST sits inside the price, it is never added to the total
                  <div className="flex items-center justify-between text-gray-500">
                    <span className="font-semibold">
                      Includes GST (
                      {data.data.orderInfo.price_breakdown.gst_percentage}%)
                    </span>
                    <span>₹{data.data.orderInfo.price_breakdown.gst_amount}</span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    Shipping
                    {shippingRuleTitle ? (
                      <span className="block text-xs font-normal text-gray-500">
                        {shippingRuleTitle}
                      </span>
                    ) : null}
                  </span>
                  <span>
                    {shippingCharge > 0
                      ? `₹${shippingCharge.toFixed(2)}`
                      : "FREE"}
                  </span>
                </div>
                <div className="w-full border-t border-gray-300"></div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">TOTAL</span>
                  <span>₹{data?.data.orderInfo.total_amount}</span>
                </div>
              </Section>
              <Section>
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
                  disabledValues={[
                    // Booking is one-way. Once the shipment exists the order
                    // cannot go back to pending or be confirmed again, but it
                    // must still be cancellable — cancelling is exactly what
                    // an admin needs to do when a booked order goes wrong, and
                    // the API cancels it with the courier too.
                    //
                    // Never fires without a partner: nothing writes
                    // partner_order_id, so a self-shipped order stays freely
                    // movable in both directions.
                    ...(booked ? [ORDER_PENDING, ORDER_CONFIRMED] : []),
                  ]}
                />

                {/* Every other status is the admin's to set, whichever partner
                    is live.
                    
                    They used to be locked whenever any partner was configured,
                    on the reasoning that tracking scans would set them and a
                    hand-set status would only be overwritten by the next
                    webhook. That was only ever true of a partner that pushes
                    one. Bigship pushes nothing at all, so its orders could not
                    be moved past CONFIRMED by anyone — and the shipped and
                    out-for-delivery emails, which the API sends off the status
                    change, never went out either.

                    Nothing is overwritten now in any case: a courier scan can
                    no longer walk an order backwards (see the tracking sync in
                    the API), and a status set here writes the customer's
                    tracking step itself. */}
                {shippingInfo ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {shippingInfo.enabled
                      ? `${shippingInfo.partner_label} is live. Tracking scans move this on their own — set it by hand when a scan has not arrived.`
                      : `${shippingInfo.partner_label}. Nothing reports back, so every status here is set by hand.`}
                  </p>
                ) : null}

                {/* Parking is deliberately not one of the status options: the
                    order keeps the status it has, so restoring it needs no
                    guess about where it belongs. */}
                <Button
                  type="button"
                  variant={orderInfo?.is_draft ? "default" : "outline"}
                  className={
                    orderInfo?.is_draft
                      ? "mt-4 w-full bg-green-700 hover:bg-green-900"
                      : "mt-4 w-full"
                  }
                  disabled={isLoading}
                  onClick={() => {
                    const toDraft = !orderInfo?.is_draft;

                    if (
                      !confirm(
                        toDraft
                          ? "Move this order to draft? The customer stops seeing it, its emails stop going out, its stock goes back and the dashboard ignores it."
                          : "Restore this order? It goes back to the customer, to the dashboard, and takes its stock again.",
                      )
                    )
                      return;

                    mutate({
                      apiPath: `/api/v1/orders/${params.id}/draft`,
                      method: "patch",
                      formData: { is_draft: toDraft },
                      onSuccess() {
                        refetch();
                      },
                    });
                  }}
                >
                  {orderInfo?.is_draft ? "Restore From Draft" : "Move To Draft"}
                </Button>

                {/* A replacement is shipped only once the returned goods are
                    actually back, so it is a deliberate second action rather
                    than something the return books up front. The API refuses it
                    unless the order really is in the replace flow. */}
                {orderInfo?.order_status === REPLACE_INITIATED ||
                orderInfo?.order_status === ORDER_RETURNED ? (
                  <Button
                    type="button"
                    className="mt-4 w-full bg-green-700 hover:bg-green-900"
                    disabled={isLoading}
                    onClick={() => {
                      if (
                        !confirm(
                          "Book the replacement parcel with the courier? Do this only once the returned goods are back at the warehouse.",
                        )
                      )
                        return;

                      mutate({
                        apiPath: `/api/v1/orders/${params.id}/replacement-shipment`,
                        method: "post",
                        formData: {},
                        onSuccess() {
                          refetch();
                        },
                      });
                    }}
                  >
                    Book Replacement Shipment
                  </Button>
                ) : null}
              </Section>
            </div>
          </div>

          {orderInfo && paymentInfo ? (
            <RefundDialog
              open={refundOpen}
              setOpen={setRefundOpen}
              orderId={params.id ?? ""}
              orderInfo={orderInfo}
              paymentInfo={paymentInfo}
              onDone={() => refetch()}
            />
          ) : null}
        </main>
      </LoadingHandler>
    </>
  );
}
