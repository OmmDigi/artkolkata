"use client";
import { useState } from "react";
import FloatingCart from "./trending/FloatingCart";
import ShoppingCartSidebar from "./trending/ShoppingCartSidebar";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/useWishlistStore";

const CartDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { wishlist } = useWishlistStore();

  return (
    <>
      {/* <FloatingCart onOpen={() => setIsOpen(!isOpen)} /> */}
      <Link
        key="1"
        href="/wishlist"
        className={`font-bold transition-colors relative group capitalize`}
      >
        <div className="flex text-gray-700 hover:text-[#0a1e33] transition-colors">
          <FloatingCart
            onOpen={() => setIsOpen(!isOpen)}
            length={wishlist.length}
          />
          {/* <p className="bg-[#000000] text-gray-50 rounded-[50%] ml-[-7] mt-[-7] text-xs h-5 w-5 p-0 flex justify-center items-center">
            {wishlist.length}
          </p> */}
        </div>
      </Link>
    </>
  );
};

export default CartDrawer;
