export const SIDEBAR_OPTIONS = {
  dropdownOptions: ["Logout"],
  navMain: [
    {
      id: "1",
      title: "Getting Started",
      url: "#",
      items: [
        {
          id: "1-15",
          title: "Dashboard",
          url: "/",
        },
        {
          id: "1-1",
          title: "Categories",
          url: "/categories",
        },
        {
          id: "1-2",
          title: "Sub Categories",
          url: "/sub-categories",
        },
        {
          id: "1-3",
          title: "Products",
          url: "/products",
        },
        {
          id: "1-4",
          title: "Coupons",
          url: "/discount",
        },
        {
          id: "1-5",
          title: "Orders",
          url: "/orders",
        },
        {
          id: "1-6",
          title: "Reviews",
          url: "/reviews",
        },
        // {
        //   id: "1-7",
        //   title: "Recipient",
        //   url: "/recipient",
        // },
        // {
        //   id: "1-8",
        //   title: "Demo Webhook",
        //   url: "/demo-webhook",
        // },
        // {
        //   id: "1-9",
        //   title: "Media Gallery",
        //   url: "/media-gallery",
        // },
        {
          id: "1-10",
          title: "Inquiries",
          url: "/contact-list",
        },
        {
          id: "1-11",
          title: "Customers",
          url: "/users",
        },
        {
          id: "1-12",
          title: "Staff",
          url: "/staff",
        },
        {
          id: "1-14",
          title: "Blogs",
          url: "/blogs",
        },
        {
          id: "1-13",
          title: "Settings",
          url: "/settings",
        },
      ],
    },
  ],
};

export const DEFAULT_PRODUCT_VARIANT_OPTIONS = [
  {
    id: 1,
    name: "Color",
    values: [
      { id: 1, value: "Red" },
      { id: 2, value: "Blue" },
    ],
  },
];

export const ORDER_PENDING = "PENDING";
export const ORDER_CONFIRMED = "CONFIRMED";
export const ORDER_PACKED = "PACKED";
export const ORDER_SHIPPED = "SHIPPED";
export const ORDER_DELIVERED = "DELIVERED";
export const ORDER_CANCELLED = "CANCELLED";
export const ORDER_RETURNED = "RETURNED";
export const ORDER_RETURN_INITIATED = "RETURN INITIATED";
export const OUT_FOR_DELIVERY = "OUT FOR DELIVERY";
// A customer asking for a Replace instead of a Return puts the order into
// these, so the CMS has to be able to show and progress them — without them a
// replaced order shows a blank status the admin cannot move.
export const REPLACE_INITIATED = "REPLACE INITIATED";
export const REPLACED = "REPLACED";

export const PAYMENT_PENDING = "PENDING";
export const PAYMENT_PAID = "PAID";
export const PAYMENT_FAILED = "FAILED";
export const PAYMENT_REFUNDED = "REFUNDED";

export const PAYMENT_METHOD_COD = "COD";
export const PAYMENT_METHOD_ONLINE = "ONLINE";

export const REVIEW_STATUS_NOT_APPROVED = 1;
export const REVIEW_STATUS_APPROVED = 2;

// "all" is not sent to the API, it just clears the ?stars= filter.
export const REVIEW_RATING_ALL = "all";

export const REVIEW_RATINGS = [
  {
    text: "All Ratings",
    value: REVIEW_RATING_ALL,
  },
  {
    text: "5 Star",
    value: "5",
  },
  {
    text: "4 Star",
    value: "4",
  },
  {
    text: "3 Star",
    value: "3",
  },
  {
    text: "2 Star",
    value: "2",
  },
  {
    text: "1 Star",
    value: "1",
  },
];

export const ORDER_STATUS = [
  {
    text: "Pending",
    value: ORDER_PENDING,
  },
  {
    text: "Confirmed",
    value: ORDER_CONFIRMED,
  },
  {
    text: "Packed",
    value: ORDER_PACKED,
  },
  {
    text: "Shipped",
    value: ORDER_SHIPPED,
  },
  {
    text: "Our For Delivery",
    value: OUT_FOR_DELIVERY,
  },
  {
    text: "Delivered",
    value: ORDER_DELIVERED,
  },
  {
    text: "Cancelled",
    value: ORDER_CANCELLED,
  },
  {
    text: "Returned",
    value: ORDER_RETURNED,
  },
  {
    text: "Return Initiated",
    value: ORDER_RETURN_INITIATED,
  },
  {
    text: "Replace Initiated",
    value: REPLACE_INITIATED,
  },
  {
    text: "Replaced",
    value: REPLACED,
  },
];

export const PAYMENT_STATUS = [
  {
    text: "Pending",
    value: PAYMENT_PENDING,
  },
  {
    text: "Paid",
    value: PAYMENT_PAID,
  },
  {
    text: "Failed",
    value: PAYMENT_FAILED,
  },
  {
    text: "Refunded",
    value: PAYMENT_REFUNDED,
  },
];

/**
 * The sidebar id of the Orders screen. It is also what the analytics endpoints
 * require, so it is what gates the dashboard on the landing page — see
 * api/src/routes/analytics.routes.ts.
 */
export const ORDERS_PERMISSION_ID = "1-5";

/**
 * Whether an order was placed with an account or as a guest. Used by the order
 * list and the customer list, which filter on the same query parameter.
 */
export const CUSTOMER_TYPE = [
  {
    text: "Registered",
    value: "registered",
  },
  {
    text: "Guest",
    value: "guest",
  },
];

/**
 * The value the "All" entry of every filter dropdown carries. Radix refuses an
 * empty string as an item value, so "all" stands in for "no filter" and the
 * filter drops the query parameter instead of sending it.
 */
export const FILTER_ALL = "all";

const ALL_OPTION = { text: "All", value: FILTER_ALL };

/**
 * Filter-only copies of the lists above. The originals stay clean because the
 * same arrays drive the dropdowns that set a real status on an order, and "All"
 * is not a status anything can be moved to.
 */
export const ORDER_STATUS_FILTER = [ALL_OPTION, ...ORDER_STATUS];
export const PAYMENT_STATUS_FILTER = [ALL_OPTION, ...PAYMENT_STATUS];
export const CUSTOMER_TYPE_FILTER = [ALL_OPTION, ...CUSTOMER_TYPE];
