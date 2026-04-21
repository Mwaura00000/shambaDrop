"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Inter, Montserrat } from 'next/font/google';
import { toast, Toaster } from 'sonner';

// Load the custom fonts you specified
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export default function Register() {
  const router = useRouter();
  
  // States
  const [role, setRole] = useState<'farmer' | 'transporter'>('farmer');
  const [displayRole, setDisplayRole] = useState<'farmer' | 'transporter'>('farmer');
  const [animating, setAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '', phone: '', email: '', password: '', confirmPassword: ''
  });

  // Specific field errors
  const [errors, setErrors] = useState({
    fullName: '', phone: '', email: '', password: '', confirmPassword: '', general: ''
  });

  // Handle right-panel crossfade
  useEffect(() => {
    if (role !== displayRole) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setDisplayRole(role);
        setAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [role, displayRole]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear specific error when user starts typing
    if (errors[e.target.name as keyof typeof errors]) {
      setErrors({ ...errors, [e.target.name]: '', general: '' });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    let newErrors = { fullName: '', phone: '', email: '', password: '', confirmPassword: '', general: '' };
    let isValid = true;

    // --- CLIENT SIDE VALIDATION ---
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(07|01|\+2547|\+2541)[0-9]{8}$/;

    if (formData.fullName.trim().length < 3) {
      newErrors.fullName = 'Name must be at least 3 characters.';
      isValid = false;
    }
    if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
      isValid = false;
    }
    if (!phoneRegex.test(formData.phone.trim())) {
      newErrors.phone = 'Enter a valid Kenyan phone number (e.g. 0712345678).';
      isValid = false;
    }
    if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
      isValid = false;
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords must match.';
      isValid = false;
    }

    if (!isValid) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    // --- SUPABASE REGISTRATION ---
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
            throw new Error("This email is already registered. Please log in.");
        }
        throw authError;
      }

      if (authData.user) {
        // Include the email field in the profile insert!
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: authData.user.id,
            full_name: formData.fullName.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim(), // <--- THE FIX
            role: role
          }
        ]);

        if (profileError) throw profileError;

        toast.success(`Success! Welcome to AgriMove.`);
        
        // Push them to the correct dashboard immediately
        if (role === 'farmer') {
            router.push('/dashboard/farmer');
        } else {
            router.push('/dashboard/transporter');
        }
      }
    } catch (error: any) {
      setErrors({ ...newErrors, general: error.message || 'Registration failed.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`h-screen w-full flex bg-white text-gray-800 ${inter.variable} ${montserrat.variable} font-sans overflow-hidden`}>
      <Toaster position="top-center" richColors />
      
      {/* LEFT SIDE: FORM */}
      <div className="w-full lg:w-1/2 flex flex-col px-8 sm:px-16 md:px-24 py-8 overflow-y-auto">
        <div className="max-w-md w-full mx-auto my-auto py-4">
          
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-green-600 transition mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Home
          </Link>

          <div className="flex items-center gap-3 mb-6 w-fit">
            <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center text-white shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            </div>
            <span className="font-montserrat font-bold text-2xl text-gray-900 tracking-tight">AgriMove</span>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-montserrat font-bold text-gray-900 mb-2">Create an account</h1>
            <p className="text-gray-500 text-sm">Join AgriMove to connect with the agricultural network.</p>
          </div>

          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3 text-sm font-medium">
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              {errors.general}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* ROLE TOGGLE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">I am signing up as a:</label>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button" 
                  onClick={() => setRole('farmer')}
                  className={`relative flex flex-col items-start border-2 rounded-xl p-4 transition-all duration-200 ${role === 'farmer' ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <svg className={`w-6 h-6 ${role === 'farmer' ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${role === 'farmer' ? 'bg-green-600 opacity-100 scale-100' : 'bg-transparent opacity-0 scale-50'}`}>
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">Farmer</h3>
                  <p className="text-[10px] text-gray-500 mt-1">I want to move produce</p>
                </button>

                <button 
                  type="button" 
                  onClick={() => setRole('transporter')}
                  className={`relative flex flex-col items-start border-2 rounded-xl p-4 transition-all duration-200 ${role === 'transporter' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <svg className={`w-6 h-6 ${role === 'transporter' ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${role === 'transporter' ? 'bg-blue-600 opacity-100 scale-100' : 'bg-transparent opacity-0 scale-50'}`}>
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">Transporter</h3>
                  <p className="text-[10px] text-gray-500 mt-1">I own a transport vehicle</p>
                </button>
              </div>
            </div>

            {/* FULL NAME */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <input type="text" name="fullName" required value={formData.fullName} onChange={handleInputChange} className={`w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl outline-none transition text-sm ${errors.fullName ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-green-500 focus:ring-1 focus:ring-green-500'}`} placeholder="John Kamau" />
              </div>
              {errors.fullName && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.fullName}</p>}
            </div>

            {/* EMAIL & PHONE GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <input type="email" name="email" required value={formData.email} onChange={handleInputChange} className={`w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl outline-none transition text-sm ${errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-green-500 focus:ring-1 focus:ring-green-500'}`} placeholder="john@email.com" />
                </div>
                {errors.email && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone (Kenya)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </div>
                  <input type="tel" name="phone" required value={formData.phone} onChange={handleInputChange} className={`w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl outline-none transition text-sm ${errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-green-500 focus:ring-1 focus:ring-green-500'}`} placeholder="07XX..." />
                </div>
                {errors.phone && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.phone}</p>}
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <input type={showPassword ? "text" : "password"} name="password" required value={formData.password} onChange={handleInputChange} className={`w-full pl-10 pr-10 py-2.5 bg-gray-50 border rounded-xl outline-none transition text-sm ${errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-green-500 focus:ring-1 focus:ring-green-500'}`} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none">
                  {showPassword ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.password}</p>}
            </div>

            {/* CONFIRM PASSWORD */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" required value={formData.confirmPassword} onChange={handleInputChange} className={`w-full pl-10 pr-10 py-2.5 bg-gray-50 border rounded-xl outline-none transition text-sm ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-green-500 focus:ring-1 focus:ring-green-500'}`} placeholder="••••••••" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none">
                  {showConfirmPassword ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.confirmPassword}</p>}
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-green-500/30 mt-4 disabled:opacity-70 disabled:cursor-not-allowed">
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-xs mt-6">
            Already have an account? <Link href="/login" className="font-semibold text-green-600 hover:text-green-700">Log in here</Link>
          </p>
        </div>
      </div>

      {/* RIGHT SIDE: DYNAMIC PANEL (From Figma) */}
      <div className="hidden lg:block w-1/2 relative bg-gray-900">
        
        {/* Animated Container */}
        <div className={`absolute inset-0 transition-opacity duration-300 ease-in-out ${animating ? 'opacity-0' : 'opacity-100'}`}>
          <img 
            src={displayRole === 'farmer' 
              ? 'https://images.pexels.com/photos/2199293/pexels-photo-2199293.jpeg?auto=compress&cs=tinysrgb&w=1200' 
              : 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80'} 
            alt="Showcase" 
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent"></div>
          
          <div className="absolute bottom-12 left-12 right-12 text-white">
            <div className="flex gap-2 mb-6">
              <div className={`w-2 h-2 rounded-full ${displayRole === 'farmer' ? 'bg-green-500' : 'bg-white opacity-50'}`}></div>
              <div className={`w-8 h-2 rounded-full ${displayRole === 'farmer' ? 'bg-white opacity-50' : 'bg-blue-500'}`}></div>
              <div className="w-2 h-2 rounded-full bg-white opacity-50"></div>
            </div>
            <h2 className="text-3xl font-montserrat font-bold mb-4">
              {displayRole === 'farmer' ? 'Guaranteed Secure Payments.' : 'Join the Network.'}
            </h2>
            <p className="text-lg text-gray-200 leading-relaxed max-w-lg">
              {displayRole === 'farmer' 
                ? 'Your transport fees are held safely in our M-Pesa Escrow until your cargo arrives in perfect condition.' 
                : "Create a free account in seconds. Whether you're moving a sack of potatoes or a lorry of maize, AgriMove is built for you."}
            </p>
          </div>
        </div>
        
      </div>
    </div>
  );
}