"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Progress } from "../ui/progress";
import { toast } from "react-toastify";
import { useDoMutation } from "@/hooks/useDoMutation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { IGalleryItem, IResponse } from "@/types";
import LoadingLayout from "../LoadingLayout";
import { api } from "@/utils/api";
import { uploadFiles } from "@/utils/uploadFiles";
import { ButtonLoading } from "../ui/button-loading";

export const formSchema = z
  .object({
    type: z.enum(["youtube-link", "image"]),
    photos: z.any(),
    youtube_link: z.string().optional(),
    altTags: z.string().min(1, { message: "Add Alt Tags" }),
    // media_type: z.enum(["gallery-item", "banner-item"]),
  })
  .superRefine((data, ctx) => {
    if (data.type === "youtube-link") {
      if (!data.youtube_link || data.youtube_link.trim() === "") {
        ctx.addIssue({
          path: ["youtube_link"],
          code: z.ZodIssueCode.custom,
          message: "Youtube link is required",
        });
      }
    } else if (data.type === "image") {
      if (!(data.photos instanceof FileList) || data.photos.length === 0) {
        ctx.addIssue({
          path: ["photos"],
          code: z.ZodIssueCode.custom,
          message: "Please upload at least one photo",
        });
      }
    }
  });
type FormType = z.infer<typeof formSchema>;

interface IProps {
  isOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  media_item_id: number;
}

interface IUploadMediaItem extends Omit<IGalleryItem, "media_item_id"> {}

const getSingleGalleryItem = async (media_item_id: number) => {
  const response = await api.get("/api/v1/media-item/" + media_item_id);
  return response.data;
};

export default function AddMediaGalleryDialog({
  isOpen,
  setOpen,
  media_item_id,
}: IProps) {
  const [uploadPercent, setUploadPercent] = useState(() => -1);
  const queryClient = useQueryClient();

  const [isUploading, startUploading] = useTransition();

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "image",
      photos: undefined,
      altTags: "",
    },
  });

  const { isFetching, error, data } = useQuery<IResponse<IGalleryItem | null>>({
    queryKey: ["get-single-media-item", media_item_id],
    queryFn: () => getSingleGalleryItem(media_item_id),
    enabled: media_item_id !== 0,
    // onSuccess(data : IResponse<IGalleryItem | null>) {
    //   form.reset({
    //     type: data.data?.media_type,
    //     photos: undefined,
    //     youtube_link: data.data?.item_link,
    //     altTags: data.data?.alt_tag,
    //   });
    // },
  });

  useEffect(() => {
    if (data?.data) {
      form.reset({
        type: data.data?.media_type,
        photos: undefined,
        youtube_link: data.data?.item_link,
        altTags: data.data?.alt_tag,
      });
    }
  }, [isFetching]);

  useEffect(() => {
    if (media_item_id === 0) {
      form.reset({
        type: "image",
        photos: undefined,
        altTags: "",
      });
    }
  }, [media_item_id]);

  if (error) {
    throw error;
  }

  const { isLoading, mutate } = useDoMutation();

  const onSubmit = (values: FormType) => {
    const valueToStore: IUploadMediaItem[] = [];

    startUploading(async () => {
      if (values.type === "image") {
        const { data, error } = await uploadFiles({
          files: media_item_id === 0 ? values.photos : [values.photos[0]],
          folder: "media-gallery",
          onUploading(percentage) {
            setUploadPercent(percentage);
          },
          onUploaded() {
            setUploadPercent(-1);
          },
        });

        if (error) {
          toast.error("Something went wrong while uploading files");
          setUploadPercent(-1);
          return;
        }

        const splitedAltTag = values.altTags.split(",");
        data.forEach((blob, index) => {
          valueToStore.push({
            item_link: blob.downloadUrl,
            alt_tag: splitedAltTag[index] || "",
            media_type: values.type,
          });
        });
      } else {
        valueToStore.push({
          alt_tag: values.altTags,
          item_link: values.youtube_link || "",
          media_type: "youtube-link",
        });
      }

      if (media_item_id === 0) {
        mutate({
          apiPath: "/api/v1/media-item",
          method: "post",
          formData: valueToStore,
          headers: {
            "Content-Type": "application/json",
          },
          onSuccess() {
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ["get-gallery-items"] });
          },
        });

        return;
      }

      mutate({
        apiPath: "/api/v1/media-item",
        method: "put",
        formData: {
          alt_tag: valueToStore[0].alt_tag,
          item_link: valueToStore[0].item_link,
          media_type: valueToStore[0].media_type,
        },
        headers: {
          "Content-Type": "application/json",
        },
        onSuccess() {
          setOpen(false);
          queryClient.invalidateQueries({ queryKey: ["get-gallery-items"] });
        },

        id: media_item_id,
      });
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Media Item</DialogTitle>
        </DialogHeader>
        {isFetching ? (
          <LoadingLayout />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex items-center gap-3">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Media Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl className="w-full">
                          <SelectTrigger>
                            <SelectValue defaultValue="image" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="youtube-link">
                            YouTube Link
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("type") === "image" ? (
                  <FormField
                    control={form.control}
                    name="photos"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Choose Photos *</FormLabel>
                        <Input
                          type="file"
                          accept="*/*"
                          multiple
                          onChange={(e) => {
                            if ((e.target.files?.length || 0) > 10) {
                              form.setError("photos", {
                                message:
                                  "Not Allow To Upload More Than 10 Image Togather",
                              });
                              form.setValue("photos", []);
                              return;
                            }
                            field.onChange(e.target.files);
                          }}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="youtube_link"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Youtube Link *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Youtube Link"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              {uploadPercent === -1 ? null : <Progress value={uploadPercent} />}
              {/* <FormField
              control={form.control}
              name="media_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Media Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl className="w-full">
                      <SelectTrigger>
                        <SelectValue defaultValue="gallery-item" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="gallery-item">Gallery Item</SelectItem>
                      <SelectItem value="banner-item">Banner Item</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            /> */}

              <FormField
                control={form.control}
                name="altTags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alt Tag *</FormLabel>
                    <FormControl>
                      <Input placeholder="Alt Tag" {...field} />
                    </FormControl>
                    <FormDescription>
                      If Multiple Image Than Use "," To Seperate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ButtonLoading loading={isLoading || isUploading}>
                Save
              </ButtonLoading>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
