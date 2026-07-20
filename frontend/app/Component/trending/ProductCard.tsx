"use client";
import { useState } from "react";
import { ShoppingCart, Heart } from "lucide-react";
import Link from "next/link";
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
  const [loadingIcon, setLoadingIcon] = useState(null);
  const [currentImage, setCurrentImage] = useState(hoverImage);
  const { wishlist, toggleWishlist } = useWishlistStore();
  const { addToCart, isInCart } = useCartStore();
  const inCart = isInCart(product?.id, null);
  const inWishlist = wishlist.some((w) => w?.id === product?.id);

  const handleIconClick = (type: any) => {
    setLoadingIcon(type);
    setTimeout(() => {
      setLoadingIcon(null);
      if (type === "wish") toggleWishlist(product);
      if (type === "cart") addToCart(product, null, 1);
    }, 100);
  };

  return (
    <div
      className="text-center group text-gray-800"
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex justify-between gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <IconButton onClick={() => handleIconClick("cart")} active={inCart}>
            {loadingIcon === "cart" ? (
              <Spinner />
            ) : (
              <ShoppingCart
                className={`w-3 h-3 md:w-5 md:h-5 ${inCart ? "text-white" : "text-gray-600"}`}
                size={16}
              />
            )}
          </IconButton>
          <IconButton
            onClick={() => handleIconClick("wish")}
            active={inWishlist}
          >
            {loadingIcon === "wish" ? (
              <Spinner />
            ) : (
              <Heart
                className={`w-3 h-3 md:w-5 md:h-5 ${inWishlist ? "fill-white text-white" : "text-gray-600"}`}
                size={16}
              />
            )}
          </IconButton>
        </div>
      </div>

      {/* PRODUCT INFO */}
      <div className="py-2">
        <p className="  mt-2 text-lg font-semibold ">{name}</p>
        <p className="text-gray-600 text-sm">{price}</p>
      </div>
    </div>
  );
};

const IconButton = ({ children, onClick, active }: any) => (
  <button
    onClick={onClick}
    className={`w-10 h-10 rounded-full flex items-center justify-center shadow transition-all duration-300 hover:-translate-y-1 ${
      active ? "bg-black hover:bg-gray-800" : "bg-white hover:bg-gray-200"
    }`}
  >
    {children}
  </button>
);

const Spinner = () => (
  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
);

export default ProductCard;
