import React, { useState } from "react";
import { Star, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";
import { postRequest, getRequest } from "@/lib/fetcher";
import { useRouter, usePathname } from "next/navigation";
import { useIsLoggedIn } from "@/store/useUserStore";
import { useQuery } from "@tanstack/react-query";

interface Review {
  id: number;
  user_id: string;
  stars: number;
  message: string;
  status: number;
  created_at: string;
  product_id: string;
  user_name: string;
  product_name: string;
}

interface ProductReviewSummaryProps {
  fullProduct?: any;
}

export default function ProductReviewSummary({
  fullProduct,
}: ProductReviewSummaryProps) {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(1);
  const [comment, setComment] = useState("");
  const [page, setPage] = useState(1);
  const [starFilter, setStarFilter] = useState("All Ratings");
  const [sortBy, setSortBy] = useState("Most Recent");

  const isLoggedIn = useIsLoggedIn();
  const router = useRouter();
  const pathname = usePathname();

  const getStarQuery = () => {
    if (starFilter === "5 Stars") return 5;
    if (starFilter === "4 Stars") return 4;
    if (starFilter === "3 Stars") return 3;
    if (starFilter === "2 Stars") return 2;
    if (starFilter === "1 Star") return 1;
    return "";
  };

  const {
    data: productReviewData,
    isLoading: loadingProductReview,
    error: errorProductReview,
    refetch: mutateProductReview,
  } = useQuery({
    queryKey: ["Product-Reviews", fullProduct?.id],
    queryFn: () =>
      getRequest(`/api/v1/products/reviews?product_id=${fullProduct?.id}`),
    enabled: !!fullProduct?.id,
  });
  console.log("productReviewData", productReviewData);

  const productReview = productReviewData as any;

  let allReviews: Review[] = [];
  if (productReview) {
    if (Array.isArray(productReview)) {
      allReviews = [...productReview];
    } else if (Array.isArray(productReview.data)) {
      allReviews = [...productReview.data];
    }
  }

  // Calculate summary stats using ALL reviews
  const totalReviews = allReviews.length;
  const averageRating = totalReviews
    ? (
        allReviews.reduce((acc, r) => acc + (Number(r.stars) || 0), 0) /
        totalReviews
      ).toFixed(1)
    : "0.0";

  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  allReviews.forEach((r) => {
    const starVal = Number(r.stars);
    if (starVal >= 1 && starVal <= 5) {
      ratingCounts[starVal as keyof typeof ratingCounts]++;
    }
  });

  // Client-side filtering
  const targetStar = getStarQuery();
  let displayedReviews = allReviews.filter((r) => {
    if (targetStar) return Number(r.stars) === targetStar;
    return true;
  });

  // Client-side sorting
  if (sortBy === "Highest Rating") {
    displayedReviews.sort((a, b) => Number(b.stars) - Number(a.stars));
  } else if (sortBy === "Lowest Rating") {
    displayedReviews.sort((a, b) => Number(a.stars) - Number(b.stars));
  } else if (sortBy === "Most Recent") {
    displayedReviews.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  // Client-side pagination
  const itemsPerPage = 5;
  const totalPages = Math.ceil(displayedReviews.length / itemsPerPage);
  const paginatedReviews = displayedReviews.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  const handleWriteReviewClick = () => {
    if (!isLoggedIn) {
      toast.info("Please login to write a review.");
      router.push(`/account?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    setShowReviewForm(true);
  };

  const handleSubmitReview = async () => {
    if (!rating || !comment.trim()) {
      toast.error("Please provide a rating and comment.");
      return;
    }
    const newReview = {
      stars: rating,
      message: comment,
      product_id: fullProduct?.id,
    };

    try {
      const response: any = await postRequest({
        url: "/api/v1/products/reviews",
        body: newReview,
      });
      toast.success(response?.message || "Review submitted successfully!");
      mutateProductReview();
      setRating(1);
      setComment("");
      setShowReviewForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to submit review");
    }
  };

  // Summary is already calculated above

  return (
    <div className="max-w-9xl mx-auto py-12 px-4 font-sans bg-white">
      {/* Title Area */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-16 h-px bg-gray-300"></div>
          <div className="text-orange-500 transform rotate-45 scale-75">
            <div className="w-3 h-3 bg-orange-500"></div>
          </div>
          <div className="w-16 h-px bg-gray-300"></div>
        </div>
        <h2 className="text-4xl md:text-5xl font-serif font-bold text-slate-800 tracking-wide uppercase mb-2">
          Customer Reviews
        </h2>
        <p className="text-gray-500 text-lg">
          Real Reviews From Real Customers
        </p>
      </div>

      {/* Main Content: Two Columns on Desktop */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Left Column: Review Summary */}
        <div className="w-full lg:w-1/4  flex flex-col gap-2">
          {/* Score */}
          <div className="flex flex-col items-center border-b lg:border-b-0 lg:border-b border-gray-100 pb-8 lg:pb-0">
            <div className="text-[40px] font-bold text-orange-500 leading-none mb-4">
              {averageRating}
            </div>
            <div className="flex gap-1.5 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  className={
                    star <= Math.round(Number(averageRating))
                      ? "fill-orange-500 text-orange-500"
                      : "fill-gray-200 text-gray-200"
                  }
                />
              ))}
            </div>
            <div className="text-gray-800 font-bold text-lg mb-6">
              {totalReviews} Customer Reviews
            </div>

            <div className="w-full max-w-[250px] h-px bg-gray-300 mb-6 relative">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-orange-500 rounded-full"></div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-orange-500">
                <ShieldCheck size={32} className="stroke-[1.5]" />
              </div>
              <div className="text-sm text-left">
                <div className="text-gray-500">All reviews are from</div>
                <div className="font-bold text-green-600">
                  verified purchases
                </div>
              </div>
            </div>
          </div>

          {/* Rating Summary Bars */}
          <div className="w-full  flex flex-col">
            <div className="w-full flex flex-col ">
              <h3 className="text-xl font-bold text-gray-800 mb-6 uppercase tracking-wider text-center lg:text-left">
                Rating Summary
              </h3>
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingCounts[star as keyof typeof ratingCounts];
                  const percentage = totalReviews
                    ? Math.round((count / totalReviews) * 100)
                    : 0;
                  return (
                    <div
                      key={star}
                      className="flex items-center gap-2 text-[15px] font-medium text-blue-600"
                    >
                      <div className="w-14 shrink-0">{star} star</div>
                      <div className="flex-1 h-3 bg-gray-200 rounded-sm overflow-hidden flex shadow-inner">
                        <div
                          className="h-full bg-orange-500 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="w-12 text-right text-gray-500 shrink-0">
                        {percentage}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Reviews List Area */}
        <div className="w-full lg:w-3/4 md:px-10">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800 uppercase tracking-wider mb-4 md:mb-0">
              Reviews ({totalReviews})
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Filter:</span>
                <select
                  value={starFilter}
                  onChange={(e) => {
                    setStarFilter(e.target.value);
                    setPage(1); // Reset to page 1 on filter change
                  }}
                  className="border border-gray-300 rounded px-3 py-1.5 bg-white text-gray-700 outline-none focus:border-orange-500"
                >
                  <option>All Ratings</option>
                  <option>5 Stars</option>
                  <option>4 Stars</option>
                  <option>3 Stars</option>
                  <option>2 Stars</option>
                  <option>1 Star</option>
                </select>
              </div>
            </div>
          </div>

          {loadingProductReview ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : paginatedReviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No reviews found for this filter.
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedReviews.map((review: Review) => (
                <div
                  key={review.id}
                  className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col sm:flex-row gap-6"
                >
                  {/* User Info */}
                  <div className="flex items-start gap-4 sm:w-1/3 shrink-0">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-lg break-words max-w-[120px]">
                        {review.user_name}
                      </h4>
                      <div className="text-sm text-gray-500 mb-2 flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <ShieldCheck
                            size={16}
                            className="text-green-600 shrink-0"
                          />
                          <span className="text-green-600 font-medium whitespace-nowrap text-xs">
                            Verified
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Review Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2 gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={16}
                              className={
                                star <= review.stars
                                  ? "fill-orange-500 text-orange-500"
                                  : "fill-gray-200 text-gray-200"
                              }
                            />
                          ))}
                        </div>
                        <span className="border border-orange-500 text-orange-500 text-xs px-1.5 py-0.5 rounded font-bold">
                          {Number(review.stars).toFixed(1)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">
                        {review.created_at}
                      </div>
                    </div>
                    <h5 className="font-bold text-gray-800 mb-2 truncate">
                      {review.product_name}
                    </h5>
                    <p className="text-gray-600 mb-4 text-sm">
                      {review.message}
                    </p>
                  </div>
                </div>
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-4 mt-8">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={`px-3 py-1.5 border rounded-lg font-medium transition-colors text-sm ${page === 1 ? "border-gray-200 text-gray-400 cursor-not-allowed" : "border-orange-500 text-orange-500 hover:bg-orange-50"}`}
                  >
                    Previous
                  </button>
                  <div className="flex items-center justify-center font-bold text-gray-700 text-sm">
                    {page} of {totalPages}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className={`px-3 py-1.5 border rounded-lg font-medium transition-colors text-sm ${page === totalPages ? "border-gray-200 text-gray-400 cursor-not-allowed" : "border-orange-500 text-orange-500 hover:bg-orange-50"}`}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {showReviewForm ? (
            <div className="mt-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h4 className="text-lg font-bold text-gray-800 mb-4">
                Write a Review
              </h4>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      type="button"
                    >
                      <Star
                        size={32}
                        className={
                          star <= rating
                            ? "fill-orange-500 text-orange-500"
                            : "fill-gray-200 text-gray-200"
                        }
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comment
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  className="w-full text-gray-800 border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-orange-500"
                  placeholder="Share your thoughts about this product..."
                ></textarea>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleSubmitReview}
                  className="px-6 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors text-sm"
                >
                  Submit Review
                </button>
                <button
                  onClick={() => setShowReviewForm(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-8 flex justify-center lg:justify-start">
              <button
                onClick={handleWriteReviewClick}
                className="flex items-center gap-2 px-6 py-3 border-2 border-orange-500 text-orange-500 rounded-lg font-bold hover:bg-orange-50 transition-colors uppercase tracking-wide text-sm"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  ></path>
                </svg>
                Write a Review
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
