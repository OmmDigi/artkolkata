import LabelInput from "@/components/LabelInput";
import LabelTextArea from "@/components/LabelTextArea";
import Section from "@/components/Section";
import SelectInput from "@/components/SelectInput";
import { ButtonLoading } from "@/components/ui/button-loading";
import { Label } from "@/components/ui/label";
import { useDoMutation } from "@/hooks/useDoMutation";
import { queryClient } from "@/main";
import type { AddressInfo } from "@/types";
import { useRef, useState } from "react";

interface IProps {
  userAddress: AddressInfo[];
  userid: string;
  role: "User" | "Employee";
}

export default function SingleUserAddressInfo({
  userAddress,
  userid,
  role,
}: IProps) {
  const [selectedAddress, setSelectedAddress] = useState<AddressInfo | null>(
    userAddress.length === 0 ? null : userAddress[0],
  );
  const whichButtonClicked = useRef<"save" | "create" | "delete">("save");

  const { isLoading, mutate } = useDoMutation();

  return (
    <form
      key={selectedAddress?.address_id}
      onSubmit={(e) => {
        console.log(selectedAddress);
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("user_id", userid);

        if (selectedAddress != null) {
          formData.set("address_id", String(selectedAddress.address_id));
        }

        formData.set("country", "India");

        if (whichButtonClicked.current == "create") {
          if (!confirm("Are you sure you want to create address?")) return;
          formData.delete("address_id");
        }

        let endPoint = "";
        if (role == "User") {
          endPoint = "address";
        } else {
          endPoint = "employee/address";
        }

        if (whichButtonClicked.current == "delete") {
          if (!confirm("Are you sure you want to delete address?")) return;
          mutate({
            apiPath: `/api/v1/users/${endPoint}`,
            method: "delete",
            formData: {
              address_id: formData.get("address_id"),
              user_id: formData.get("user_id"),
            },
            onSuccess() {
              queryClient.invalidateQueries({
                queryKey: ["get-single-user-info"],
              });
            },
          });
          return;
        }

        mutate({
          apiPath: `/api/v1/users/${endPoint}`,
          method: "post",
          formData,
          onSuccess() {
            queryClient.invalidateQueries({
              queryKey: ["get-single-user-info"],
            });
          },
        });
      }}
    >
      <Section>
        <div className="flex items-center gap-3">
          <Label className="text-xl block flex-1">User Address</Label>
          <SelectInput
            options={
              userAddress.map((item, index) => ({
                text: `Address ${index + 1}`,
                value: item.address_id.toString(),
              })) ?? []
            }
            onValueChange={(value) => {
              const currentAddress = userAddress.find(
                (item) => item.address_id == parseInt(value),
              );
              if (!currentAddress) return alert("User address is required");
              setSelectedAddress(currentAddress);
            }}
            defaultValue={selectedAddress?.address_id.toString()}
          />
        </div>
        <LabelInput
          name="fullName"
          label="Full Name"
          defaultValue={selectedAddress?.name}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <LabelInput
            name="email"
            label="Email"
            defaultValue={selectedAddress?.email}
          />
          <LabelInput
            name="phone"
            label="Phone Number"
            defaultValue={selectedAddress?.phone}
          />
        </div>

        <LabelTextArea
          name="address"
          label="Address"
          defaultValue={selectedAddress?.address_line1}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <LabelInput
            name="city"
            label="City"
            defaultValue={selectedAddress?.city}
          />
          <LabelInput
            name="state"
            label="State"
            defaultValue={selectedAddress?.state}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <LabelInput
            name="pincode"
            label="Pincode"
            defaultValue={selectedAddress?.pincode}
          />
        </div>

        <div className="flex items-center gap-3">
          <ButtonLoading
            onClick={() => {
              whichButtonClicked.current = "save";
            }}
            loading={whichButtonClicked.current === "save" && isLoading}
          >
            Save
          </ButtonLoading>
          <ButtonLoading
            onClick={() => {
              whichButtonClicked.current = "create";
            }}
            variant="own"
            loading={whichButtonClicked.current === "create" && isLoading}
          >
            Create
          </ButtonLoading>
          <ButtonLoading
            onClick={() => {
              whichButtonClicked.current = "delete";
            }}
            variant="destructive"
            loading={whichButtonClicked.current === "delete" && isLoading}
          >
            Delete
          </ButtonLoading>
        </div>
      </Section>
    </form>
  );
}
