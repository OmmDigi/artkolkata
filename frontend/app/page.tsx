import HeroSection from "@/Component1/HeroSection";
import ShopSection from "@/Component1/ShopSection";
import CategoryShowcase from "@/Component1/CategoryShowcase";
import Marquee from "@/Component1/Marquee";
import VideoSection from "@/Component1/VideoSection";
import WatchOnYouTube from "@/Component1/WatchOnYouTube";
import ProductEnquiryForm from "@/Component1/ProductEnquiryForm";
import { getPrimaryVideo, getVideos } from "@/lib/videos";

export default async function Home() {
  const [primaryVideo, videos] = await Promise.all([
    getPrimaryVideo(),
    getVideos(),
  ]);

  return (
    <>
      <HeroSection />
      <Marquee />
      <CategoryShowcase />
      <ShopSection />
      <VideoSection video={primaryVideo} />
      <WatchOnYouTube videos={videos} />
      <ProductEnquiryForm />
    </>
  );
}
