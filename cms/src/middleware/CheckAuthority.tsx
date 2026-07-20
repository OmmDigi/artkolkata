import { Button } from "@/components/ui/button";
import { SIDEBAR_OPTIONS } from "@/constant";
import { setNavItems } from "@/redux/slice/sidebar.slice";
import type { IError, INavItem, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";

const checkIsLogin = async () => {
  return (await api.get("/api/v1/users/is-login")).data;
};

interface IProps {
  children: React.ReactNode;
}
export default function CheckAuthority({ children }: IProps) {
  const { isFetching, error, data } = useQuery<
    IResponse<{
      permissions: Record<string, string> | null;
      refreshToken: string;
    }>,
    AxiosError<IError>
  >({
    queryKey: ["check-is-login"],
    queryFn: checkIsLogin,
  });

  const dispatch = useDispatch();

  useEffect(() => {
    if (!error && data?.data) {
      localStorage.setItem("token", data.data.refreshToken);
      localStorage.setItem(
        "permissions",
        JSON.stringify(data.data.permissions ?? {}),
      );

      if (data.data.permissions != null) {
        // process the data
        const navItems: INavItem[] = [];
        SIDEBAR_OPTIONS.navMain[0].items.forEach((item) => {
          if (data.data.permissions?.[item.id]) {
            navItems.push({
              id: item.id,
              items: [],
              title: item.title,
              url: item.url,
            });
          }
        });

        dispatch(setNavItems(navItems));
      }
    }
  }, [isFetching]);

  if (isFetching)
    return (
      <div className="size-full flex items-center justify-center flex-col pt-20 gap-y-1.5">
        <div className="bg-gray-100 p-2.5 rounded-md">
          <LoaderCircle className="animate-spin" />
        </div>
        <h2 className="font-semibold text-xl">Processing your request</h2>
        <p className="text-gray-600 text-sm">
          Please wait while we process your request. Do not refresh the page.
        </p>
      </div>
    );

  if (error) {
    if (error.status === 401 || error.status === 403) {
      return (
        <div className="flex items-center justify-center flex-col gap-y-2.5 pt-20">
          <h2>Unauthorized</h2>
          <Link to="/login">
            <Button className="cursor-pointer">Login</Button>
          </Link>
        </div>
      );
    }

    return <p className="text-center pt-14 text-lg">Something Went Wrong</p>;
  }

  return children;
}
