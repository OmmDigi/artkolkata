import Image from "next/image";

const promoSectionList = [
  {
    id: 1,
    heading: "Free Shipping",
    subtitle: "on all US order or order above $99",
    image: "/car.png",
    imageWidth : "w-12"
  },
  {
    id: 2,
    heading: "Support 24/7 :",
    subtitle: "Contact us 24 hours a day, 7 days a week",
    image: "/phone.png",
    imageWidth : "w-8"
  },
  {
    id: 3,
    heading: "30 Days Return :",
    subtitle: "Simply return it within 30 days for an exchange.",
    image: "/exchang.png",
    imageWidth : "w-8"
  },
];

export default function PromoSection() {
  return (
    <section className="container px-4 mx-auto py-7">
      <ul className="flex items-center justify-center gap-y-5 md:justify-between lg:justify-between flex-wrap md:flex-nowrap lg:flex-nowrap">
        {promoSectionList.map((item) => (
          <li key={item.id} className="flex items-center flex-col md:flex-row lg:flex-row gap-2.5">
            <span>
              <Image
                className={item.imageWidth}
                src={item.image}
                alt="Car Image"
                height={512}
                width={512}
              />
            </span>
            <span className="block max-w-64 text-sm font-spartan md:text-left lg:text-left text-center">
              <span className="font-semibold">{item.heading}</span>{" "}
              {item.subtitle}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
