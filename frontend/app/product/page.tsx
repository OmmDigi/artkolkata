import React from "react";
import ProductsPage from "@/Component1/productPage";

export default function ProductsPageComponent() {
  // paging + filter + sort states

  return (
    <>
      <React.Suspense>
        <ProductsPage />
      </React.Suspense>
    </>
  );
}
