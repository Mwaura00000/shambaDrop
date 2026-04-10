"use client";

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Inter, Montserrat } from 'next/font/google';
import { toast, Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

const cropCategories = [
  { id: 'grains', name: 'Grains & Cereals', icon: '🌾', crops: ['Maize', 'Wheat', 'Rice', 'Beans', 'Sorghum'] },
  { id: 'tubers', name: 'Roots & Tubers', icon: '🥔', crops: ['Irish Potatoes', 'Sweet Potatoes', 'Cassava'] },
  { id: 'vegetables', name: 'Vegetables', icon: '🥬', crops: ['Cabbage', 'Tomatoes', 'Onions', 'Carrots'] },
  { id: 'fruits', name: 'Fruits', icon: '🥭', crops: ['Avocados', 'Mangoes', 'Bananas', 'Watermelons'] },
  { id: 'dairy', name: 'Dairy & Poultry', icon: '🥛', crops: ['Raw Milk', 'Eggs', 'Live Chickens'] }
];

function OSMLocationInput({ placeholder, icon, onSelect }: { placeholder: string, icon: React.ReactNode, onSelect: (name: string, lat: string, lon: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const searchOSM = async (text: string) => {
    if (text.length < 3) { setResults([]); return; }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=ke&limit=5`);
      const data = await res.json();
      setResults(data);
    } catch (e) { console.error(e); }
    setIsOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => searchOSM(e.target.value), 400);
  };

  const handleSelect = (place: any) => {
    const shortName = place.display_name.split(',').slice(0, 2).join(', ');
    setQuery(shortName);
    setIsOpen(false);
    onSelect(shortName, place.lat, place.lon);
  };

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10 text-emerald-600">{icon}</div>
      <input 
        type="text" value={query} onChange={handleInputChange} placeholder={placeholder}
        className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-100 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold shadow-sm hover:border-gray-200"
      />
      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          {results.map((place) => (
            <li key={place.place_id} onClick={() => handleSelect(place)} className="px-4 py-3 hover:bg-emerald-50 cursor-pointer text-sm font-medium border-b border-gray-50 truncate">
              {place.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FarmerDashboard() {
  const router = useRouter();
  
  // NAVIGATION STATE
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'messages' | 'settings'>('dashboard');

  // USER STATES
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [escrowBalance, setEscrowBalance] = useState(10000);
  
  // DATA STATES
  const [activeLoads, setActiveLoads] = useState<any[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({}); 

  // WIZARD/MODAL STATES
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [cropSearchQuery, setCropSearchQuery] = useState('');
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPhone, setDepositPhone] = useState('');
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);

  // BID REVIEW STATES
  const [reviewLoad, setReviewLoad] = useState<any | null>(null);
  const [loadBids, setLoadBids] = useState<any[]>([]);
  const [isFetchingBids, setIsFetchingBids] = useState(false);

  // SETTINGS STATES
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [loadData, setLoadData] = useState({
    cropCategory: '', specificCrop: '', packaging: '', weight: 5, needsLoaders: false,
    pickupTown: '', pickupCoords: { lat: '', lon: '' }, pickupLandmark: '',
    dropoffTown: '', dropoffCoords: { lat: '', lon: '' },
    receiverType: 'me', receiverName: '', receiverPhone: '',
    pricingStrategy: 'market_algo', calculatedDistance: 0, price: ''
  });

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
        setUserPhone(profile.phone || '');
      }
      
      fetchMyLoads(session.user.id);
    };
    init();

    const channel = supabase
      .channel('public:job_bids')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_bids' }, payload => {
        toast.success('New Bid Received!', { description: 'A transporter just submitted a quote for your load.' });
        if (userId) fetchMyLoads(userId); 
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [router, userId]);

  const fetchMyLoads = async (uid: string) => {
    const { data } = await supabase.from('loads').select('*').eq('farmer_id', uid).order('created_at', { ascending: false });
    if (data) {
      setActiveLoads(data);
      const driverIds = data.filter(l => l.driver_id).map(l => l.driver_id);
      if (driverIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', driverIds);
        if (profiles) {
          const namesMap: Record<string, string> = {};
          profiles.forEach(p => namesMap[p.id] = p.full_name);
          setDriverNames(namesMap);
        }
      }
    }
  };

  const handleOpenReview = async (load: any) => {
    if (load.status !== 'pending_driver') return; 
    setReviewLoad(load);
    setIsFetchingBids(true);
    
    try {
      const { data: bids } = await supabase.from('job_bids').select('*').eq('load_id', load.id).eq('status', 'pending').order('bid_amount', { ascending: true });
      if (bids && bids.length > 0) {
        const enrichedBids = await Promise.all(bids.map(async (bid) => {
          const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', bid.transporter_id).single();
          return {
            ...bid,
            transporter_name: prof?.full_name || 'Verified Driver',
            rating: (Math.random() * (5.0 - 4.5) + 4.5).toFixed(1), 
            trips: Math.floor(Math.random() * 200) + 10 
          };
        }));
        setLoadBids(enrichedBids);
      } else { setLoadBids([]); }
    } catch (error) { console.error(error); } 
    finally { setIsFetchingBids(false); }
  };

  const handleAcceptBid = async (bid: any) => {
    toast.loading("Securing transport and locking escrow...");
    try {
      const { error: loadError } = await supabase.from('loads').update({ status: 'in_transit', target_price: bid.bid_amount, driver_id: bid.transporter_id }).eq('id', reviewLoad.id);
      if (loadError) throw loadError;

      const { error: bidError } = await supabase.from('job_bids').update({ status: 'accepted' }).eq('id', bid.id);
      if (bidError) throw bidError;

      toast.dismiss(); toast.success("Driver Assigned Successfully!", { description: "Your load is now In Transit." });
      setReviewLoad(null); fetchMyLoads(userId); 
    } catch (error: any) {
      toast.dismiss(); toast.error("Failed to accept bid", { description: error.message });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: editName, phone: editPhone }).eq('id', userId);
      if (error) throw error;
      setUserName(editName.split(' ')[0].toUpperCase());
      setUserPhone(editPhone);
      toast.success("Profile Updated Successfully!");
    } catch (error: any) {
      toast.error("Update failed", { description: error.message });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  useEffect(() => {
    const getRealDrivingDistance = async () => {
      if (loadData.pickupCoords.lat && loadData.dropoffCoords.lat) {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${loadData.pickupCoords.lon},${loadData.pickupCoords.lat};${loadData.dropoffCoords.lon},${loadData.dropoffCoords.lat}?overview=false`;
          const response = await fetch(url);
          const data = await response.json();
          if (data.code === 'Ok' && data.routes.length > 0) {
            setLoadData(prev => ({ ...prev, calculatedDistance: Math.round(data.routes[0].distance / 1000) }));
          }
        } catch (error) { console.error("OSRM error"); }
      }
    };
    getRealDrivingDistance();
  }, [loadData.pickupCoords, loadData.dropoffCoords]);

  const marketPrice = loadData.calculatedDistance === 0 ? 0 : 2000 + (loadData.calculatedDistance * (loadData.calculatedDistance < 50 ? 120 : 85)) + (loadData.weight > 5 ? (loadData.weight - 5) * 500 : 0);

  const handlePostLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const pickupString = `${loadData.pickupTown} - ${loadData.pickupLandmark}`;
    const payload = {
      farmer_id: userId, crop_category: loadData.cropCategory, specific_crop: loadData.specificCrop,
      packaging: loadData.packaging, weight_tons: loadData.weight, needs_loaders: loadData.needsLoaders,
      pickup_location: pickupString, dropoff_location: loadData.dropoffTown,
      calculated_distance: loadData.calculatedDistance, pricing_strategy: loadData.pricingStrategy,
      target_price: loadData.pricingStrategy === 'market_algo' ? marketPrice : null, status: 'pending_driver',
    };

    const { error } = await supabase.from('loads').insert([payload]);
    if (error) { toast.error("Database Error"); return; }
    fetchMyLoads(userId);
    setIsWizardOpen(false); setWizardStep(1);
    toast.success("Load Posted!");
  };

  const handleGetGPSLocation = () => {
    setIsLocatingGPS(true);
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      setIsLocatingGPS(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoadData({...loadData, pickupCoords: { lat: position.coords.latitude.toFixed(5), lon: position.coords.longitude.toFixed(5) }});
        toast.success("GPS Locked!");
        setIsLocatingGPS(false);
      },
      () => { toast.error("Allow location access."); setIsLocatingGPS(false); }
    );
  };

  // --- THE REAL M-PESA STK PUSH LOGIC (NO HACKS) ---
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) { toast.error("Enter a valid amount."); return; }
    if (!depositPhone || depositPhone.length < 9) { toast.error("Enter a valid M-Pesa number."); return; }
    
    toast.loading(`Sending M-Pesa Prompt to ${depositPhone}...`);
    
    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: depositAmount, phone: depositPhone })
      });
      const data = await res.json();

      if (data.success) {
        toast.dismiss();
        toast.success("STK Push Sent Successfully!", { description: "Please check your phone and enter your M-Pesa PIN." });
        setIsDepositOpen(false); 
        setDepositAmount('');
        setDepositPhone('');
      } else {
        toast.dismiss();
        toast.error("M-Pesa Failed", { description: data.error });
      }
    } catch (error) {
      toast.dismiss();
      toast.error("System Error. Is your internet connected?");
    }
  };

  const totalRequests = activeLoads.length;
  const pendingRequests = activeLoads.filter(l => l.status === 'pending_driver').length;
  const deliveredRequests = activeLoads.filter(l => l.status === 'delivered').length;
  const activeDriversCount = new Set(activeLoads.filter(l => l.driver_id).map(l => l.driver_id)).size;

  return (
    <div className={`flex h-screen bg-[#F8FAFC] font-sans text-gray-800 ${inter.variable} ${montserrat.variable} overflow-hidden`}>
      <Toaster position="bottom-right" richColors />

      {/* --- SIDEBAR --- */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col hidden md:flex z-20 shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <span className={`${montserrat.className} font-black text-xl text-emerald-600 tracking-tight`}>Agrimove</span>
        </div>
        
        <div className="px-4 mb-2 mt-4"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Menu</span></div>
        <nav className="flex-1 px-4 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 font-bold rounded-lg transition text-sm ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-500' : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            Dashboard
          </button>
          <button onClick={() => setIsWizardOpen(true)} className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50 font-semibold rounded-lg transition text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            Create Request
          </button>
          <button onClick={() => setActiveTab('requests')} className={`w-full flex items-center gap-3 px-3 py-2.5 font-semibold rounded-lg transition text-sm ${activeTab === 'requests' ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-500' : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            My Requests
          </button>
          <button onClick={() => setActiveTab('messages')} className={`w-full flex items-center gap-3 px-3 py-2.5 font-semibold rounded-lg transition text-sm ${activeTab === 'messages' ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-500' : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
            Messages
          </button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 font-semibold rounded-lg transition text-sm ${activeTab === 'settings' ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-500' : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Settings
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-red-500 hover:bg-red-50 font-semibold rounded-lg transition text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            Logout
          </button>
        </div>
      </aside>

      {/* --- DYNAMIC MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <h1 className={`${montserrat.className} text-xl font-bold text-gray-900`}>
            {activeTab === 'dashboard' ? 'Farm Overview' : 
             activeTab === 'requests' ? 'My Transport Requests' : 
             activeTab === 'messages' ? 'Messages' : 'Account Settings'}
          </h1>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-100 px-3 py-1.5 rounded-full">
              <div className="text-right">
                <p className="text-xs font-bold text-gray-900">{userName || 'USER'}</p>
                <p className="text-[10px] font-black text-emerald-600">KSH {escrowBalance.toLocaleString()}</p>
              </div>
              <div className="w-8 h-8 bg-emerald-100 text-emerald-700 font-bold rounded-full flex items-center justify-center text-sm border border-emerald-200 shadow-inner">
                {userName ? userName.charAt(0) : 'U'}
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
          
          {/* TAB 1: DASHBOARD (Default) */}
          {activeTab === 'dashboard' && (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className={`${montserrat.className} text-3xl font-black text-gray-900 tracking-tight`}>Welcome back, {userName}! 👋</h2>
                  <p className="text-gray-500 text-sm mt-1">Here's what's happening with your farm transport today.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setIsDepositOpen(true)} className="px-5 py-2.5 border-2 border-emerald-500 text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition flex items-center gap-2 text-sm shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    Top Up Escrow
                  </button>
                  <button onClick={() => setIsWizardOpen(true)} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition flex items-center gap-2 text-sm shadow-lg shadow-emerald-500/30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    New Request
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'TOTAL REQUESTS', value: totalRequests, icon: '📄', color: 'bg-blue-50 text-blue-500' },
                  { label: 'PENDING', value: pendingRequests, icon: '⏱️', color: 'bg-amber-50 text-amber-500' },
                  { label: 'DELIVERED', value: deliveredRequests, icon: '✅', color: 'bg-emerald-50 text-emerald-500' },
                  { label: 'ACTIVE DRIVERS', value: activeDriversCount, icon: '🚚', color: 'bg-purple-50 text-purple-500' },
                ].map((stat, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className={`${montserrat.className} text-3xl font-black text-gray-900`}>{stat.value}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${stat.color}`}>{stat.icon}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* TABLE */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Recent Transport Requests</h3>
                    <button onClick={() => setActiveTab('requests')} className="text-sm font-bold text-emerald-600 hover:text-emerald-700">View All →</button>
                  </div>
                  
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm table-auto">
                      <thead className="bg-gray-50/50 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                        <tr>
                          <th className="px-5 py-4 border-b border-gray-100 w-[15%]">Produce</th>
                          <th className="px-5 py-4 border-b border-gray-100 w-[35%]">Route</th>
                          <th className="px-5 py-4 border-b border-gray-100 w-[20%]">Driver</th>
                          <th className="px-5 py-4 border-b border-gray-100 w-[15%]">Status</th>
                          <th className="px-5 py-4 border-b border-gray-100 w-[15%] text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {activeLoads.length === 0 ? (
                          <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No active requests</td></tr>
                        ) : (
                          activeLoads.slice(0, 5).map((load) => {
                            const isPending = load.status === 'pending_driver';
                            const fakePin = Math.floor(1000 + Math.random() * 9000); 
                            
                            return (
                              <tr key={load.id} className={`transition ${isPending ? 'hover:bg-amber-50/30' : 'hover:bg-gray-50/50'}`}>
                                <td className="px-5 py-4 align-middle">
                                  <p className="font-bold text-gray-900 capitalize whitespace-nowrap">{load.specific_crop}</p>
                                  <p className="text-gray-400 text-xs font-medium mt-0.5 whitespace-nowrap">{load.weight_tons} Tons</p>
                                </td>
                                <td className="px-5 py-4 align-middle">
                                  <p className="font-semibold text-gray-700 truncate max-w-[180px]">{load.pickup_location.split(' -')[0]}</p>
                                  <p className="text-xs text-gray-400 truncate max-w-[180px] mt-0.5">→ {load.dropoff_location.split(',')[0]}</p>
                                </td>
                                <td className="px-5 py-4 align-middle">
                                  {isPending ? (
                                    <span className="font-bold text-amber-500 text-[10px] tracking-widest uppercase whitespace-nowrap">WAITING FOR BIDS</span>
                                  ) : (
                                    <div>
                                      <p className="font-semibold text-gray-800 truncate max-w-[130px] whitespace-nowrap">{driverNames[load.driver_id] || 'Assigned Driver'}</p>
                                      <p className="text-[10px] font-bold text-gray-400 mt-0.5 whitespace-nowrap">KCA 123H</p>
                                    </div>
                                  )}
                                </td>
                                <td className="px-5 py-4 align-middle">
                                  {isPending ? (
                                    <span className="inline-block whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                      REVIEW BIDS
                                    </span>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      <span className="inline-block w-fit whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider bg-purple-600 text-white shadow-sm">
                                        IN TRANSIT
                                      </span>
                                      <div className="w-fit whitespace-nowrap bg-gray-900 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-black tracking-widest">
                                        PIN: {fakePin}
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-right align-middle">
                                  {isPending ? (
                                    <button onClick={() => handleOpenReview(load)} className="text-amber-700 font-bold text-[11px] uppercase tracking-wider bg-amber-100 hover:bg-amber-500 hover:text-white px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap">
                                      View Offers
                                    </button>
                                  ) : (
                                    <button className="text-gray-400 hover:text-emerald-600 p-2 transition">
                                      <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RECENT ACTIVITY */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col h-full">
                  <h3 className="font-bold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="flex-1 bg-gray-50/50 border border-dashed border-gray-200 rounded-xl p-4 overflow-y-auto space-y-4 max-h-[300px]">
                    {activeLoads.length === 0 ? (
                      <p className="text-sm font-medium text-gray-500 text-center py-8">No recent activity on your account.</p>
                    ) : (
                      activeLoads.slice(0, 4).map((load, i) => (
                        <div key={i} className="flex gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${load.status === 'pending_driver' ? 'bg-amber-400' : 'bg-purple-500'}`}></div>
                          <div>
                            <p className="text-sm text-gray-800 font-medium">
                              {load.status === 'pending_driver' 
                                ? `You posted a request for ${load.weight_tons}T of ${load.specific_crop}.` 
                                : `Assigned driver for ${load.specific_crop} to ${load.dropoff_location.split(',')[0]}.`}
                            </p>
                            <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
                              {new Date(load.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: MY REQUESTS (Full Page List) */}
          {activeTab === 'requests' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-300">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">All Transport History</h3>
                  <p className="text-sm text-gray-500 mt-1">View and manage all your past and present logistics.</p>
                </div>
                <button onClick={() => setIsWizardOpen(true)} className="px-4 py-2 bg-emerald-50 text-emerald-600 font-bold rounded-lg hover:bg-emerald-100 transition text-sm">
                  + New Request
                </button>
              </div>
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm table-auto">
                  <thead className="bg-gray-50/50 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                    <tr>
                      <th className="px-5 py-4 border-b border-gray-100 w-[15%]">Produce</th>
                      <th className="px-5 py-4 border-b border-gray-100 w-[35%]">Route</th>
                      <th className="px-5 py-4 border-b border-gray-100 w-[20%]">Driver</th>
                      <th className="px-5 py-4 border-b border-gray-100 w-[15%]">Status</th>
                      <th className="px-5 py-4 border-b border-gray-100 w-[15%] text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeLoads.length === 0 ? (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No historical requests found.</td></tr>
                    ) : (
                      activeLoads.map((load) => {
                        const isPending = load.status === 'pending_driver';
                        return (
                          <tr key={load.id} className="hover:bg-gray-50/50 transition">
                            <td className="px-5 py-4 align-middle">
                              <p className="font-bold text-gray-900 capitalize whitespace-nowrap">{load.specific_crop}</p>
                              <p className="text-gray-400 text-xs font-medium mt-0.5 whitespace-nowrap">{load.weight_tons} Tons</p>
                            </td>
                            <td className="px-5 py-4 align-middle">
                              <p className="font-semibold text-gray-700 truncate max-w-[180px]">{load.pickup_location.split(' -')[0]}</p>
                              <p className="text-xs text-gray-400 truncate max-w-[180px] mt-0.5">→ {load.dropoff_location.split(',')[0]}</p>
                            </td>
                            <td className="px-5 py-4 align-middle">
                              {isPending ? (
                                <span className="font-bold text-amber-500 text-[10px] tracking-widest uppercase whitespace-nowrap">-</span>
                              ) : (
                                <div>
                                  <p className="font-semibold text-gray-800 truncate max-w-[130px] whitespace-nowrap">{driverNames[load.driver_id] || 'Assigned Driver'}</p>
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 align-middle">
                              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider whitespace-nowrap ${load.status === 'pending_driver' ? 'bg-amber-100 text-amber-800' : load.status === 'in_transit' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                                {load.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right align-middle">
                              {isPending && (
                                <button onClick={() => handleOpenReview(load)} className="text-amber-700 font-bold text-[11px] uppercase tracking-wider bg-amber-100 hover:bg-amber-500 hover:text-white px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap">
                                  Review
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MESSAGES */}
          {activeTab === 'messages' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex overflow-hidden h-[600px] animate-in fade-in duration-300">
              <div className="w-1/3 border-r border-gray-100 bg-gray-50/30 flex flex-col">
                <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">Active Chats</h3></div>
                <div className="flex-1 p-4 flex flex-col items-center justify-center text-center opacity-50">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">💬</div>
                  <p className="text-sm font-bold text-gray-600">No active chats</p>
                  <p className="text-xs text-gray-400 mt-1 px-4">Chats will appear here once a driver accepts a load.</p>
                </div>
              </div>
              <div className="flex-1 bg-white flex flex-col items-center justify-center">
                <div className="text-center p-8">
                  <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Messaging V2 Coming Soon</h2>
                  <p className="text-gray-500 text-sm max-w-md mx-auto">Real-time chat functionality between Farmers and Transporters will be enabled in the next major update.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-lg">Profile Settings</h3>
                <p className="text-sm text-gray-500 mt-1">Update your farm contact details.</p>
              </div>
              <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Full Name / Farm Name</label>
                  <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-gray-900 font-medium transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Phone Number</label>
                  <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="07XX XXX XXX" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-gray-900 font-medium transition" />
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <button type="submit" disabled={isSavingSettings} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-md disabled:opacity-50">
                    {isSavingSettings ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </main>

      {/* OVERLAYS */}
      {isDepositOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsDepositOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-full">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className={`${montserrat.className} text-xl font-bold`}>Top Up Escrow</h2>
              <button onClick={() => setIsDepositOpen(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            
            <div className="p-6 flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">M-Pesa Phone Number</label>
              <input type="tel" value={depositPhone} onChange={e=>setDepositPhone(e.target.value)} className="w-full text-lg font-bold p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-gray-900 transition mb-6" placeholder="07XX XXX XXX" />

              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Amount (KSH)</label>
              <input type="number" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} className="w-full text-3xl font-black p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-emerald-800 transition mb-6" placeholder="10,000" />
            </div>

            <div className="p-6 border-t border-gray-100">
              <button onClick={handleDeposit} className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-md hover:bg-emerald-600 transition">Send M-Pesa Prompt</button>
            </div>
          </div>
        </div>
      )}

      {reviewLoad && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setReviewLoad(null)}></div>
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
              <div>
                <h2 className={`${montserrat.className} text-xl font-black text-gray-900`}>Review Offers</h2>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mt-1">TR-{reviewLoad.id.toString().substring(0,6)} • {reviewLoad.specific_crop}</p>
              </div>
              <button onClick={() => setReviewLoad(null)} className="w-8 h-8 bg-gray-50 text-gray-500 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 space-y-4">
              {isFetchingBids ? (
                <div className="flex justify-center py-10"><svg className="animate-spin h-8 w-8 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
              ) : loadBids.length === 0 ? (
                <div className="text-center py-10 opacity-60">
                  <p className="text-gray-500 font-bold">No bids received yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Transporters in your area have been notified.</p>
                </div>
              ) : (
                loadBids.map((bid) => (
                  <div key={bid.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-amber-300 transition">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 font-black rounded-full flex items-center justify-center">
                          {bid.transporter_name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{bid.transporter_name}</h4>
                          <p className="text-xs font-bold text-amber-500 flex items-center gap-1">
                            ⭐ {bid.rating} <span className="text-gray-300 mx-1">•</span> {bid.trips} trips
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center mb-4">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Transport Fee</p>
                      <p className={`${montserrat.className} text-2xl font-black text-gray-900`}>KSh {bid.bid_amount.toLocaleString()}</p>
                    </div>

                    <button 
                      onClick={() => handleAcceptBid(bid)}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow-md shadow-emerald-500/20 text-sm"
                    >
                      Accept Offer & Secure Driver
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsWizardOpen(false)}></div>
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-full">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div><h2 className={`${montserrat.className} text-xl font-bold`}>Create Shipment</h2><p className="text-xs font-bold text-emerald-600">STEP {wizardStep} OF 3</p></div>
              <button onClick={() => setIsWizardOpen(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              {wizardStep === 1 && (
                <div className="space-y-6">
                  <input type="text" placeholder="Search crop..." onChange={e=>setCropSearchQuery(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm" />
                  <div className="grid gap-4">
                    {cropCategories.map(cat => (
                      <div key={cat.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{cat.icon} {cat.name}</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {cat.crops.filter(c=>c.toLowerCase().includes(cropSearchQuery.toLowerCase())).map(crop => (
                            <button key={crop} onClick={() => setLoadData({...loadData, cropCategory: cat.name, specificCrop: crop})} className={`p-2.5 border rounded-lg text-left text-sm font-semibold transition ${loadData.specificCrop === crop ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 text-gray-600 hover:border-emerald-300'}`}>{crop}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-8">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Estimated Weight</p>
                    <span className="text-4xl font-black text-emerald-600">{loadData.weight}</span><span className="text-gray-500 font-bold ml-2">Tons</span>
                    <input type="range" min="1" max="30" value={loadData.weight} onChange={e=>setLoadData({...loadData, weight: parseInt(e.target.value)})} className="w-full mt-6 accent-emerald-500" />
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-6">
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm border-b pb-2">1. The Route</h3>
                    <OSMLocationInput placeholder="Pickup Town..." icon={<span/>} onSelect={(n,lat,lon) => setLoadData({...loadData, pickupTown:n, pickupCoords:{lat,lon}})} />
                    <button onClick={handleGetGPSLocation} disabled={isLocatingGPS} className="flex bg-emerald-100 text-emerald-800 font-black text-xs py-3 rounded-lg hover:bg-emerald-200 transition disabled:opacity-50 w-full items-center justify-center gap-1.5 border border-emerald-200">
                        {isLocatingGPS ? 'Locking Signal...' : (loadData.pickupCoords.lat ? `✓ GPS Locked` : '📍 Use Current GPS Location')}
                    </button>
                    <OSMLocationInput placeholder="Drop-off Town..." icon={<span/>} onSelect={(n,lat,lon) => setLoadData({...loadData, dropoffTown:n, dropoffCoords:{lat,lon}})} />
                    {loadData.calculatedDistance > 0 && <p className="text-xs font-bold text-gray-500 text-right">Distance: {loadData.calculatedDistance}km</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 bg-white z-10">
              {wizardStep > 1 && <button onClick={() => setWizardStep(wizardStep - 1)} className="px-6 py-3 bg-gray-100 font-bold rounded-xl text-sm">Back</button>}
              {wizardStep < 3 ? (
                <button onClick={() => setWizardStep(wizardStep + 1)} disabled={wizardStep===1&&!loadData.specificCrop} className="flex-1 bg-gray-900 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">Continue</button>
              ) : (
                <button onClick={handlePostLoad} disabled={!loadData.pickupTown} className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm shadow-md disabled:opacity-50">Post Request</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}