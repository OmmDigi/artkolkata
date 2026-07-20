import { Heart, ShoppingCart } from "lucide-react";

const FloatingCart = ({
  onOpen,
  length,
}: {
  onOpen: () => void;
  length: number;
}) => {
  return (
    <div className="fixed bottom-6 left-6 z-50">
      {/* Cart Button */}
      <div
        onClick={onOpen}
        id="floating-cart"
        className="relative w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center cursor-pointer"
      >
        {/* Cart Icon */}
        <Heart className="w-6 h-6 text-gray-800" />

        {/* Quantity Badge */}
        <span
          className="
            absolute
            -top-1
            -right-1
            w-5
            h-5
            bg-black
            text-white
            text-xs
            rounded-full
            flex
            items-center
            justify-center
          "
        >
          {length}
        </span>
      </div>
    </div>
  );
};

export default FloatingCart;
