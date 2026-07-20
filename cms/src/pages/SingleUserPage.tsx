import LabelInput from "@/components/LabelInput";
import Section from "@/components/Section";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IResponse, IUserProfile } from "@/types";
import { api } from "@/utils/api";
import { Label } from "@radix-ui/react-label";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { MoveLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import SingleUserAddressInfo from "./SingleUserAddressInfo";
import UserOrdersItem from "./UserOrdersItem";
import ManageUserForm from "./ManageUserForm";
import { SIDEBAR_OPTIONS } from "@/constant";
import { Checkbox } from "@/components/ui/checkbox";
import { ButtonLoading } from "@/components/ui/button-loading";
import { useEffect, useState } from "react";
import { useDoMutation } from "@/hooks/useDoMutation";

const getSingleUser = async (userid: string, role: "User" | "Employee") => {
  let endUrl = "";
  if (role == "User") {
    endUrl = userid;
  } else if (role == "Employee") {
    endUrl = `employee/${userid}`;
  }
  return (await api.get(`/api/v1/users/${endUrl}`)).data;
};

interface IProps {
  role: "User" | "Employee";
}

export default function SingleUserPage({ role }: IProps) {
  const params = useParams();
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState<
    Record<string, string> | undefined
  >(undefined);

  const userid = params.id;

  if (!userid) return <Label>User Id is required</Label>;

  const { error, data, isFetching } = useQuery<
    IResponse<IUserProfile>,
    AxiosError<IError>
  >({
    queryKey: ["get-single-user-info", userid],
    enabled: userid != "new",
    queryFn: () => getSingleUser(userid, role),
  });

  useEffect(() => {
    // process permissions
    if (data?.data) {
      setPermissions(data.data.permissions);
    }
  }, [isFetching, userid]);

  const { isLoading, mutate } = useDoMutation();

  const handleSavePermission = () => {
    if (userid == "new") return alert("User must be registered first");

    mutate({
      apiPath: "/api/v1/users/employee/permission",
      method: "post",
      formData: {
        user_id: userid,
        permissions: JSON.stringify(permissions),
      },
    });
  };

  return (
    <div>
      <LoadingHandler loading={isFetching} error={error} length={1}>
        <main className="space-y-5">
          <button
            onClick={() => {
              navigate(-1);
            }}
            className="font-semibold text-2xl inline-flex items-center gap-3.5 cursor-pointer hover:underline"
          >
            <MoveLeft className="mt-1" />
            <span>{data?.data.name}</span>
          </button>

          <div className="grid grid-cols-3 gap-3.5">
            <div className="col-span-2 space-y-7">
              <Section>
                <Label className="text-xl mb-7 block">User Details</Label>
                <ManageUserForm
                  userid={userid}
                  userData={data?.data}
                  role={role}
                />
              </Section>

              {userid != "new" && role != "Employee" && (
                <SingleUserAddressInfo
                  userAddress={data?.data.user_address ?? []}
                  userid={userid}
                  role={role}
                />
              )}

              {userid != "new" && role != "Employee" && (
                <Section>
                  <Label className="text-xl mb-5 block">Order Summary</Label>

                  <UserOrdersItem userid={userid} />
                </Section>
              )}
            </div>

            <div className="space-y-7">
              {role !== "Employee" && (
                <Section>
                  <LabelInput
                    disabled
                    label="Role"
                    defaultValue={data?.data.role ?? role}
                  />
                </Section>
              )}

              {userid != "new" && role == "Employee" && (
                <Section>
                  <Label className="font-semibold inline-block">
                    Permissions
                  </Label>
                  <ul className="space-y-2">
                    {SIDEBAR_OPTIONS.navMain[0].items.map((item) => (
                      <li
                        onClick={() => {
                          if (permissions?.[item.id]) {
                            const newObj = { ...permissions };
                            delete newObj[item.id];
                            setPermissions(newObj);
                          } else {
                            setPermissions((prev) => ({
                              ...prev,
                              [item.id]: "r-w",
                            }));
                          }
                        }}
                        className="flex items-center gap-1.5 font-semibold cursor-pointer"
                      >
                        <Checkbox
                          checked={permissions?.[item.id] != undefined}
                        />
                        {item.title}
                      </li>
                    ))}
                  </ul>
                  <ButtonLoading
                    loading={isLoading}
                    disabled={permissions == undefined || isLoading}
                    onClick={handleSavePermission}
                  >
                    Update Permissions
                  </ButtonLoading>
                </Section>
              )}
            </div>
          </div>
        </main>
      </LoadingHandler>
    </div>
  );
}
