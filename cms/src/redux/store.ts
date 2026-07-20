import { configureStore } from "@reduxjs/toolkit";
import choosedMediaItems from "@/redux/slice/choose.gallery.slice";
import sidebarSlice from "@/redux/slice/sidebar.slice";

export const reduxStore = configureStore({
  reducer: {
    choosedMediaItems: choosedMediaItems,
    sidebarSlice: sidebarSlice,
  },
});

export type RootState = ReturnType<typeof reduxStore.getState>;
export type AppDispatch = typeof reduxStore.dispatch;
