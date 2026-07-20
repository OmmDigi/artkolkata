import type { ChoosedMediaItem, IChoosedMediaItem } from "@/types";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const initialState: IChoosedMediaItem = {
  selectedMedia: [],
};

const choosedMediaItems = createSlice({
  name: "choose gallery slice",
  initialState,
  reducers: {
    resetMediaItem: (state, action: PayloadAction<ChoosedMediaItem[]>) => {
      state.selectedMedia = action.payload;
    },

    setMediaItem: (state, action: PayloadAction<ChoosedMediaItem>) => {
      const updateToIndex = state.selectedMedia.findIndex(
        (element) => element.media_id === action.payload.media_id
      );
      if (updateToIndex === -1) {
        state.selectedMedia.push(action.payload);
      } else {
        state.selectedMedia[updateToIndex] = action.payload;
      }
    },

    removeMediaItem: (state, action: PayloadAction<{ media_id: number }>) => {
      const updatedMediaItems = state.selectedMedia.filter(
        (item) => item.media_id !== action.payload.media_id
      );
      state.selectedMedia = updatedMediaItems;
    },

    clear: (state) => {
      state.selectedMedia = [];
    },
  },
});

export default choosedMediaItems.reducer;
export const { resetMediaItem, setMediaItem, removeMediaItem, clear } =
  choosedMediaItems.actions;
