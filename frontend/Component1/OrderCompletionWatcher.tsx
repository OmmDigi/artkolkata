"use client";

import { useEffect } from "react";
import { getRequest } from "@/lib/fetcher";
import { useCartStore } from "@/store/useCartStore";
import { getGuestOrderToken } from "@/lib/guestOrder";
import { clearPendingOrder, getPendingOrder } from "@/lib/pendingOrder";

/**
 * Empties the cart once an online payment has actually gone through.
 *
 * A COD order clears the cart at checkout, because the order is final the
 * moment the API answers. An online one is not: the customer is handed to the
 * payment gateway and comes back to /guest-order or /account?tab=orders, having
 * paid, failed, or simply closed the tab. Clearing before that would punish
 * everyone whose card was declined, so checkout leaves a marker
 * (lib/pendingOrder) and this reads the order's real payment status on the
 * next page load.
 *
 * It is mounted in the root layout because there is no single return page —
 * the guest and account paths land in different places, and a customer may
 * navigate somewhere else entirely before the app sees them again.
 */
const OrderCompletionWatcher = () => {
  useEffect(() => {
    const pending = getPendingOrder();
    if (!pending) return;

    let cancelled = false;

    const findOrder = async (): Promise<any | null> => {
      if (pending.isGuestOrder) {
        const token = getGuestOrderToken();
        // no token means no way back into the order; the marker is useless
        if (!token) return null;

        const res: any = await getRequest("/api/v1/orders/guest/order", {
          "x-guest-order-token": token,
        });
        return res?.data ?? null;
      }

      // The account path has no per-order endpoint, so the order is picked out
      // of the customer's own list by the number checkout recorded.
      const res: any = await getRequest("/api/v1/users/orders");
      return (
        (res?.data ?? []).find(
          (order: any) => order?.order_number === pending.orderNumber,
        ) ?? null
      );
    };

    findOrder()
      .then((order) => {
        if (cancelled || !order) return;

        if (order.payment_status === "PAID") {
          useCartStore.getState().clearCart();
          clearPendingOrder();
          return;
        }

        // A payment that failed outright is never coming back. Anything else
        // (still PENDING, gateway callback not in yet) keeps the marker so the
        // next page load checks again.
        if (order.payment_status === "FAILED") {
          clearPendingOrder();
        }
      })
      .catch(() => {
        // offline, expired guest token, logged out : leave the marker and the
        // cart alone rather than throwing away items nobody has paid for
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
};

export default OrderCompletionWatcher;
