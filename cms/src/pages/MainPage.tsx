import SidebarWrapper from "@/components/SidebarWrapper";
import { Outlet } from "react-router-dom";

function MainPage() {
  return (
    <SidebarWrapper>
      <Outlet />
    </SidebarWrapper>
  );
}

export default MainPage;
