import HeroSection from "@/Component1/HeroSection";
import ShopSection from "@/Component1/ShopSection";
import CategoryShowcase from "@/Component1/CategoryShowcase";
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
