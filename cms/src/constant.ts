export const SIDEBAR_OPTIONS = {
  dropdownOptions: ["Logout"],
  navMain: [
    {
      id: "1",
      title: "Getting Started",
      url: "#",
      items: [
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
        // {
        //   id: "1-4",
        //   title: "Coupons",
        //   url: "/discount",
        // },
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
          title: "Registered Users",
          url: "/users",
        },
        {
          id: "1-12",
          title: "Staff",
          url: "/staff",
        },
        {
          id: "1-13",
          title: "Settings",
          url: "/settings",
        },
        {
          id: "1-14",
          title: "Blogs",
          url: "/blogs",
        },
      ],
    },
  ],
};

export const PREDEFINED_PRODUCT_TAGS = [
  "Best Seller",
  "Recommendation",
  "New Arrival",
  "Featured",
  "Sale",
  "Trending",
];

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

export const PAYMENT_PENDING = "PENDING";
export const PAYMENT_PAID = "PAID";
export const PAYMENT_FAILED = "FAILED";
export const PAYMENT_REFUNDED = "REFUNDED";

export const REVIEW_STATUS_NOT_APPROVED = 1;
export const REVIEW_STATUS_APPROVED = 2;

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
