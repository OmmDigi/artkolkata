import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useDoMutation } from "@/hooks/useDoMutation";
import { queryClient } from "@/main";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/utils/api";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IRecipient, IResponse } from "@/types";
import type { AxiosError } from "axios";
import FilePicker from "../FilePicker";
import LabelInput from "../LabelInput";
import SelectInput from "../SelectInput";
interface IProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  item_id: number;
}

const getRecipientCategory = async (id: number) => {
  return (await api.get(`/api/v1/products/recipient/${id}`)).data;
};

export default function RecipientDialog({
  open,
  setOpen,
  item_id = 0,
}: IProps) {
  const { isLoading, mutate } = useDoMutation();

  const [formData, setFormData] = useState<{
    image: string;
    tag_name: string;
    alt_tag: string | null;
    status: number;
  }>({
    image: "",
    alt_tag: null,
    tag_name: "",
    status: 1,
  });

  const { data, error, isFetching } = useQuery<
    IResponse<IRecipient>,
    AxiosError<IError>
  >({
    queryKey: ["get-single-recipient", item_id],
    queryFn: () => getRecipientCategory(item_id),
    enabled: item_id !== 0,
  });

  const resetForm = () => {
    setFormData({
      tag_name: "",
      alt_tag: "",
      image: "",
      status: 1,
    });
  };

  useEffect(() => {
    if (data?.data) {
      setFormData({
        tag_name: data.data.tag_name ?? "",
        alt_tag: data.data.alt_tag ?? "",
        image: data.data.image ?? "",
        status: data.data.status ?? 1,
      });
    }
    return () => {
      resetForm();
    };
  }, [item_id, isFetching]);

  const onFormSubmit = (data: FormData) => {
    const payload: Record<string, string | null | number> = {
      tag_name: formData.tag_name,
      image: data.get("image")?.toString() ?? "",
      status : formData.status
    };

    const altTag = data.get("alt_tag")?.toString();
    if (altTag && altTag != "") {
      payload["alt_tag"] = altTag;
    }

    if (item_id === 0) {
      mutate({
        apiPath: "/api/v1/products/recipient",
        method: "post",
        formData: payload,
        onSuccess() {
          setOpen(false);
          resetForm();
          queryClient.invalidateQueries({ queryKey: ["get-recipient-list"] });
        },
      });
      return;
    }

    mutate({
      apiPath: "/api/v1/products/recipient",
      method: "put",
      formData: {
        id: item_id,
        ...payload,
      },
      onSuccess() {
        setOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ["get-recipient-list"] });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <LoadingHandler loading={isFetching} length={1} error={error as any}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onFormSubmit(new FormData(e.currentTarget));
            }}
            className="space-y-5"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-center">
                <FilePicker
                  name="image"
                  className="!aspect-[9/16] !w-48 !h-auto"
                  accept="image/*"
                  fileLink={formData.image === "" ? undefined : formData.image}
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap *:flex-1">
                <LabelInput
                  name="tag_name"
                  label="Tag Name *"
                  placeholder="Wife"
                  value={formData.tag_name}
                  onChange={(event) => {
                    const inputValue = event.currentTarget.value ?? "";
                    setFormData((prev) => ({
                      ...prev,
                      tag_name: inputValue,
                    }));
                  }}
                />
                <SelectInput
                  name="status"
                  label="Status"
                  defaultValue={formData.status.toString()}
                  onValueChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      status: parseInt(value),
                    }));
                  }}
                  options={[
                    {
                      text: "Public",
                      value: "1",
                    },
                    { text: "Private", value: "2" },
                  ]}
                />
              </div>
              <LabelInput
                name="alt_tag"
                label="Image Alt Tag"
                placeholder="Image alt tag (optional)"
                value={formData.alt_tag ?? undefined}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    alt_tag: e.currentTarget?.value ?? "",
                  }));
                }}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" variant={"own"}>
                {isLoading ? <LoaderCircle className="animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </LoadingHandler>
      </DialogContent>
    </Dialog>
  );
}
