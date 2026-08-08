import LabelInput from "@/components/LabelInput";
import LabelMultiSelect from "@/components/LabelMultiSelect";
import Section from "@/components/Section";
import SelectInput from "@/components/SelectInput";
import { ButtonLoading } from "@/components/ui/button-loading";
import { useCategory } from "@/hooks/useCategory";
import { useDoMutation } from "@/hooks/useDoMutation";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IResponse } from "@/types";
import { api } from "@/utils/api";
import { generateDiscountCodeWithPrefix } from "@/utils/generateDiscountCodeWithPrefix";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { MoveLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const getSingleDiscount = async (id: number) => {
  if (id == -1) return;
  return (await api.get(`/api/v1/discount/${id}`)).data;
};


export default function SingleDiscountPage() {
  const params = useParams();
  const isNewProduct = params?.id == "new";

  const [discountCode, setDiscountCode] = useState<string | null>(null);

  const { data, isFetching, error } = useQuery<
    IResponse<any>,
    AxiosError<IError>
  >({
    queryKey: ["get-single-discount", params?.id],
    enabled: !isNewProduct,
    queryFn: () => getSingleDiscount(parseInt(params?.id ?? "-1")),
  });

  const [choosedCategories, setChoosedCategories] = useState<string[]>([]);

  const { isCategoryFetching, categoryData } = useCategory();

  useEffect(() => {
    if (data?.data?.code) {
      setDiscountCode(data?.data?.code);
    }

    if (data?.data?.categories) {
      setChoosedCategories(data.data.categories);
    }
  }, [isFetching]);

  const { isLoading, mutate } = useDoMutation();
  const handleFormSubmit = (data: FormData) => {
    if (choosedCategories.length !== 0) {
      data.set("categories", choosedCategories as any);
    }

    if (isNewProduct) {
      mutate({
        apiPath: "/api/v1/discount",
        method: "post",
        formData: data,
        onSuccess() {},
      });
      return;
    }

    mutate({
      apiPath: "/api/v1/discount",
      method: "put",
      formData: data,
      id: params?.id as any,
      onSuccess() {},
    });
  };

  return (
    <main className="space-y-2.5">
      <Link
        to={"/discount"}
        className="font-semibold text-2xl inline-flex items-center gap-3.5 cursor-pointer hover:underline"
      >
        <MoveLeft className="mt-1" />
        <span>Create Coupon</span>
      </Link>

      <LoadingHandler loading={isFetching} error={error} length={1}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit(new FormData(e.currentTarget));
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="col-span-2 space-y-7">
              <Section>
                <div className="space-y-1.5">
                  <LabelInput
                    required
                    name="code"
                    label="Coupon code"
                    placeholder="TAC-PTB12XP25L"
                    defaultValue={discountCode ?? ""}
                  />
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountCode(
                          generateDiscountCodeWithPrefix(undefined, 10)
                        );
                      }}
                      className="inline-block text-blue-600 text-sm cursor-pointer underline select-none"
                    >
                      Generate coupon code
                    </button>
                  </div>
                </div>
              </Section>

              <Section>
                <LabelInput
                  required
                  name="title"
                  label="Coupon name"
                  placeholder="Diwali discount"
                  defaultValue={data?.data?.title}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SelectInput
                    required
                    name="type"
                    label="Coupon apply by"
                    options={[
                      { text: "By Percentage %", value: "percentage" },
                      { text: "Fixed Amount", value: "fixed_amount" },
                    ]}
                    defaultValue={data?.data?.type ?? "percentage"}
                  />

                  <LabelInput
                    name="value"
                    label="Value"
                    defaultValue={data?.data?.value}
                  />
                </div>

                {!isCategoryFetching ? (
                  <LabelMultiSelect
                    label="Discount On Category"
                    options={categoryData.map((category) => ({
                      value: category.id.toString(),
                      label: category.name,
                    }))}
                    placeholder="Choose categories.."
                    onValueChange={(value) => {
                      setChoosedCategories(value);
                    }}
                    defaultValues={choosedCategories}
                  />
                ) : (
                  <p>Getting categories..</p>
                )}

                <LabelInput
                  required
                  name="min_amount_to_select"
                  label="Minimum amount to purchase"
                  placeholder="1000"
                  defaultValue={data?.data?.min_amount_to_select}
                />
              </Section>

              <Section>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LabelInput
                    required
                    type="datetime-local"
                    name="starts_at"
                    label="Start Date"
                    defaultValue={data?.data?.starts_at}
                  />
                  <LabelInput
                    required
                    type="datetime-local"
                    name="ends_at"
                    label="End Date"
                    defaultValue={data?.data?.ends_at}
                  />
                </div>
              </Section>
            </div>

            <div>
              <Section>
                <SelectInput
                  required
                  label="Status"
                  name="status"
                  options={[
                    {
                      text: "Active",
                      value: "active",
                    },
                    {
                      text: "Inactive",
                      value: "disabled",
                    },
                  ]}
                  defaultValue={data?.data?.status ?? "active"}
                />
              </Section>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <ButtonLoading loading={isLoading}>Save</ButtonLoading>
          </div>
        </form>
      </LoadingHandler>
    </main>
  );
}
