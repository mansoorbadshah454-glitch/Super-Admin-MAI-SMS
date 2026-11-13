import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, School, User, Mail, Shield,
    CreditCard, Power, Loader2, Save, Calendar,
    MapPin, Hash, CheckCircle, XCircle, Users, Phone,
    Landmark, Building2, Plus, Trash2, Crown, Sparkles, Bus, Tv,
    DollarSign, SlidersHorizontal, Check, AlertCircle, ArrowLeft
} from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, getDoc, collection, getCountFromServer, setDoc } from 'firebase/firestore';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const SchoolDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { hasPermission, isMasterAdmin } = useAdminAuth();
    const [school, setSchool] = useState(null);
    const [principal, setPrincipal] = useState(null);
    const [stats, setStats] = useState({ total: '...', teachers: '...', parents: '...' });
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [savingBanking, setSavingBanking] = useState(false);
    const [monthlyFee, setMonthlyFee] = useState('');
    const [yearlyFee, setYearlyFee] = useState('');
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [savingPricing, setSavingPricing] = useState(false);
    
    // Windows 7 / XP Tab Navigation State
    const [activeTab, setActiveTab] = useState('general'); // 'general' | 'principal' | 'subscription' | 'banking'

    // Listen to School's banking settings
    useEffect(() => {
        if (!id) return;
        const unsub = onSnapshot(doc(db, `schools/${id}/settings`, 'banking'), (snap) => {
            if (snap.exists()) {
                setBankAccounts(snap.data().accounts || []);
            } else {
                setBankAccounts([]);
            }
        });
        return () => unsub();
    }, [id]);

    const handleBankChange = (index, field, value) => {
        const updated = [...bankAccounts];
        updated[index] = { ...updated[index], [field]: value };
        setBankAccounts(updated);
    };

    const addBankAccount = () => {
        setBankAccounts([
            ...bankAccounts,
            { bankName: '', accountTitle: '', accountNumber: '', iban: '' }
        ]);
    };

    const removeBankAccount = (index) => {
        const updated = bankAccounts.filter((_, i) => i !== index);
        setBankAccounts(updated);
    };

    const handleSaveBanking = async () => {
        setSavingBanking(true);
        try {
            await setDoc(doc(db, `schools/${id}/settings`, 'banking'), {
                accounts: bankAccounts,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            alert("Payment methods saved successfully for " + (school?.name || 'School') + "!");
        } catch (err) {
            console.error("Failed to save banking:", err);
            alert("Error saving banking details: " + err.message);
        } finally {
            setSavingBanking(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        const unsubscribe = onSnapshot(doc(db, "schools", id), async (docSnap) => {
            try {
                if (docSnap.exists()) {
                    const schoolData = { id: docSnap.id, ...docSnap.data() };
                    setSchool(schoolData);
                    setMonthlyFee(schoolData.monthlySubscriptionFee ?? 5000);
                    setYearlyFee(schoolData.yearlySubscriptionFee ?? 50000);
                    setBillingCycle(schoolData.billingCycle || 'monthly');

                    // Fetch principal info (Fail gracefully)
                    if (schoolData.principalId) {
                        try {
                            const principalSnap = await getDoc(doc(db, "global_users", schoolData.principalId));
                            let pData = principalSnap.exists() ? principalSnap.data() : null;

                            const fallbackSnap = await getDoc(doc(db, `schools/${id}/users`, schoolData.principalId));
                            if (fallbackSnap.exists()) {
                                pData = { ...pData, ...fallbackSnap.data() };
                            }
                            setPrincipal(pData);
                        } catch (pError) {
                            console.error("Principal Fetch Error (Non-fatal):", pError);
                        }
                    }

                    // Fetch stats
                    fetchSchoolStats(id);
                } else {
                    console.error("School not found");
                    navigate('/schools');
                }
            } catch (err) {
                console.error("Error processing school data:", err);
                alert("Error processing data: " + err.message);
            } finally {
                setLoading(false);
            }
        }, (error) => {
            console.error("School Query Error:", error);
            alert(`Error loading school: ${error.message}`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id, navigate]);

    const fetchSchoolStats = async (schoolId) => {
        try {
            const studentsRef = collection(db, `schools/${schoolId}/students`);
            const totalSnapshot = await getCountFromServer(studentsRef);
            const total = totalSnapshot.data().count;

            const teachersRef = collection(db, `schools/${schoolId}/teachers`);
            const teachersSnapshot = await getCountFromServer(teachersRef);
            const teachers = teachersSnapshot.data().count;

            const parentsRef = collection(db, `schools/${schoolId}/parents`);
            const parentsSnapshot = await getCountFromServer(parentsRef);
            const parents = parentsSnapshot.data().count;

            setStats({ total, teachers, parents });
        } catch (error) {
            console.error("Error fetching stats:", error);
            setStats(prev => ({ ...prev, total: 0, teachers: 0, parents: 0 }));
        }
    };

    const handleTogglePayment = async () => {
        if (!isMasterAdmin && !hasPermission('manageBilling')) {
            alert("Permission Denied: You do not have permission to manage billing.");
            return;
        }
        setUpdating(true);
        try {
            const newStatus = school.paymentStatus === 'paid' ? 'unpaid' : 'paid';
            await updateDoc(doc(db, "schools", id), {
                paymentStatus: newStatus,
                updatedAt: new Date()
            });
        } catch (error) {
            alert("Failed to update payment status: " + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleSaveSubscriptionPricing = async () => {
        if (!isMasterAdmin && !hasPermission('manageBilling')) {
            alert("Permission Denied: You do not have permission to manage billing pricing.");
            return;
        }
        setSavingPricing(true);
        try {
            await updateDoc(doc(db, "schools", id), {
                monthlySubscriptionFee: Number(monthlyFee) || 0,
                yearlySubscriptionFee: Number(yearlyFee) || 0,
                billingCycle: billingCycle,
                updatedAt: new Date()
            });
            alert("School subscription pricing updated successfully!");
        } catch (err) {
            console.error("Error updating subscription pricing:", err);
            alert("Failed to update pricing: " + err.message);
        } finally {
            setSavingPricing(false);
        }
    };

    const handlePackageUpdate = async (newPackage) => {
        setUpdating(true);
        try {
            const defaultModules = newPackage === 'premium'
                ? { transport: true, surveillance: true, paperGenerator: true, store: true }
                : { transport: false, surveillance: false, paperGenerator: false, store: false };
            await updateDoc(doc(db, "schools", id), {
                package: newPackage,
                modules: defaultModules,
                updatedAt: new Date()
            });
        } catch (error) {
            alert("Failed to update subscription package: " + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleModuleToggle = async (moduleKey) => {
        setUpdating(true);
        try {
            const currentModules = school.modules || {
                transport: school.package === 'premium',
                surveillance: school.package === 'premium',
                paperGenerator: school.package === 'premium',
                store: school.package === 'premium',
            };
            const updatedModules = {
                ...currentModules,
                [moduleKey]: !currentModules[moduleKey]
            };
            await updateDoc(doc(db, "schools", id), {
                modules: updatedModules,
                updatedAt: new Date()
            });
        } catch (error) {
            alert("Failed to update module: " + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleToggleSystemStatus = async () => {
        if (!isMasterAdmin && !hasPermission('systemControl')) {
            alert("Permission Denied: You do not have permission to start/stop school systems.");
            return;
        }
        setUpdating(true);
        try {
            const newStatus = school.status === 'active' ? 'suspended' : 'active';
            await updateDoc(doc(db, "schools", id), {
                status: newStatus,
                updatedAt: new Date()
            });
        } catch (error) {
            alert("Failed to update system status: " + error.message);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div style={{ height: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <Loader2 className="animate-spin" size={36} color="#2563EB" />
                <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>Loading School Console...</span>
            </div>
        );
    }

    const isSuspended = school?.status === 'suspended';
    const isPaid = school?.paymentStatus === 'paid';

    return (
        <div className="animate-in fade-in duration-300" style={{ maxWidth: '1100px', margin: '0 auto', fontFamily: "'Segoe UI', Tahoma, Verdana, sans-serif" }}>
            <style>{`
                .win-btn {
                    font-family: inherit;
                    font-size: 12.5px;
                    font-weight: 600;
                    padding: 6px 14px;
                    border-radius: 4px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    border: 1px solid #CBD5E1;
                    background: #FFFFFF;
                    color: #334155;
                    transition: all 0.15s ease;
                }
                .win-btn:hover {
                    background: #F1F5F9;
                    border-color: #94A3B8;
                }
                .win-tab {
                    padding: 9px 18px;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    border-top: 2px solid transparent;
                    border-bottom: 2px solid transparent;
                    color: #64748B;
                    transition: all 0.15s ease;
                    user-select: none;
                }
                .win-tab-active {
                    color: #1D4ED8;
                    border-bottom: 2px solid #2563EB;
                    background-color: #EFF6FF;
                }
                .win-tab:hover:not(.win-tab-active) {
                    color: #1E293B;
                    background-color: #F8FAFC;
                }
                .win-fieldset {
                    border: 1px solid #CBD5E1;
                    border-radius: 6px;
                    padding: 16px 18px;
                    margin-bottom: 16px;
                    background: #FFFFFF;
                }
                .win-legend {
                    font-size: 12px;
                    font-weight: 700;
                    color: #1E40AF;
                    padding: 0 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .win-input {
                    width: 100%;
                    box-sizing: border-box;
                    background: #FFFFFF;
                    border: 1px solid #94A3B8;
                    border-radius: 3px;
                    padding: 6px 10px;
                    font-size: 13px;
                    color: #1E293B;
                    outline: none;
                    font-family: inherit;
                }
                .win-input:focus {
                    border-color: #2563EB;
                    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
                }
            `}</style>

            {/* 1. TOP WINDOWS EXPLORER COMMAND BAR */}
            <div
                style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '12px 18px',
                    marginBottom: '1rem',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}
            >
                {/* Left: Back Button & Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <button
                        onClick={() => navigate('/schools')}
                        className="win-btn"
                        title="Back to Schools Directory"
                        style={{ padding: '6px 10px' }}
                    >
                        <ChevronLeft size={16} /> Back
                    </button>

                    {(() => {
                        const isDemo = school?.id === 'SCHOOL_6257' || school?.schoolId === 'SCHOOL_6257' || school?.isDemo === true;
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    background: isDemo ? 'linear-gradient(135deg, #8B5CF6, #6D28D9)' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#FFFFFF'
                                }}>
                                    <School size={20} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: isDemo ? '#5B21B6' : '#0F172A' }}>
                                            {school.name || school.schoolName || 'Unnamed School'}
                                        </h2>
                                        <span style={{
                                            fontSize: '11px',
                                            fontFamily: 'monospace',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            backgroundColor: isDemo ? '#F3E8FF' : '#F1F5F9',
                                            color: isDemo ? '#6D28D9' : '#475569',
                                            border: isDemo ? '1px solid #DDD6FE' : '1px solid #CBD5E1'
                                        }}>
                                            ID: {school.id}
                                        </span>
                                        {isDemo && (
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: '800',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                backgroundColor: '#EDE9FE',
                                                color: '#6D28D9',
                                                border: '1px solid #DDD6FE',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8B5CF6' }} />
                                                Demo Acc
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                                        <MapPin size={12} style={{ color: isDemo ? '#7C3AED' : '#2563EB' }} />
                                        <span>{school.city || school.district || 'City N/A'}, {school.state || 'Province N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Right: Quick Action Controls Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* System Status Pill & Toggle */}
                    <span style={{
                        padding: '4px 9px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        backgroundColor: isSuspended ? '#FEE2E2' : '#DEF7EC',
                        color: isSuspended ? '#991B1B' : '#03543F',
                        border: isSuspended ? '1px solid #FCA5A5' : '1px solid #84E1BC'
                    }}>
                        {isSuspended ? 'Suspended' : 'Active'}
                    </span>

                    <button
                        onClick={handleToggleSystemStatus}
                        disabled={updating}
                        className="win-btn"
                        style={{
                            color: isSuspended ? '#059669' : '#DC2626',
                            borderColor: isSuspended ? '#A7F3D0' : '#FECACA',
                            backgroundColor: isSuspended ? '#ECFDF5' : '#FEF2F2'
                        }}
                    >
                        <Power size={14} />
                        {isSuspended ? 'Start System' : 'Stop System'}
                    </button>

                    {/* Payment Pill & Toggle */}
                    <span style={{
                        padding: '4px 9px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        backgroundColor: isPaid ? '#DEF7EC' : '#FEF08A',
                        color: isPaid ? '#03543F' : '#854D0E',
                        border: isPaid ? '1px solid #84E1BC' : '1px solid #FDE047'
                    }}>
                        {school.paymentStatus || 'unpaid'}
                    </span>

                    <button
                        onClick={handleTogglePayment}
                        disabled={updating}
                        className="win-btn"
                        style={{
                            color: isPaid ? '#D97706' : '#059669',
                            borderColor: isPaid ? '#FDE68A' : '#A7F3D0',
                            backgroundColor: isPaid ? '#FFFBEB' : '#ECFDF5'
                        }}
                    >
                        <CreditCard size={14} />
                        {isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                    </button>
                </div>
            </div>

            {/* 2. WINDOWS MANAGEMENT CONSOLE CARD */}
            <div
                style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    overflow: 'hidden'
                }}
            >
                {/* Console Navigation Tabs */}
                <div
                    style={{
                        display: 'flex',
                        borderBottom: '1px solid #CBD5E1',
                        backgroundColor: '#F8FAFC',
                        overflowX: 'auto'
                    }}
                >
                    <div
                        onClick={() => setActiveTab('general')}
                        className={`win-tab ${activeTab === 'general' ? 'win-tab-active' : ''}`}
                    >
                        <School size={16} /> 1. Campus Profile & Stats
                    </div>

                    <div
                        onClick={() => setActiveTab('principal')}
                        className={`win-tab ${activeTab === 'principal' ? 'win-tab-active' : ''}`}
                    >
                        <Shield size={16} /> 2. Principal Administrative Info
                    </div>

                    <div
                        onClick={() => setActiveTab('subscription')}
                        className={`win-tab ${activeTab === 'subscription' ? 'win-tab-active' : ''}`}
                    >
                        <Crown size={16} /> 3. Subscription Tier & Modules
                    </div>

                    <div
                        onClick={() => setActiveTab('banking')}
                        className={`win-tab ${activeTab === 'banking' ? 'win-tab-active' : ''}`}
                    >
                        <Landmark size={16} /> 4. Fee Banking Accounts
                    </div>
                </div>

                {/* Tab Body Content Area */}
                <div style={{ padding: '20px' }}>
                    {/* TAB 1: General Profile & Statistics */}
                    {activeTab === 'general' && (
                        <div>
                            {/* 3 Metric Tiles (Students, Teachers, Parents) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                                <div style={{
                                    backgroundColor: '#EFF6FF',
                                    border: '1px solid #BFDBFE',
                                    borderRadius: '6px',
                                    padding: '14px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#1E40AF', textTransform: 'uppercase' }}>Total Students</div>
                                        <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#1E3A8A' }}>
                                            {typeof stats.total === 'number' ? stats.total.toLocaleString() : (stats.total || '...')}
                                        </div>
                                    </div>
                                    <div style={{ padding: '10px', borderRadius: '6px', background: '#DBEAFE', color: '#1D4ED8' }}>
                                        <Users size={22} />
                                    </div>
                                </div>

                                <div style={{
                                    backgroundColor: '#FDF2F8',
                                    border: '1px solid #FBCFE8',
                                    borderRadius: '6px',
                                    padding: '14px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#9D174D', textTransform: 'uppercase' }}>Total Teachers</div>
                                        <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#831843' }}>
                                            {typeof stats.teachers === 'number' ? stats.teachers.toLocaleString() : (stats.teachers || '0')}
                                        </div>
                                    </div>
                                    <div style={{ padding: '10px', borderRadius: '6px', background: '#FCE7F3', color: '#BE185D' }}>
                                        <User size={22} />
                                    </div>
                                </div>

                                <div style={{
                                    backgroundColor: '#FFFBEB',
                                    border: '1px solid #FDE68A',
                                    borderRadius: '6px',
                                    padding: '14px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#92400E', textTransform: 'uppercase' }}>Total Parents</div>
                                        <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#78350F' }}>
                                            {typeof stats.parents === 'number' ? stats.parents.toLocaleString() : (stats.parents || '0')}
                                        </div>
                                    </div>
                                    <div style={{ padding: '10px', borderRadius: '6px', background: '#FEF3C7', color: '#B45309' }}>
                                        <Users size={22} />
                                    </div>
                                </div>
                            </div>

                            {/* Campus Details Fieldset */}
                            <fieldset className="win-fieldset">
                                <legend className="win-legend">Campus Profile & Geographic Location</legend>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                                    <SimpleInfoItem label="School Name" value={school.name || school.schoolName || 'N/A'} icon={School} />
                                    <SimpleInfoItem label="School ID (Firestore)" value={school.id} icon={Hash} isCode />
                                    <SimpleInfoItem label="State / Province" value={school.state || 'Not Specified'} icon={Landmark} />
                                    <SimpleInfoItem label="District" value={school.district || 'Not Specified'} icon={Building2} />
                                    <SimpleInfoItem label="City / Tehsil" value={school.city || 'Not Specified'} icon={MapPin} />
                                    <SimpleInfoItem label="Official Phone" value={school.contact || 'Not Provided'} icon={Phone} />
                                    <SimpleInfoItem
                                        label="Registered Date"
                                        value={school.createdAt?.toDate ? school.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                        icon={Calendar}
                                    />
                                    <SimpleInfoItem
                                        label="System Access Status"
                                        value={isSuspended ? 'Suspended (Locked)' : 'Active (Operational)'}
                                        icon={isSuspended ? XCircle : CheckCircle}
                                        valueColor={isSuspended ? '#DC2626' : '#16A34A'}
                                    />
                                </div>

                                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                                        Full Physical Campus Address
                                    </span>
                                    <span style={{ fontSize: '13px', color: '#1E293B', fontWeight: '500' }}>
                                        {school.address || 'No physical address provided.'}
                                    </span>
                                </div>
                            </fieldset>
                        </div>
                    )}

                    {/* TAB 2: Principal Administrator */}
                    {activeTab === 'principal' && (
                        <div>
                            <fieldset className="win-fieldset">
                                <legend className="win-legend">School Administrator & Contact Details</legend>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                                    <SimpleInfoItem label="Principal Name" value={principal?.name || school.principalName || 'Not Set'} icon={User} />
                                    <SimpleInfoItem label="Official Email Address" value={principal?.email || school.principalEmail || 'N/A'} icon={Mail} />
                                    <SimpleInfoItem label="Principal Mobile" value={principal?.contact || school.principalContact || 'Not Provided'} icon={Phone} />
                                    <SimpleInfoItem label="Vice Principal Contact" value={school.vicePrincipalContact || 'Not Provided'} icon={Phone} />
                                    <SimpleInfoItem label="Campus Landline" value={school.landline || 'Not Provided'} icon={Phone} />
                                    <SimpleInfoItem label="Principal UID" value={school.principalId || 'N/A'} icon={Hash} isCode />
                                    <SimpleInfoItem
                                        label="Profile Last Updated"
                                        value={school.updatedAt?.toDate ? school.updatedAt.toDate().toLocaleDateString() : 'N/A'}
                                        icon={Calendar}
                                    />
                                </div>
                            </fieldset>
                        </div>
                    )}

                    {/* TAB 3: Subscription & Modules */}
                    {activeTab === 'subscription' && (
                        <div>
                            {/* Tier Selection */}
                            <fieldset className="win-fieldset">
                                <legend className="win-legend">SaaS Deployment Tier</legend>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    {/* Standard Tier */}
                                    <div
                                        onClick={() => !updating && handlePackageUpdate('standard')}
                                        style={{
                                            border: school.package !== 'premium' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                            backgroundColor: school.package !== 'premium' ? '#EFF6FF' : '#FFFFFF',
                                            borderRadius: '6px',
                                            padding: '12px 16px',
                                            cursor: updating ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#1E3A8A' }}>Standard Tier</span>
                                            <Sparkles size={16} color="#2563EB" />
                                        </div>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                                            Core Student LMS, Fee Management, Attendance, Timetable & Notices.
                                        </p>
                                    </div>

                                    {/* Premium Pro Tier */}
                                    <div
                                        onClick={() => !updating && handlePackageUpdate('premium')}
                                        style={{
                                            border: school.package === 'premium' ? '2px solid #D97706' : '1px solid #CBD5E1',
                                            backgroundColor: school.package === 'premium' ? '#FFFBEB' : '#FFFFFF',
                                            borderRadius: '6px',
                                            padding: '12px 16px',
                                            cursor: updating ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#92400E' }}>Premium Pro ⭐</span>
                                            <Crown size={16} color="#D97706" />
                                        </div>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                                            All Core Features + Real-time Fleet GPS Van Tracking + Live CCTV Streams.
                                        </p>
                                    </div>
                                </div>
                            </fieldset>

                            {/* Add-on Module Switches */}
                            <fieldset className="win-fieldset">
                                <legend className="win-legend">Hardware & IoT Modules</legend>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {/* Transport Module */}
                                    <div
                                        onClick={() => !updating && handleModuleToggle('transport')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '10px 14px',
                                            backgroundColor: (school.modules?.transport ?? (school.package === 'premium')) ? '#F0FDF4' : '#F8FAFC',
                                            border: (school.modules?.transport ?? (school.package === 'premium')) ? '1px solid #86EFAC' : '1px solid #CBD5E1',
                                            borderRadius: '4px',
                                            cursor: updating ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ padding: '6px', borderRadius: '4px', background: '#FEF3C7', color: '#D97706' }}>
                                                <Bus size={17} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1F2937' }}>Transport & Van Fleet GPS Hub</div>
                                                <div style={{ fontSize: '11.5px', color: '#6B7280' }}>Real-time school bus tracking and parent route notifications</div>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={!!(school.modules?.transport ?? (school.package === 'premium'))}
                                            onChange={() => {}}
                                            style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#16A34A' }}
                                        />
                                    </div>

                                    {/* CCTV Module */}
                                    <div
                                        onClick={() => !updating && handleModuleToggle('surveillance')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '10px 14px',
                                            backgroundColor: (school.modules?.surveillance ?? (school.package === 'premium')) ? '#F0FDF4' : '#F8FAFC',
                                            border: (school.modules?.surveillance ?? (school.package === 'premium')) ? '1px solid #86EFAC' : '1px solid #CBD5E1',
                                            borderRadius: '4px',
                                            cursor: updating ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ padding: '6px', borderRadius: '4px', background: '#E0E7FF', color: '#4F46E5' }}>
                                                <Tv size={17} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1F2937' }}>Live CCTV Campus Surveillance</div>
                                                <div style={{ fontSize: '11.5px', color: '#6B7280' }}>Multi-camera live classroom and entry gate streams</div>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={!!(school.modules?.surveillance ?? (school.package === 'premium'))}
                                            onChange={() => {}}
                                            style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#16A34A' }}
                                        />
                                    </div>
                                </div>
                            </fieldset>

                            {/* Subscription Pricing Rates Editor */}
                            <fieldset className="win-fieldset">
                                <legend className="win-legend">Subscription Billing Rates & Cycle</legend>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                            Active Billing Cycle
                                        </label>
                                        <select
                                            className="win-input"
                                            value={billingCycle}
                                            onChange={(e) => setBillingCycle(e.target.value)}
                                        >
                                            <option value="monthly">Monthly Cycle</option>
                                            <option value="yearly">Yearly Cycle</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                            Monthly Fee (Rs)
                                        </label>
                                        <input
                                            type="number"
                                            className="win-input"
                                            value={monthlyFee}
                                            onChange={(e) => setMonthlyFee(e.target.value)}
                                            placeholder="5000"
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                            Yearly Fee (Rs)
                                        </label>
                                        <input
                                            type="number"
                                            className="win-input"
                                            value={yearlyFee}
                                            onChange={(e) => setYearlyFee(e.target.value)}
                                            placeholder="50000"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSaveSubscriptionPricing}
                                    disabled={savingPricing}
                                    className="win-btn"
                                    style={{
                                        backgroundColor: '#2563EB',
                                        color: '#FFFFFF',
                                        borderColor: '#1D4ED8'
                                    }}
                                >
                                    {savingPricing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Save Pricing Rates
                                </button>
                            </fieldset>
                        </div>
                    )}

                    {/* TAB 4: Fee Banking Accounts */}
                    {activeTab === 'banking' && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#1E293B' }}>Parent App Fee Payment Methods</h4>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                                        These accounts appear when parents click "Pay Fee" inside the mobile app.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={addBankAccount}
                                        className="win-btn"
                                    >
                                        <Plus size={14} /> Add Method
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveBanking}
                                        disabled={savingBanking}
                                        className="win-btn"
                                        style={{ backgroundColor: '#2563EB', color: '#FFFFFF', borderColor: '#1D4ED8' }}
                                    >
                                        {savingBanking ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Accounts
                                    </button>
                                </div>
                            </div>

                            {bankAccounts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed #CBD5E1', borderRadius: '6px', color: '#64748B', fontSize: '13px' }}>
                                    No payment accounts configured yet. Click "+ Add Method" to add EasyPaisa, JazzCash, or Bank accounts.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {bankAccounts.map((acc, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                backgroundColor: '#F8FAFC',
                                                border: '1px solid #CBD5E1',
                                                borderRadius: '6px',
                                                padding: '12px 14px',
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) 40px',
                                                gap: '10px',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                                                    Method / Bank Name
                                                </label>
                                                <input
                                                    type="text"
                                                    className="win-input"
                                                    value={acc.bankName || ''}
                                                    onChange={(e) => handleBankChange(index, 'bankName', e.target.value)}
                                                    placeholder="e.g. EasyPaisa, JazzCash, Meezan Bank"
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                                                    Account Title
                                                </label>
                                                <input
                                                    type="text"
                                                    className="win-input"
                                                    value={acc.accountTitle || ''}
                                                    onChange={(e) => handleBankChange(index, 'accountTitle', e.target.value)}
                                                    placeholder="e.g. Springfield High School"
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                                                    Account / Phone Number
                                                </label>
                                                <input
                                                    type="text"
                                                    className="win-input"
                                                    value={acc.accountNumber || ''}
                                                    onChange={(e) => handleBankChange(index, 'accountNumber', e.target.value)}
                                                    placeholder="e.g. 03001234567"
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                                                    IBAN / Details (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    className="win-input"
                                                    value={acc.iban || ''}
                                                    onChange={(e) => handleBankChange(index, 'iban', e.target.value)}
                                                    placeholder="PK00..."
                                                />
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => removeBankAccount(index)}
                                                    title="Delete Method"
                                                    style={{
                                                        padding: '6px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #FECACA',
                                                        backgroundColor: '#FEF2F2',
                                                        color: '#DC2626',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SimpleInfoItem = ({ label, value, icon: Icon, isCode, valueColor }) => (
    <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '3px' }}>
            {Icon && <Icon size={13} style={{ color: '#2563EB' }} />}
            <span>{label}</span>
        </div>
        {isCode ? (
            <code style={{ fontSize: '12px', fontWeight: '700', color: '#1E40AF', background: '#F1F5F9', padding: '2px 6px', borderRadius: '3px' }}>
                {value}
            </code>
        ) : (
            <div style={{ fontSize: '13px', fontWeight: '700', color: valueColor || '#1E293B' }}>
                {value}
            </div>
        )}
    </div>
);

export default SchoolDetail;
