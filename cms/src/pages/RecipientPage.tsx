// import LabelInput from "@/components/LabelInput";
// import { Button } from "@/components/ui/button";
// import { uploadFiles } from "@/utils/uploadFiles";
// import { Loader, Plus, Trash } from "lucide-react";
// import { useRef, useState } from "react";

// interface RecipientList {
//   id: number | null;
//   tag_name: string | null;
//   url: string | null;
// }

// export default function RecipientPage() {
//   const inputRefList = useRef<(HTMLInputElement | null)[]>([]);
//   const [list, setList] = useState<RecipientList[]>([
//     { id: null, tag_name: null, url: null },
//   ]);

//   const [isLoadingArr, setIsLoadingArr] = useState(list.map((_) => false));

//   return (
//     <div className="space-y-6">
//       <div className="flex items-center justify-between">
//         <h2 className="font-semibold text-2xl">Receipient</h2>
//         <Button
//           onClick={() => {
//             if (list.length >= 5)
//               return alert("Your are not able to add more than 5 items");
//             setList((prev) => [
//               ...prev,
//               { id: null, tag_name: null, url: null },
//             ]);
//           }}
//         >
//           Add New
//         </Button>
//       </div>
//       <ul className="grid grid-cols-5">
//         {list.map((item, index) => (
//           <li key={item.id ?? index} className="w-52 aspect-[9/16] space-y-3.5">
//             <input
//               ref={(r) => {
//                 inputRefList.current[index] = r;
//               }}
//               onChange={(e) => {
//                 const file = e.currentTarget.files?.[0];
//                 if (!file) return;

//                 uploadFiles({
//                   files: [file],
//                   folder: "recipient",
//                   onUploaded: (data) => {
//                     const newData = [...list];
//                     newData[index].url = data[0].url;
//                     setList(newData);

//                     setIsLoadingArr((prev) => {
//                       const copy = [...prev];
//                       copy[index] = false;
//                       return copy;
//                     });
//                   },

//                   onUploadStart: () => {
//                     setIsLoadingArr((prev) => {
//                       const copy = [...prev];
//                       copy[index] = true;
//                       return copy;
//                     });
//                   },

//                   onError: (e) => {
//                     console.log(e);
//                     setIsLoadingArr((prev) => {
//                       const copy = [...prev];
//                       copy[index] = false;
//                       return copy;
//                     });
//                   },
//                 });
//               }}
//               type="file"
//               className="hidden"
//             />
//             <button
//               disabled={isLoadingArr[index]}
//               onClick={() => {
//                 inputRefList.current[index]?.click();
//               }}
//               className="w-52 aspect-[9/16] bg-gray-200 flex items-center justify-center cursor-pointer"
//             >
//               {isLoadingArr[index] == true ? (
//                 <Loader className="animate-spin" />
//               ) : (
//                 <>
//                   {item.url == null ? (
//                     <Plus />
//                   ) : (
//                     <img
//                       src={item.url}
//                       className="h-full w-full object-cover"
//                     />
//                   )}
//                 </>
//               )}
//             </button>
//             <div className="w-full space-y-1.5">
//               <LabelInput
//                 onChange={(e) => {
//                   const newData = [...list];
//                   newData[index].tag_name = e.currentTarget.value;
//                   setList(newData);
//                 }}
//                 placeholder="Type Tag Name"
//                 defaultValue={item.tag_name ?? ""}
//               />

//               <Button
//                 onClick={() => {
//                   setList((prev) => prev.filter((f, i) => {
//                     if(f.id != null && item.id != null) {
//                       return i != index
//                     } else {
//                       return item
//                     }
//                   }));
//                 }}
//                 className="bg-red-500 w-full"
//               >
//                 Delete
//               </Button>
//             </div>
//           </li>
//         ))}
//       </ul>

//       <div className="flex items-center justify-center">
//         <Button>Save Changes</Button>
//       </div>
//     </div>
//   );
// }

import RecipientDialog from "@/components/dialogs/RecipientDialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDoMutation } from "@/hooks/useDoMutation";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IRecipient, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Loader, Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";
// import { useSearchParams } from "react-router-dom";

const getRecipientList = async () =>
  (await api.get("/api/v1/products/recipient")).data;

export default function RecipientPage() {
  const [open, setOpen] = useState(false);
  const [itemid, setItemId] = useState(0);

  // const [searchParams] = useSearchParams();

  // const currentPage = parseInt(searchParams.get("page") ?? "1");

  const { isLoading, mutate } = useDoMutation();

  const { data, isFetching, error, refetch } = useQuery<
    IResponse<IRecipient[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-recipient-list"],
    queryFn: getRecipientList,
  });

  return (
    <>
      <RecipientDialog
        key={`${itemid}`}
        open={open}
        setOpen={setOpen}
        item_id={itemid}
      />
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-2xl">Recipient List</h2>
          <Button
            onClick={() => {
              if ((data?.data.length || 0) >= 5)
                return alert("Not able to add more than 5 tags");
              setItemId(0);
              setOpen(true);
            }}
            variant="own"
            className="flex items-center gap-1.5"
          >
            <Plus />
            Add New Recipient
          </Button>
        </div>
        <LoadingHandler
          loading={isFetching}
          error={error}
          length={data?.data.length}
          noDataMsg="No tags found"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-green-600 hover:!bg-green-600">
                <TableHead className="w-[100px] text-white">Tag Name</TableHead>
                <TableHead className="text-white text-center">Status</TableHead>
                <TableHead className="text-right text-white">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {data?.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {/* <div className="flex items-center gap-2">
                      <div className="h-20 aspect-square overflow-hidden rounded-xl bg-gray-300">
                        <img
                          className="size-full object-cover"
                          alt={item.alt_tag ?? undefined}
                          title={item.alt_tag ?? undefined}
                          src={item.image}
                        />
                      </div>
                      {item.name}
                    </div> */}
                    {item.tag_name}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.status == 1 ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-green-700 text-white shadow-2xl">
                        Published
                      </span>
                    ) : (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-red-700 text-white shadow-2xl">
                        Private
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-5">
                      <Pencil
                        className="cursor-pointer"
                        onClick={() => {
                          setItemId(item.id);
                          setOpen(true);
                        }}
                        size={16}
                      />
                      {isLoading ? (
                        <Loader size={16} className="animate-spin" />
                      ) : (
                        <Trash
                          className="cursor-pointer"
                          onClick={() => {
                            if (
                              !confirm(
                                "Are you sure you want to remove this category ?"
                              )
                            )
                              return;
                            mutate({
                              apiPath: "/api/v1/products/recipient",
                              method: "delete",
                              id: item.id,
                              onSuccess() {
                                refetch();
                              },
                            });
                          }}
                          size={16}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* <PaginationComp
            totalPage={-1}
            page={currentPage}
            totalItems={categoryData.length}
            onPageChange={(page) => {
              setSearchParams((prev) => {
                prev.set("page", page.toString());
                return prev;
              });
            }}
          /> */}
        </LoadingHandler>
      </div>
    </>
  );
}
