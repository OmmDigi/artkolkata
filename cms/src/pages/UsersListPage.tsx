import { PaginationComp } from "@/components/PaginationComp";
import SearchBar from "@/components/SearchBar";
import SelectInput from "@/components/SelectInput";
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
import { CUSTOMER_TYPE } from "@/constant";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IResponse, IUsers } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ExternalLink, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const getUserList = async (page: number, filters: string, role : "User" | "Employee") => {
  let endPoint = "";
  if(role == "User") {
    endPoint = "users"
  } else {
    endPoint = "users/employee"
  }
  return (await api.get(`/api/v1/${endPoint}?page=${page}&${filters}`)).data;
};

interface IProps {
  role: "User" | "Employee";
  heading?: string;
}

export default function UsersListPage({ role = "User", heading }: IProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryParams, setQueryParams] = useState("");
  const navigator = useNavigate();

  const currentPage = parseInt(searchParams.get("page") ?? "1");
  const { isFetching, error, data } = useQuery<
    IResponse<IUsers[]>,
    AxiosError<IError>
  >({
    queryKey: ["users-list", currentPage, queryParams, role],
    queryFn: () => getUserList(currentPage, queryParams, role),
  });

  useEffect(() => {
    // optimize the search params
    const searchBy = searchParams.get("search_by");
    const searchValue = searchParams.get("search_value");

    const urlSearchParams = new URLSearchParams();
    // urlSearchParams.set("role", role);
    if (searchBy && searchValue) {
      urlSearchParams.set(searchBy, searchValue);
    }

    // Guests and registered customers share the users table. Left off, the API
    // returns both, which is what this screen showed before guest checkout.
    const customerType = searchParams.get("customer_type");
    if (customerType) {
      urlSearchParams.set("customer_type", customerType);
    }

    setQueryParams(urlSearchParams.toString());
  }, [searchParams.toString()]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center">
        <h2 className="font-semibold text-xl flex-1">
          {heading ?? "Users List"}
        </h2>
        <div className="flex items-end gap-3">
          <Button
            onClick={() => {
              if (role === "User") {
                navigator("/users/new");
              } else {
                navigator("/staff/new");
              }
            }}
            variant="outline"
          >
            <Plus /> Add New {role}
          </Button>
          <SearchBar
            options={[
              { text: "User Name", value: "name" },
              { text: "Email", value: "email" },
              { text: "Phone Number", value: "phone_no" },
            ]}
          />

          {/* Staff are never guests, so the split only makes sense for customers. */}
          {role === "User" ? (
            <SelectInput
              label="Customer Type"
              options={CUSTOMER_TYPE}
              defaultValue={searchParams.get("customer_type") ?? undefined}
              onValueChange={(value) =>
                setSearchParams((prev) => {
                  prev.set("customer_type", value);
                  prev.delete("page");
                  return prev;
                })
              }
            />
          ) : null}
          <Button
            title="Reset filter"
            onClick={() => {
              setSearchParams({});
            }}
          >
            <RotateCcw size={12} />
          </Button>
        </div>
      </div>
      <LoadingHandler
        error={error}
        loading={isFetching}
        length={data?.data.length}
      >
        <ScrollArea className="w-full whitespace-nowrap pb-3.5">
          <Table className="w-max">
            <TableHeader>
              <TableRow className="*:min-w-52 bg-green-600 hover:!bg-green-600 *:text-white">
                <TableHead className="sticky top-0 left-0 z-20">
                  USER NAME
                </TableHead>
                <TableHead>USER EMAIL</TableHead>
                <TableHead>USER PHONE NUMBER</TableHead>
                <TableHead>ROLE</TableHead>
                <TableHead>IS VERIFIED</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <span className="block">
                      {user.name}
                      {/* No password, never verified : this row exists only
                          because someone checked out as a guest with this
                          email. It cannot be logged into. */}
                      {user.is_guest ? (
                        <span
                          title="Created by a guest checkout, no password set"
                          className="ml-2 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5"
                        >
                          Guest
                        </span>
                      ) : null}
                    </span>
                    <div className="flex items-center gap-3.5">
                      <Link
                        to={`/${role == "User" ? "users" : "staff"}/${user.id}`}
                        className="underline text-green-600 cursor-pointer flex items-center gap-1"
                      >
                        Edit
                        <ExternalLink size={12} />
                      </Link>

                      {role == "Employee" ? (
                        <Link
                          to={`/staff/${user.id}/#permissions`}
                          className="underline text-blue-600 cursor-pointer flex items-center gap-1"
                        >
                          Permissions
                          <ExternalLink size={12} />
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone_no}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    {user.is_active == true ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-green-700 text-white shadow-2xl">
                        Active
                      </span>
                    ) : (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-red-600 text-white shadow-2xl">
                        Inactive
                      </span>
                    )}
                  </TableCell>

                  {/* <TableCell>{order.order_date}</TableCell> */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar className="z-30" orientation="horizontal" />
        </ScrollArea>

        <PaginationComp
          totalPage={-1}
          page={currentPage}
          totalItems={data?.data.length}
          onPageChange={(page) => {
            setSearchParams((prev) => {
              prev.set("page", page.toString());
              return prev;
            });
          }}
        />
      </LoadingHandler>
    </div>
  );
}
