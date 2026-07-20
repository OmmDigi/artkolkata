// "use client";
// import React, { useEffect, useRef, useState } from "react";
// import {
//   ChevronLeft,
//   ChevronRight,
//   Heart,
//   Share2,
//   Scale,
//   Minus,
//   Plus,
// } from "lucide-react";
// import Link from "next/link";
// import { useCartStore } from "@/store/useCartStore";
// import { getRequest } from "@/lib/fetcher";
// import { useQuery } from "@tanstack/react-query";
// import { useParams } from "next/navigation";

// interface PackItem {
//   id: number;
//   name: string;
//   price: number;
//   image: string;
//   quantity: number;
// }

// interface ProductImage {
//   id: number;
//   thumb: string;
//   medium: string;
//   large: string;
//   alt: string;
// }

// const ProductDetail: React.FC = () => {
//   const [quantity, setQuantity] = useState<number>(1);
//   const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
//   const [activeTab, setActiveTab] = useState<string>("description");
//   const [inWishlist, setInWishlist] = useState<boolean>(true);
//   const [showLens, setShowLens] = useState(false);
//   const [lensPos, setLensPos] = useState({ x: 0, y: 0 });

//   const imageRef = useRef<HTMLDivElement>(null);

//   const LENS_SIZE = 200; // px
//   const ZOOM = 5.5;
//   const params = useParams<{ slug: string | undefined }>();

//   const [mainImage, setMainImage] = useState("");
//   const [selectedOptions, setSelectedOptions] = useState<any>({});
//   const [selectedVariant, setSelectedVariant] = useState<any>(null);
//   const {
//     addToCart,
//     removeFromCart,
//     updateQuantity,
//     cart,
//     isInCart,
//     getItemQty,
//   } = useCartStore();

//   const {
//     isLoading: isLoadingSingleProduct,
//     isError: isErrorSingleProduct,
//     data: product,
//     error: errorSingleProduct,
//     refetch,
//   } = useQuery({
//     queryKey: ["All-category", params?.slug],
//     queryFn: () => getRequest(`/api/v1/products/${params?.slug}`),
//   });
//   const fullProduct = (product as any)?.data;
//   console.log("fullProduct", fullProduct);

//   useEffect(() => {
//     if ((product as any)?.data?.images?.length > 0) {
//       setMainImage((product as any).data.images[0].image);
//     }
//   }, [product]);

//   // 🔥 Match Variant based on selected options
//   useEffect(() => {
//     if ((product as any)?.data?.variants) {
//       const match = (product as any)?.data?.variants.find((v: any) =>
//         v.combination.every((value: string) =>
//           Object.values(selectedOptions).includes(value)
//         )
//       );
//       setSelectedVariant(match || null);
//     }
//   }, [selectedOptions]);

//   useEffect(() => {
//     if (selectedVariant?.images?.length > 0) {
//       setMainImage(selectedVariant.images[0].image);
//     } else if (fullProduct?.images?.length > 0) {
//       setMainImage(fullProduct.images[0].image);
//     }
//   }, [selectedVariant, fullProduct]);

//   if (!product) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <p className="text-xl text-black">Loading...</p>
//       </div>
//     );
//   }

//   const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
//     if (!imageRef.current) return;
//     const rect = imageRef.current.getBoundingClientRect();
//     let x = e.clientX - rect.left;
//     let y = e.clientY - rect.top;
//     // Clamp to image bounds (NOT lens bounds)
//     x = Math.max(0, Math.min(x, rect.width));
//     y = Math.max(0, Math.min(y, rect.height));
//     setLensPos({ x, y });
//   };

//   const productImages: ProductImage[] = [
//     {
//       id: 1,
//       thumb:
//         "https://apollotran.b-cdn.net/demo/at_auros/29-home_default/brown-bear-printed-sweater.jpg",
//       medium:
//         "https://apollotran.b-cdn.net/demo/at_auros/29-medium_default/brown-bear-printed-sweater.jpg",
//       large:
//         "https://apollotran.b-cdn.net/demo/at_auros/29-large_default/brown-bear-printed-sweater.jpg",
//       alt: "Miro Dining Table - View 1",
//     },
//     {
//       id: 2,
//       thumb:
//         "https://apollotran.b-cdn.net/demo/at_auros/30-home_default/brown-bear-printed-sweater.jpg",
//       medium:
//         "https://apollotran.b-cdn.net/demo/at_auros/30-medium_default/brown-bear-printed-sweater.jpg",
//       large:
//         "https://apollotran.b-cdn.net/demo/at_auros/30-large_default/brown-bear-printed-sweater.jpg",
//       alt: "Miro Dining Table - View 2",
//     },
//   ];

//   const packItems: PackItem[] = [
//     {
//       id: 14,
//       name: "Mega Table Lamp",
//       price: 9.0,
//       image:
//         "https://apollotran.b-cdn.net/demo/at_auros/59-medium_default/hummingbird-vector-graphics.jpg",
//       quantity: 1,
//     },
//     {
//       id: 21,
//       name: "Soundless Speaker",
//       price: 0.0,
//       image:
//         "https://apollotran.b-cdn.net/demo/at_auros/71-medium_default/soundless-speaker.jpg",
//       quantity: 1,
//     },
//   ];

//   const nextImage = () => {
//     setCurrentImageIndex((prev) => (prev + 1) % productImages.length);
//   };

//   const prevImage = () => {
//     setCurrentImageIndex(
//       (prev) => (prev - 1 + productImages.length) % productImages.length
//     );
//   };

//   const getAvailableStock = () => {
//     if (selectedVariant) return Number(selectedVariant.quantity);
//     return Number(fullProduct.available_quantity || 1);
//   };
//   const handleSelectOption = (name: string, value: string) => {
//     setSelectedOptions((prev: any) => ({
//       ...prev,
//       [name]: value,
//     }));
//   };
//   const handleQuantityChange = (delta: number) => {
//     setQuantity(Math.max(1, quantity + delta));
//   };

//   const allOptionsSelected = fullProduct?.options?.every(
//     (opt: any) => selectedOptions[opt.name]
//   );

//   const variantId = selectedVariant?.id || null;
//   const itemAlreadyInCart = isInCart(fullProduct?.id, variantId);
//   const cartQuantity = getItemQty(fullProduct?.id, variantId);

//   const handleAddToCart = () => {
//     const variantId = selectedVariant?.id || null;

//     // 🛑 Requires selecting all options when variants exist
//     if (fullProduct.options?.length > 0 && !allOptionsSelected) {
//       alert("Select all options first!");
//       return;
//     }

//     // Check if item with same variant already exists
//     const alreadyAdded = isInCart(fullProduct.id, variantId);

//     if (alreadyAdded) {
//       removeFromCart(fullProduct.id, variantId);
//       return;
//     }

//     // 🔥 Build the final cart item with variant data
//     const itemToAdd = {
//       ...fullProduct,
//       sku: selectedVariant?.sku,
//       variant_id: variantId,
//       price: selectedVariant?.price || fullProduct.price,
//       compare_at_price:
//         selectedVariant?.compareAtPrice || fullProduct.compare_at_price,
//       stock: selectedVariant?.quantity || fullProduct.available_quantity,
//       images:
//         selectedVariant?.images?.length > 0
//           ? selectedVariant.images
//           : fullProduct.images,
//       options: selectedOptions,
//     };
//     addToCart(itemToAdd, variantId, 1);
//   };

//   return (
//     <div className="min-h-screen bg-gray-50 text-gray-800">
//       {/* Breadcrumb */}
//       <div className="bg-white border-b">
//         <div className="container mx-auto px-4 py-4">
//           <nav className="flex gap-2 text-sm text-gray-600">
//             <Link href="/" className="hover:text-gray-900">
//               Home
//             </Link>
//             <span>/</span>
//             <span className="text-gray-900 font-medium">Miro Dining Table</span>
//           </nav>
//         </div>
//       </div>

//       <div className="container mx-auto px-4 py-8">
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
//           {/* Image Gallery */}
//           <div>
//             <div className="bg-white rounded-lg p-4 mb-4 sticky top-8">
//               <div
//                 ref={imageRef}
//                 className="relative bg-gray-100 rounded-lg overflow-hidden mb-4 cursor-none "
//                 style={{ aspectRatio: "1" }}
//                 onMouseEnter={() => setShowLens(true)}
//                 onMouseLeave={() => setShowLens(false)}
//                 onMouseMove={handleMouseMove}
//               >
//                 {/* Main Image */}
//                 <img
//                   src={productImages[currentImageIndex].large}
//                   alt={productImages[currentImageIndex].alt}
//                   className="w-full h-full object-cover"
//                 />

//                 {/* Magnifier Lens */}
//                 {showLens &&
//                   imageRef.current &&
//                   (() => {
//                     const imgWidth = imageRef.current.offsetWidth;
//                     const imgHeight = imageRef.current.offsetHeight;

//                     const bgX = (lensPos.x / imgWidth) * 100;
//                     const bgY = (lensPos.y / imgHeight) * 100;

//                     return (
//                       <div
//                         className="absolute rounded-full
//                          border-2 border-gray-300 bg-white pointer-events-none shadow-2xl"
//                         style={{
//                           width: LENS_SIZE,
//                           height: LENS_SIZE,
//                           top: lensPos.y - LENS_SIZE / 2,
//                           left: lensPos.x - LENS_SIZE / 2,
//                           backgroundImage: `url(${productImages[currentImageIndex].large})`,
//                           backgroundRepeat: "no-repeat",
//                           backgroundSize: `${ZOOM * 100}%`,
//                           backgroundPosition: `${bgX}% ${bgY}%`,
//                         }}
//                       />
//                     );
//                   })()}

//                 {/* Badge */}
//                 <div className="absolute top-4 left-4 hover:bg-[#fad5be] bg-[#e0bca5] text-white px-3 py-1 rounded text-sm font-semibold">
//                   Pack
//                 </div>

//                 {/* Navigation */}
//                 <button
//                   onClick={prevImage}
//                   className="absolute left-4 top-1/2 -translate-y-1/2 bg-white p-2 rounded-full hover:bg-gray-100"
//                 >
//                   <ChevronLeft size={20} />
//                 </button>

//                 <button
//                   onClick={nextImage}
//                   className="absolute right-4 top-1/2 -translate-y-1/2 bg-white p-2 rounded-full hover:bg-gray-100"
//                 >
//                   <ChevronRight size={20} />
//                 </button>
//               </div>

//               {/* Thumbnails */}
//               <div className="flex gap-2">
//                 {productImages.map((img, idx) => (
//                   <button
//                     key={img.id}
//                     onClick={() => setCurrentImageIndex(idx)}
//                     className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition ${
//                       idx === currentImageIndex
//                         ? "border-blue-500"
//                         : "border-gray-200"
//                     }`}
//                   >
//                     <img
//                       src={img.thumb}
//                       alt={img.alt}
//                       className="w-full h-full object-cover"
//                     />
//                   </button>
//                 ))}
//               </div>
//             </div>
//           </div>

//           {/* Product Info */}
//           <div className="md:w-1/2  space-y-6 text-gray-800">
//             <h1 className="text-xl font-bold">{fullProduct?.name}</h1>

//             {/* Price */}
//             <div className="flex items-center gap-3">
//               <span className="text-3xl font-bold text-[#000000]">
//                 ₹{selectedVariant?.price || fullProduct?.price}
//               </span>

//               {fullProduct?.compare_at_price && (
//                 <span className="line-through text-gray-400 text-lg">
//                   ₹
//                   {selectedVariant?.compareAtPrice ||
//                     fullProduct?.compare_at_price}
//                 </span>
//               )}
//               <div className="flex items-center gap-1">
//                 <span className="text-amber-500">★</span>
//                 <span className="text-sm text-gray-600">
//                   {parseFloat(fullProduct?.rating ?? "0.0").toFixed(1)} (
//                   {fullProduct?.total_ratings})
//                 </span>
//               </div>
//             </div>

//             {/* Variant Options */}
//             {fullProduct?.options?.map((opt: any, index: number) => (
//               <div key={opt.id}>
//                 <h3 className="font-semibold mb-2 text-gray-800">
//                   Select {opt.name}
//                 </h3>

//                 <div className="flex gap-4 flex-wrap">
//                   {opt.values.map((val: any) => (
//                     <button
//                       key={val.id}
//                       onClick={() => handleSelectOption(opt.name, val.value)}
//                       className={`px-4 py-2 rounded-lg border font-semibold ${
//                         selectedOptions[opt.name] === val.value
//                           ? "border-[#000000] text-[#000000]"
//                           : "border-gray-300"
//                       }`}
//                     >
//                       {val.value}
//                     </button>
//                   ))}
//                 </div>
//               </div>
//             ))}
//             <div className="text-gray-800">
//               <span className=" font-bold text-[#000000]">
//                 {selectedVariant?.quantity && (
//                   <div>Total Stock - {selectedVariant?.quantity}</div>
//                 )}
//               </span>
//             </div>

//             {/* Quantity + Add to Cart */}
//             <div className="flex justify-between">
//               <div>
//                 {itemAlreadyInCart && (
//                   <div className="flex items-center gap-4">
//                     <button
//                       className="px-3 py-2 border rounded-lg"
//                       onClick={() => {
//                         if (cartQuantity > 1) {
//                           updateQuantity(
//                             fullProduct.id,
//                             variantId,
//                             cartQuantity - 1
//                           );
//                         }
//                       }}
//                     >
//                       -
//                     </button>

//                     <span className="text-xl font-bold">{cartQuantity}</span>

//                     <button
//                       className="px-3 py-2 border rounded-lg"
//                       onClick={() => {
//                         const stock = getAvailableStock();
//                         if (cartQuantity < stock) {
//                           updateQuantity(
//                             fullProduct.id,
//                             variantId,
//                             cartQuantity + 1
//                           );
//                         }
//                       }}
//                     >
//                       +
//                     </button>
//                   </div>
//                 )}
//               </div>
//               {!fullProduct?.quantity || selectedVariant?.quantity > 0 ? (
//                 <button
//                   disabled={!allOptionsSelected}
//                   onClick={handleAddToCart}
//                   className={`w-[50%] py-3 rounded-lg text-white font-semibold ${
//                     !allOptionsSelected
//                       ? "bg-gray-300"
//                       : itemAlreadyInCart
//                       ? "bg-gray-500"
//                       : "bg-[#000000] border-2 border-dotted hover:bg-gray-800"
//                   }`}
//                 >
//                   {itemAlreadyInCart
//                     ? "Remove from Cart"
//                     : !allOptionsSelected
//                     ? " Select a varient"
//                     : "Add to Cart"}
//                 </button>
//               ) : (
//                 <button
//                   disabled={true}
//                   className="w-[50%] py-3 rounded-lg  text-white font-semibold bg-gray-500"
//                 >
//                   {"No Product Avilable"}
//                 </button>
//               )}
//             </div>
//             <div>
//               <h1 className="text-2xl font-bold">Description</h1>
//               <div
//                 style={{ whiteSpace: "pre-wrap" }}
//                 dangerouslySetInnerHTML={{ __html: fullProduct?.description }}
//               />
//             </div>
//           </div>
//         </div>

//         {/* Pack Contents */}
//         <div className="bg-white rounded-lg p-8 mb-12">
//           <h2 className="text-2xl font-bold text-gray-900 mb-6">
//             This pack contains
//           </h2>
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             {packItems.map((item) => (
//               <div
//                 key={item.id}
//                 className="border border-gray-200 rounded-lg p-4 flex gap-4"
//               >
//                 <img
//                   src={item.image}
//                   alt={item.name}
//                   className="w-24 h-24 object-cover rounded"
//                 />
//                 <div className="flex-1">
//                   <h3 className="font-semibold text-gray-900 mb-2">
//                     {item.name}
//                   </h3>
//                   <p className="text-xl font-bold text-gray-900 mb-2">
//                     ${item.price.toFixed(2)}
//                   </p>
//                   <p className="text-sm text-gray-600">x {item.quantity}</p>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* Tabs */}
//         <div className="bg-white rounded-lg mb-12">
//           <div className="border-b">
//             <div className="flex gap-8 px-8">
//               {[
//                 { id: "description", label: "Description" },
//                 { id: "details", label: "Product Details" },
//                 { id: "reviews", label: "Reviews" },
//                 { id: "extra1", label: "Extra Tab" },
//                 { id: "extra2", label: "Extra Tab 1" },
//               ].map((tab) => (
//                 <button
//                   key={tab.id}
//                   onClick={() => setActiveTab(tab.id)}
//                   className={`py-4 px-2 font-semibold border-b-2 transition ${
//                     activeTab === tab.id
//                       ? "border-blue-600 text-blue-600"
//                       : "border-transparent text-gray-700 hover:text-gray-900"
//                   }`}
//                 >
//                   {tab.label}
//                 </button>
//               ))}
//             </div>
//           </div>

//           <div className="p-8">
//             {activeTab === "description" && (
//               <div className="prose prose-sm max-w-none">
//                 <p className="text-gray-700 leading-relaxed">
//                   Studio Design's PolyFaune collection features classic products
//                   with colorful patterns, inspired by traditional Japanese
//                   origamis. To wear with a chino or jeans. The sublimation
//                   textile printing process provides exceptional color rendering
//                   and durability guaranteed over time.
//                 </p>
//               </div>
//             )}

//             {activeTab === "details" && (
//               <div>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   <div>
//                     <h3 className="font-semibold text-gray-900 mb-2">
//                       Manufacturer
//                     </h3>
//                     <p className="text-gray-600">Studio Design</p>
//                   </div>
//                   <div>
//                     <h3 className="font-semibold text-gray-900 mb-2">
//                       Reference
//                     </h3>
//                     <p className="text-gray-600">demo_3</p>
//                   </div>
//                   <div>
//                     <h3 className="font-semibold text-gray-900 mb-2">
//                       In stock
//                     </h3>
//                     <p className="text-gray-600">2052 Items</p>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {activeTab === "reviews" && (
//               <div className="text-center py-8">
//                 <button className="text-blue-600 hover:text-blue-700 font-semibold">
//                   Be the first to write your review!
//                 </button>
//               </div>
//             )}

//             {activeTab === "extra1" && (
//               <p className="text-gray-600 leading-relaxed">
//                 Sed molestie orci sem, at semper est molestie ac. Suspendisse
//                 cursus feugiat erat, eu posuere massa. Nullam posuere nibh non
//                 eros lobortis tempus.
//               </p>
//             )}

//             {activeTab === "extra2" && (
//               <p className="text-gray-600">Extra Tab 1 content here</p>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ProductDetail;

"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Share2, ShoppingCart, Heart, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";
import { useCartStore } from "@/store/useCartStore";

const ProductPage = () => {
  const [mainImage, setMainImage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const [selectedOptions, setSelectedOptions] = useState<any>({});
  const [selectedVariant, setSelectedVariant] = useState<any>(null);

  const [rating, setRating] = useState<number>(1);
  const [comment, setComment] = useState<string>("");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [expandedTab, setExpandedTab] = useState<number | null>(null);
  const params = useParams<{ slug: string | undefined }>();

  const imageRef = useRef<HTMLDivElement | null>(null);

  const [showLens, setShowLens] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });

  const LENS_SIZE = 150;
  const ZOOM = 2;
  const safeImageUrl = (url?: string) =>
    url ? encodeURI(url.replace(/\+/g, "%2B")) : "";
  const {
    addToCart,
    removeFromCart,
    updateQuantity,
    cart,
    isInCart,
    getItemQty,
  } = useCartStore();

  const {
    isLoading: isLoadingSingleProduct,
    isError: isErrorSingleProduct,
    data: product,
    error: errorSingleProduct,
    refetch,
  } = useQuery({
    queryKey: ["All-category", params?.slug],
    queryFn: () => getRequest(`/api/v1/products/${params?.slug}`),
  });

  useEffect(() => {
    if ((product as any)?.data?.images?.length > 0) {
      setMainImage((product as any)?.data?.images?.[0]?.image);
    }
  }, [product]);

  // 🔥 Match Variant based on selected options
  useEffect(() => {
    if ((product as any)?.data?.variants) {
      const match = (product as any)?.data?.variants.find((v: any) =>
        v.combination.every((value: string) =>
          Object.values(selectedOptions).includes(value),
        ),
      );
      setSelectedVariant(match || null);
    }
  }, [selectedOptions]);

  const fullProduct = (product as any)?.data;

  useEffect(() => {
    if (selectedVariant?.images?.length > 0) {
      setMainImage(selectedVariant?.images[0].image);
    } else if (fullProduct?.images?.length > 0) {
      setMainImage(fullProduct.images[0].image);
    }
  }, [selectedVariant, fullProduct]);

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl text-black">Loading...</p>
      </div>
    );
  }

  const allOptionsSelected = fullProduct?.options?.every(
    (opt: any) => selectedOptions[opt.name],
  );
  const variantId = selectedVariant?.id || null;
  const itemAlreadyInCart = isInCart(fullProduct?.id, variantId);
  const cartQuantity = getItemQty(fullProduct?.id, variantId);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();

    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    // Clamp inside image
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));

    setLensPos({ x, y });
  };

  const getAvailableStock = () => {
    if (selectedVariant) return Number(selectedVariant.quantity);
    return Number(fullProduct.available_quantity || 1);
  };

  const handleSelectOption = (name: string, value: string) => {
    setSelectedOptions((prev: any) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddToCart = () => {
    const variantId = selectedVariant?.id || null;

    // 🛑 Requires selecting all options when variants exist
    if (fullProduct.options?.length > 0 && !allOptionsSelected) {
      alert("Select all options first!");
      return;
    }

    // Check if item with same variant already exists
    const alreadyAdded = isInCart(fullProduct.id, variantId);

    if (alreadyAdded) {
      removeFromCart(fullProduct.id, variantId);
      return;
    }

    // 🔥 Build the final cart item with variant data
    const itemToAdd = {
      ...fullProduct,
      sku: selectedVariant?.sku,
      variant_id: variantId,
      price: selectedVariant?.price || fullProduct.price,
      compare_at_price:
        selectedVariant?.compareAtPrice || fullProduct.compare_at_price,
      stock: selectedVariant?.quantity || fullProduct.available_quantity,
      images:
        selectedVariant?.images?.length > 0
          ? selectedVariant.images
          : fullProduct.images,
      options: selectedOptions,
    };
    addToCart(itemToAdd, variantId, 1);
  };

  const openModal = (img: string) => {
    setZoomImage(img);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setZoomImage(null);
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Product Grid */}
        <div className=" gap-12 mb-12">
          {/* Images Section */}
          <div className=" md:flex md:gap-10">
            {/* LEFT - Images */}
            <div className="md:w-1/2 px-20 md:sticky md:top-2 md:h-fit">
              <div className="bg-white  p-4 mb-4 sticky top-8">
                {/* Main Image with Magnifier */}
                <div
                  ref={imageRef}
                  className="relative bg-gray-100  overflow-hidden cursor-none"
                  style={{ aspectRatio: "1" }}
                  onMouseEnter={() => setShowLens(true)}
                  onMouseLeave={() => setShowLens(false)}
                  onMouseMove={handleMouseMove}
                  onClick={() => openModal(mainImage)}
                >
                  {mainImage && (
                    <img
                      src={mainImage}
                      className="w-full h-full object-cover"
                      alt="Product"
                    />
                  )}

                  {/* Magnifier Lens */}
                  {showLens &&
                    imageRef.current &&
                    (() => {
                      const imgWidth = imageRef.current.offsetWidth;
                      const imgHeight = imageRef.current.offsetHeight;

                      const bgX = (lensPos.x / imgWidth) * 100;
                      const bgY = (lensPos.y / imgHeight) * 100;

                      return (
                        <div
                          className="absolute rounded-full border-2 border-gray-300 bg-white pointer-events-none shadow-2xl"
                          style={{
                            width: LENS_SIZE,
                            height: LENS_SIZE,
                            top: lensPos.y - LENS_SIZE / 2,
                            left: lensPos.x - LENS_SIZE / 2,
                            backgroundImage: `url(${mainImage ? encodeURI(mainImage) : ""})`,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: `${imgWidth * ZOOM}px ${imgHeight * ZOOM}px`,
                            backgroundPosition: `${LENS_SIZE / 2 - lensPos.x * ZOOM}px ${LENS_SIZE / 2 - lensPos.y * ZOOM}px`,
                          }}
                        />
                      );
                    })()}
                </div>

                {/* Thumbnails */}
                <div className="flex gap-3 mt-4 flex-wrap justify-center">
                  {(selectedVariant?.images?.length
                    ? selectedVariant.images
                    : fullProduct?.images
                  )?.map((img: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => setMainImage(img.image)}
                      className={`w-20 h-20  overflow-hidden border-1 ${
                        mainImage === img.image
                          ? "border-[#000000]"
                          : "border-gray-300 opacity-70"
                      }`}
                    >
                      <img
                        src={img.image}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT - Product Info */}
            <div className="md:w-1/2  space-y-6 text-gray-800">
              <h1 className="text-xl font-bold">{fullProduct?.name}</h1>

              {/* Price */}
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-[#000000]">
                  ₹{selectedVariant?.price || fullProduct?.price}
                </span>

                {fullProduct?.compare_at_price && (
                  <span className="line-through text-gray-400 text-lg">
                    ₹
                    {selectedVariant?.compareAtPrice ||
                      fullProduct?.compare_at_price}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-amber-500">★</span>
                  <span className="text-sm text-gray-600">
                    {parseFloat(fullProduct?.rating ?? "0.0").toFixed(1)} (
                    {fullProduct?.total_ratings})
                  </span>
                </div>
              </div>

              {/* Variant Options */}
              {fullProduct?.options?.map((opt: any, index: number) => (
                <div key={opt.id}>
                  <h3 className="font-semibold mb-2 text-gray-800">
                    Select {opt.name}
                  </h3>

                  <div className="flex gap-4 flex-wrap">
                    {opt.values.map((val: any) => (
                      <button
                        key={val.id}
                        onClick={() => handleSelectOption(opt.name, val.value)}
                        className={`px-4 py-2 rounded-lg border font-semibold ${
                          selectedOptions[opt.name] === val.value
                            ? "border-[#000000] text-[#000000]"
                            : "border-gray-300"
                        }`}
                      >
                        {val.value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="text-gray-800">
                <span className=" font-bold text-[#000000]">
                  {selectedVariant?.quantity && (
                    <div>Total Stock - {selectedVariant?.quantity}</div>
                  )}
                </span>
              </div>

              {/* Quantity + Add to Cart */}
              <div className="flex justify-between">
                <div>
                  {itemAlreadyInCart && (
                    <div className="flex items-center gap-4">
                      <button
                        className="px-3 py-2 border rounded-lg"
                        onClick={() => {
                          if (cartQuantity > 1) {
                            updateQuantity(
                              fullProduct.id,
                              variantId,
                              cartQuantity - 1,
                            );
                          }
                        }}
                      >
                        -
                      </button>

                      <span className="text-xl font-bold">{cartQuantity}</span>

                      <button
                        className="px-3 py-2 border rounded-lg"
                        onClick={() => {
                          const stock = getAvailableStock();
                          if (cartQuantity < stock) {
                            updateQuantity(
                              fullProduct.id,
                              variantId,
                              cartQuantity + 1,
                            );
                          }
                        }}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
                {!fullProduct?.quantity || selectedVariant?.quantity > 0 ? (
                  <button
                    disabled={!allOptionsSelected}
                    onClick={handleAddToCart}
                    className={`w-[50%] py-3 rounded-lg text-white font-semibold ${
                      !allOptionsSelected
                        ? "bg-gray-300"
                        : itemAlreadyInCart
                          ? "bg-gray-500"
                          : "bg-[#000000] border-2 border-dotted hover:bg-gray-800"
                    }`}
                  >
                    {itemAlreadyInCart
                      ? "Remove from Cart"
                      : !allOptionsSelected
                        ? " Select a varient"
                        : "Add to Cart"}
                  </button>
                ) : (
                  <button
                    disabled={true}
                    className="w-[50%] py-3 rounded-lg  text-white font-semibold bg-gray-500"
                  >
                    {"No Product Avilable"}
                  </button>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold">Description</h1>
                <div
                  style={{ whiteSpace: "pre-wrap" }}
                  dangerouslySetInnerHTML={{ __html: fullProduct?.description }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Accordion Sections */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">


          {/* Shipping & Returns Section */}
          <div>
            <button
              onClick={() => setExpandedTab(expandedTab === 2 ? null : 2)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <span className="text-lg font-semibold text-gray-900">
                Shipping & Returns
              </span>
              <ChevronDown
                className={`w-5 h-5 text-gray-600 transition ${
                  expandedTab === 2 ? "rotate-180" : ""
                }`}
              />
            </button>
            {expandedTab === 2 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 space-y-4">
                <p className="text-gray-700">
                  Free Standard Shipping with any online purchase of $50
                  (merchandise subtotal excludes store pick up items;
                  merchandise subtotal is calculated before sales tax, before
                  gift wrap charges, and after any discounts or coupons). Truck
                  delivery and shipping surcharges on over-sized or extremely
                  heavy items will still apply (these charges are indicated on
                  the appropriate product information pages and will be
                  displayed in the shipping subtotal of your order). Orders
                  typically arrive within 3-6 business days. Items shipped
                  directly from the vendor or to Alaska and Hawaii have longer
                  delivery lead times. This offer does not apply to Alaska,
                  Hawaii, Puerto Rico or Business Direct orders.
                </p>
              </div>
            )}
          </div>
        </div>


      </div>

      {/* Image Modal */}
      {isModalOpen && zoomImage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className="relative max-w-2xl w-[90%]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 bg-white p-2 rounded-full"
            >
              <X />
            </button>

            <img
              src={zoomImage}
              className="w-full object-contain max-h-[80vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
