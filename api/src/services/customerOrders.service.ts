import { pool } from "..";
import {
  ONLINE_PAYMENT,
  ORDER_DELIVERED,
  ORDER_PENDING,
} from "../constant";
import { withOrderDocumentUrls } from "../utils/orderDocumentUrls";

/**
 * The customer-facing shape of an order: what the account's order history
 * shows, and what a guest sees on their confirmation page.
 *
 * It lives here rather than in a controller because two callers need exactly
 * the same rows and the same rules. A guest order and an account order differ
 * only in how the caller proved they may see it — once past that gate, the
 * flags this query derives (is_cancelable, is_returnable, invoice_avilable)
 * have to agree, or a guest would be offered a cancel button the api then
 * refuses, or be denied one it would have honoured.
 *
 * Deliberately not the CMS shape: nothing here exposes cost, courier ids or
 * internal status history.
 *
 * Both callers also drop drafts. An order staff have parked is one they have
 * decided did not happen — a test, a duplicate, a mistyped phone order — so the
 * customer must not find it in their history or behind a guest order token,
 * and a guest lookup of one reads as "no such order" rather than as an error.
 */
const buildCustomerOrderQuery = (whereClause: string) => `
     SELECT
      o.order_id,
      o.order_number,
      TO_CHAR(o.created_at, 'DD Mon YYYY') AS order_date,
      o.order_status,
      o.total_amount,
      o.payment_method,
      o.payment_status,
      -- The frozen copy of what the customer typed at checkout. The guest
      -- confirmation page has nowhere else to read the delivery address from,
      -- and on the account side it is what the order was actually sent to,
      -- which the address book no longer tells you once it has been edited.
      o.shipping_address,
      -- The buyer's own GSTIN, when they gave one at checkout. Null on most
      -- orders. Sent so the confirmation page can show the customer what will
      -- be printed on their invoice, while there is still time to tell us it
      -- is wrong.
      o.gst_details,
      o.price_breakdown,
      o.is_guest_order,
      CASE
        WHEN o.order_status = '${ORDER_DELIVERED}' 
              AND o.payment_method = '${ONLINE_PAYMENT}' 
              AND o.updated_at >= NOW() - INTERVAL '7 days'
        THEN true
        ELSE false
      END AS is_returnable,
      CASE
        WHEN o.order_status = '${ORDER_DELIVERED}' 
              AND o.updated_at >= NOW() - INTERVAL '7 days'
        THEN true
        ELSE false
      END AS is_replaceable,
      -- True for an invoice of either kind: one an admin uploaded from the CMS,
      -- or one the CMS generated. The payment slip is neither, and every order
      -- gets one regardless of this flag.
      (
        (o.invoice_document IS NOT NULL AND o.invoice_document <> '')
        OR (o.invoice_pdf_url IS NOT NULL AND o.invoice_pdf_url <> '')
      ) AS invoice_avilable,
      o.waybill AS tracking_id,
      -- Cancelling is only offered while the order is still pending; after
      -- confirmation the shipment is already booked with the courier.
      (o.order_status = '${ORDER_PENDING}') AS is_cancelable,
      JSON_AGG(
        CASE
          WHEN oi.variant_info IS NOT NULL
          THEN JSON_BUILD_OBJECT(
          'product_name', oi.variant_info->>'product_name',
          -- the live slug wins over the snapshot, so a link keeps working after
          -- an admin edits the slug. The snapshot covers a deleted product, and
          -- orders placed before the slug was snapshotted fall back to the live
          -- lookup.
          'product_slug', COALESCE(
              (
                SELECT slug
                FROM products
                WHERE id = (oi.variant_info->>'product_id')::int
              ),
              oi.variant_info->>'product_slug'
            ),
          'variant_id', oi.variant_info->>'id',
          'product_id', oi.variant_info->>'product_id',
          'quantity', oi.quantity,
          'sku', oi.variant_info->>'sku',
          'price', oi.variant_info->'price',
          'images', COALESCE(
              oi.variant_info->'images'->0,
              (
                SELECT 
                  jsonb_build_object(
                    'image',   image,
                    'alt_tag', alt_tag 
                  )    
                FROM product_images

                WHERE product_id = (oi.variant_info->>'product_id')::int
                AND COALESCE(type, 'image') = 'image'
                ORDER BY position ASC
                LIMIT 1
              )
            )
          )
          ELSE JSON_BUILD_OBJECT(
          'product_name', oi.product_info->>'name',
          'product_slug', COALESCE(
              (
                SELECT slug
                FROM products
                WHERE id = (oi.product_info->>'id')::int
              ),
              oi.product_info->>'slug'
            ),
          'quantity', oi.quantity,
          'sku', null,
          'images', oi.product_info->'images'->0,
          'price', oi.product_info->'price'
          )
        END
      ) AS ordered_products
      FROM orders o

      LEFT JOIN order_items oi
      ON oi.order_id = o.order_id

      ${whereClause}

      GROUP BY o.order_id

      ORDER BY o.order_id DESC
    `;

/** Every order on one account, newest first. */
export const fetchOrdersForUser = async (userId: number) => {
  const { rows } = await pool.query(
    buildCustomerOrderQuery(
      "WHERE o.user_id = $1 AND COALESCE(o.is_draft, false) = false",
    ),
    [userId],
  );

  return withOrderDocumentUrls(rows);
};

/**
 * One order, by its row id.
 *
 * Takes the id and nothing else: the caller has already decided that whoever
 * is asking is allowed to see this order — a session for an account order, a
 * guest order token for a guest one — and this function does not re-litigate
 * it. Returns null when there is no such order.
 */
export const fetchCustomerOrderById = async (orderId: number) => {
  const { rows } = await pool.query(
    buildCustomerOrderQuery(
      "WHERE o.order_id = $1 AND COALESCE(o.is_draft, false) = false",
    ),
    [orderId],
  );

  return withOrderDocumentUrls(rows)[0] ?? null;
};
