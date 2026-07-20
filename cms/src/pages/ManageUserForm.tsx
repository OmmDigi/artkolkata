import LabelInput from "@/components/LabelInput";
import SelectInput from "@/components/SelectInput";
import { ButtonLoading } from "@/components/ui/button-loading";
import { useDoMutation } from "@/hooks/useDoMutation";
import { queryClient } from "@/main";
import type { IUserProfile } from "@/types";

interface IProps {
  userid: string;
  userData?: IUserProfile;
  role: "User" | "Employee";
}

export default function ManageUserForm({ userid, userData, role }: IProps) {
  const { isLoading, mutate } = useDoMutation();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        if (userid != "new") {
          formData.set("user_id", userid);
        }

        formData.set("role", role);

        let endPoint = "";
        if (role == "User") {
          endPoint = "save";
        } else {
          endPoint = "employee/save";
        }

        mutate({
          apiPath: `/api/v1/users/${endPoint}`,
          formData,
          method: "post",
          onSuccess() {
            queryClient.invalidateQueries({
              queryKey: ["get-single-user-info"],
            });
          },
        });
      }}
    >
      <LabelInput
        name="name"
        label="User Name"
        defaultValue={userData?.name}
        required
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <LabelInput
          name="email"
          label="Email"
          defaultValue={userData?.email}
          required
        />
        <LabelInput
          name="phone_no"
          label="Phone Number"
          defaultValue={userData?.phone_no}
          required
        />
      </div>
      <LabelInput
        name="password"
        label="User Password"
        defaultValue={userData?.password}
        passwordInput
        required
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <SelectInput
          name="is_verified"
          label="Is Verified"
          options={[
            { text: "True", value: "true" },
            { text: "False", value: "false" },
          ]}
          defaultValue={String(userData?.is_verified)}
        />
        <SelectInput
          name="is_active"
          label="Is Active"
          options={[
            { text: "True", value: "true" },
            { text: "False", value: "false" },
          ]}
          defaultValue={String(userData?.is_active)}
        />
      </div>

      <ButtonLoading loading={isLoading}>Save</ButtonLoading>
    </form>
  );
}
