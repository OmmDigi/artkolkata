import React from "react";
import GuestAccountPage from "@/Component1/GuestAccountPage";

export default function page() {
  return (
    <React.Suspense>
      <GuestAccountPage />
    </React.Suspense>
  );
}
