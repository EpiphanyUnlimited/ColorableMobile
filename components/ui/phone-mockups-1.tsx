import {
  ImageItem,
  PhoneCarousel,
} from "@/components/ui/phone-mockups-1-utils/phone-carousel";

const exampleImages: ImageItem[] = [
  {
    src: "/mockups/hero.png",
    alt: "Colorable — turn photos into coloring pages, 100% on-device AI",
  },
  {
    src: "/mockups/editor-vivid.png",
    alt: "Colorable book designer in vivid mode with Add Page",
  },
  {
    src: "/mockups/landing.png",
    alt: "Colorable AI landing page — photo to line-art in seconds",
  },
];

export default function PhoneMockupBasic() {
  return <PhoneCarousel images={exampleImages} />;
}
