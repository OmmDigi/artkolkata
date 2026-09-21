import React from "react";
import GuestAccountPage from "../Component/GuestAccountPage";

export default function page() {
  return (
    <React.Suspense>
      <GuestAccountPage />
    </React.Suspense>
  );
}
