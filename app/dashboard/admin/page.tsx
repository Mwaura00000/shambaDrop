"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Inter, Montserrat } from 'next/font/google';
import { toast, Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export default function AdminDashboard() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'all_loads' | 'users' | 'config'>('overview');
  const [adminName, setAdminName] = useState('Admin');

  // Global Platform States
  const [allLoads, setAllLoads] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, any>>({});
  
  // KPI States
  const [totalEscrow, setTotalEscrow] = useState(0);
  const [totalTonnage, setTotalTonnage] = useState(0);
  const [activeDeliveries, setActiveDeliveries] = useState(0);
  const [completedDeliveries, setCompletedDeliveries] = useState(0);

  // --- NEW: INTERACTIVE FILTER STATES ---
  const [loadSearch, setLoadSearch] = useState('');
  const [loadStatusFilter, setLoadStatusFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile) setAdminName(profile.full_name);

      await fetchPlatformData();
      setIsLoading(false);
    };

    initAdmin();

    const globalLoadChannel = supabase
      .channel('admin:global_loads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loads' }, () => {
        fetchPlatformData();
      })
      .subscribe();

    return () => { supabase.removeChannel(globalLoadChannel); };
  }, [router]);

  const fetchPlatformData = async () => {
    // 1. Fetch ALL Users
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) {
      setAllUsers(profiles);
      const map: Record<string, any> = {};
      profiles.forEach(p => map[p.id] = p);
      setUserMap(map);
    }

    // 2. Fetch ALL Loads
    const { data: loads } = await supabase.from('loads').select('*').order('created_at', { ascending: false });
    if (loads) {
      setAllLoads(loads);
      
      // Calculate KPIs
      let escrow = 0;
      let tonnage = 0;
      let active = 0;
      let completed = 0;

      loads.forEach(load => {
        if (load.status === 'in_transit') {
          escrow += (load.target_price || 0);
          active++;
        }
        if (load.status === 'delivered') completed++;
        tonnage += (load.weight_tons || 0);
      });

      setTotalEscrow(escrow);
      setTotalTonnage(tonnage);
      setActiveDeliveries(active);
      setCompletedDeliveries(completed);
    }
  };

  // --- NEW: ADMIN OVERRIDE FUNCTION ---
  const handleAdminCancelLoad = async (loadId: string) => {
    if (!window.confirm("WARNING: Are you sure you want to force-cancel this load? This action cannot be undone.")) return;
    
    toast.loading("Overriding and Canceling Load...");
    try {
      const { error } = await supabase.from('loads').update({ status: 'cancelled' }).eq('id', loadId);
      if (error) throw error;
      
      toast.dismiss();
      toast.success("Load Cancelled Successfully.");
      fetchPlatformData(); // Refresh UI
    } catch (error: any) {
      toast.dismiss();
      toast.error("Failed to cancel load", { description: error.message });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // --- NEW: FILTERING LOGIC ---
  const filteredLoads = allLoads.filter(load => {
    const matchesSearch = 
      load.specific_crop?.toLowerCase().includes(loadSearch.toLowerCase()) ||
      load.pickup_location?.toLowerCase().includes(loadSearch.toLowerCase()) ||
      load.dropoff_location?.toLowerCase().includes(loadSearch.toLowerCase()) ||
      load.id.toString().includes(loadSearch);
    
    const matchesStatus = loadStatusFilter === 'all' || load.status === loadStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = allUsers.filter(user => {
    return user.full_name?.toLowerCase().includes(userSearch.toLowerCase()) || 
           user.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
           user.role?.toLowerCase().includes(userSearch.toLowerCase());
  });

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-[#0F172A]"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className={`flex h-screen bg-[#F8FAFC] font-sans text-gray-800 ${inter.variable} ${montserrat.variable} overflow-hidden`}>
      <Toaster position="bottom-right" richColors />

      {/* --- ADMIN SIDEBAR (DARK THEME) --- */}
      <aside className="w-64 bg-[#0F172A] flex flex-col hidden md:flex z-20 shadow-xl">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <span className={`${montserrat.className} font-black text-xl text-white tracking-tight`}>Control Tower</span>
        </div>
        
        <div className="px-4 mb-2 mt-6"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-2">Platform Management</span></div>
        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 font-bold rounded-xl transition text-sm ${activeTab === 'overview' ? 'bg-indigo-500/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            System Overview
          </button>
          <button onClick={() => setActiveTab('all_loads')} className={`w-full flex items-center justify-between px-4 py-3 font-bold rounded-xl transition text-sm ${activeTab === 'all_loads' ? 'bg-indigo-500/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
              Global Load Map
            </div>
            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px]">{allLoads.length}</span>
          </button>
          <button onClick={() => setActiveTab('users')} className={`w-full flex items-center justify-between px-4 py-3 font-bold rounded-xl transition text-sm ${activeTab === 'users' ? 'bg-indigo-500/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              User Directory
            </div>
            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px]">{allUsers.length}</span>
          </button>
          <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-3 px-4 py-3 font-bold rounded-xl transition text-sm ${activeTab === 'config' ? 'bg-indigo-500/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            System Data
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 font-bold rounded-xl transition text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            System Logout
          </button>
        </div>
      </aside>

      {/* --- DYNAMIC MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <h1 className={`${montserrat.className} text-xl font-bold text-slate-800`}>
            {activeTab === 'overview' ? 'System Overview' : 
             activeTab === 'all_loads' ? 'Global Logistics Map' : 
             activeTab === 'config' ? 'System Configurations' : 'User Directory'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span> Platform Active
            </div>
            <div className="w-9 h-9 bg-slate-900 text-white font-bold rounded-full flex items-center justify-center text-sm shadow-md border border-slate-700">
              {adminName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
          
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="animate-in fade-in duration-300 space-y-8">
              <div>
                <h2 className={`${montserrat.className} text-3xl font-black text-slate-900 tracking-tight`}>AgriMove Network Status</h2>
                <p className="text-slate-500 text-sm mt-1">Live metrics across all 47 counties.</p>
              </div>

              {/* KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 rounded-bl-full -z-10"></div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    Money in Escrow
                  </p>
                  <p className={`${montserrat.className} text-3xl font-black text-slate-900`}>KSh {totalEscrow.toLocaleString()}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-10"></div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>
                    Total Volume Moved
                  </p>
                  <p className={`${montserrat.className} text-3xl font-black text-slate-900`}>{totalTonnage.toLocaleString()} Tons</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-10"></div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    Active Trips
                  </p>
                  <p className={`${montserrat.className} text-3xl font-black text-slate-900`}>{activeDeliveries}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50 rounded-bl-full -z-10"></div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Completed Deliveries
                  </p>
                  <p className={`${montserrat.className} text-3xl font-black text-slate-900`}>{completedDeliveries}</p>
                </div>
              </div>

              {/* LIVE ACTIVITY FEED */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-900">Platform Pulse (Latest 5 Events)</h3>
                  <button onClick={() => setActiveTab('all_loads')} className="text-sm font-bold text-indigo-600 hover:text-indigo-700">View All Data →</button>
                </div>
                <div className="p-6 space-y-6">
                  {allLoads.slice(0, 5).map(load => {
                     const farmer = userMap[load.farmer_id];
                     const driver = load.driver_id ? userMap[load.driver_id] : null;

                     return (
                        <div key={load.id} className="flex items-start gap-4">
                            <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${load.status === 'pending_driver' ? 'bg-amber-50 border-amber-200 text-amber-600' : load.status === 'in_transit' ? 'bg-blue-50 border-blue-200 text-blue-600' : load.status === 'cancelled' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                                {load.status === 'pending_driver' ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg> :
                                 load.status === 'in_transit' ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> :
                                 load.status === 'cancelled' ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg> :
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>}
                            </div>
                            <div className="flex-1 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                                <p className="text-sm text-slate-800 leading-relaxed">
                                    <span className="font-bold">{farmer?.full_name || 'A Farmer'}</span> 
                                    {load.status === 'pending_driver' ? ' posted a new request for ' : load.status === 'in_transit' ? ' secured driver ' : load.status === 'cancelled' ? ' had a load cancelled: ' : ' completed a delivery with '}
                                    {load.status !== 'pending_driver' && load.status !== 'cancelled' && <span className="font-bold">{driver?.full_name || 'a Transporter'}</span>}
                                    {load.status !== 'pending_driver' && load.status !== 'cancelled' ? ' for ' : ''}
                                    <span className="font-bold text-indigo-700">{load.weight_tons}T of {load.specific_crop}</span> 
                                    {' heading to '} <span className="font-bold">{load.dropoff_location.split(',')[0]}</span>.
                                </p>
                                <div className="mt-2 flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    <span>TR-{load.id.toString().substring(0,6)}</span>
                                    <span>•</span>
                                    <span>{new Date(load.created_at).toLocaleString()}</span>
                                    {load.target_price && (
                                        <>
                                            <span>•</span>
                                            <span className="text-emerald-600">Value: KSh {load.target_price.toLocaleString()}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                     );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALL LOADS (NOW WITH FILTERING & OVERRIDES) */}
          {activeTab === 'all_loads' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300 flex flex-col h-[700px]">
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Global Logistics Data</h3>
                  <p className="text-sm text-slate-500 mt-1">Master table of every transport request. Admin overrides available.</p>
                </div>
                
                {/* SEARCH & FILTER CONTROLS */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </div>
                        <input 
                            type="text" 
                            value={loadSearch}
                            onChange={(e) => setLoadSearch(e.target.value)}
                            placeholder="Search locations, crop, ID..." 
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <select 
                        value={loadStatusFilter}
                        onChange={(e) => setLoadStatusFilter(e.target.value)}
                        className="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 bg-white"
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending_driver">Pending</option>
                        <option value="in_transit">In Transit</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left text-sm table-auto relative">
                  <thead className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-200">ID & Date</th>
                      <th className="px-6 py-4 border-b border-slate-200">Farmer / Cargo</th>
                      <th className="px-6 py-4 border-b border-slate-200">Route</th>
                      <th className="px-6 py-4 border-b border-slate-200">Assigned Driver</th>
                      <th className="px-6 py-4 border-b border-slate-200">Status</th>
                      <th className="px-6 py-4 border-b border-slate-200 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLoads.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">No loads match your search criteria.</td></tr>
                    ) : (
                      filteredLoads.map((load) => {
                        const farmer = userMap[load.farmer_id];
                        const driver = load.driver_id ? userMap[load.driver_id] : null;
                        
                        return (
                        <tr key={load.id} className="hover:bg-indigo-50/30 transition">
                          <td className="px-6 py-4 align-middle">
                            <p className="font-mono font-bold text-indigo-600 text-xs">TR-{load.id.toString().substring(0,4)}</p>
                            <p className="text-slate-400 text-[10px] font-medium mt-1 whitespace-nowrap">{new Date(load.created_at).toLocaleDateString()}</p>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <p className="font-bold text-slate-900 whitespace-nowrap">{farmer?.full_name || 'Unknown'}</p>
                            <p className="text-slate-500 text-xs font-medium mt-0.5 capitalize">{load.weight_tons}T of {load.specific_crop}</p>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <p className="font-semibold text-slate-700 truncate max-w-[150px]">{load.pickup_location.split(' -')[0]}</p>
                            <p className="text-xs text-slate-400 truncate max-w-[150px] mt-0.5">→ {load.dropoff_location.split(',')[0]}</p>
                          </td>
                          <td className="px-6 py-4 align-middle font-medium text-slate-800 whitespace-nowrap">
                            {driver ? driver.full_name : <span className="text-slate-300 italic">Unassigned</span>}
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold tracking-wider whitespace-nowrap ${load.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : load.status === 'in_transit' ? 'bg-blue-100 text-blue-800' : load.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                              {load.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right align-middle">
                            {/* OVERRIDE BUTTON: Only show if not delivered or already cancelled */}
                            {(load.status === 'pending_driver' || load.status === 'in_transit') ? (
                                <button 
                                    onClick={() => handleAdminCancelLoad(load.id)}
                                    className="text-red-600 hover:text-white bg-red-50 hover:bg-red-600 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-md transition border border-red-200"
                                >
                                    Force Cancel
                                </button>
                            ) : (
                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Locked</span>
                            )}
                          </td>
                        </tr>
                      )})
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: USERS (NOW WITH SEARCH) */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300 flex flex-col h-[700px]">
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">System Users</h3>
                  <p className="text-sm text-slate-500 mt-1">Directory of all registered Farmers and Transporters.</p>
                </div>
                <div className="relative w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <input 
                        type="text" 
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search users by name, email..." 
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left text-sm table-auto">
                  <thead className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-widest sticky top-0 shadow-sm">
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-200">Name / Company</th>
                      <th className="px-6 py-4 border-b border-slate-200">Role</th>
                      <th className="px-6 py-4 border-b border-slate-200">Contact Details</th>
                      <th className="px-6 py-4 border-b border-slate-200">Transporter Rates</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">No users found.</td></tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-4 align-middle">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${user.role === 'farmer' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {user.full_name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900">{user.full_name}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
                                </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-black tracking-widest uppercase ${user.role === 'farmer' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                                {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <p className="font-medium text-slate-700">{user.phone || <span className="text-slate-300 italic">No phone linked</span>}</p>
                          </td>
                          <td className="px-6 py-4 align-middle text-slate-500 text-xs">
                            {user.role === 'transporter' ? (
                                <span className="font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                    KSh {user.base_rate_per_km || 100}/km + KSh {user.base_drop_fee || 2500}
                                </span>
                            ) : (
                                <span className="italic opacity-50">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SYSTEM CONFIG (THE FUTURE DATABASE CONNECTION) */}
          {activeTab === 'config' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>
                    System Data Management
                </h3>
                <p className="text-sm text-slate-500 mt-1">Manage global dropdown lists. (Note: To make these fully dynamic, create a 'system_data' table in Supabase and fetch them directly in the UI instead of hardcoding).</p>
              </div>

              <div className="p-8 space-y-10">
                
                {/* MOCK CROP CATEGORIES UI */}
                <div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                        <h4 className="font-black text-slate-800">Approved Crop Types</h4>
                        <button className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition">+ Add New Crop</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['Maize', 'Wheat', 'Irish Potatoes', 'Tomatoes', 'Avocados', 'Raw Milk', 'Live Chickens'].map(crop => (
                            <span key={crop} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-2 border border-slate-200 group cursor-default">
                                {crop}
                                <button className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </span>
                        ))}
                    </div>
                </div>

                {/* MOCK LOCATION UI */}
                <div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                        <h4 className="font-black text-slate-800">Supported Counties</h4>
                        <button className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition">+ Add County</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['Nairobi', 'Nakuru', 'Uasin Gishu', 'Kiambu', 'Mombasa', 'Meru', 'Kisumu', 'Bungoma'].map(county => (
                            <span key={county} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-2 border border-slate-200 group cursor-default">
                                {county}
                                <button className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </span>
                        ))}
                        <span className="px-3 py-1.5 text-slate-400 text-xs font-medium italic">... and 39 more.</span>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <div>
                        <h5 className="font-bold text-amber-800 text-sm">Developer Note</h5>
                        <p className="text-xs text-amber-700 mt-1">To make these buttons actually update the platform, you will need to create a `system_config` table in Supabase. You would then fetch the lists on component mount in the Farmer dashboard instead of relying on the hardcoded constants.</p>
                    </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}