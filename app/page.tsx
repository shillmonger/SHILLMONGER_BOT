"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";


import Hero from "../components/LandingPage/Hero";
import HowWeWork from "../components/LandingPage/HowWeWork";
import PricingClarity from "../components/LandingPage/PricingClarity";
import FloatingSidebar from "../components/LandingPage/FloatingSidebar";
import WhyShillmonger from "../components/LandingPage/WhyShillmonger";
import TradingPlatforms from "../components/LandingPage/TradingPlatforms";
import AskShillmonger from "../components/LandingPage/AskShillmonger";
import BacktestResults from "../components/LandingPage/BacktestResults";
import FQ from "@/components/LandingPage/F&Q";

export default function App() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased selection:bg-neutral-800 selection:text-neutral-50 overflow-x-clip">
      <Hero />
      <HowWeWork />
      <PricingClarity />
      <BacktestResults />
      <div className="hidden md:block">
      <FloatingSidebar />
      </div>
      <div className="hidden md:block">
        <WhyShillmonger />
      </div>
      <AskShillmonger/>
      <TradingPlatforms />
      <FQ />
    </div>
  );
}