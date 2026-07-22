import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

interface IProps {
  totalPage: number | undefined;
  page: number;
  onPageChange?: (page: number) => void;
  onPageClick?: (page: number) => void;
  loading?: boolean;
  totalItems?: number;
}

const MAX_PAGE = 5;
export function PaginationComp({
  totalPage = -1,
  page,
  onPageChange,
  onPageClick,
  loading = false,
  totalItems = 10,
}: IProps) {
  const [array, setArray] = useState<number[]>([]);
  const currentClickedNavBtn = useRef<"next" | "prev" | "none">("none");

  useEffect(() => {
    setArray(() => {
      if (totalPage >= MAX_PAGE) return [1, 2, 3, 4, 5];
      return Array.from({ length: totalPage }, (_, i) => i + 1);
    });
  }, [totalPage]);

  const handleNextBtn = () => {
    currentClickedNavBtn.current = "next";
    if (totalPage !== -1) {
      setArray((prev) => prev.map((item) => item + 1));
    } else {
      onPageChange?.(page + 1);
      onPageClick?.(page + 1);
    }
  };

  const handlePrevBtn = () => {
    currentClickedNavBtn.current = "prev";
    if (totalPage !== -1) {
      setArray((prev) => prev.map((item) => item - 1));
    } else {
      if (page !== 1) {
        onPageChange?.(page - 1);
        onPageClick?.(page - 1);
      }
    }
  };

  const nextButtonDisibility =
    totalItems < 10
      ? true
      : totalPage === -1
      ? false
      : array[MAX_PAGE - 1] === undefined || array[MAX_PAGE - 1] >= totalPage;

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          {loading && currentClickedNavBtn.current === "prev" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Button
              disabled={array[0] === 1}
              variant={"ghost"}
              onClick={handlePrevBtn}
            >
              <ArrowLeft />
            </Button>
          )}
        </PaginationItem>
        {array.slice().map((item) => (
          <PaginationItem key={item}>
            <Button
              onClick={() => {
                onPageChange?.(item);
                onPageClick?.(item);
              }}
              // isActive={item === page || loading}
            >
              {loading && item === page ? (
                <Loader2 className="animate-spin" />
              ) : (
                item
              )}
            </Button>
          </PaginationItem>
        ))}

        {array[MAX_PAGE - 1] === undefined ||
        array[MAX_PAGE - 1] >= totalPage ? null : (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        <PaginationItem>
          {loading && currentClickedNavBtn.current === "next" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Button
              disabled={nextButtonDisibility}
              variant={"ghost"}
              onClick={handleNextBtn}
            >
              <ArrowRight />
            </Button>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
