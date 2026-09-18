import type { IBlogAuthor, IError, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

const getBlogAuthorList = async () =>
  (await api.get("/api/v1/blogs/authors")).data;

// the author catalogue lives in the database, so an author created while
// writing one post is available to every post written after it
export const useBlogAuthors = () => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<IBlogAuthor[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-blog-author-list"],
    queryFn: getBlogAuthorList,
  });

  return {
    isBlogAuthorFetching: isFetching,
    blogAuthorError: error,
    blogAuthorData: data?.data ?? [],
    refetchBlogAuthors: refetch,
  };
};
