import Image from "next/image";
import HeroSlideshow from "./Component/heroSection";
import Segment from "./Component/segment";
import NewDesign from "./Component/newDesign";
import BodyBanner from "./Component/bodyBanner";
import Trending from "./Component/trending/Trending";
import CustomerReview from "./Component/customerReview";
import HeroSection from "@/Component1/HeroSection";
import ShopSection from "@/Component1/ShopSection";
import CategoryShowcase from "@/Component1/CategoryShowcase";
import VideoSection from "@/Component1/VideoSection";
import BestSellersSection from "@/Component1/BestSellersSection";
import CollectionsSection from "@/Component1/CollectionsSection";
import StylesAndWear from "@/Component1/StylesAndWear";
import BlogSection from "@/Component1/BlogSection";
import Marquee from "@/Component1/Marquee";

export default function Home() {
  return (
    // <>
    //   <HeroSlideshow />
    //   <Segment />
    //   <NewDesign />
    //   <Trending />
    //   <BodyBanner />
    //   <CustomerReview />
    // </>
    <>
      <HeroSection />
      <Marquee />
      <CategoryShowcase />

      <ShopSection />
      {/* <VideoSection /> */}
      {/* <BestSellersSection /> */}
      {/* <CollectionsSection /> */}
      {/* <StylesAndWear /> */}
      {/* <BlogSection /> */}
    </>
  );
}
