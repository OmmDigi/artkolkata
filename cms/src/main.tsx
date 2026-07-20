import { createRoot } from "react-dom/client";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import LoginPage from "./pages/LoginPage.tsx";
import { Bounce, ToastContainer } from "react-toastify";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MainPage from "./pages/MainPage.tsx";
import CheckAuthority from "./middleware/CheckAuthority.tsx";
import CategoryPage from "./pages/CategoryPage.tsx";
import ProductsPage from "./pages/ProductsPage.tsx";
import { Provider } from "react-redux";
import { reduxStore } from "./redux/store.ts";
import SingleProduct from "./pages/SingleProduct.tsx";
import SingleDiscountPage from "./pages/SingleDiscountPage.tsx";
import DiscountPage from "./pages/DiscountPage.tsx";
// import SubCategoryPage from "./pages/SubCategoryPage.tsx";
import OrderListingPage from "./pages/OrderListingPage.tsx";
import SingleOrderPage from "./pages/SingleOrderPage.tsx";
import ReviewsList from "./pages/ReviewsList.tsx";
// import DemoWebHook from "./pages/DemoWebHook.tsx";
import InquiryListPage from "./pages/InquiryListPage.tsx";
import UsersListPage from "./pages/UsersListPage.tsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.tsx";
import ChangePasswordPage from "./pages/ChangePasswordPage.tsx";
import SingleUserPage from "./pages/SingleUserPage.tsx";
import HomeWelcomePage from "./pages/HomeWelcomePage.tsx";
import SubCategoryPage from "./pages/SubCategoryPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import BlogsPage from "./pages/BlogsPage.tsx";
import SingleBlogPage from "./pages/SingleBlogPage.tsx";

const router = createBrowserRouter([
  {
    id: "1",
    path: "/",
    element: (
      <CheckAuthority>
        <MainPage />
      </CheckAuthority>
    ),
    children: [
      {
        id: "1-12",
        path: "",
        element: <HomeWelcomePage />,
      },
      {
        id: "1-1",
        path: "categories",
        element: <CategoryPage />,
      },
      {
        id: "1-2",
        path: "sub-categories",
        element: <SubCategoryPage />,
      },
      {
        id: "1-3",
        path: "products",
        element: <ProductsPage />,
      },
      {
        id: "1-4",
        path: "products/:id",
        element: <SingleProduct />,
      },
      {
        id: "1-5",
        path: "discount",
        element: <DiscountPage />,
      },
      {
        id: "1-6",
        path: "discount/:id",
        element: <SingleDiscountPage />,
      },
      {
        id: "1-7",
        path: "orders",
        element: <OrderListingPage />,
      },
      {
        id: "1-8",
        path: "orders/:id",
        element: <SingleOrderPage />,
      },
      {
        id: "1-9",
        path: "reviews",
        element: <ReviewsList />,
      },
      // {
      //   id: "1-10",
      //   path: "recipient",
      //   element: <RecipientPage />,
      // },
      // {
      //   id: "1-11",
      //   path: "demo-webhook",
      //   element: <DemoWebHook />,
      // },
      // {
      //   id : "1-4",
      //   path : "media-gallery",
      //   element : <MediaGallery asChooser={false} />
      // },
      {
        id: "1-11",
        path: "contact-list",
        element: <InquiryListPage />,
      },
      {
        id: "1-13",
        path: "users",
        element: <UsersListPage role="User" />,
      },
      {
        id: "1-14",
        path: "users/:id",
        element: <SingleUserPage role="User" />,
      },
      {
        id: "1-15",
        path: "staff",
        element: <UsersListPage role="Employee" heading="Staff List" />,
      },
      {
        id: "1-16",
        path: "staff/:id",
        element: <SingleUserPage role="Employee" />,
      },
      {
        id: "1-17",
        path: "settings",
        element: <SettingsPage />,
      },
      {
        id: "1-18",
        path: "blogs",
        element: <BlogsPage />,
      },
      {
        id: "1-19",
        path: "blogs/:id",
        element: <SingleBlogPage />,
      },
    ],
  },
  {
    id: "2",
    path: "/login",
    element: <LoginPage />,
  },
  {
    id: "3",
    path: "forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    id: "4",
    path: "change-password",
    element: <ChangePasswordPage />,
  },
]);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // refetchOnMount: false,
      retry: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <Provider store={reduxStore}>
    <QueryClientProvider client={queryClient}>
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Bounce}
      />
      <RouterProvider router={router} />
    </QueryClientProvider>
  </Provider>,
  // </StrictMode>,
);
