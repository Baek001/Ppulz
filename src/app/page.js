export const runtime = 'edge';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import HowToUse from '@/components/sections/HowToUse';
import Features from '@/components/sections/Features';
import PredictionMarketIntro from '@/components/sections/PredictionMarketIntro';
import Trust from '@/components/sections/Trust';

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <HowToUse />
      <Features />
      <PredictionMarketIntro />
      <Trust />
      <Footer />
    </main>
  );
}

