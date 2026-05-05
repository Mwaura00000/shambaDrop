"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Inter, Montserrat } from 'next/font/google';

// Enforce Premium Typography
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

// Custom Animated Agrimove Logo
const AgrimoveLogo = () => (
  <div className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-lg shadow-green-500/40 group overflow-hidden cursor-pointer flex-shrink-0">
    <div className="absolute inset-0 bg-white/30 -translate-x-full group-hover:animate-[shimmer_1s_infinite] skew-x-12 z-0"></div>
    <svg className="w-7 h-7 text-white transform group-hover:-translate-y-1 transition-transform duration-300 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center shadow-sm z-20">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
    </div>
  </div>
);

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Authentic local Kenyan selections
  const heroFeatures = [
    {
      image: "https://images.pexels.com/photos/2255938/pexels-photo-2255938.jpeg?auto=compress&cs=tinysrgb&w=1200",
      title: "Open Marketplace",
      desc: "Farmers post loads. Drivers bid instantly.",
      icon: "🚜"
    },
    {
      image: "https://images.pexels.com/photos/2199293/pexels-photo-2199293.jpeg?auto=compress&cs=tinysrgb&w=1200",
      title: "Live GPS Tracking",
      desc: "Watch your cargo move in real-time.",
      icon: "📍"
    },
    {
      image: "https://images.pexels.com/photos/1112080/pexels-photo-1112080.jpeg?auto=compress&cs=tinysrgb&w=1200",
      title: "M-Pesa Escrow",
      desc: "Funds secured until delivery is confirmed.",
      icon: "🛡️"
    }
  ];

  // Scroll handler for Navbar
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 4-Second Interval Slider
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % heroFeatures.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [heroFeatures.length]);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      // FIXED: Increased offset to 100px so the heading clears the tall navbar perfectly
      const offset = 100; 
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  return (
    <div className={`font-sans text-gray-800 antialiased overflow-x-hidden selection:bg-green-500 selection:text-white scroll-smooth ${inter.variable} ${montserrat.variable}`}>
      
      {/* --- CSS Animations --- */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer { 100% { transform: translateX(100%); } }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}} />

      {/* --- NAVBAR --- */}
      {/* FIXED: Changed to solid 'bg-white' when scrolled so text underneath doesn't bleed through */}
      <nav className={`fixed w-full z-[100] border-b transition-all duration-300 ${isScrolled ? 'bg-white shadow-md border-gray-200' : 'bg-transparent border-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            
            <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
              <AgrimoveLogo />
              <span className={`${montserrat.className} font-extrabold text-3xl text-gray-900 tracking-tight group-hover:text-green-600 transition-colors`}>Agrimove</span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="text-gray-700 hover:text-green-600 font-bold transition">How it Works</a>
              <a href="#benefits" onClick={(e) => scrollToSection(e, 'benefits')} className="text-gray-700 hover:text-green-600 font-bold transition">Benefits</a>
              <a href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')} className="text-gray-700 hover:text-green-600 font-bold transition">Stories</a>
              <div className="h-6 w-px bg-gray-300"></div>
              <Link href="/login" className="text-gray-900 hover:text-green-600 font-bold transition">Login</Link>
              <Link href="/register" className="bg-green-600 hover:bg-green-700 text-white px-7 py-3 rounded-xl font-bold transition shadow-lg shadow-green-500/20 transform hover:-translate-y-1">
                Get Started Free
              </Link>
            </div>

            <div className="md:hidden flex items-center z-50">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-600 hover:text-green-600 focus:outline-none p-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <>
            <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setIsMenuOpen(false)}></div>
            <div className="md:hidden bg-white border-t border-gray-100 absolute w-full shadow-2xl z-50 animate-in slide-in-from-top-4 duration-200">
              <div className="px-6 pt-4 pb-8 space-y-3">
                <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="block px-3 py-4 rounded-xl text-base font-bold text-gray-700 hover:text-green-600 hover:bg-green-50">How it Works</a>
                <a href="#benefits" onClick={(e) => scrollToSection(e, 'benefits')} className="block px-3 py-4 rounded-xl text-base font-bold text-gray-700 hover:text-green-600 hover:bg-green-50">Benefits</a>
                <Link href="/login" className="block px-3 py-4 rounded-xl text-base font-bold text-gray-700 hover:text-green-600 hover:bg-green-50">Login</Link>
                <Link href="/register" className="block mt-6 w-full text-center bg-green-600 text-white px-4 py-4 rounded-xl font-bold shadow-lg shadow-green-500/20">Get Started Free</Link>
              </div>
            </div>
          </>
        )}
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-[#f8fafc]">
        {/* Animated Background Blobs */}
        <div className="absolute top-0 -left-4 w-96 h-96 bg-green-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob pointer-events-none"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000 pointer-events-none"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* Left: Copy & Buttons */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-green-200 text-green-700 font-bold text-xs uppercase tracking-widest mb-6 shadow-sm">
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                Connecting Kenya&apos;s Supply Chain
              </div>
              <h1 className={`${montserrat.className} text-5xl sm:text-6xl lg:text-7xl font-black text-gray-900 leading-[1.1] mb-6 tracking-tight`}>
                Move Your Harvest <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500">Faster & Safer.</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0 font-medium leading-relaxed">
                Agrimove directly connects farmers with trusted, verified transporters. Stop waiting for middle-men. Get your produce to market fresh, while saving on transport costs.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/register" className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition shadow-xl shadow-green-600/30 flex items-center justify-center gap-2 hover:-translate-y-1">
                  I am a Farmer <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </Link>
                <Link href="/register" className="bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-900 px-8 py-4 rounded-xl font-bold text-lg transition shadow-sm flex items-center justify-center gap-2 hover:-translate-y-1">
                  I am a Transporter <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                </Link>
              </div>
              <p className="mt-6 text-sm text-gray-500 font-bold flex items-center justify-center lg:justify-start gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                100% Free to join. Secure & Verified.
              </p>
            </div>

            {/* Right: Feature Slider */}
            <div className="relative h-[500px] w-full rounded-[2.5rem] shadow-2xl z-10 overflow-hidden bg-gray-900 border-[8px] border-white/50 backdrop-blur-sm">
              
              {heroFeatures.map((feature, index) => (
                <img 
                  key={index} 
                  src={feature.image} 
                  alt={feature.title} 
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                    activeIndex === index ? 'opacity-80 z-10' : 'opacity-0 z-0'
                  }`} 
                />
              ))}
              
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-900/40 to-transparent z-20 pointer-events-none"></div>
              
              <div className="absolute bottom-6 left-6 right-6 bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-2xl flex items-center gap-4 z-30 shadow-2xl transition-all duration-500 hover:scale-[1.02]">
                <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl shadow-inner flex-shrink-0">
                  {heroFeatures[activeIndex].icon}
                </div>
                <div className="transition-opacity duration-300">
                  <h4 className={`${montserrat.className} text-white font-bold text-lg drop-shadow-md tracking-tight`}>{heroFeatures[activeIndex].title}</h4>
                  <p className="text-green-50 text-sm font-medium drop-shadow-md">{heroFeatures[activeIndex].desc}</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* --- STATS SECTION --- */}
      <section className="bg-green-900 py-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-green-800/50">
            <div>
              <h3 className={`${montserrat.className} text-4xl md:text-5xl font-black text-white mb-2`}>47</h3>
              <p className="text-green-300 font-bold uppercase tracking-widest text-xs">Counties Covered</p>
            </div>
            <div>
              <h3 className={`${montserrat.className} text-4xl md:text-5xl font-black text-white mb-2`}>12k+</h3>
              <p className="text-green-300 font-bold uppercase tracking-widest text-xs">Active Farmers</p>
            </div>
            <div>
              <h3 className={`${montserrat.className} text-4xl md:text-5xl font-black text-white mb-2`}>850+</h3>
              <p className="text-green-300 font-bold uppercase tracking-widest text-xs">Verified Trucks</p>
            </div>
            <div>
              <h3 className={`${montserrat.className} text-4xl md:text-5xl font-black text-white mb-2`}>99%</h3>
              <p className="text-green-300 font-bold uppercase tracking-widest text-xs">Delivery Success</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- THE CHALLENGE --- */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-green-600 font-bold tracking-widest uppercase text-sm mb-3">The Challenge</h2>
            <h3 className={`${montserrat.className} text-3xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight`}>Why we built Agrimove</h3>
            <p className="text-gray-500 text-xl font-medium leading-relaxed">Traditional farm transport is broken. We are here to fix the supply chain so everyone wins.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-red-50/50 p-8 rounded-3xl border border-red-100 hover:bg-red-50 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-md">
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h4 className={`${montserrat.className} text-xl font-bold text-gray-900 mb-3`}>Post-Harvest Losses</h4>
              <p className="text-gray-600 leading-relaxed font-medium">Nearly 30% of harvested produce rots at the farm while waiting days for unreliable transport to arrive.</p>
            </div>
            
            <div className="bg-orange-50/50 p-8 rounded-3xl border border-orange-100 hover:bg-orange-50 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-md">
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h4 className={`${montserrat.className} text-xl font-bold text-gray-900 mb-3`}>Middlemen Exploitation</h4>
              <p className="text-gray-600 leading-relaxed font-medium">Brokers inflate transport prices, leaving farmers with minimal profits and drivers with unfair wages.</p>
            </div>
            
            <div className="bg-gray-50 p-8 rounded-3xl border border-gray-200 hover:bg-gray-100 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-md">
              <div className="w-14 h-14 bg-white shadow-sm border border-gray-200 text-gray-700 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              </div>
              <h4 className={`${montserrat.className} text-xl font-bold text-gray-900 mb-3`}>Empty Return Trips</h4>
              <p className="text-gray-600 leading-relaxed font-medium">Transporters often drive back empty after a delivery. This wastes fuel and doubles the cost of logistics.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- BENEFITS SECTION --- */}
      <section id="benefits" className="py-24 bg-[#F8FAFC] border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* For Farmers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-32">
            <div>
              <div className="inline-block bg-green-100 text-green-700 font-bold tracking-widest uppercase text-xs px-4 py-1.5 rounded-lg mb-5 border border-green-200">For Farmers</div>
              <h3 className={`${montserrat.className} text-3xl md:text-5xl font-black text-gray-900 mb-8 tracking-tight leading-tight`}>Get your produce to market fresh and on time.</h3>
              <ul className="space-y-8">
                <li className="flex gap-5">
                  <div className="flex-shrink-0 w-14 h-14 bg-white border border-green-100 text-green-600 rounded-2xl flex items-center justify-center shadow-md">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">Instant Connections</h4>
                    <p className="text-gray-500 mt-2 font-medium text-lg">Post a request and get matched with available drivers in your county within minutes.</p>
                  </div>
                </li>
                <li className="flex gap-5">
                  <div className="flex-shrink-0 w-14 h-14 bg-white border border-green-100 text-green-600 rounded-2xl flex items-center justify-center shadow-md">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">Verified Drivers Only</h4>
                    <p className="text-gray-500 mt-2 font-medium text-lg">Every transporter is vetted with ID and logbook checks so your cargo is always safe.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative">
              <img src="https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?auto=format&fit=crop&w=1000&q=80" alt="Happy farmer" className="rounded-[2.5rem] shadow-2xl object-cover h-[500px] w-full relative z-10" />
              <div className="absolute inset-0 border-[6px] border-green-500 rounded-[2.5rem] transform translate-x-6 translate-y-6 z-0"></div>
            </div>
          </div>

          {/* For Transporters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center flex-col-reverse lg:flex-row-reverse">
            <div>
              <div className="inline-block bg-blue-100 text-blue-700 font-bold tracking-widest uppercase text-xs px-4 py-1.5 rounded-lg mb-5 border border-blue-200">For Transporters</div>
              <h3 className={`${montserrat.className} text-3xl md:text-5xl font-black text-gray-900 mb-8 tracking-tight leading-tight`}>Keep your truck moving and maximize earnings.</h3>
              <ul className="space-y-8">
                <li className="flex gap-5">
                  <div className="flex-shrink-0 w-14 h-14 bg-white border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-md">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">Find Jobs Anywhere</h4>
                    <p className="text-gray-500 mt-2 font-medium text-lg">Browse a live feed of transport requests. Perfect for finding return-trip loads.</p>
                  </div>
                </li>
                <li className="flex gap-5">
                  <div className="flex-shrink-0 w-14 h-14 bg-white border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-md">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">Direct Payments</h4>
                    <p className="text-gray-500 mt-2 font-medium text-lg">Deal directly with the farmer. Keep 100% of your negotiated transport fee.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative">
              <img src="https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1000&q=80" alt="Transport truck" className="rounded-[2.5rem] shadow-2xl object-cover h-[500px] w-full relative z-10" />
              <div className="absolute inset-0 border-[6px] border-blue-500 rounded-[2.5rem] transform -translate-x-6 translate-y-6 z-0"></div>
            </div>
          </div>

        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section id="how-it-works" className="py-24 bg-gray-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h3 className={`${montserrat.className} text-4xl md:text-5xl font-black mb-4 tracking-tight`}>How Agrimove Works</h3>
            <p className="text-gray-400 text-xl font-medium">A simple, three-step process to move your agricultural goods.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative text-center">
            {/* Connecting Line for Desktop */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-1 bg-gray-800 z-0"></div>

            <div className="relative z-10">
              <div className={`${montserrat.className} w-24 h-24 mx-auto bg-gray-800 border-[6px] border-green-500 rounded-full flex items-center justify-center text-3xl font-black text-white mb-6 shadow-xl shadow-green-500/20`}>1</div>
              <h4 className="text-2xl font-bold mb-3">Post a Request</h4>
              <p className="text-gray-400 font-medium text-lg max-w-xs mx-auto">Farmers enter produce details, weight, and drop a GPS pin for pickup.</p>
            </div>
            
            <div className="relative z-10">
              <div className={`${montserrat.className} w-24 h-24 mx-auto bg-gray-800 border-[6px] border-green-500 rounded-full flex items-center justify-center text-3xl font-black text-white mb-6 shadow-xl shadow-green-500/20`}>2</div>
              <h4 className="text-2xl font-bold mb-3">Transporter Accepts</h4>
              <p className="text-gray-400 font-medium text-lg max-w-xs mx-auto">Local drivers view the request, check the route, and bid on the job instantly.</p>
            </div>

            <div className="relative z-10">
              <div className={`${montserrat.className} w-24 h-24 mx-auto bg-gray-800 border-[6px] border-green-500 rounded-full flex items-center justify-center text-3xl font-black text-white mb-6 shadow-xl shadow-green-500/20`}>3</div>
              <h4 className="text-2xl font-bold mb-3">Deliver & Earn</h4>
              <p className="text-gray-400 font-medium text-lg max-w-xs mx-auto">The crop is transported safely. Escrow releases funds securely upon delivery.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- TESTIMONIALS --- */}
      <section id="testimonials" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className={`${montserrat.className} text-3xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight`}>Trusted by Kenyans</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#F8FAFC] p-10 rounded-3xl border border-gray-200 relative">
              <svg className="w-12 h-12 text-green-200 absolute top-8 left-8" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
              <p className="text-gray-700 text-xl italic relative z-10 pl-12 mb-8 font-medium leading-relaxed">&quot;Before Agrimove, I would wait days for a broker to find a truck for my cabbages. Now, I post a request and have a driver at my farm in Uasin Gishu the same morning.&quot;</p>
              <div className="flex items-center gap-4 pl-12">
                <div className={`${montserrat.className} w-14 h-14 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-black text-lg`}>JM</div>
                <div>
                  <h5 className="font-bold text-gray-900 text-lg">John Mwaura</h5>
                  <p className="text-gray-500 font-medium">Farmer, Uasin Gishu</p>
                </div>
              </div>
            </div>
            
            <div className="bg-[#F8FAFC] p-10 rounded-3xl border border-gray-200 relative">
              <svg className="w-12 h-12 text-blue-200 absolute top-8 left-8" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
              <p className="text-gray-700 text-xl italic relative z-10 pl-12 mb-8 font-medium leading-relaxed">&quot;I used to drive my Canter back empty from Nairobi to Nakuru. Now I use Agrimove to find return trips. It has doubled my monthly income.&quot;</p>
              <div className="flex items-center gap-4 pl-12">
                <div className={`${montserrat.className} w-14 h-14 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-black text-lg`}>DK</div>
                <div>
                  <h5 className="font-bold text-gray-900 text-lg">David Kiprono</h5>
                  <p className="text-gray-500 font-medium">Transporter, Nakuru</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section className="py-24 relative overflow-hidden bg-green-600">
        <div className="absolute inset-0 bg-gradient-to-r from-green-700 to-green-500"></div>
        <svg className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 opacity-10 text-white w-[800px] h-[800px]" fill="currentColor" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50"/></svg>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className={`${montserrat.className} text-4xl md:text-6xl font-black text-white mb-6 tracking-tight`}>Ready to revolutionize your transport?</h2>
          <p className="text-green-50 text-xl md:text-2xl mb-12 font-medium drop-shadow-md">Join thousands of farmers and drivers building the future of agriculture logistics in Kenya.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/register" className="bg-white text-green-700 hover:bg-gray-50 px-10 py-5 rounded-xl font-bold text-xl transition shadow-2xl hover:-translate-y-1">
              Create Free Account
            </Link>
            <Link href="/login" className="bg-green-800 text-white hover:bg-green-900 border border-green-700 px-10 py-5 rounded-xl font-bold text-xl transition shadow-xl hover:-translate-y-1">
              Login to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-gray-900 text-gray-300 py-16 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12 border-b border-gray-800 pb-12">
            
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <AgrimoveLogo />
                <span className={`${montserrat.className} font-black text-2xl text-white tracking-tight`}>Agrimove</span>
              </div>
              <p className="text-base text-gray-400 leading-relaxed mb-6 font-medium">
                Smart transport for modern farming. Connecting Kenyan agriculture to markets efficiently.
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 uppercase text-sm tracking-widest">Platform</h4>
              <ul className="space-y-4 text-base font-medium">
                <li><Link href="/register" className="hover:text-green-400 transition">Join as Farmer</Link></li>
                <li><Link href="/register" className="hover:text-green-400 transition">Join as Transporter</Link></li>
                <li><a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="hover:text-green-400 transition">How it Works</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 uppercase text-sm tracking-widest">Support</h4>
              <ul className="space-y-4 text-base font-medium">
                <li><Link href="/help" className="hover:text-green-400 transition">Help Center</Link></li>
                <li><Link href="/safety" className="hover:text-green-400 transition">Safety Guidelines</Link></li>
                <li><Link href="/terms" className="hover:text-green-400 transition">Terms of Service</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 uppercase text-sm tracking-widest">Contact HQ</h4>
              <ul className="space-y-4 text-base font-medium">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span>Eldoret, Uasin Gishu, Kenya</span>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <span>+254 708 663 288</span>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <span>hello@agrimove.co.ke</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500 font-bold">
            <p>&copy; 2026 Agrimove Logistics. All rights reserved.</p>
            <p className="mt-2 md:mt-0 text-base">Built for Kenyan Agriculture 🇰🇪</p>
          </div>
        </div>
      </footer>

    </div>
  );
}