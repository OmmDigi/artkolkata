"use client";
import { useState } from "react";
import { ShoppingCart, Heart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useCartStore } from "@/store/useCartStore";
import Image from "next/image";

const ProductCard = ({
  product,
  ids,
  image,
  hoverImage,
  colors,
  name,
  price,
  slug,
}: any) => {
  const router = useRouter();
  const [loadingIcon, setLoadingIcon] = useState(null);
  const [currentImage, setCurrentImage] = useState(hoverImage);
  const { wishlist, toggleWishlist } = useWishlistStore();
  const { addToCart, removeFromCart, isInCart } = useCartStore();
  const inCart = isInCart(product?.id, null);
  const inWishlist = wishlist.some((w) => w?.id === product?.id);

  const handleIconClick = (type: any) => {
    setLoadingIcon(type);
    setTimeout(() => {
      setLoadingIcon(null);
      if (type === "wish") toggleWishlist(product);
      if (type === "cart") {
        if (inCart) {
          removeFromCart(product?.id, null);
        } else {
          addToCart(product, null, 1);
        }
      }
    }, 100);
  };

  return (
    <div
      className="group relative flex flex-col h-full border border-gray-300 p-2 bg-white"
      onMouseEnter={() => hoverImage && setCurrentImage(hoverImage)}
      onMouseLeave={() => setCurrentImage(image)}
    >
      {/* IMAGE CONTAINER */}
      <div className="relative bg-gray-100  overflow-hidden h-auto ">
        <Link href={`/product/${slug}`}>
          <div
            className="relative overflow-hidden rounded-lg bg-[#ececea] 
                aspect-[4/4]"
          >
            <div className="relative w-full h-full">
              <Image
                src={currentImage ? currentImage : image}
                alt={product.name}
                fill
                className="object-cover transition-opacity duration-300"
              />
            </div>
          </div>
        </Link>

        {/* COLOR VARIANTS (vertical, left side) */}
        {colors && (
          <div className="absolute top-6 left-4 flex flex-col gap-2 z-10">
            {colors.map((color: any, index: number) => (
              <button
                key={index}
                className="
                  w-4
                  h-4
                  rounded-full
                  border
                  border-transparent
                  hover:border-black
                  transition-colors
                  duration-200
                  "
                style={{ backgroundColor: color }}
                aria-label="color variant"
              />
            ))}
          </div>
        )}

        {/* ICONS */}
        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center opacity-100 transition-opacity duration-300 pointer-events-none">
          <button
            className={`p-2.5 rounded-full transition-colors pointer-events-auto shadow-md flex items-center justify-center ${
              inCart
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-white text-black hover:bg-black hover:text-white"
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleIconClick("cart");
            }}
            aria-label="Add to cart"
            style={{ width: "38px", height: "38px" }}
          >
            {loadingIcon === "cart" ? (
              <div className="w-[18px] h-[18px] border-2 border-[currentColor] border-t-transparent rounded-full animate-spin" />
            ) : (
              <ShoppingCart size={18} />
            )}
          </button>
          <button
            className={`p-2.5 rounded-full transition-colors pointer-events-auto shadow-md flex items-center justify-center bg-white text-black hover:bg-black hover:text-white`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleIconClick("wish");
            }}
            aria-label="Add to wishlist"
            style={{ width: "38px", height: "38px" }}
          >
            {loadingIcon === "wish" ? (
              <div className="w-[18px] h-[18px] border-2 border-[currentColor] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Heart
                size={24}
                fill={inWishlist ? "red" : "none"}
                color={inWishlist ? "red" : "currentColor"}
              />
            )}
          </button>
        </div>
      </div>

      {/* PRODUCT INFO */}
      <Link href={`/product/${slug}`} className="block mt-auto text-left">
        <p className="text-sm font-medium text-black mb-2 mt-2 group-hover:opacity-80 transition-opacity">
          {name?.length > 30 ? `${name.slice(0, 30)}...` : name}
        </p>
        <div className="flex gap-2 items-center mb-3">
          <span className="text-sm font-medium text-black">{price}</span>
        </div>
      </Link>

      <div className="flex flex-col gap-2 mt-auto">
        <button
          className={`w-full py-2 rounded-md font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
            inCart
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : "border border-black text-black hover:bg-black hover:text-white"
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleIconClick("cart");
          }}
        >
          {loadingIcon === "cart" ? (
            <div className="w-[16px] h-[16px] border-2 border-[currentColor] border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <ShoppingCart size={16} />
              {inCart ? "In Cart" : "Add to Cart"}
            </>
          )}
        </button>

        <button
          className="w-full py-2 rounded-md font-medium text-sm bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center justify-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!inCart) {
              addToCart(product, null, 1);
            }
            router.push("/checkout");
          }}
        >
          BUY NOW
        </button>
      </div>
    </div>
  );
};

const IconButton = ({ children, onClick, active }: any) => (
  <button
    onClick={onClick}
    className={`w-10 h-10 rounded-full flex items-center justify-center shadow transition-all duration-300 hover:-translate-y-1 ${
      active ? "bg-black  " : "bg-white hover:bg-gray-200"
    }`}
  >
    {children}
  </button>
);

const Spinner = () => (
  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
);

export default ProductCard;
