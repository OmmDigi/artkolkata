import ViewDescriptionDialog from "@/components/dialogs/ViewDescriptionDialog";
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
import { useInquiry } from "@/hooks/useInquiry";
import LoadingHandler from "@/middleware/LoadingHandler";
import { Eye, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

export default function InquiryListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [isOpen, setOpen] = useState(false);
  const [currentClickIndex, setCurrentClickIndex] = useState(-1);

  const currentPage = parseInt(searchParams.get("page") || "1");

  const { inquiryData, inquiryError, isInquiryFetching } = useInquiry({
    page: currentPage,
    depandencyArray: [currentPage],
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
      <section className="space-y-5 overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-2xl">Inquiries</h2>
        </div>

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
                    {/* <TableHead>Product</TableHead> */}
                    {/* <TableHead>Business Name</TableHead> */}
                    {/* <TableHead>Quantity</TableHead> */}
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
                      {/* <TableCell className="flex items-center gap-2.5 min-w-80">
                        {inquiry.product_images ? (
                          <img
                            src={inquiry.product_images?.[0].image}
                            height={60}
                            width={60}
                            className="rounded-md"
                          />
                        ) : null}

                        {inquiry.product_name}
                      </TableCell> */}
                      {/* <TableCell>{inquiry.business_name}</TableCell> */}
                      {/* <TableCell>{inquiry.quantity}</TableCell> */}
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
              onPageChange={(page) => {
                setSearchParams((prev) => {
                  prev.set("page", page.toString());
                  return prev;
                });
              }}
            />
          </div>
        </LoadingHandler>
      </section>
    </>
  );
}
