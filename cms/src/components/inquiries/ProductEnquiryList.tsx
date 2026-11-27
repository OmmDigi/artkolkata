import ViewDescriptionDialog from "@/components/dialogs/ViewDescriptionDialog";
import { PaginationComp } from "@/components/PaginationComp";
import SelectInput from "@/components/SelectInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounce } from "@/hooks/useDebounce";
import { usePageSize } from "@/hooks/usePageSize";
import {
  PRODUCT_ENQUIRY_STATUSES,
  PRODUCT_ENQUIRY_TYPES,
  useEnquiryCategories,
  useProductEnquiries,
} from "@/hooks/useProductEnquiry";
import { cn } from "@/lib/utils";
import LoadingHandler from "@/middleware/LoadingHandler";
import type {
  IProductEnquiry,
  TProductEnquiryStatus,
  TProductEnquiryType,
} from "@/types";
import { Eye, Loader2, Phone, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

// "all" is not sent to the API, it just clears the filter
const ALL = "all";

const STATUS_STYLES: Record<TProductEnquiryStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-800 border-amber-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};

const TYPE_STYLES: Record<TProductEnquiryType, string> = {
  bulk_order: "bg-green-50 text-green-700 border-green-200",
  custom_frp_mould: "bg-purple-50 text-purple-700 border-purple-200",
};

const typeLabel = (type: TProductEnquiryType) =>
  PRODUCT_ENQUIRY_TYPES.find((option) => option.value === type)?.text ?? type;

export default function ProductEnquiryList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageSize = usePageSize();

  // filters live in the url, so a refresh or a shared link keeps them
  const page = parseInt(searchParams.get("page") || "1");
  const status = (searchParams.get("status") ?? ALL) as
    | TProductEnquiryStatus
    | typeof ALL;
  // an unknown type in a hand-edited url falls back to "all" instead of a 400
  const typeParam = searchParams.get("type");
  const type =
    PRODUCT_ENQUIRY_TYPES.find((option) => option.value === typeParam)?.value ??
    ALL;
  const categoryId = searchParams.get("category") ?? ALL;
  const [searchText, setSearchText] = useState(searchParams.get("q") ?? "");
  const search = useDebounce(searchText.trim(), 400);

  const setParam = (key: string, value: string | null) =>
    setSearchParams((prev) => {
      if (value === null || value === ALL || value === "") prev.delete(key);
      else prev.set(key, value);
      // a new filter starts from the first page
      if (key !== "page") prev.delete("page");
      return prev;
    });

  useEffect(() => {
    if (search !== (searchParams.get("q") ?? "")) setParam("q", search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const categories = useEnquiryCategories();

  const {
    enquiries,
    totalPage,
    isEnquiryLoading,
    isEnquiryFetching,
    enquiryError,
    isMutating,
    updateStatus,
    deleteEnquiry,
  } = useProductEnquiries({
    page,
    limit: pageSize,
    status: status === ALL ? undefined : status,
    type: type === ALL ? undefined : type,
    categoryId: categoryId === ALL ? undefined : Number(categoryId),
    search: search || undefined,
  });

  const [viewing, setViewing] = useState<IProductEnquiry | null>(null);

  const handleDelete = (enquiry: IProductEnquiry) => {
    if (!confirm(`Delete the enquiry from ${enquiry.name}? This can't be undone.`))
      return;
    deleteEnquiry(enquiry.id);
  };

  return (
    <div className="space-y-4">
      {viewing ? (
        <ViewDescriptionDialog
          isOpen={viewing !== null}
          setOpen={(open) => {
            if (!open) setViewing(null);
          }}
          message={viewing.message}
        />
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:w-72">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search name or phone"
            className="pl-9 border border-green-600"
          />
        </div>

        <SelectInput
          className="w-full sm:w-48"
          value={type}
          onValueChange={(value) => setParam("type", value)}
          options={[{ value: ALL, text: "All types" }, ...PRODUCT_ENQUIRY_TYPES]}
        />

        <SelectInput
          className="w-full sm:w-56"
          value={categoryId}
          onValueChange={(value) => setParam("category", value)}
          options={[
            { value: ALL, text: "All categories" },
            ...categories.map((category) => ({
              value: category.id.toString(),
              text: category.name,
            })),
          ]}
        />

        <SelectInput
          className="w-full sm:w-44"
          value={status}
          onValueChange={(value) => setParam("status", value)}
          options={[{ value: ALL, text: "All statuses" }, ...PRODUCT_ENQUIRY_STATUSES]}
        />

        {isEnquiryFetching && !isEnquiryLoading ? (
          <Loader2 size={18} className="animate-spin text-gray-400 mb-2.5" />
        ) : null}
      </div>

      <LoadingHandler
        error={enquiryError}
        length={enquiries.length}
        loading={isEnquiryLoading}
        noDataMsg={
          search || status !== ALL || type !== ALL || categoryId !== ALL
            ? "No product enquiries match these filters"
            : "No product enquiries yet"
        }
      >
        <div className="space-y-5">
          <ScrollArea className="max-w-svw whitespace-nowrap pb-3.5">
            <Table className="max-w-full">
              <TableHeader className="bg-green-600 hover:!bg-green-600">
                <TableRow className="*:bg-green-600 *:text-secondary">
                  {/* sized so the whole row, actions included, fits a
                      1366px laptop screen without scrolling sideways */}
                  <TableHead className="min-w-44">Enquiry By</TableHead>
                  <TableHead className="min-w-36">Type & Category</TableHead>
                  <TableHead className="min-w-24">Quantity</TableHead>
                  <TableHead className="min-w-56">Message</TableHead>
                  <TableHead className="min-w-28">Received At</TableHead>
                  <TableHead className="min-w-36">Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {enquiries.map((enquiry) => (
                  <TableRow key={enquiry.id}>
                    <TableCell>
                      <div className="flex flex-col gap-y-1.5">
                        <span className="font-medium">{enquiry.name}</span>
                        <a
                          href={`tel:+91${enquiry.phone}`}
                          className="flex items-center gap-1 text-green-700 hover:underline"
                        >
                          <Phone size={12} />
                          {enquiry.phone}
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      {/* the type sits above the category rather than in its
                          own column, so the row still fits a laptop screen */}
                      <span
                        className={cn(
                          "mb-1 inline-block rounded-md border px-2 py-0.5 text-xs font-medium",
                          TYPE_STYLES[enquiry.enquiry_type],
                        )}
                      >
                        {typeLabel(enquiry.enquiry_type)}
                      </span>
                      <span className="block text-wrap">{enquiry.category_name}</span>
                      {enquiry.category_id === null ? (
                        <span className="block text-xs text-gray-400">
                          category deleted
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-wrap">
                      {enquiry.quantity ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="text-wrap line-clamp-2">
                        {enquiry.message ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 text-wrap">
                      {enquiry.received_at}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={enquiry.status}
                        disabled={isMutating}
                        onValueChange={(value) =>
                          updateStatus(enquiry.id, value as TProductEnquiryStatus)
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className={cn(
                            "w-32 cursor-pointer font-medium",
                            STATUS_STYLES[enquiry.status],
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_ENQUIRY_STATUSES.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="cursor-pointer"
                            >
                              {option.text}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          disabled={!enquiry.message}
                          onClick={() => setViewing(enquiry)}
                          title="View full message"
                        >
                          <Eye size={18} />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={isMutating}
                          onClick={() => handleDelete(enquiry)}
                          title="Delete enquiry"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar className="z-30" orientation="horizontal" />
          </ScrollArea>

          <PaginationComp
            totalPage={totalPage}
            page={page}
            totalItems={enquiries.length}
            onPageChange={(next) => setParam("page", next.toString())}
          />
        </div>
      </LoadingHandler>
    </div>
  );
}
