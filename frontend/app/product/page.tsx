import React from "react";
import ProductsPage from "../Component/productPage";

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
