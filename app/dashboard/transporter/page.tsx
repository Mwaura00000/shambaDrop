"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Inter, Montserrat } from 'next/font/google';
import { toast, Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export default function TransporterDashboard() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'find_jobs' | 'deliveries' | 'messages' | 'settings'>('dashboard');

  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [driverRates, setDriverRates] = useState({ baseRate: 100, dropFee: 2500 });
  
  const [liveLoads, setLiveLoads] = useState<any[]>([]);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [farmerNames, setFarmerNames] = useState<Record<string, string>>({});

  const [selectedLoad, setSelectedLoad] = useState<any | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBaseRate, setEditBaseRate] = useState(100);
  const [editDropFee, setEditDropFee] = useState(2500);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUserId(session.user.id);
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile) {
        setUserName(profile.full_name.split(' ')[0].toUpperCase()); 
        setEditName(profile.full_name);
        setEditPhone(profile.phone || '');
        const br = profile.base_rate_per_km || 100;
        const df = profile.base_drop_fee || 2500;
        setDriverRates({ baseRate: br, dropFee: df });
        setEditBaseRate(br);
        setEditDropFee(df);
      }

      fetchLiveLoads();
      fetchMyJobs(session.user.id);
      setTimeout(() => setWalletBalance(28830), 800);
    };
    
    init();

    const channel = supabase
      .channel('public:loads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loads' }, payload => {
        if (payload.new.status === 'pending_driver') {
            toast.success('New Load Alert!', { description: `${payload.new.weight_tons} Tons of ${payload.new.specific_crop} posted near you.` });
            fetchLiveLoads();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [router]);

  const fetchLiveLoads = async () => {
    const { data } = await supabase.from('loads').select('*').eq('status', 'pending_driver').order('created_at', { ascending: false });
    if (data) {
        setLiveLoads(data);
        fetchFarmerNames(data);
    }
  };

  const fetchMyJobs = async (uid: string) => {
    const { data } = await supabase.from('loads').select('*').eq('driver_id', uid).order('created_at', { ascending: false });
    if (data) {
      setMyJobs(data);
      fetchFarmerNames(data);
      const current = data.find(j => j.status === 'in_transit');
      if (current) setActiveJob(current);
    }
  };

  const fetchFarmerNames = async (loads: any[]) => {
      const fIds = [...new Set(loads.map(l => l.farmer_id))];
      if (fIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', fIds);
          if (profiles) {
              const namesMap: Record<string, string> = { ...farmerNames };
              profiles.forEach(p => namesMap[p.id] = p.full_name);
              setFarmerNames(namesMap);
          }
      }
  };

  const handleOpenBidDrawer = (load: any) => {
    setSelectedLoad(load);
    const calculatedPrice = (load.calculated_distance * driverRates.baseRate) + driverRates.dropFee;
    setBidAmount(calculatedPrice.toString());
  };

  const handleSubmitBid = async () => {
    if (!bidAmount || parseFloat(bidAmount) <= 0) { toast.error("Enter a valid bid."); return; }
    setIsSubmittingBid(true);
    try {
      const { error } = await supabase.from('job_bids').insert([{
        load_id: selectedLoad.id, transporter_id: userId, bid_amount: parseFloat(bidAmount), status: 'pending' 
      }]);
      if (error) throw error;
      
      // --- TRIGGER EMAIL NOTIFICATION ---
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_bid',
          recipient: 'farmer_demo@agrimove.com',
          subject: `New Quote Received: TR-${selectedLoad.id.toString().substring(0,6)}`,
          body: `Hello,\n\nTransporter ${userName} has submitted a new quote of KSh ${parseFloat(bidAmount).toLocaleString()} for your ${selectedLoad.weight_tons} Tons of ${selectedLoad.specific_crop} heading to ${selectedLoad.dropoff_location.split(',')[0]}.\n\nPlease log in to the Agrimove dashboard to review and accept the offer.\n\nBest,\nThe Agrimove Team`
        })
      });

      toast.success("Quote Submitted!", { description: "Waiting for the farmer to review your offer." });
      setSelectedLoad(null); setBidAmount('');
    } catch (error: any) { toast.error("Failed to submit", { description: error.message }); } 
    finally { setIsSubmittingBid(false); }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const { error } = await supabase.from('profiles').update({ 
        full_name: editName, phone: editPhone, base_rate_per_km: editBaseRate, base_drop_fee: editDropFee 
      }).eq('id', userId);
      if (error) throw error;
      
      setUserName(editName.split(' ')[0].toUpperCase());
      setDriverRates({ baseRate: editBaseRate, dropFee: editDropFee });
      toast.success("Profile & Rates Updated!", { description: "Your smart quoting algorithm has been recalibrated." });
    } catch (error: any) { toast.error("Update failed", { description: error.message }); } 
    finally { setIsSavingSettings(false); }
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > walletBalance) { 
      toast.error("Invalid withdrawal amount."); return; 
    }
    toast.loading(`Processing withdrawal to M-Pesa...`);
    setTimeout(() => {
      setWalletBalance(prev => prev - parseFloat(withdrawAmount));
      setIsWithdrawOpen(false); setWithdrawAmount(''); toast.dismiss(); 
      toast.success(`Successfully withdrew KSh ${parseFloat(withdrawAmount).toLocaleString()}!`);
    }, 2500);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className={`flex h-screen bg-[#F8FAFC] font-sans text-gray-800 ${inter.variable} ${montserrat.variable} overflow-hidden`}>
      <Toaster position="bottom-right" richColors />

      {/* --- SIDEBAR --- */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col hidden md:flex z-20 shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-blue-600/20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className={`${montserrat.className} font-black text-xl text-blue-700 tracking-tight`}>Agrimove</span>
        </div>
        
        <div className="px-4 mb-2 mt-4"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Menu</span></div>
        <nav className="flex-1 px-4 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 font-bold rounded-xl transition text-sm ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' : 'text-gray-500 hover:bg-blue-50/50 hover:text-blue-600'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            Dashboard
          </button>
          <button onClick={() => setActiveTab('find_jobs')} className={`w-full flex items-center justify-between px-4 py-3 font-bold rounded-xl transition text-sm ${activeTab === 'find_jobs' ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' : 'text-gray-500 hover:bg-blue-50/50 hover:text-blue-600'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              Find Jobs
            </div>
            {liveLoads.length > 0 && <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px]">{liveLoads.length}</span>}
          </button>
          <button onClick={() => setActiveTab('deliveries')} className={`w-full flex items-center gap-3 px-4 py-3 font-bold rounded-xl transition text-sm ${activeTab === 'deliveries' ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' : 'text-gray-500 hover:bg-blue-50/50 hover:text-blue-600'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            My Deliveries
          </button>
          <button onClick={() => setActiveTab('messages')} className={`w-full flex items-center gap-3 px-4 py-3 font-bold rounded-xl transition text-sm ${activeTab === 'messages' ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' : 'text-gray-500 hover:bg-blue-50/50 hover:text-blue-600'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
            Messages
          </button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 font-bold rounded-xl transition text-sm ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' : 'text-gray-500 hover:bg-blue-50/50 hover:text-blue-600'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Settings & Rates
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 font-bold rounded-xl transition text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            Logout
          </button>
        </div>
      </aside>

      {/* --- DYNAMIC MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col overflow-y-auto relative z-10">
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <h1 className={`${montserrat.className} text-xl font-bold text-gray-900`}>
            {activeTab === 'dashboard' ? 'Overview' : 
             activeTab === 'find_jobs' ? 'Load Marketplace' : 
             activeTab === 'deliveries' ? 'My Deliveries' : 
             activeTab === 'messages' ? 'Messages' : 'Account & Rates'}
          </h1>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Verified
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-gray-900">{userName || 'Transporter'}</p>
                <p className="text-[10px] font-black text-blue-600">Wallet: KSh {walletBalance.toLocaleString()}</p>
              </div>
              <div className="w-9 h-9 bg-blue-100 text-blue-700 font-bold rounded-full flex items-center justify-center text-sm border border-blue-200 shadow-inner cursor-pointer hover:scale-105 transition" onClick={() => setActiveTab('settings')}>
                {userName ? userName.charAt(0) : 'T'}
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in duration-300 space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className={`${montserrat.className} text-3xl font-black text-gray-900 tracking-tight`}>Welcome to the road, {userName}! 👋</h2>
                  <p className="text-gray-500 text-sm mt-1">Here's your real-time performance and active market overview.</p>
                </div>
                <button onClick={() => setIsWithdrawOpen(true)} className="px-6 py-2.5 bg-white border-2 border-blue-600 text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition flex items-center gap-2 text-sm shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Withdraw Funds
                </button>
              </div>

              {/* KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border-l-4 border-l-green-500 border border-y-gray-100 border-r-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">TOTAL EARNINGS</p>
                  <p className={`${montserrat.className} text-2xl font-black text-gray-900`}>KSh {walletBalance.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border-l-4 border-l-purple-500 border border-y-gray-100 border-r-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">BID WIN RATE</p>
                  <p className={`${montserrat.className} text-2xl font-black text-gray-900`}>75%</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border-l-4 border-l-amber-500 border border-y-gray-100 border-r-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ACTIVE DELIVERIES</p>
                  <p className={`${montserrat.className} text-2xl font-black text-gray-900`}>{activeJob ? '1' : '0'}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border-l-4 border-l-blue-500 border border-y-gray-100 border-r-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">COMPLETED TRIPS</p>
                  <p className={`${montserrat.className} text-2xl font-black text-gray-900`}>{myJobs.filter(j => j.status === 'delivered').length}</p>
                </div>
              </div>

              {/* MOCK REVENUE CHART */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hidden md:block">
                <h3 className="font-bold text-gray-900 mb-6 text-sm">Revenue Trajectory</h3>
                <div className="h-40 flex items-end justify-between px-2 gap-2 relative">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                     <div className="border-b border-gray-50 w-full h-0"></div>
                     <div className="border-b border-gray-50 w-full h-0"></div>
                     <div className="border-b border-gray-50 w-full h-0"></div>
                  </div>
                  {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((month, i) => {
                    const heights = ['h-12', 'h-16', 'h-10', 'h-24', 'h-20', 'h-32'];
                    return (
                      <div key={month} className="flex flex-col items-center w-full z-10 group">
                        <div className={`w-full max-w-[40px] bg-green-500/20 group-hover:bg-green-500 transition-colors rounded-t-sm ${heights[i]}`}></div>
                        <span className="text-[10px] font-bold text-gray-400 mt-2 uppercase">{month}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">
                {/* LIVE LOAD BOARD (Cards) */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Live Load Board</h3>
                    <button onClick={() => setActiveTab('find_jobs')} className="text-sm font-bold text-blue-600 hover:text-blue-700">View All →</button>
                  </div>
                  
                  <div className="flex-1 p-6 bg-gray-50/50 space-y-4 overflow-y-auto max-h-[500px]">
                    {liveLoads.length === 0 ? (
                      <div className="text-center py-10 opacity-60">
                        <p className="text-gray-500 font-bold">No new loads posted yet.</p>
                      </div>
                    ) : (
                      liveLoads.slice(0, 4).map((load) => (
                        <div key={load.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-black tracking-widest uppercase">
                                TR-{load.id.toString().substring(0,4)}
                              </span>
                              <h4 className="font-bold text-gray-900 capitalize">{load.specific_crop} • <span className="text-gray-500 font-medium">{load.weight_tons} Tons</span></h4>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">DISTANCE</p>
                              <p className="font-black text-blue-600">{load.calculated_distance} KM</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="w-2 h-2 rounded-full border-2 border-blue-500 flex-shrink-0"></span>
                                <span className="truncate max-w-[180px]">{load.pickup_location.split(' -')[0]}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                                <span className="truncate max-w-[180px]">{load.dropoff_location.split(',')[0]}</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleOpenBidDrawer(load)}
                              className="w-full sm:w-auto px-5 py-2.5 bg-blue-50 hover:bg-blue-600 border border-blue-100 hover:border-blue-600 text-blue-700 hover:text-white font-bold rounded-lg transition text-xs shadow-sm whitespace-nowrap"
                            >
                              View Details & Quote
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* CURRENT ACTIVE JOB */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">Current Active Job</h3>
                  </div>
                  <div className="p-6 flex-1">
                    {activeJob ? (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 relative overflow-hidden h-full flex flex-col">
                        <div className="absolute top-0 right-0 p-3">
                          <span className="bg-blue-600 text-white px-2 py-1 rounded text-[9px] font-black tracking-widest animate-pulse">IN TRANSIT</span>
                        </div>
                        <h4 className="font-black text-gray-900 text-lg capitalize mb-6 mt-4">{activeJob.specific_crop} <span className="text-gray-500 font-medium text-sm">({activeJob.weight_tons}T)</span></h4>
                        
                        <div className="relative border-l-2 border-blue-200 ml-2 space-y-6 flex-1">
                          <div className="relative pl-4">
                            <span className="absolute -left-[9px] top-1 w-4 h-4 bg-blue-100 border-2 border-blue-500 rounded-full"></span>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pickup</p>
                            <p className="text-sm font-bold text-gray-800">{activeJob.pickup_location.split(' -')[0]}</p>
                          </div>
                          <div className="relative pl-4">
                            <span className="absolute -left-[9px] top-1 w-4 h-4 bg-white border-2 border-gray-300 rounded-full"></span>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Drop-off</p>
                            <p className="text-sm font-bold text-gray-800">{activeJob.dropoff_location.split(',')[0]}</p>
                          </div>
                        </div>

                        <button className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-md shadow-blue-600/20 text-sm">
                          Confirm Delivery
                        </button>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                         <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         <p className="text-sm font-bold text-gray-500">No active trips</p>
                         <p className="text-xs text-gray-400 mt-1">Accept a bid from the load board to get started.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FIND JOBS (Full Table) */}
          {activeTab === 'find_jobs' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Load Marketplace</h3>
                  <p className="text-sm text-gray-500 mt-1">Browse all available farmer requests across Kenya.</p>
                </div>
                <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm table-auto">
                  <thead className="bg-gray-50/50 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4 border-b border-gray-100 w-[15%]">Produce</th>
                      <th className="px-6 py-4 border-b border-gray-100 w-[35%]">Route</th>
                      <th className="px-6 py-4 border-b border-gray-100 w-[15%] text-right">Distance</th>
                      <th className="px-6 py-4 border-b border-gray-100 w-[15%] text-right">Target Price</th>
                      <th className="px-6 py-4 border-b border-gray-100 w-[20%] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {liveLoads.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">No available loads right now.</td></tr>
                    ) : (
                      liveLoads.map((load) => (
                        <tr key={load.id} className="hover:bg-blue-50/30 transition">
                          <td className="px-6 py-4 align-middle">
                            <p className="font-bold text-gray-900 capitalize whitespace-nowrap">{load.specific_crop}</p>
                            <p className="text-gray-500 text-xs font-medium mt-0.5 whitespace-nowrap">{load.weight_tons} Tons</p>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <p className="font-semibold text-gray-700 truncate max-w-[200px]">{load.pickup_location.split(' -')[0]}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[200px] mt-0.5">→ {load.dropoff_location.split(',')[0]}</p>
                          </td>
                          <td className="px-6 py-4 align-middle text-right font-black text-gray-700 whitespace-nowrap">
                            {load.calculated_distance} km
                          </td>
                          <td className="px-6 py-4 align-middle text-right">
                            {load.target_price ? (
                              <span className="font-bold text-emerald-600 whitespace-nowrap">KSh {load.target_price.toLocaleString()}</span>
                            ) : (
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Open Bid</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right align-middle">
                            <button onClick={() => handleOpenBidDrawer(load)} className="text-blue-700 font-bold text-[11px] uppercase tracking-wider bg-blue-50 border border-blue-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 px-4 py-2 rounded-lg transition shadow-sm whitespace-nowrap">
                              Quote Job
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MY DELIVERIES */}
          {activeTab === 'deliveries' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-lg">Delivery History</h3>
                <p className="text-sm text-gray-500 mt-1">Track your past jobs and earnings.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm table-auto">
                  <thead className="bg-gray-50/50 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4 border-b border-gray-100">Date</th>
                      <th className="px-6 py-4 border-b border-gray-100">Cargo</th>
                      <th className="px-6 py-4 border-b border-gray-100">Destination</th>
                      <th className="px-6 py-4 border-b border-gray-100">Farmer</th>
                      <th className="px-6 py-4 border-b border-gray-100">Status</th>
                      <th className="px-6 py-4 border-b border-gray-100 text-right">Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myJobs.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">You haven't completed any jobs yet.</td></tr>
                    ) : (
                      myJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 align-middle text-gray-500 whitespace-nowrap">
                            {new Date(job.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 align-middle font-bold text-gray-900 capitalize whitespace-nowrap">
                            {job.specific_crop} <span className="text-gray-400 text-xs font-medium">({job.weight_tons}T)</span>
                          </td>
                          <td className="px-6 py-4 align-middle text-gray-600 truncate max-w-[200px]">
                            {job.dropoff_location.split(',')[0]}
                          </td>
                          <td className="px-6 py-4 align-middle font-medium text-gray-800 whitespace-nowrap">
                            {farmerNames[job.farmer_id] || 'Farmer'}
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider whitespace-nowrap ${job.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-600 text-white'}`}>
                              {job.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right align-middle font-black text-gray-900 whitespace-nowrap">
                            {job.target_price ? `KSh ${job.target_price.toLocaleString()}` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: MESSAGES (Functional Mock) */}
          {activeTab === 'messages' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex overflow-hidden h-[600px] animate-in fade-in duration-300">
              <div className="w-1/3 border-r border-gray-100 bg-gray-50/30 flex flex-col">
                <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">Active Chats</h3></div>
                {activeJob ? (
                  <div className="p-4 border-b border-gray-100 bg-blue-50/50 cursor-pointer flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg">
                          {(farmerNames[activeJob.farmer_id] || 'F').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                          <p className="font-bold text-gray-900 text-sm truncate">{farmerNames[activeJob.farmer_id] || 'Farmer Contact'}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">TR-{activeJob.id.toString().substring(0,4)} • {activeJob.specific_crop}</p>
                      </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 p-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3 text-xl">💬</div>
                    <p className="text-sm font-bold text-gray-600">No active chats</p>
                  </div>
                )}
              </div>
              <div className="flex-1 bg-white flex flex-col">
                {activeJob ? (
                  <>
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h3 className="font-bold text-gray-900">{farmerNames[activeJob.farmer_id] || 'Farmer Contact'}</h3>
                            <p className="text-xs text-green-500 font-bold flex items-center gap-1 mt-0.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Online</p>
                        </div>
                        <button className="text-blue-600 hover:text-blue-700 font-bold text-sm bg-blue-50 px-4 py-2 rounded-lg transition">Call Farmer</button>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/30">
                        <div className="flex flex-col gap-1 items-start">
                            <div className="bg-white border border-gray-100 text-gray-800 px-4 py-3 rounded-2xl rounded-tl-none max-w-[80%] text-sm shadow-sm">
                                Hello! Please confirm once you reach the farm gate to start loading.
                            </div>
                            <span className="text-[10px] text-gray-400 font-bold ml-1 mt-1">10:42 AM</span>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                            <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-none max-w-[80%] text-sm shadow-sm">
                                Good morning! I am 10 minutes away. I'll share the dispatch PIN once we are loaded.
                            </div>
                            <span className="text-[10px] text-gray-400 font-bold mr-1 mt-1">10:45 AM • Read</span>
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 bg-white">
                        <form onSubmit={(e) => { e.preventDefault(); toast.success("Message sent!"); (e.target as HTMLFormElement).reset(); }} className="flex items-center gap-3">
                            <input type="text" required placeholder="Type a message..." className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3.5 text-sm outline-none focus:border-blue-500 transition" />
                            <button type="submit" className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition shadow-md flex-shrink-0">
                                <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                            </button>
                        </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
                    <svg className="w-16 h-16 text-blue-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Your Messages</h2>
                    <p className="text-gray-500 text-sm max-w-md mx-auto">Once you win a bid and a load goes into transit, your live chat with the farmer will appear right here.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SETTINGS (Smart Quoting Control Panel) */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg></div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Algorithm & Profile Settings</h3>
                  <p className="text-sm text-gray-500">Tune your smart quoting engine to win more bids automatically.</p>
                </div>
              </div>
              
              <form onSubmit={handleSaveSettings} className="p-6 space-y-8">
                <div className="grid sm:grid-cols-2 gap-6 pb-6 border-b border-gray-100">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Driver Name / Company</label>
                    <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-gray-900 font-bold transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Contact Number</label>
                    <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="07XX XXX XXX" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-gray-900 font-bold transition" />
                  </div>
                </div>

                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                  <h4 className="font-black text-gray-900 mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Smart Quoting Algorithm
                  </h4>
                  <p className="text-sm text-gray-600 mb-6 font-medium">Set your base rates here. When you click "Quote" on a job, the system will automatically calculate: <strong className="text-blue-700">(Distance × Per KM) + Drop Fee</strong>.</p>
                  
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Rate Per Kilometer (KSh)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">KSh</span>
                        <input type="number" required value={editBaseRate} onChange={e => setEditBaseRate(parseInt(e.target.value))} className="w-full pl-14 pr-4 py-3.5 bg-white border-2 border-blue-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-xl font-black text-blue-900 transition" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Base Drop Fee (KSh)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">KSh</span>
                        <input type="number" required value={editDropFee} onChange={e => setEditDropFee(parseInt(e.target.value))} className="w-full pl-14 pr-4 py-3.5 bg-white border-2 border-blue-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-xl font-black text-blue-900 transition" />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 font-bold pl-1">Flat fee to cover mobilization/fuel.</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={isSavingSettings} className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-lg shadow-blue-600/20 disabled:opacity-50">
                    {isSavingSettings ? 'Saving to Algorithm...' : 'Save Settings & Update Algorithm'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </main>

      {/* --- OVERLAYS --- */}

      {/* DETAILED SMART BIDDING DRAWER */}
      {selectedLoad && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedLoad(null)}></div>
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
              <div>
                <h2 className={`${montserrat.className} text-xl font-black text-gray-900`}>Submit Quote</h2>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">TR-{selectedLoad.id.toString().substring(0,6)}</p>
              </div>
              <button onClick={() => setSelectedLoad(null)} className="w-8 h-8 bg-gray-50 text-gray-500 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 space-y-6">
              
              {/* THE ENHANCED LOAD MANIFEST */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gray-50/80 p-4 border-b border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Load Manifest
                  </span>
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded tracking-widest">
                    {selectedLoad.specific_crop.toUpperCase()}
                  </span>
                </div>
                
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-6">
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg> Weight</p>
                        <p className="font-black text-gray-900">{selectedLoad.weight_tons} Tons</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> Packaging</p>
                        <p className="font-bold text-gray-900">{selectedLoad.packaging}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg> Distance</p>
                        <p className="font-bold text-gray-900">{selectedLoad.calculated_distance} km</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg> Labor</p>
                        <p className="font-bold text-gray-900 text-xs mt-0.5">{selectedLoad.needs_loaders ? 'Driver must provide' : 'Farmer will provide'}</p>
                    </div>
                  </div>

                  <div className="relative border-l-2 border-dashed border-gray-200 ml-2 space-y-5 py-2">
                    <div className="relative pl-6">
                      <span className="absolute -left-[9px] top-0.5 w-4 h-4 bg-white border-2 border-gray-300 rounded-full"></span>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pickup</p>
                      <p className="text-sm font-bold text-gray-800 mt-0.5">{selectedLoad.pickup_location}</p>
                    </div>
                    <div className="relative pl-6">
                      <span className="absolute -left-[9px] top-0.5 w-4 h-4 bg-blue-100 border-2 border-blue-500 rounded-full"></span>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Drop-off</p>
                      <p className="text-sm font-bold text-gray-800 mt-0.5">{selectedLoad.dropoff_location}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SMART INPUT AREA */}
              <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10"></div>
                <h4 className="font-black text-gray-900 mb-1">Your Transport Offer</h4>
                
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                    Algorithm Auto-Quote
                    <button type="button" onClick={() => {setActiveTab('settings'); setSelectedLoad(null)}} className="text-blue-500 hover:text-blue-700 underline text-[10px]">Edit Rates</button>
                  </p>
                  <p className="text-xs text-gray-600 font-medium">
                    (KSh {driverRates.baseRate}/km × {selectedLoad.calculated_distance}km) + KSh {driverRates.dropFee.toLocaleString()} Fee.
                  </p>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="font-black text-gray-400">KSh</span>
                  </div>
                  <input 
                    type="number" 
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="w-full pl-14 pr-4 py-4 bg-white border-2 border-blue-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-2xl font-black text-blue-900 shadow-inner" 
                  />
                </div>
                
                {selectedLoad.target_price && (
                  <p className="text-xs font-bold text-emerald-600 mt-3 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Farmer's budget: KSh {selectedLoad.target_price.toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-white z-10 flex gap-3">
              <button onClick={() => setSelectedLoad(null)} className="px-6 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl transition hover:bg-gray-200">Cancel</button>
              <button 
                onClick={handleSubmitBid} 
                disabled={isSubmittingBid || !bidAmount}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isSubmittingBid ? "Submitting..." : "Submit Quote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAW DRAWER */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsWithdrawOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-full">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className={`${montserrat.className} text-xl font-bold`}>Withdraw Funds</h2>
              <button onClick={() => setIsWithdrawOpen(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="p-6 flex-1">
              <div className="bg-blue-50 p-4 rounded-xl mb-6 flex justify-between items-center border border-blue-100">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-widest">Available Balance</span>
                <span className="font-black text-blue-900">KSh {walletBalance.toLocaleString()}</span>
              </div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Amount to Withdraw (KSH)</label>
              <input type="number" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)} className="w-full text-3xl font-black p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-blue-800 transition mb-6" placeholder="0.00" />
            </div>
            <div className="p-6 border-t border-gray-100">
              <button onClick={handleWithdraw} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition disabled:opacity-50">Transfer to M-Pesa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}