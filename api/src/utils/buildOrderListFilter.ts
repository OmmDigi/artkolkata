import { Request } from "express";
import { resolveDateRange } from "./resolveDateRange";

/**
 * The WHERE clause behind the CMS order list, shared with the Excel export so
 * the file an admin downloads is exactly the rows they were looking at.
 *
 * Every value goes in as a placeholder; only fixed SQL fragments are
 * concatenated.
 */
export function buildOrderListFilter(query: Request["query"]) {
  let filter = "WHERE 1=1";
  let placeholder = 1;
  const filterValues: any[] = [];

  if (query.orderid) {
    filter += ` AND o.order_number = $${placeholder++}`;
    filterValues.push(query.orderid);
  }

  /**
   * from/to are calendar dates picked in the CMS, both inclusive: "1st to 5th"
   * has to contain everything placed on the 5th. resolveDateRange turns them
   * into IST midnight of `from` and IST midnight after `to`, and each bound is
   * converted into the database's own clock (see REPORTING_TIMEZONE for why),
   * so this stays one range scan on idx_orders_created_at.
   */
  if (query.from && query.to) {
    const range = resolveDateRange({
      range: "custom",
      start_date: query.from.toString(),
      end_date: query.to.toString(),
    });
    filter += ` AND o.created_at >= ($${placeholder++}::timestamptz AT TIME ZONE current_setting('TimeZone'))`;
    filter += ` AND o.created_at < ($${placeholder++}::timestamptz AT TIME ZONE current_setting('TimeZone'))`;
    filterValues.push(range.startAt);
    filterValues.push(range.endAt);
  }

  if (query.pstatus) {
    filter += ` AND o.payment_status = $${placeholder++}`;
    filterValues.push(query.pstatus);
  }

  if (query.ostatus) {
    filter += ` AND o.order_status = $${placeholder++}`;
    filterValues.push(query.ostatus);
  }

  // COD or ONLINE — anything else is ignored rather than matching nothing.
  if (query.pmode === "COD" || query.pmode === "ONLINE") {
    filter += ` AND o.payment_method = $${placeholder++}`;
    filterValues.push(query.pmode);
  }

  /**
   * Drafts are parked orders — a test, a duplicate, a phone order keyed in
   * wrong — and they are off every screen but the one that asks for them.
   * ?draft=true is that screen: it shows drafts and nothing else, so the two
   * views never overlap and a total taken from either one is honest.
   */
  if (query.draft === "true") {
    filter += ` AND o.is_draft = true`;
  } else {
    filter += ` AND COALESCE(o.is_draft, false) = false`;
  }

  // "Show me only the orders nobody was logged in for." Read off the order, not
  // the customer, so a guest who has since made an account does not quietly
  // drop out of the list.
  if (query.customer_type === "guest") {
    filter += ` AND o.is_guest_order = true`;
  } else if (query.customer_type === "registered") {
    filter += ` AND COALESCE(o.is_guest_order, false) = false`;
  }

  return { filter, filterValues };
}
