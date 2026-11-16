import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import GallerySection from "@/components/GallerySection";
import WhyUsSection from "@/components/WhyUsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";
import QuoteCalculatorSection from "@/components/QuoteCalculatorSection";

const Index = () => {
  return (
    <div className="public-site min-h-screen bg-background text-foreground antialiased">
      <Navbar />
      <HeroSection />
      <WhyUsSection />
      <GallerySection />
      <TestimonialsSection />
      <QuoteCalculatorSection />
      <Footer />
    </div>
  );
};

export default Index;
