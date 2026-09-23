"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";

/**
 * The order tracking timeline, in three layers.
 *
 * Each one is useful on its own, and each one depends on less than the one
 * above it — so another project can take whichever layer matches how it
 * already fetches and lays out:
 *
 *   OrderTrackingTimeline — the steps and nothing else. React only, no data
 *                           fetching, no styling system beyond Tailwind
 *                           classes. This is the piece to copy into another
 *                           codebase.
 *   OrderTrackingPanel    — the timeline inside the card the account page
 *                           shows it in : back button, heading, order summary.
 *                           Still takes its data as props.
 *   OrderTracking         — the panel wired to this project's api. Pass it an
 *                           order number and it does the rest.
 *
 * The steps come from GET /api/v1/orders/track exactly as the api returns
 * them. Nothing here assumes how many there are or what they are called : the
 * api decides the whole journey, including the steps that have not happened
 * yet, so a new order status shows up here without this file being touched.
 */

/** One row of the timeline, as the track endpoint returns it. */
export interface OrderTrackStep {
  /** The raw order status. The api sends it; the timeline does not use it. */
  key?: string;
  /** What the customer reads, e.g. "OUT FOR DELIVERY". */
  status: string;
  /** Already formatted for display, or null for a step that has not happened. */
  date: string | null;
  completed: boolean;
  location: string | null;
}

/** The brand colour of a completed step. Overridable so this travels. */
const DEFAULT_ACCENT = "#02F8C5";

interface TimelineProps {
  steps?: OrderTrackStep[] | null;
  /** Any CSS colour. Applied inline so it is not tied to a Tailwind config. */
  accent?: string;
  isLoading?: boolean;
  /** Shown when there is nothing to draw and nothing is loading. */
  emptyMessage?: string;
  className?: string;
}

export const OrderTrackingTimeline: React.FC<TimelineProps> = ({
  steps,
  accent = DEFAULT_ACCENT,
  isLoading = false,
  emptyMessage = "Tracking updates will appear here once the order is on its way.",
  className = "",
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-500 animate-spin" />
      </div>
    );
  }

  if (!steps || steps.length === 0) {
    return <p className="text-sm text-gray-500 py-6">{emptyMessage}</p>;
  }

  return (
    <div className={`relative pl-2 md:pl-4 ${className}`}>
      {steps.map((step, idx) => (
        <div
          key={`${step.key ?? step.status}-${idx}`}
          className="flex gap-6 mb-8 last:mb-0 relative"
        >
          <div className="flex flex-col items-center z-10">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step.completed ? "text-black" : "bg-gray-200 text-gray-500"
              }`}
              style={
                step.completed ? { backgroundColor: accent } : undefined
              }
            >
              {step.completed ? "✓" : idx + 1}
            </div>
          </div>

          {/* The line down to the next step. The last step has nothing to
              join, so it does not get one. */}
          {idx < steps.length - 1 && (
            <div
              className={`absolute left-4 top-8 bottom-[-2rem] w-0.5 ${
                step.completed ? "" : "bg-gray-200"
              }`}
              style={{
                transform: "translateX(-50%)",
                ...(step.completed ? { backgroundColor: accent } : {}),
              }}
            />
          )}

          <div className="flex-1 pb-4">
            <h4
              className={`font-semibold ${
                step.completed ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {step.status}
            </h4>
            {step.date && (
              <p className="text-sm text-gray-500 mt-1">{step.date}</p>
            )}
            {step.location && (
              <p className="text-sm text-gray-500">{step.location}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

interface PanelProps extends TimelineProps {
  orderNumber?: string | null;
  trackingId?: string | null;
  /** A line under the order number — usually the first product's name. */
  subtitle?: string | null;
  heading?: string;
  /** Left out, the back button is not rendered at all. */
  onBack?: () => void;
  backLabel?: string;
  isError?: boolean;
  errorMessage?: string;
}

export const OrderTrackingPanel: React.FC<PanelProps> = ({
  orderNumber,
  trackingId,
  subtitle,
  heading = "Track Your Order",
  onBack,
  backLabel = "Back to Orders",
  isError = false,
  errorMessage = "We could not load the tracking information for this order.",
  ...timeline
}) => (
  <div className="bg-white border border-gray-200 rounded p-6">
    {onBack && (
      <button
        onClick={onBack}
        className="cursor-pointer flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 font-medium text-sm transition"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {backLabel}
      </button>
    )}

    <h2 className="text-2xl font-bold text-gray-900 mb-6">{heading}</h2>

    {/* Order Summary */}
    <div className="bg-gray-50 border border-gray-200 rounded p-4 md:p-6 mb-8">
      <div className="md:flex justify-between items-center mb-2">
        <h3 className="font-semibold text-gray-900">Order ID: {orderNumber}</h3>
        {trackingId && (
          <span className="text-sm text-gray-600">
            Tracking ID: {trackingId}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
      )}
    </div>

    {/* Tracking Steps */}
    {isError ? (
      <p className="text-sm text-gray-500 py-6">{errorMessage}</p>
    ) : (
      <OrderTrackingTimeline {...timeline} />
    )}
  </div>
);

interface OrderTrackingProps extends Omit<PanelProps, "steps" | "isLoading"> {
  /** The order to track. Nothing is requested until there is one. */
  orderNumber?: string | null;
  /**
   * Where the steps come from. Defaults to this project's track endpoint —
   * another project passes its own and keeps everything else.
   */
  fetchSteps?: (orderNumber: string) => Promise<OrderTrackStep[]>;
}

const defaultFetchSteps = async (
  orderNumber: string,
): Promise<OrderTrackStep[]> => {
  const response = await getRequest<{ data?: OrderTrackStep[] }>(
    `api/v1/orders/track?order_number=${encodeURIComponent(orderNumber)}`,
  );

  return response?.data ?? [];
};

const OrderTracking: React.FC<OrderTrackingProps> = ({
  orderNumber,
  fetchSteps = defaultFetchSteps,
  ...panel
}) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["orderTrack", orderNumber],
    queryFn: () => fetchSteps(orderNumber as string),
    enabled: !!orderNumber,
  });

  return (
    <OrderTrackingPanel
      {...panel}
      orderNumber={orderNumber}
      steps={data}
      isLoading={isLoading}
      isError={isError}
    />
  );
};

export default OrderTracking;
