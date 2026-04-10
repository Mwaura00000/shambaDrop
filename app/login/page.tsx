"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Inter, Montserrat } from 'next/font/google';
import { Toaster, toast } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

const AgrimoveLogo = () => (
  <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-lg flex-shrink-0">
    <svg className="w-6 h-6 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  </div>
);

export default function Login() {
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'password' | 'magic_link'>('password');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const executeLogin = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) { toast.error("Please enter your email address."); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }

    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (authError) {
        toast.error('Login Failed', { description: authError.message });
        setIsLoading(false);
        return;
      }

      if (authData?.user) {
        toast.success("Welcome back!");
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();
          
        setTimeout(() => {
          router.push(profile?.role === 'transporter' ? '/dashboard/transporter' : '/dashboard/farmer');
        }, 1000);
      }
    } catch (error: any) {
      alert("SYSTEM CRASH: " + error.message);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') executeLogin();
  };

  return (
    <div className={`h-screen w-full flex bg-white text-gray-800 ${inter.variable} ${montserrat.variable} font-sans overflow-hidden`} onKeyDown={handleKeyPress}>
      <Toaster position="bottom-right" richColors />

      {/* LEFT SIDE */}
      <div className="w-full lg:w-1/2 flex flex-col px-8 sm:px-16 md:px-24 py-8 overflow-y-auto relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage: 'radial-gradient(#22c55e 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>

        <div className="max-w-[400px] w-full mx-auto my-auto py-4 relative z-10">
          
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-green-600 transition mb-10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Home
          </Link>

          <div className="flex items-center gap-3 mb-6 w-fit">
            <AgrimoveLogo />
            <span className={`${montserrat.className} font-black text-2xl text-gray-900 tracking-tight`}>Agrimove</span>
          </div>

          <div className="mb-8">
            <h1 className={`${montserrat.className} text-3xl font-black text-gray-900 mb-2 tracking-tight`}>Welcome back</h1>
            <p className="text-gray-500 text-sm font-medium">Sign in to manage your agricultural logistics.</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider pl-1">Email Address</label>
              <div className="relative">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-4 pr-10 py-3.5 bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-green-500 transition-all text-sm font-medium" placeholder="name@company.com" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 pl-1">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-4 pr-12 py-3.5 bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-green-500 transition-all text-sm font-medium" placeholder="••••••••" />
              </div>
            </div>

            <button type="button" onClick={executeLogin} disabled={isLoading} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg shadow-green-600/20 mt-6 disabled:opacity-50 flex items-center justify-center gap-2 hover:-translate-y-0.5">
              {isLoading ? "Signing in..." : "Sign In to Dashboard"}
            </button>
          </div>

          <p className="text-center text-gray-500 text-sm mt-8 font-medium">
            Don't have an account? <Link href="/register" className="font-bold text-green-600 hover:text-green-700 transition">Create one now</Link>
          </p>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="hidden lg:block w-1/2 relative bg-green-900 overflow-hidden">
        <img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1200&auto=format&fit=crop" alt="Agriculture Logistics" className="absolute inset-0 w-full h-full object-cover scale-105 animate-[pulse_20s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-gradient-to-t from-green-950 via-emerald-900/70 to-transparent mix-blend-multiply"></div>
        <div className="absolute bottom-16 left-16 right-16 text-white z-10">
          <h2 className={`${montserrat.className} text-4xl lg:text-5xl font-black mb-4 leading-tight drop-shadow-xl text-white`}>Connecting Kenyan Agriculture.</h2>
        </div>
      </div>
    </div>
  );
}