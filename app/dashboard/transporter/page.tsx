"use client";

import React, { useEffect, useState, useRef } from 'react';
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
  const [userEmail, setUserEmail] = useState('');
  const [walletBalance, setWalletBalance] = useState(28830);
  const [driverRates, setDriverRates] = useState({ baseRate: 100, dropFee: 2500 });
  
  const [liveLoads, setLiveLoads] = useState<any[]>([]);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [farmerNames, setFarmerNames] = useState<Record<string, string>>({});
  const [farmerPhones, setFarmerPhones] = useState<Record<string, string>>({});

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBaseRate, setEditBaseRate] = useState(100);
  const [editDropFee, setEditDropFee] = useState(2500);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // --- PIN VERIFICATION STATES ---
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [deliveryPin, setDeliveryPin] = useState('');

  // --- MESSAGING STATES ---
  const [activeChatLoad, setActiveChatLoad] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUserId(session.user.id);
      setUserEmail(session.user.email || '');
      
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
    };
    
    init();

    // Listen for new loads joining the Broadcast Board
    const loadChannel = supabase
      .channel('public:loads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loads' }, payload => {
        if (payload.new.status === 'pending_driver') {
            toast.success('New Load Alert!', { description: `${payload.new.weight_tons} Tons of ${payload.new.specific_crop} posted to the market.` });
            fetchLiveLoads();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'loads' }, payload => {
        fetchLiveLoads(); // Refresh board if someone else takes a job
        if(payload.new.driver_id === userId) {
          if (payload.new.status === 'in_transit' && payload.old.status === 'pending_driver') {
            toast.success("Job Assigned!", { description: "You are now active on this delivery." });
          }
          fetchMyJobs(userId);
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(loadChannel); 
    };
  }, [router, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      if (current) {
        setActiveJob(current);
        if(!activeChatLoad) setActiveChatLoad(current);
      } else {
        setActiveJob(null);
      }
    }
  };

  const fetchFarmerNames = async (loads: any[]) => {
      const fIds = [...new Set(loads.map(l => l.farmer_id))];
      if (fIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone').in('id', fIds);
          if (profiles) {
              const namesMap: Record<string, string> = { ...farmerNames };
              const phonesMap: Record<string, string> = { ...farmerPhones };
              profiles.forEach(p => {
                namesMap[p.id] = p.full_name;
                phonesMap[p.id] = p.phone || '';
              });
              setFarmerNames(namesMap);
              setFarmerPhones(phonesMap);
          }
      }
  };

  // FIXED: STRICT FILTERED MESSAGE LISTENER FOR TRANSPORTER
  useEffect(() => {
    if (activeChatLoad) {
      const fetchMessages = async () => {
        const { data } = await supabase.from('messages').select('*').eq('load_id', activeChatLoad.id).order('created_at', { ascending: true });
        if (data) setMessages(data);
      };
      fetchMessages();

      const messageChannel = supabase
        .channel(`chat-transporter-${activeChatLoad.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `load_id=eq.${activeChatLoad.id}` // THIS STOPS THE CROSS-TALK!
        }, payload => {
          setMessages(prev => [...prev, payload.new]);
        })
        .subscribe();

      return () => { supabase.removeChannel(messageChannel); };
    }
  }, [activeChatLoad]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatLoad) return;
    
    const tempMessage = newMessage;
    setNewMessage(''); 

    const { error } = await supabase.from('messages').insert([{ 
      load_id: activeChatLoad.id, sender_id: userId, text: tempMessage 
    }]);

    if (error) {
      toast.error("Failed to send message");
      setNewMessage(tempMessage); 
    }
  };

  // --- THE HYBRID BROADCAST ACCEPTANCE ---
  const handleAcceptJob = async (load: any) => {
    toast.loading("Locking in job & processing payout algorithm...");
    
    // Auto-calculate your payout based on your rates
    let finalPrice = (load.calculated_distance * driverRates.baseRate) + driverRates.dropFee;
    if (load.weight_tons > 5) finalPrice += (finalPrice * 0.1);
    finalPrice = Math.round(finalPrice);

    // Generate the Delivery PIN
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

    try {
      // Try to claim the job in the database
      const { error, count } = await supabase.from('loads').update({ 
        status: 'in_transit', 
        driver_id: userId, 
        target_price: finalPrice,
        delivery_pin: generatedPin
      }).eq('id', load.id).eq('status', 'pending_driver'); // Ensure it hasn't been taken

      if (error) throw error;

      // Email the Farmer the PIN
      const { data: farmer } = await supabase.from('profiles').select('email').eq('id', load.farmer_id).single();
      if (farmer?.email) {
          await fetch('/api/notify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: farmer.email,
              subject: `Driver Assigned! TR-${load.id.toString().substring(0,6)}`,
              body: `Hello,\n\nTransporter ${userName} has accepted your broadcasted transport request!\n\nGuaranteed Price: KSh ${finalPrice.toLocaleString()}\n\n*** YOUR SECURE DELIVERY PIN IS: ${generatedPin} ***\n\nPlease give this PIN to the driver ONLY when they deliver your produce.\n\nBest,\nThe Agrimove Team`
            })
          });
      }

      toast.dismiss();
      toast.success("Job Claimed Successfully!", { description: `You locked in a payout of KSh ${finalPrice.toLocaleString()}` });
      fetchMyJobs(userId);
      fetchLiveLoads();
      setActiveTab('dashboard'); // Jump to dashboard to see active job
    } catch (err: any) {
      toast.dismiss();
      toast.error("Failed to claim job", { description: "Another driver may have already taken it." });
    }
  };

  const handleVerifyPin = async () => {
    if (!deliveryPin || deliveryPin.length !== 4) {
      toast.error("Invalid Input", { description: "Please enter the 4-digit PIN." });
      return;
    }
    if (deliveryPin !== activeJob.delivery_pin) {
      toast.error("Verification Failed", { description: "The PIN provided is incorrect. Please ask the receiver again." });
      return;
    }

    toast.loading("Verifying PIN & Processing Payout...");
    try {
      const { error } = await supabase.from('loads').update({ status: 'delivered' }).eq('id', activeJob.id);
      if (error) throw error;
      
      toast.dismiss();
      toast.success("Delivery Complete!", { description: `KSh ${activeJob.target_price.toLocaleString()} has been released to your wallet.` });
      setWalletBalance(prev => prev + activeJob.target_price);
      setIsPinModalOpen(false);
      setDeliveryPin('');
      fetchMyJobs(userId);
      setActiveChatLoad(null); 
    } catch (error: any) {
      toast.dismiss(); toast.error("System Error", { description: error.message });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: editName, phone: editPhone, base_rate_per_km: editBaseRate, base_drop_fee: editDropFee }).eq('id', userId);
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

  const inTransitJobs = myJobs.filter(j => j.status === 'in_transit');

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
          <button onClick={() => setActiveTab('messages')} className={`w-full flex items-center justify-between px-4 py-3 font-bold rounded-xl transition text-sm ${activeTab === 'messages' ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' : 'text-gray-500 hover:bg-blue-50/50 hover:text-blue-600'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
              Messages
            </div>
            {inTransitJobs.length > 0 && <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px]">{inTransitJobs.length}</span>}
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
             activeTab === 'find_jobs' ? 'Live Load Board' : 
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
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">MARKET LOADS</p>
                  <p className={`${montserrat.className} text-2xl font-black text-gray-900`}>{liveLoads.length}</p>
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">
                
                {/* CURRENT ACTIVE JOB W/ CONTACTS & PIN BUTTON */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-auto">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">Current Active Job</h3>
                  </div>
                  <div className="p-6 flex-1">
                    {activeJob ? (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between">
                        <div>
                            <div className="absolute top-0 right-0 p-4">
                            <span className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase shadow-sm">
                                Guaranteed: KSh {activeJob.target_price.toLocaleString()}
                            </span>
                            </div>
                            <h4 className="font-black text-gray-900 text-xl capitalize mb-6 mt-2">{activeJob.specific_crop} <span className="text-gray-500 font-medium text-sm">({activeJob.weight_tons}T)</span></h4>
                            
                            {/* BIG CONTACT BLOCK FOR DRIVER */}
                            <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-white border border-blue-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Farmer Phone</p>
                                        <p className="text-lg font-black text-blue-900">{farmerPhones[activeJob.farmer_id] || 'Not Provided'}</p>
                                    </div>
                                    <a href={`tel:${farmerPhones[activeJob.farmer_id]}`} className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 shadow-md transition">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                    </a>
                                </div>
                                <div className="bg-white border border-green-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Receiver Phone</p>
                                        <p className="text-lg font-black text-green-700">{activeJob.receiver_phone || 'Not Provided'}</p>
                                    </div>
                                    <a href={`tel:${activeJob.receiver_phone}`} className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center hover:bg-green-700 shadow-md transition">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                    </a>
                                </div>
                            </div>

                            <div className="relative border-l-2 border-blue-200 ml-3 space-y-6">
                            <div className="relative pl-6">
                                <span className="absolute -left-[11px] top-1 w-5 h-5 bg-blue-100 border-2 border-blue-500 rounded-full"></span>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pickup Schedule, Location & Directions</p>
                                <p className="text-sm font-bold text-gray-800 mt-1 bg-white p-3 rounded-lg border border-gray-100 leading-relaxed">{activeJob.pickup_location}</p>
                            </div>
                            <div className="relative pl-6">
                                <span className="absolute -left-[11px] top-1 w-5 h-5 bg-white border-2 border-gray-300 rounded-full"></span>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Drop-off Destination & Directions</p>
                                <p className="text-sm font-bold text-gray-800 mt-1 bg-white p-3 rounded-lg border border-gray-100 leading-relaxed">{activeJob.dropoff_location}</p>
                            </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button onClick={() => setActiveTab('messages')} className="flex-1 py-4 bg-white border border-blue-200 hover:border-blue-600 text-blue-600 font-bold rounded-xl transition shadow-sm text-sm">
                                Message Farmer
                            </button>
                            <button onClick={() => setIsPinModalOpen(true)} className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition shadow-lg shadow-green-600/30 text-sm flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                Finish Delivery & Get Paid
                            </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-60 min-h-[300px]">
                         <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         <p className="text-lg font-bold text-gray-600">No active trips</p>
                         <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">Make sure your rates are competitive. Farmers will book you instantly, or browse the Live Load Board.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* INFO PANEL */}
                <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl shadow-sm p-8 text-white flex flex-col justify-between h-[500px]">
                    <div>
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        </div>
                        <h3 className="text-2xl font-black mb-3">Instant Auto-Quotes</h3>
                        <p className="text-blue-100 text-sm leading-relaxed opacity-90">
                            You no longer have to waste time bidding on jobs. Ensure your Base Rates and Drop Fees in the Settings tab are accurate. 
                            When a farmer requests transport, our algorithm instantly quotes them using your set rates. 
                        </p>
                    </div>
                    <div className="bg-black/20 p-5 rounded-xl backdrop-blur-sm border border-white/10">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200 mb-1">Your Current Configuration</p>
                        <p className="font-bold">KSh {driverRates.baseRate}/km + KSh {driverRates.dropFee} Drop Fee</p>
                    </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FIND JOBS (FULL MARKETPLACE) */}
          {activeTab === 'find_jobs' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Load Marketplace</h3>
                  <p className="text-sm text-gray-500 mt-1">First-come, first-serve. Payouts are auto-calculated based on your saved rates.</p>
                </div>
                <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live Updates
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm table-auto">
                  <thead className="bg-gray-50/50 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4 border-b border-gray-100 w-[15%]">Produce</th>
                      <th className="px-6 py-4 border-b border-gray-100 w-[35%]">Route</th>
                      <th className="px-6 py-4 border-b border-gray-100 w-[15%] text-right">Distance</th>
                      <th className="px-6 py-4 border-b border-gray-100 w-[15%] text-right">Your Payout</th>
                      <th className="px-6 py-4 border-b border-gray-100 w-[20%] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {liveLoads.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">No available loads right now.</td></tr>
                    ) : (
                      liveLoads.map((load) => {
                        let finalPrice = (load.calculated_distance * driverRates.baseRate) + driverRates.dropFee;
                        if (load.weight_tons > 5) finalPrice += (finalPrice * 0.1);

                        return (
                        <tr key={load.id} className="hover:bg-blue-50/30 transition">
                          <td className="px-6 py-4 align-middle">
                            <p className="font-bold text-gray-900 capitalize whitespace-nowrap">{load.specific_crop}</p>
                            <p className="text-gray-500 text-xs font-medium mt-0.5 whitespace-nowrap">{load.weight_tons} Tons</p>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <p className="font-semibold text-gray-700 truncate max-w-[200px]">{load.pickup_location.split(' |')[0].split(' -')[0]}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[200px] mt-0.5">→ {load.dropoff_location.split(' -')[0]}</p>
                          </td>
                          <td className="px-6 py-4 align-middle text-right font-black text-gray-700 whitespace-nowrap">
                            {load.calculated_distance} km
                          </td>
                          <td className="px-6 py-4 align-middle text-right">
                             <span className="font-bold text-blue-600 whitespace-nowrap">KSh {Math.round(finalPrice).toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-right align-middle">
                            <button onClick={() => handleAcceptJob(load)} className="text-white font-bold text-[11px] uppercase tracking-wider bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition shadow-sm whitespace-nowrap">
                              Accept Job
                            </button>
                          </td>
                        </tr>
                      )})
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
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider whitespace-nowrap ${job.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-purple-600 text-white'}`}>
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

          {/* TAB 4: LIVE MESSAGES */}
          {activeTab === 'messages' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex overflow-hidden h-[600px] animate-in fade-in duration-300">
              <div className="w-1/3 border-r border-gray-100 bg-gray-50/30 flex flex-col">
                <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">Active Chats</h3></div>
                <div className="flex-1 overflow-y-auto">
                  {inTransitJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center opacity-50 p-8">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">💬</div>
                      <p className="text-sm font-bold text-gray-600">No active chats</p>
                      <p className="text-xs text-gray-400 mt-1">Chats appear here when a farmer books you.</p>
                    </div>
                  ) : (
                    inTransitJobs.map(job => (
                      <div 
                        key={job.id} 
                        onClick={() => setActiveChatLoad(job)}
                        className={`p-4 border-b border-gray-100 cursor-pointer flex items-center gap-3 transition ${activeChatLoad?.id === job.id ? 'bg-blue-50/80 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'}`}
                      >
                          <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {(farmerNames[job.farmer_id] || 'F').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 overflow-hidden">
                              <p className="font-bold text-gray-900 text-sm truncate">{farmerNames[job.farmer_id] || 'Farmer Contact'}</p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">TR-{job.id.toString().substring(0,4)} • {job.specific_crop}</p>
                          </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex-1 bg-white flex flex-col">
                {activeChatLoad ? (
                  <>
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h3 className="font-bold text-gray-900">{farmerNames[activeChatLoad.farmer_id] || 'Farmer Contact'}</h3>
                            <p className="text-xs text-green-500 font-bold flex items-center gap-1 mt-0.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Online</p>
                        </div>
                        <a 
                          href={`tel:${activeChatLoad?.farmer_id ? farmerPhones[activeChatLoad.farmer_id] : ''}`} 
                          onClick={(e) => {
                            if(!farmerPhones[activeChatLoad.farmer_id]){
                                e.preventDefault();
                                toast.error("Farmer hasn't provided a phone number.");
                            } else {
                                toast.info("Opening Phone Dialer...", { description: "Calling the Farmer." });
                            }
                          }}
                          className="text-blue-600 hover:text-blue-700 font-bold text-sm bg-blue-50 px-4 py-2 rounded-lg transition border border-blue-100 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                          Call Farmer
                        </a>
                    </div>
                    
                    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/30">
                        {messages.map(msg => {
                          const isMe = msg.sender_id === userId;
                          return (
                            <div key={msg.id} className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className={`px-4 py-3 max-w-[80%] text-sm shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-none'}`}>
                                {msg.text}
                              </div>
                              <span className="text-[10px] text-gray-400 font-bold px-1">
                                {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          )
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 border-t border-gray-100 bg-white">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                            <input 
                              type="text" 
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Type a message to the farmer..." 
                              className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3.5 text-sm outline-none focus:border-blue-500 transition" 
                            />
                            <button type="submit" disabled={!newMessage.trim()} className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition shadow-md flex-shrink-0 disabled:opacity-50">
                                <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                            </button>
                        </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
                    <svg className="w-16 h-16 text-blue-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Your Messages</h2>
                    <p className="text-gray-500 text-sm max-w-md mx-auto">Select an active trip from the sidebar to coordinate dispatch with the farmer.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SETTINGS (Upgraded UI) */}
          {activeTab === 'settings' && (
            <div className="max-w-4xl bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-5 bg-gray-50/50">
                <div className="w-20 h-20 bg-blue-100 text-blue-700 font-black text-3xl rounded-2xl flex items-center justify-center shadow-inner border border-blue-200 flex-shrink-0">
                  {userName ? userName.charAt(0) : 'T'}
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-2xl tracking-tight">Account & Algorithm</h3>
                  <p className="text-sm text-gray-500 font-medium mt-1.5 flex flex-wrap items-center gap-2">
                    Manage your identity and tune your auto-quoting bot. 
                    <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Verified Transporter
                    </span>
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  
                  {/* Left Column: Editable Profile */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      Profile Information
                    </h4>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Driver Name / Company</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-gray-900 font-bold transition shadow-sm" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Contact Number</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        </div>
                        <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="07XX XXX XXX" className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-gray-900 font-bold transition shadow-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Read-only Security Info */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      Account Security
                    </h4>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Login Email Address</label>
                      <div className="relative opacity-70 cursor-not-allowed">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <input type="email" value={userEmail} disabled className="w-full pl-12 pr-4 py-4 bg-gray-100 border-2 border-gray-200 rounded-xl outline-none text-gray-700 font-bold" />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5 ml-1 font-medium">Contact Agrimove support to change your registered email.</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Driver ID Number</label>
                      <div className="relative opacity-70">
                         <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                        </div>
                        <input type="text" value={`TRN-${userId.substring(0,8).toUpperCase()}`} disabled className="w-full pl-12 pr-4 py-4 bg-gray-100 border-2 border-gray-200 rounded-xl outline-none text-gray-700 font-mono font-bold tracking-wider" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* THE ALGORITHM BLOCK */}
                <div className="bg-blue-50/50 p-8 rounded-3xl border border-blue-100 mt-8">
                  <h4 className="font-black text-gray-900 mb-1 flex items-center gap-2 text-lg">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Smart Quoting Algorithm
                  </h4>
                  <p className="text-sm text-gray-600 mb-8 font-medium">Set your base rates here. When a farmer requests transport, our algorithm instantly calculates: <strong className="text-blue-700 bg-blue-100 px-2 py-0.5 rounded">(Distance × Per KM) + Drop Fee</strong>.</p>
                  
                  <div className="grid sm:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Rate Per Kilometer (KSh)</label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-gray-400">KSh</span>
                        <input type="number" required value={editBaseRate} onChange={e => setEditBaseRate(parseInt(e.target.value))} className="w-full pl-16 pr-4 py-4 bg-white border-2 border-blue-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-2xl font-black text-blue-900 transition shadow-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Base Drop Fee (KSh)</label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-gray-400">KSh</span>
                        <input type="number" required value={editDropFee} onChange={e => setEditDropFee(parseInt(e.target.value))} className="w-full pl-16 pr-4 py-4 bg-white border-2 border-blue-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-2xl font-black text-blue-900 transition shadow-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-6">
                  <p className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Your data is secured by Supabase.
                  </p>
                  <button type="submit" disabled={isSavingSettings} className="w-full sm:w-auto px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition shadow-lg shadow-blue-600/30 disabled:opacity-50 text-sm">
                    {isSavingSettings ? 'Saving to Algorithm...' : 'Save Settings & Update Algorithm'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </main>

      {/* OVERLAYS */}
      {isPinModalOpen && activeJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={() => setIsPinModalOpen(false)}></div>
          
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="bg-green-600 p-6 text-center text-white relative">
              <button onClick={() => setIsPinModalOpen(false)} className="absolute top-4 right-4 text-white/70 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30 shadow-inner">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              </div>
              <h2 className={`${montserrat.className} text-2xl font-black mb-1 tracking-tight`}>Verify Delivery</h2>
              <p className="text-sm font-medium text-green-100">Enter the 4-digit PIN provided to the receiver to release your funds.</p>
            </div>

            <div className="p-8">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-6 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Escrow Payout</p>
                <p className="text-2xl font-black text-green-600">KSh {activeJob.target_price.toLocaleString()}</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 text-center">Enter 4-Digit PIN</label>
                  <input 
                    type="text" 
                    maxLength={4}
                    value={deliveryPin}
                    onChange={(e) => setDeliveryPin(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full text-center text-4xl tracking-[1em] font-black p-4 bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 text-gray-900 transition shadow-inner" 
                    placeholder="••••" 
                  />
                </div>

                <button 
                  onClick={handleVerifyPin} 
                  disabled={deliveryPin.length !== 4}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl transition shadow-lg shadow-green-600/30 disabled:opacity-50 text-sm flex justify-center items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Confirm & Release Payout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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