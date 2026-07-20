import { ChevronsUpDown, GalleryVerticalEnd, LogOut } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";

// const doLogout = async () => {
//   return await api.post("/api/v1/users/logout");
// };

export function MoreOptionHeader({
  dropdownOptions,
}: {
  dropdownOptions: string[];
}) {
  const navigate = useNavigate();
  // const { isPending, mutate } = useMutation({
  //   mutationFn: doLogout,
  //   onSuccess: () => {
  //     toast.success("Logout successfull");
  //     navigate("/login");
  //   },
  //   onError: (error: AxiosError<IError>) => {
  //     toast.error(
  //       error.response?.data.message ??
  //         "Unable process your logout request please try again later"
  //     );
  //   },
  // });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <GalleryVerticalEnd className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-medium">Welcome To Home</span>
                <span className="">View more</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width)"
            align="start"
          >
            {dropdownOptions.map((option) => (
              <DropdownMenuItem
                // disabled={isPending}
                key={option}
                onSelect={() => {
                  if (!confirm("Are you sure you want log logout ?")) return;
                  localStorage.clear();
                  navigate("/login");
                  // mutate();
                }}
              >
                {/* {isPending ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <LogOut />
                )} */}

                <LogOut />

                {option}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
