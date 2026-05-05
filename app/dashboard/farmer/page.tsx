"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Inter, Montserrat } from 'next/font/google';
import { toast, Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

// HELPER: Strict Kenyan Phone Validation
const isValidKenyanPhone = (phone: string) => {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  return /^(?:254|\+254|0)?((?:7|1)[0-9]{8})$/.test(cleaned);
};

interface Profile {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  role: string;
  base_rate_per_km?: number;
  base_drop_fee?: number;
}

interface Load {
  id: string;
  status: string;
  weight_tons: number;
  specific_crop: string;
  farmer_id: string;
  driver_id?: string;
  pickup_location: string;
  dropoff_location: string;
  calculated_distance: number;
  target_price: number;
  delivery_pin?: string;
  receiver_phone?: string;
  created_at: string;
}

interface Message {
  id: string;
  load_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

interface Driver extends Profile {
  calculated_quote: number;
  rating: string;
  trips: number;
}

interface CropCategory {
  id: string;
  name: string;
  icon: string;
  crops: string[];
}

export default function FarmerDashboard() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'messages' | 'settings'>('dashboard');

  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [escrowBalance, setEscrowBalance] = useState(10000);
  
  const [activeLoads, setActiveLoads] = useState<Load[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({}); 
  const [driverPhones, setDriverPhones] = useState<Record<string, string>>({});

  // System Config States (Fetched from DB)
  const [cropCategories, setCropCategories] = useState<CropCategory[]>([]);
  const [kenyaLocations, setKenyaLocations] = useState<Record<string, string[]>>({});

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [cropSearchQuery, setCropSearchQuery] = useState('');
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPhone, setDepositPhone] = useState('');

  const [reviewLoad, setReviewLoad] = useState<Load | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [isFetchingDrivers, setIsFetchingDrivers] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [activeChatLoad, setActiveChatLoad] = useState<Load | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [loadData, setLoadData] = useState({
    cropCategory: '', specificCrop: '', packaging: '', weight: 5, needsLoaders: false,
    pickupCounty: '', pickupTown: '', pickupLandmark: '', pickupCoords: { lat: 0, lon: 0 },
    pickupDate: '', pickupTime: '', 
    deliveryCounty: '', deliveryTown: '', deliveryLandmark: '', dropoffCoords: { lat: 0, lon: 0 },
    receiverPhone: '', 
    calculatedDistance: 0
  });

  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);

  const fetchMyLoads = useCallback(async (uid: string) => {
    const { data } = await supabase.from('loads').select('*').eq('farmer_id', uid).order('created_at', { ascending: false });
    if (data) {
      setActiveLoads(data as Load[]);
      const driverIds = (data as Load[]).filter(l => l.driver_id).map(l => l.driver_id);
      if (driverIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone').in('id', driverIds);
        if (profiles) {
          const namesMap: Record<string, string> = {};
          const phonesMap: Record<string, string> = {};
          profiles.forEach(p => {
              namesMap[p.id] = p.full_name;
              phonesMap[p.id] = p.phone || ''; 
          });
          setDriverNames(namesMap);
          setDriverPhones(phonesMap);
        }
      }
      
      const inTransitLoads = (data as Load[]).filter(l => l.status === 'in_transit');
      if (inTransitLoads.length > 0 && !activeChatLoad) {
        setActiveChatLoad(inTransitLoads[0]);
      }
    }
  }, [activeChatLoad]);

  const fetchMessages = useCallback(async () => {
    if (!activeChatLoad) return;
    const { data } = await supabase.from('messages').select('*').eq('load_id', activeChatLoad.id).order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
  }, [activeChatLoad]);

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
        setUserPhone(profile.phone || '');
      }

      // Fetch System Configs dynamically
      const { data: configData } = await supabase.from('system_config').select('*');
      if (configData) {
        const crops = configData.find(c => c.key === 'crop_categories')?.value;
        const locs = configData.find(c => c.key === 'kenya_locations')?.value;
        if (crops) setCropCategories(crops);
        if (locs) setKenyaLocations(locs);
      }
      
      fetchMyLoads(session.user.id);
    };
    init();

    const loadChannel = supabase
      .channel('public:loads')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'loads' }, payload => {
         if (userId) fetchMyLoads(userId);
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(loadChannel); 
    };
  }, [router, userId, fetchMyLoads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);



  useEffect(() => {
    if (activeChatLoad) {
      fetchMessages();
      const messageChannel = supabase
        .channel(`chat-farmer-${activeChatLoad.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `load_id=eq.${activeChatLoad.id}` 
        }, () => {
          fetchMessages();
        })
        .subscribe();

      return () => { supabase.removeChannel(messageChannel); };
    }
  }, [activeChatLoad, fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatLoad) return;
    
    const tempMessage = newMessage;
    setNewMessage(''); 

    const { error } = await supabase.from('messages').insert([{ 
      load_id: activeChatLoad.id, 
      sender_id: userId, 
      text: tempMessage 
    }]);

    if (error) {
      toast.error("Failed to send message");
      setNewMessage(tempMessage);
    }
  };

  const handleOpenMarketplace = async (load: Load) => {
    if (load.status !== 'pending_driver') return; 
    setReviewLoad(load);
    setIsFetchingDrivers(true);
    
    try {
      const { data: transporters } = await supabase.from('profiles').select('*').eq('role', 'transporter');
      
      if (transporters && transporters.length > 0) {
        const quotedDrivers = transporters.map((t) => {
          const bRate = t.base_rate_per_km || 100;
          const dFee = t.base_drop_fee || 2500;
          let finalPrice = (load.calculated_distance * bRate) + dFee;
          
          if (load.weight_tons > 5) finalPrice += (finalPrice * 0.1);

          return {
            ...t,
            calculated_quote: Math.round(finalPrice),
            rating: (Math.random() * (5.0 - 4.5) + 4.5).toFixed(1), 
            trips: Math.floor(Math.random() * 200) + 10 
          };
        });
        
        quotedDrivers.sort((a, b) => a.calculated_quote - b.calculated_quote);
        setAvailableDrivers(quotedDrivers);
      } else { 
        setAvailableDrivers([]); 
      }
    } catch {
        toast.error("Failed to load drivers.");
    } finally { 
      setIsFetchingDrivers(false); 
    }
  };

  const handleSecureDriver = async (driver: Driver) => {
    if (!reviewLoad) return;
    toast.loading("Securing Driver & Processing Escrow...");
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

    try {
      const { error: loadError } = await supabase.from('loads').update({ 
        status: 'in_transit', target_price: driver.calculated_quote, driver_id: driver.id, delivery_pin: generatedPin 
      }).eq('id', reviewLoad.id);
      if (loadError) throw loadError;

      if (driver.email) {
          await fetch('/api/notify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: driver.email, subject: `Job Secured! TR-${reviewLoad.id.toString().substring(0,6)}`,
              body: `Hello,\nYou have been booked for a job by ${userName}!\nProduce: ${reviewLoad.weight_tons}T of ${reviewLoad.specific_crop}\nPayout: KSh ${driver.calculated_quote.toLocaleString()}\nAsk the receiver for the 4-digit Delivery PIN once you arrive.`
            })
          });
      }
      if (userEmail) {
          await fetch('/api/notify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: userEmail, subject: `Your Secure Delivery PIN: ${generatedPin}`,
              body: `Hello ${userName},\nYou secured a driver (${driver.full_name}).\nYOUR SECURE DELIVERY PIN IS: ${generatedPin}\nGive this PIN to the driver ONLY when they deliver your produce.`
            })
          });
      }

      toast.dismiss(); toast.success("Driver Secured!", { description: `Check your dashboard or email for the Delivery PIN.` });
      setReviewLoad(null); fetchMyLoads(userId); 
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to secure driver';
      toast.dismiss(); toast.error("Failed to secure driver", { description: errorMessage });
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Update failed';
      toast.error("Update failed", { description: errorMessage });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleCalculateRoute = async () => {
    if (!loadData.pickupTown && loadData.pickupCoords.lat === 0) { toast.error("Please provide a pickup location."); return; }
    if (!loadData.deliveryTown) { toast.error("Please provide a delivery location."); return; }

    setIsCalculatingRoute(true);
    toast.loading("Analyzing route and calculating distance...");

    try {
        let pLat = loadData.pickupCoords.lat;
        let pLon = loadData.pickupCoords.lon;

        if (pLat === 0 && loadData.pickupTown) {
            const pQuery = encodeURIComponent(`${loadData.pickupTown}, ${loadData.pickupCounty}, Kenya`);
            const pRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${pQuery}&format=json&limit=1`);
            const pData = await pRes.json();
            if (pData && pData.length > 0) { pLat = pData[0].lat; pLon = pData[0].lon; }
        }

        let dLat = 0; let dLon = 0;
        const dQuery = encodeURIComponent(`${loadData.deliveryTown}, ${loadData.deliveryCounty}, Kenya`);
        const dRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${dQuery}&format=json&limit=1`);
        const dData = await dRes.json();
        if (dData && dData.length > 0) { dLat = dData[0].lat; dLon = dData[0].lon; }

        if (!pLat || !dLat) {
            toast.dismiss();
            toast.error("Could not map the exact towns. Please check the spelling or select a larger nearby town.");
            setIsCalculatingRoute(false);
            return;
        }

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pLon},${pLat};${dLon},${dLat}?overview=false`;
        const osrmResponse = await fetch(osrmUrl);
        const osrmData = await osrmResponse.json();

        if (osrmData.code === 'Ok' && osrmData.routes.length > 0) {
            const distanceInKm = Math.round(osrmData.routes[0].distance / 1000);
            setLoadData(prev => ({ 
              ...prev, 
              calculatedDistance: distanceInKm,
              pickupCoords: {lat: pLat, lon: pLon},
              dropoffCoords: {lat: dLat, lon: dLon}
            }));
            toast.dismiss();
            toast.success("Route Calculated Successfully!");
        } else {
            toast.dismiss();
            toast.error("Could not find a driving route between these locations.");
        }
    } catch (error) {
        toast.dismiss();
        toast.error("Network Error. Please try again.");
    }
    setIsCalculatingRoute(false);
  };

  const handlePostLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    // FORMAT THE DATE AND TIME INTO THE LOCATION STRING FOR THE DRIVER
    const timeString = `📅 ${loadData.pickupDate} ⏰ ${loadData.pickupTime}`;
    const pLoc = `${loadData.pickupTown}, ${loadData.pickupCounty} | ${timeString}${loadData.pickupLandmark ? ` | Directions: ${loadData.pickupLandmark}` : ''}`;
    
    const dLoc = loadData.deliveryLandmark ? `${loadData.deliveryTown}, ${loadData.deliveryCounty} - Directions: ${loadData.deliveryLandmark}` : `${loadData.deliveryTown}, ${loadData.deliveryCounty}`;
    
    const payload = {
      farmer_id: userId, crop_category: loadData.cropCategory, specific_crop: loadData.specificCrop,
      packaging: loadData.packaging, weight_tons: loadData.weight, needs_loaders: loadData.needsLoaders,
      pickup_location: pLoc, dropoff_location: dLoc,
      calculated_distance: loadData.calculatedDistance, status: 'pending_driver',
      pricing_strategy: 'market_algo', receiver_phone: loadData.receiverPhone
    };

    const { error } = await supabase.from('loads').insert([payload]);
    if (error) { toast.error("Database Error", {description: error.message}); return; }
    
    if (userEmail) {
        await fetch('/api/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: userEmail,
            subject: `Request Posted: ${loadData.weight}T of ${loadData.specificCrop}`,
            body: `Hello ${userName},\n\nYour transport request has been posted to the instant marketplace. You can now view auto-calculated quotes from verified drivers in your area.\n\nBest,\nThe Agrimove Team`
          })
        });
    }

    fetchMyLoads(userId);
    setIsWizardOpen(false); setWizardStep(1);
    toast.success("Request Created!", { description: "Click 'View Drivers' to secure a transporter instantly."});
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
        setLoadData(prev => ({
          ...prev, 
          pickupTown: "GPS Coordinates", 
          pickupCounty: "Current Location",
          pickupCoords: { lat: position.coords.latitude, lon: position.coords.longitude }
        }));
        toast.success("Pickup GPS Locked!");
        setIsLocatingGPS(false);
      },
      () => { toast.error("Allow location access."); setIsLocatingGPS(false); }
    );
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) { toast.error("Enter a valid amount."); return; }
    if (!depositPhone || depositPhone.length < 9) { toast.error("Enter a valid M-Pesa number."); return; }
    toast.loading(`Sending M-Pesa Prompt to ${depositPhone}...`);
    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: depositAmount, phone: depositPhone })
      });
      const data = await res.json();
      if (data.success) {
        toast.dismiss(); toast.success("STK Push Sent!"); setIsDepositOpen(false); setDepositAmount(''); setDepositPhone('');
      } else { toast.dismiss(); toast.error("M-Pesa Failed", { description: data.error }); }
    } catch (error) { toast.dismiss(); toast.error("System Error"); }
  };

  const totalRequests = activeLoads.length;
  const pendingRequests = activeLoads.filter(l => l.status === 'pending_driver').length;
  const deliveredRequests = activeLoads.filter(l => l.status === 'delivered').length;
  const activeDriversCount = new Set(activeLoads.filter(l => l.driver_id).map(l => l.driver_id)).size;
  const inTransitLoads = activeLoads.filter(l => l.status === 'in_transit');

  return (
    <div className={`flex h-screen bg-[#F8FAFC] font-sans text-gray-800 ${inter.variable} ${montserrat.variable} overflow-hidden`}>
      <Toaster position="bottom-right" richColors />

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
          <button onClick={() => setActiveTab('messages')} className={`w-full flex items-center justify-between px-3 py-2.5 font-semibold rounded-lg transition text-sm ${activeTab === 'messages' ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-500' : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
              Messages
            </div>
            {inTransitLoads.length > 0 && <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-[10px]">{inTransitLoads.length}</span>}
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
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className={`${montserrat.className} text-3xl font-black text-gray-900 tracking-tight`}>Welcome back, {userName}! 👋</h2>
                  <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s happening with your farm transport today.</p>
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
                            const isInTransit = load.status === 'in_transit';
                            
                            return (
                              <tr key={load.id} className={`transition ${isPending ? 'hover:bg-amber-50/30' : 'hover:bg-gray-50/50'}`}>
                                <td className="px-5 py-4 align-middle">
                                  <p className="font-bold text-gray-900 capitalize whitespace-nowrap">{load.specific_crop}</p>
                                  <p className="text-gray-400 text-xs font-medium mt-0.5 whitespace-nowrap">{load.weight_tons} Tons</p>
                                </td>
                                <td className="px-5 py-4 align-middle">
                                  <p className="font-semibold text-gray-700 truncate max-w-[180px]">{load.pickup_location.split(' |')[0]}</p>
                                  <p className="text-xs text-gray-400 truncate max-w-[180px] mt-0.5">→ {load.dropoff_location.split(',')[0]}</p>
                                </td>
                                <td className="px-5 py-4 align-middle">
                                  {isPending ? (
                                    <span className="font-bold text-amber-500 text-[10px] tracking-widest uppercase whitespace-nowrap">AWAITING DRIVER</span>
                                  ) : (
                                    <div>
                                      <p className="font-semibold text-gray-800 truncate max-w-[130px] whitespace-nowrap">{load.driver_id ? driverNames[load.driver_id] : 'Assigned Driver'}</p>
                                    </div>
                                  )}
                                </td>
                                <td className="px-5 py-4 align-middle">
                                  {isPending ? (
                                    <span className="inline-block whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                      OPEN MARKET
                                    </span>
                                  ) : isInTransit ? (
                                    <div className="flex flex-col gap-1">
                                      <span className="inline-block w-fit whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider bg-purple-600 text-white shadow-sm">
                                        IN TRANSIT
                                      </span>
                                      <span className="inline-block w-fit whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest bg-gray-100 text-gray-800 border border-gray-200">
                                        PIN: {load.delivery_pin}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="inline-block whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      DELIVERED
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-right align-middle">
                                  {isPending ? (
                                    <button onClick={() => handleOpenMarketplace(load)} className="text-amber-700 font-bold text-[11px] uppercase tracking-wider bg-amber-100 hover:bg-amber-500 hover:text-white px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap">
                                      View Drivers
                                    </button>
                                  ) : isInTransit ? (
                                    <button className="text-gray-400 hover:text-emerald-600 p-2 transition cursor-not-allowed opacity-50" title="Driver will complete job using the PIN">
                                      <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
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

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col h-full">
                  <h3 className="font-bold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="flex-1 bg-gray-50/50 border border-dashed border-gray-200 rounded-xl p-4 overflow-y-auto space-y-4 max-h-[300px]">
                    {activeLoads.length === 0 ? (
                      <p className="text-sm font-medium text-gray-500 text-center py-8">No recent activity on your account.</p>
                    ) : (
                      activeLoads.slice(0, 4).map((load, i) => (
                        <div key={i} className="flex gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${load.status === 'pending_driver' ? 'bg-amber-400' : load.status === 'in_transit' ? 'bg-purple-500' : 'bg-emerald-500'}`}></div>
                          <div>
                            <p className="text-sm text-gray-800 font-medium">
                              {load.status === 'pending_driver' 
                                ? `You posted a request for ${load.weight_tons}T of ${load.specific_crop}.` 
                                : load.status === 'in_transit' ? `Secured driver for ${load.specific_crop} to ${load.dropoff_location.split(',')[0]}.`
                                : `Delivery confirmed for ${load.specific_crop}.`}
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

          {/* TAB 2: MY REQUESTS */}
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
                        const isInTransit = load.status === 'in_transit';
                        return (
                          <tr key={load.id} className="hover:bg-gray-50/50 transition">
                            <td className="px-5 py-4 align-middle">
                              <p className="font-bold text-gray-900 capitalize whitespace-nowrap">{load.specific_crop}</p>
                              <p className="text-gray-400 text-xs font-medium mt-0.5 whitespace-nowrap">{load.weight_tons} Tons</p>
                            </td>
                            <td className="px-5 py-4 align-middle">
                              <p className="font-semibold text-gray-700 truncate max-w-[180px]">{load.pickup_location.split(' |')[0]}</p>
                              <p className="text-xs text-gray-400 truncate max-w-[180px] mt-0.5">→ {load.dropoff_location.split(',')[0]}</p>
                            </td>
                            <td className="px-5 py-4 align-middle">
                              {isPending ? (
                                <span className="font-bold text-amber-500 text-[10px] tracking-widest uppercase whitespace-nowrap">-</span>
                              ) : (
                                <div>
                                  <p className="font-semibold text-gray-800 truncate max-w-[130px] whitespace-nowrap">{load.driver_id ? driverNames[load.driver_id] : 'Assigned Driver'}</p>
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 align-middle">
                              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider whitespace-nowrap ${load.status === 'pending_driver' ? 'bg-amber-100 text-amber-800' : load.status === 'in_transit' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                                {load.status.replace('_', ' ').toUpperCase()}
                              </span>
                              {isInTransit && (
                                <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-black tracking-widest bg-gray-100 text-gray-800 border border-gray-200">
                                  PIN: {load.delivery_pin}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right align-middle">
                              {isPending && (
                                <button onClick={() => handleOpenMarketplace(load)} className="text-amber-700 font-bold text-[11px] uppercase tracking-wider bg-amber-100 hover:bg-amber-500 hover:text-white px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap">
                                  View Drivers
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

          {/* TAB 3: LIVE MESSAGES */}
          {activeTab === 'messages' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex overflow-hidden h-[600px] animate-in fade-in duration-300">
              <div className="w-1/3 border-r border-gray-100 bg-gray-50/30 flex flex-col">
                <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">Active Chats</h3></div>
                <div className="flex-1 overflow-y-auto">
                  {inTransitLoads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center opacity-50 p-8">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">💬</div>
                      <p className="text-sm font-bold text-gray-600">No active chats</p>
                      <p className="text-xs text-gray-400 mt-1">Chats appear here when you secure a driver.</p>
                    </div>
                  ) : (
                    inTransitLoads.map(load => (
                      <div 
                        key={load.id} 
                        onClick={() => setActiveChatLoad(load)}
                        className={`p-4 border-b border-gray-100 cursor-pointer flex items-center gap-3 transition ${activeChatLoad?.id === load.id ? 'bg-emerald-50/80 border-l-4 border-l-emerald-500' : 'hover:bg-gray-50'}`}
                      >
                          <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {(load.driver_id ? driverNames[load.driver_id] : 'D').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 overflow-hidden">
                              <p className="font-bold text-gray-900 text-sm truncate">{load.driver_id ? driverNames[load.driver_id] : 'Transporter'}</p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">TR-{load.id.toString().substring(0,4)} • {load.specific_crop}</p>
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
                            <h3 className="font-bold text-gray-900">{activeChatLoad.driver_id ? driverNames[activeChatLoad.driver_id] : 'Transporter'}</h3>
                            <div className="flex items-center gap-3 mt-0.5">
                              <p className="text-xs text-emerald-600 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Tracking Active</p>
                              <p className="text-[10px] font-black tracking-widest bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md border border-purple-200">PIN: {activeChatLoad.delivery_pin}</p>
                            </div>
                        </div>
                        <a 
                          href={`tel:${activeChatLoad?.driver_id ? driverPhones[activeChatLoad.driver_id] : ''}`} 
                          onClick={(e) => {
                            if(!activeChatLoad.driver_id || !driverPhones[activeChatLoad.driver_id]){
                                e.preventDefault();
                                toast.error("Driver hasn't provided a phone number.");
                            } else {
                                toast.info("Opening Phone Dialer...", { description: "Calling the assigned Transporter." });
                            }
                          }}
                          className="text-emerald-600 hover:text-emerald-700 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-lg transition border border-emerald-100 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                          Call Driver
                        </a>
                    </div>
                    
                    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/30">
                        {messages.map(msg => {
                          const isMe = msg.sender_id === userId;
                          return (
                            <div key={msg.id} className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className={`px-4 py-3 max-w-[80%] text-sm shadow-sm ${isMe ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-none'}`}>
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
                              placeholder="Type a message to the driver..." 
                              className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3.5 text-sm outline-none focus:border-emerald-500 transition" 
                            />
                            <button type="submit" disabled={!newMessage.trim()} className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center hover:bg-emerald-700 transition shadow-md flex-shrink-0 disabled:opacity-50">
                                <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                            </button>
                        </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
                    <svg className="w-16 h-16 text-emerald-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Your Messages</h2>
                    <p className="text-gray-500 text-sm max-w-md mx-auto">Select an active trip from the sidebar to start chatting with your driver.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS (Upgraded UI) */}
          {activeTab === 'settings' && (
            <div className="max-w-4xl bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-5 bg-gray-50/50">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-700 font-black text-3xl rounded-2xl flex items-center justify-center shadow-inner border border-emerald-200 flex-shrink-0">
                  {userName ? userName.charAt(0) : 'U'}
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-2xl tracking-tight">Account Settings</h3>
                  <p className="text-sm text-gray-500 font-medium mt-1.5 flex flex-wrap items-center gap-2">
                    Manage your personal and farm details. 
                    <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Verified Farmer
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
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Full Name / Farm Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-gray-900 font-bold transition shadow-sm" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        </div>
                        <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="07XX XXX XXX" className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-gray-900 font-bold transition shadow-sm" />
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
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Secure Escrow Wallet ID</label>
                      <div className="relative opacity-70">
                         <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <input type="text" value={`AGR-${userId.substring(0,8).toUpperCase()}`} disabled className="w-full pl-12 pr-4 py-4 bg-gray-100 border-2 border-gray-200 rounded-xl outline-none text-gray-700 font-mono font-bold tracking-wider" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-6">
                  <p className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Your data is secured by Supabase.
                  </p>
                  <button type="submit" disabled={isSavingSettings} className="w-full sm:w-auto px-10 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition shadow-lg shadow-emerald-500/30 disabled:opacity-50 text-sm">
                    {isSavingSettings ? 'Saving Changes...' : 'Save Profile Changes'}
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
              <input type="text" value={depositPhone} onChange={e=>setDepositPhone(e.target.value)} className="w-full text-lg font-bold p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-gray-900 transition mb-6" placeholder="07XX XXX XXX" />

              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Amount (KSH)</label>
              <input type="number" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} className="w-full text-3xl font-black p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-emerald-800 transition mb-6" placeholder="10,000" />
            </div>

            <div className="p-6 border-t border-gray-100">
              <button onClick={handleDeposit} className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-md hover:bg-emerald-600 transition">Send M-Pesa Prompt</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW INSTANT MARKETPLACE DRAWER */}
      {reviewLoad && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setReviewLoad(null)}></div>
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
              <div>
                <h2 className={`${montserrat.className} text-xl font-black text-gray-900`}>Instant Auto-Quotes</h2>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mt-1">TR-{reviewLoad.id.toString().substring(0,6)} • {reviewLoad.calculated_distance} KM</p>
              </div>
              <button onClick={() => setReviewLoad(null)} className="w-8 h-8 bg-gray-50 text-gray-500 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-2">
                <p className="text-xs font-medium text-emerald-800">The system has calculated these fixed-price offers based on the distance and load weight using the drivers&apos; current base rates.</p>
              </div>

              {isFetchingDrivers ? (
                <div className="flex justify-center py-10"><svg className="animate-spin h-8 w-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
              ) : availableDrivers.length === 0 ? (
                <div className="text-center py-10 opacity-60">
                  <p className="text-gray-500 font-bold">No verified drivers in your region yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Please try again later.</p>
                </div>
              ) : (
                availableDrivers.map((driver) => (
                  <div key={driver.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-300 transition">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 font-black rounded-full flex items-center justify-center">
                          {driver.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{driver.full_name}</h4>
                          <p className="text-xs font-bold text-amber-500 flex items-center gap-1 mt-0.5">
                            ⭐ {driver.rating} <span className="text-gray-300 mx-1">•</span> {driver.trips} trips
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center mb-4">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Guaranteed Price</p>
                      <p className={`${montserrat.className} text-2xl font-black text-gray-900`}>KSh {driver.calculated_quote.toLocaleString()}</p>
                    </div>

                    <button 
                      onClick={() => handleSecureDriver(driver)}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow-md shadow-emerald-500/20 text-sm"
                    >
                      Secure Driver via Escrow
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- THE NEW FORM WIZARD (NO MAP, WITH AUTOCOMPLETE) --- */}
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
                  <input type="text" placeholder="Search crop..." onChange={e=>setCropSearchQuery(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm shadow-sm" />
                  <div className="grid gap-4">
                    {cropCategories.map(cat => (
                      <div key={cat.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{cat.icon} {cat.name}</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {cat.crops.filter((c: string) => c.toLowerCase().includes(cropSearchQuery.toLowerCase())).map((crop: string) => (
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

                  {/* DATE & TIME SECTION */}
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Scheduled Pickup Date & Time</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                         <input type="date" value={loadData.pickupDate} onChange={e => setLoadData({...loadData, pickupDate: e.target.value})} className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-gray-900 font-bold transition shadow-sm" />
                      </div>
                      <div>
                         <input type="time" value={loadData.pickupTime} onChange={e => setLoadData({...loadData, pickupTime: e.target.value})} className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-gray-900 font-bold transition shadow-sm" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Receiver&apos;s Phone Number</label>
                    <p className="text-xs text-gray-400 mb-3 ml-1">We will text the secure 4-digit Delivery PIN to this number.</p>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      </div>
                      <input 
                        type="text" 
                        value={loadData.receiverPhone} 
                        onChange={e => setLoadData({...loadData, receiverPhone: e.target.value})} 
                        placeholder="e.g. 0712 345 678 or +254 712 345 678" 
                        className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 rounded-xl outline-none focus:bg-white text-gray-900 font-bold transition shadow-sm ${loadData.receiverPhone.length > 0 && !isValidKenyanPhone(loadData.receiverPhone) ? 'border-red-300 focus:border-red-500' : 'border-gray-100 focus:border-emerald-500'}`} 
                      />
                    </div>
                    {loadData.receiverPhone.length > 0 && !isValidKenyanPhone(loadData.receiverPhone) && (
                        <p className="text-xs text-red-500 mt-2 font-bold ml-1">Please enter a valid Kenyan phone number.</p>
                    )}
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-6">
                  
                  {/* DATALISTS FOR AUTOCOMPLETE */}
                  <datalist id="countyList">
                    {Object.keys(kenyaLocations).map(c => <option key={c} value={c} />)}
                  </datalist>
                  <datalist id="pickupTownList">
                    {loadData.pickupCounty && kenyaLocations[loadData.pickupCounty]?.map(t => <option key={t} value={t} />)}
                  </datalist>
                  <datalist id="deliveryTownList">
                    {loadData.deliveryCounty && kenyaLocations[loadData.deliveryCounty]?.map(t => <option key={t} value={t} />)}
                  </datalist>

                  {/* PICKUP SECTION */}
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm border-b border-gray-100 pb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Pickup Details
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">County</label>
                        <input 
                          type="text"
                          list="countyList"
                          value={loadData.pickupCounty}
                          onChange={e => setLoadData({...loadData, pickupCounty: e.target.value, pickupTown: ''})}
                          placeholder="Type County..."
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 text-sm font-bold text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Town</label>
                        <input 
                          type="text"
                          list="pickupTownList"
                          value={loadData.pickupTown}
                          onChange={e => setLoadData({...loadData, pickupTown: e.target.value, pickupCoords: {lat:0, lon:0}})}
                          placeholder="Type Town..."
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 text-sm font-bold text-gray-800"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Detailed Directions for Driver</label>
                      <textarea 
                        rows={2}
                        value={loadData.pickupLandmark}
                        onChange={e => setLoadData({...loadData, pickupLandmark: e.target.value})}
                        placeholder="e.g. Take the dirt road past the Safaricom mast, third gate on the left." 
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 text-sm font-medium resize-none" 
                      />
                    </div>

                    <div className="flex items-center gap-4 my-2 opacity-50">
                        <div className="h-px bg-gray-300 flex-1"></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">OR</span>
                        <div className="h-px bg-gray-300 flex-1"></div>
                    </div>

                    <button onClick={handleGetGPSLocation} disabled={isLocatingGPS} className="flex bg-emerald-50 text-emerald-700 font-bold text-xs py-3 rounded-lg hover:bg-emerald-100 transition disabled:opacity-50 w-full items-center justify-center gap-2 border border-emerald-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {isLocatingGPS ? 'Locking Satellite Signal...' : (loadData.pickupTown === "GPS Coordinates" ? `✓ Exact GPS Locked` : 'Use Exact Phone GPS')}
                    </button>
                  </div>

                  {/* DROPOFF SECTION */}
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm border-b border-gray-100 pb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span> Delivery Details
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">County</label>
                        <input 
                          type="text"
                          list="countyList"
                          value={loadData.deliveryCounty}
                          onChange={e => setLoadData({...loadData, deliveryCounty: e.target.value, deliveryTown: ''})}
                          placeholder="Type County..."
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 text-sm font-bold text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Town</label>
                        <input 
                          type="text"
                          list="deliveryTownList"
                          value={loadData.deliveryTown}
                          onChange={e => setLoadData({...loadData, deliveryTown: e.target.value})}
                          placeholder="Type Town..."
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 text-sm font-bold text-gray-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Detailed Directions for Drop-off</label>
                      <textarea 
                        rows={2}
                        value={loadData.deliveryLandmark}
                        onChange={e => setLoadData({...loadData, deliveryLandmark: e.target.value})}
                        placeholder="e.g. Enter through the main gate, warehouse on the right." 
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 text-sm font-medium resize-none" 
                      />
                    </div>
                  </div>

                  {/* CALCULATION SECTION */}
                  {loadData.calculatedDistance > 0 ? (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center animate-in zoom-in">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                        <span className="text-xs font-bold text-emerald-800">Total Route Distance</span>
                      </div>
                      <span className="text-lg font-black text-emerald-600">{loadData.calculatedDistance} km</span>
                    </div>
                  ) : (
                    <button 
                      onClick={handleCalculateRoute} 
                      disabled={isCalculatingRoute || (!loadData.pickupTown && loadData.pickupCoords.lat === 0) || !loadData.deliveryTown}
                      className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-xl transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isCalculatingRoute ? (
                         <><svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analyzing Route...</>
                      ) : (
                         <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg> Calculate Route Distance</>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 bg-white z-10">
              {wizardStep > 1 && <button onClick={() => { setWizardStep(wizardStep - 1); setLoadData(prev => ({...prev, calculatedDistance: 0})); }} className="px-6 py-3.5 bg-gray-100 font-bold rounded-xl text-sm transition hover:bg-gray-200">Back</button>}
              {wizardStep < 3 ? (
                <button 
                  onClick={() => setWizardStep(wizardStep + 1)} 
                  disabled={
                    (wizardStep === 1 && !loadData.specificCrop) || 
                    (wizardStep === 2 && (!isValidKenyanPhone(loadData.receiverPhone) || !loadData.pickupDate || !loadData.pickupTime))
                  } 
                  className="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-3.5 rounded-xl text-sm transition disabled:opacity-50 shadow-lg shadow-gray-200"
                >
                  Continue
                </button>
              ) : (
                <button onClick={handlePostLoad} disabled={loadData.calculatedDistance === 0} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-500/30 disabled:opacity-50">Post to Marketplace</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}