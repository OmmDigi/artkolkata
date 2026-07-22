import type { INavItem, ISideBar } from "@/types";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const initialState: ISideBar = {
  dropdownOptions: ["Logout"],
  navItem: [
    {
      id: "1",
      title: "Getting Started",
      url: "#",
      items: [],
    },
  ],
};

const sidebarSlice = createSlice({
  name: "side-menu",
  initialState,
  reducers: {
    setNavItems: (state, action: PayloadAction<INavItem[]>) => {
      state.navItem[0].items = action.payload;
    },
  },
});

export default sidebarSlice.reducer;
export const { setNavItems } = sidebarSlice.actions;
