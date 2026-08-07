import React from "react";
import Image from "next/image";
import Link from "next/link";

interface BannerProps {
  backgroundImage?: string;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  buttonText?: string;
  buttonLink?: string;
}

const BodyBanner: React.FC<BannerProps> = ({
  backgroundImage = "/hero/h1-bn-4.jpg",
  title = "Lighting",
  subtitle = "2019",
  imageUrl = "/images/home1_image_layout_2.png",
  buttonText = "Discover NOW",
  buttonLink = "#",
}) => {
  return (
    <div
      className=" w-full h-full bg-cover bg-center bg-no-repeat px-4 py-25"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-center md:ml-200">
          {/* Banner Text */}
          {/* <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
              {title}
              <br />
              {subtitle}
            </h2>
          </div> */}
          <div className="flex gap-5">
            <div className="border-l-2 h-10"></div>
            <div className="text-sm md:text-white font-bold tracking-widest uppercase ">
              {title}
              <br />
              {subtitle}
            </div>
          </div>

          {/* Image */}
          {/* <div className="w-full  mb-8">
            <img
              src={imageUrl}
              alt="Product showcase"
              className="w-full h-full"
            />
          </div> */}

          <div
            className="flex flex-col items-center
  text-[11rem] font-medium text-white leading-[0.8] tracking-widest  mt-10"
          >
            <div>LO</div>
            <div>LO</div>
          </div>
          {/* Button */}
          <div className="flex justify-center mt-5">
            <Link
              href={buttonLink}
              className="inline-block px-12 py-3 bg-transparent border-2 text-white 
              font-semibold  hover:bg-[#02F8C5] hover:border-black transition-colors duration-300 shadow-lg"
            >
              {buttonText}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BodyBanner;
