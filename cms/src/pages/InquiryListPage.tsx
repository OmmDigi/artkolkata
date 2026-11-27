import ViewDescriptionDialog from "@/components/dialogs/ViewDescriptionDialog";
import ProductEnquiryList from "@/components/inquiries/ProductEnquiryList";
import { PaginationComp } from "@/components/PaginationComp";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInquiry } from "@/hooks/useInquiry";
import { usePageSize } from "@/hooks/usePageSize";
import LoadingHandler from "@/middleware/LoadingHandler";
import { Eye, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

type TInquiryTab = "general" | "product";

export default function InquiryListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // in the url so the product enquiry alert email can link straight to its tab
  const tab: TInquiryTab =
    searchParams.get("tab") === "product" ? "product" : "general";

  return (
    <section className="space-y-5 overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-2xl">Inquiries</h2>
      </div>

      <Tabs
        defaultValue="general"
        value={tab}
        // each tab has its own filters and paging, so switching starts clean
        onValueChange={(next) =>
          setSearchParams(next === "product" ? { tab: "product" } : {})
        }
      >
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="product">Product Enquiry</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralInquiryList />
        </TabsContent>
        <TabsContent value="product">
          <ProductEnquiryList />
        </TabsContent>
      </Tabs>
    </section>
  );
}

/** the contact form inquiries, as this page showed them before the tabs */
function GeneralInquiryList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [isOpen, setOpen] = useState(false);
  const [currentClickIndex, setCurrentClickIndex] = useState(-1);

  const currentPage = parseInt(searchParams.get("page") || "1");
  const pageSize = usePageSize();

  const { inquiryData, inquiryError, isInquiryFetching } = useInquiry({
    page: currentPage,
    limit: pageSize,
    depandencyArray: [currentPage, pageSize],
  });

  return (
    <>
      {isOpen ? (
        <ViewDescriptionDialog
          isOpen={isOpen}
          setOpen={setOpen}
          message={inquiryData[currentClickIndex]?.message}
        />
      ) : null}

      <LoadingHandler
        error={inquiryError}
        length={inquiryData.length}
        loading={isInquiryFetching}
        noDataMsg="No inquiries found"
      >
        <div className="space-y-5">
          <ScrollArea className="max-w-svw whitespace-nowrap pb-3.5">
            <Table className="max-w-full">
              <TableHeader className="bg-green-600 hover:!bg-green-600">
                <TableRow className="*:min-w-52 *:bg-green-600 *:text-secondary">
                  <TableHead>Enquiry By</TableHead>
                  <TableHead>Received At</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {inquiryData.map((inquiry, index) => (
                  <TableRow key={inquiry.id}>
                    <TableCell className="min-w-80">
                      <div className="flex flex-col gap-y-1.5">
                        <span className="font-medium">{inquiry.name}</span>
                        <span className="flex items-center gap-1">
                          <Mail size={12} />
                          {inquiry.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {inquiry.phone}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{inquiry.created_at}</TableCell>
                    <TableCell className="min-w-80">
                      <span className="text-wrap line-clamp-2">
                        {inquiry.message}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => {
                          setOpen(true);
                          setCurrentClickIndex(index);
                        }}
                      >
                        <Eye size={18} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar className="z-30" orientation="horizontal" />
          </ScrollArea>

          <PaginationComp
            totalPage={-1}
            page={currentPage}
            totalItems={inquiryData.length}
            onPageChange={(page) => {
              setSearchParams((prev) => {
                prev.set("page", page.toString());
                return prev;
              });
            }}
          />
        </div>
      </LoadingHandler>
    </>
  );
}
