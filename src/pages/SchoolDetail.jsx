import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, School, User, Mail, Shield,
    CreditCard, Power, Loader2, Save, Calendar,
    MapPin, Hash, CheckCircle, XCircle, Users, Phone,
    Landmark, Building2, Plus, Trash2, Crown, Sparkles, Bus, Tv,
    DollarSign, SlidersHorizontal, Check, AlertCircle, ArrowLeft,
    Key, Eye, EyeOff, Copy, Lock, Edit2, ShieldAlert,
    Receipt, Printer, Download, Clock, CheckCircle2, RotateCcw,
    FileText, Sparkle, ExternalLink
} from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, getDoc, collection, getCountFromServer, setDoc } from 'firebase/firestore';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import InlineEditSchool from '../components/InlineEditSchool';
import maiLogo from '../assets/mai-official-logo.jpg';

const SchoolDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { hasPermission, isMasterAdmin, adminProfile, isSchoolInTerritory } = useAdminAuth();
    const [school, setSchool] = useState(null);
    const [principal, setPrincipal] = useState(null);
    const [stats, setStats] = useState({ total: '...', teachers: '...', parents: '...' });
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [monthlyFee, setMonthlyFee] = useState('');
    const [yearlyFee, setYearlyFee] = useState('');
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [savingPricing, setSavingPricing] = useState(false);
    const canManagePricing = Boolean(isMasterAdmin || hasPermission('manageBilling'));
    
    // Windows 7 / XP Tab Navigation State
    const [activeTab, setActiveTab] = useState('general'); // 'general' | 'principal' | 'subscription' | 'ledger'
    const [showPass, setShowPass] = useState(false);
    const [copiedPass, setCopiedPass] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // 12 Months Definition
    const MONTHS_LIST = [
        { num: 1, name: 'January', short: 'Jan' },
        { num: 2, name: 'February', short: 'Feb' },
        { num: 3, name: 'March', short: 'Mar' },
        { num: 4, name: 'April', short: 'Apr' },
        { num: 5, name: 'May', short: 'May' },
        { num: 6, name: 'June', short: 'Jun' },
        { num: 7, name: 'July', short: 'Jul' },
        { num: 8, name: 'August', short: 'Aug' },
        { num: 9, name: 'September', short: 'Sep' },
        { num: 10, name: 'October', short: 'Oct' },
        { num: 11, name: 'November', short: 'Nov' },
        { num: 12, name: 'December', short: 'Dec' }
    ];

    // Financial Ledger State
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [invoices, setInvoices] = useState({});
    const [loadingInvoices, setLoadingInvoices] = useState(true);
    const [paymentModalMonth, setPaymentModalMonth] = useState(null);
    const [paymentFormData, setPaymentFormData] = useState({
        amount: '',
        paidDate: '',
        paymentMethod: 'Bank Transfer',
        referenceNo: '',
        notes: ''
    });
    const [savingPayment, setSavingPayment] = useState(false);
    const [viewVoucherData, setViewVoucherData] = useState(null);

    const handleCopyPrincipalPassword = (pwd) => {
        if (!pwd) return;
        navigator.clipboard.writeText(pwd);
        setCopiedPass(true);
        setTimeout(() => setCopiedPass(false), 2000);
    };

    // Listen to School's subscription invoices ledger in real-time
    useEffect(() => {
        if (!id) return;
        setLoadingInvoices(true);
        const invoicesRef = collection(db, `schools/${id}/subscription_invoices`);
        const unsub = onSnapshot(invoicesRef, (snapshot) => {
            const invMap = {};
            snapshot.forEach((d) => {
                invMap[d.id] = { id: d.id, ...d.data() };
            });
            setInvoices(invMap);
            setLoadingInvoices(false);
        }, (err) => {
            console.error("Error fetching subscription invoices:", err);
            setLoadingInvoices(false);
        });
        return () => unsub();
    }, [id]);

    const handleOpenPaymentModal = (monthObj, existingInvoice) => {
        const defaultFee = Number(monthlyFee) || Number(school?.monthlySubscriptionFee) || 5000;
        setPaymentModalMonth(monthObj);
        setPaymentFormData({
            amount: existingInvoice?.amount || existingInvoice?.paidAmount || defaultFee,
            paidDate: existingInvoice?.paidDate || new Date().toISOString().split('T')[0],
            paymentMethod: existingInvoice?.paymentMethod || 'Bank Transfer',
            referenceNo: existingInvoice?.referenceNo || '',
            notes: existingInvoice?.notes || ''
        });
    };

    const handleSavePaymentRecord = async (e) => {
        e.preventDefault();
        if (!paymentModalMonth) return;
        setSavingPayment(true);
        const monthKey = `${selectedYear}_${String(paymentModalMonth.num).padStart(2, '0')}`;
        const voucherNo = `MAI-VOUCH-${selectedYear}${String(paymentModalMonth.num).padStart(2, '0')}-${id.slice(-4).toUpperCase()}`;

        try {
            const invoiceData = {
                year: selectedYear,
                month: paymentModalMonth.num,
                monthName: paymentModalMonth.name,
                amount: Number(paymentFormData.amount) || Number(monthlyFee) || 5000,
                paidAmount: Number(paymentFormData.amount) || Number(monthlyFee) || 5000,
                status: 'paid',
                paidDate: paymentFormData.paidDate || new Date().toISOString().split('T')[0],
                paymentMethod: paymentFormData.paymentMethod || 'Bank Transfer',
                referenceNo: paymentFormData.referenceNo || 'N/A',
                notes: paymentFormData.notes || '',
                voucherNumber: voucherNo,
                recordedBy: adminProfile?.name || adminProfile?.email || 'Administrator',
                recordedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await setDoc(doc(db, `schools/${id}/subscription_invoices`, monthKey), invoiceData, { merge: true });

            // If paying for the current month, sync school paymentStatus and AUTO-START!
            const now = new Date();
            if (selectedYear === now.getFullYear() && paymentModalMonth.num === (now.getMonth() + 1)) {
                await updateDoc(doc(db, "schools", id), {
                    paymentStatus: 'paid',
                    status: 'active', // AUTO-START: Unfreezes portal immediately
                    updatedAt: new Date()
                });

                // Clear any warning announcement banner in Principal app
                try {
                    await setDoc(doc(db, `schools/${id}/announcements`, 'global_broadcast'), {
                        active: false,
                        dismissedAt: new Date().toISOString()
                    }, { merge: true });
                } catch (announceErr) {
                    console.warn("Notice deactivation error (non-fatal):", announceErr);
                }
            }

            setPaymentModalMonth(null);
            alert(`Payment recorded successfully for ${paymentModalMonth.name} ${selectedYear}! School system auto-started.`);
        } catch (err) {
            console.error("Failed to record subscription payment:", err);
            alert("Error recording payment: " + err.message);
        } finally {
            setSavingPayment(false);
        }
    };

    const handleQuickRecordCurrentMonth = () => {
        setActiveTab('ledger');
        const now = new Date();
        const curM = MONTHS_LIST.find(m => m.num === (now.getMonth() + 1)) || MONTHS_LIST[0];
        setSelectedYear(now.getFullYear());
        const monthKey = `${now.getFullYear()}_${String(curM.num).padStart(2, '0')}`;
        handleOpenPaymentModal(curM, invoices[monthKey]);
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

    if (!school) {
        return (
            <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <h3 style={{ color: '#0F172A', marginBottom: '8px' }}>School Record Not Found</h3>
                <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '16px' }}>The requested institution does not exist or has been removed.</p>
                <button onClick={() => navigate('/schools')} className="win-btn win-btn-primary">Back to Directory</button>
            </div>
        );
    }

    if (!isMasterAdmin && !isSchoolInTerritory(school, adminProfile)) {
        return (
            <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: "'Segoe UI', Tahoma, Verdana, sans-serif" }}>
                <div style={{
                    width: '100%',
                    maxWidth: '480px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '2rem',
                    textAlign: 'center',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        <ShieldAlert size={26} />
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', marginBottom: '8px' }}>
                        Territory Access Denied
                    </h3>
                    <p style={{ color: '#64748B', fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                        This school ({school.name || school.schoolName}) is located in <strong>{[school.city, school.district, school.state].filter(Boolean).join(', ')}</strong>, which is outside your assigned operational territory.
                    </p>
                    <button onClick={() => navigate('/schools')} className="win-btn win-btn-primary">
                        Return to My Schools Directory
                    </button>
                </div>
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

                    {/* Payment Status Pill */}
                    <span style={{
                        padding: '4px 9px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        backgroundColor: isPaid ? '#DEF7EC' : '#FEF08A',
                        color: isPaid ? '#03543F' : '#854D0E',
                        border: isPaid ? '1px solid #84E1BC' : '1px solid #FDE047',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        {isPaid ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                        {isPaid ? 'Paid' : 'Unpaid / Due'}
                    </span>

                    {/* Pay / Record Subscription Button */}
                    {!isPaid ? (
                        <button
                            onClick={handleQuickRecordCurrentMonth}
                            className="win-btn"
                            style={{
                                color: '#FFFFFF',
                                borderColor: '#1D4ED8',
                                backgroundColor: '#2563EB',
                                fontWeight: '700'
                            }}
                        >
                            <CreditCard size={14} />
                            Pay Subscription
                        </button>
                    ) : (
                        <button
                            onClick={() => setActiveTab('ledger')}
                            className="win-btn"
                            style={{
                                color: '#166534',
                                borderColor: '#86EFAC',
                                backgroundColor: '#F0FDF4'
                            }}
                        >
                            <Receipt size={14} />
                            View 12M Ledger
                        </button>
                    )}
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
                        onClick={() => setActiveTab('ledger')}
                        className={`win-tab ${activeTab === 'ledger' ? 'win-tab-active' : ''}`}
                    >
                        <Receipt size={16} /> 4. Financial Record & 12M Ledger
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
                    {activeTab === 'principal' && (() => {
                        const effectivePassword = school.temporaryPassword || school.initialPassword || principal?.temporaryPassword || principal?.initialPassword || '';
                        return (
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

                                    {/* Credentials & Password Card */}
                                    <div style={{
                                        marginTop: '16px',
                                        padding: '12px 14px',
                                        backgroundColor: '#F0F9FF',
                                        border: '1.5px solid #BAE6FD',
                                        borderRadius: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '6px',
                                                backgroundColor: '#0284C7',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#FFFFFF'
                                            }}>
                                                <Key size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0369A1', textTransform: 'uppercase' }}>
                                                    Administrator Login Password (Temporary / Initial)
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                                    <span style={{
                                                        fontFamily: 'monospace',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                        color: effectivePassword ? '#0C4A6E' : '#64748B'
                                                    }}>
                                                        {effectivePassword ? (showPass ? effectivePassword : '••••••••••••') : 'No temporary password recorded'}
                                                    </span>
                                                    {effectivePassword && (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPass(!showPass)}
                                                                title={showPass ? "Hide" : "Show"}
                                                                style={{ padding: '3px 6px', background: '#FFFFFF', border: '1px solid #BAE6FD', borderRadius: '3px', cursor: 'pointer', color: '#0369A1' }}
                                                            >
                                                                {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopyPrincipalPassword(effectivePassword)}
                                                                title="Copy Password"
                                                                style={{
                                                                    padding: '3px 8px',
                                                                    background: copiedPass ? '#DCFCE7' : '#FFFFFF',
                                                                    border: `1px solid ${copiedPass ? '#16A34A' : '#BAE6FD'}`,
                                                                    borderRadius: '3px',
                                                                    cursor: 'pointer',
                                                                    color: copiedPass ? '#166534' : '#0369A1',
                                                                    fontSize: '11px',
                                                                    fontWeight: 'bold',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px'
                                                                }}
                                                            >
                                                                {copiedPass ? <Check size={12} /> : <Copy size={12} />}
                                                                {copiedPass ? 'Copied' : 'Copy'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {(isMasterAdmin || hasPermission('manageSchools') || hasPermission('resetCredentials')) && (
                                            <button
                                                type="button"
                                                onClick={() => setShowEditModal(true)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 14px',
                                                    backgroundColor: '#0284C7',
                                                    color: '#FFFFFF',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
                                                }}
                                            >
                                                <Lock size={13} /> Quick Reset Password / Edit
                                            </button>
                                        )}
                                    </div>
                                </fieldset>
                            </div>
                        );
                    })()}

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

                                {!canManagePricing && (
                                    <div style={{ padding: '7px 12px', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '4px', color: '#92400E', fontSize: '11.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Lock size={13} />
                                        <span>Read-Only: Subscription pricing rates can only be edited by an Accountant or Master Administrator.</span>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                            Active Billing Cycle
                                        </label>
                                        <select
                                            className="win-input"
                                            value={billingCycle}
                                            onChange={(e) => setBillingCycle(e.target.value)}
                                            disabled={!canManagePricing}
                                            style={!canManagePricing ? { backgroundColor: '#F1F5F9', cursor: 'not-allowed' } : {}}
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
                                            disabled={!canManagePricing}
                                            style={!canManagePricing ? { backgroundColor: '#F1F5F9', cursor: 'not-allowed' } : {}}
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
                                            disabled={!canManagePricing}
                                            style={!canManagePricing ? { backgroundColor: '#F1F5F9', cursor: 'not-allowed' } : {}}
                                        />
                                    </div>
                                </div>

                                {canManagePricing && (
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
                                )}
                            </fieldset>
                        </div>
                    )}

                    {/* TAB 4: Financial Record & 12M Ledger */}
                    {activeTab === 'ledger' && (() => {
                        const currentYear = new Date().getFullYear();
                        const currentMonth = new Date().getMonth() + 1;
                        const schoolCreatedYear = school?.createdAt
                            ? (school.createdAt.toDate ? school.createdAt.toDate().getFullYear() : new Date(school.createdAt).getFullYear())
                            : currentYear;
                        const startYear = Math.min(schoolCreatedYear || (currentYear - 1), currentYear - 1);
                        const availableYears = [];
                        for (let y = startYear; y <= currentYear + 2; y++) {
                            availableYears.push(y);
                        }

                        const currentMonthlyRate = Number(monthlyFee) || Number(school?.monthlySubscriptionFee) || 5000;
                        let totalPaidThisYear = 0;
                        let totalDueThisYear = 0;
                        let paidMonthsCount = 0;
                        let overdueMonthsCount = 0;

                        MONTHS_LIST.forEach((m) => {
                            const monthKey = `${selectedYear}_${String(m.num).padStart(2, '0')}`;
                            const inv = invoices[monthKey];
                            const isPaid = inv && inv.status === 'paid';
                            const isPastOrCurrent = (selectedYear < currentYear) || (selectedYear === currentYear && m.num <= currentMonth);

                            if (isPaid) {
                                totalPaidThisYear += (Number(inv.paidAmount) || Number(inv.amount) || currentMonthlyRate);
                                paidMonthsCount += 1;
                            } else if (isPastOrCurrent) {
                                totalDueThisYear += currentMonthlyRate;
                                overdueMonthsCount += 1;
                            }
                        });

                        return (
                            <div>
                                {/* Header Bar */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                                                Subscription & Financial Record
                                            </h4>
                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontWeight: '700', border: '1px solid #BFDBFE' }}>
                                                Calendar Year {selectedYear}
                                            </span>
                                        </div>
                                        <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                                            12-month calendar ledger, paid history, due balances, and downloadable payment vouchers.
                                        </p>
                                    </div>

                                    {/* Year Selector */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Calendar Year:</label>
                                        <select
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                                            className="win-input"
                                            style={{ fontWeight: '700', minWidth: '130px', padding: '6px 10px', fontSize: '12.5px', background: '#FFFFFF' }}
                                        >
                                            {availableYears.map(y => (
                                                <option key={y} value={y}>📅 Year {y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* KPI Metrics Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                                    <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '12px 14px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', marginBottom: '2px' }}>
                                            Total Paid in {selectedYear}
                                        </div>
                                        <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#14532D' }}>
                                            Rs. {totalPaidThisYear.toLocaleString()}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#15803D', marginTop: '2px' }}>
                                            {paidMonthsCount} of 12 Months Cleared
                                        </div>
                                    </div>

                                    <div style={{ backgroundColor: totalDueThisYear > 0 ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${totalDueThisYear > 0 ? '#FECACA' : '#E2E8F0'}`, borderRadius: '6px', padding: '12px 14px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: totalDueThisYear > 0 ? '#991B1B' : '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>
                                            Outstanding / Overdue
                                        </div>
                                        <div style={{ fontSize: '1.45rem', fontWeight: '800', color: totalDueThisYear > 0 ? '#B91C1C' : '#334155' }}>
                                            Rs. {totalDueThisYear.toLocaleString()}
                                        </div>
                                        <div style={{ fontSize: '11px', color: totalDueThisYear > 0 ? '#DC2626' : '#64748B', marginTop: '2px' }}>
                                            {overdueMonthsCount > 0 ? `${overdueMonthsCount} Month(s) Pending` : 'All Past Months Settled'}
                                        </div>
                                    </div>

                                    <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '12px 14px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#1E40AF', textTransform: 'uppercase', marginBottom: '2px' }}>
                                            Monthly Billing Rate
                                        </div>
                                        <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#1E3A8A' }}>
                                            Rs. {currentMonthlyRate.toLocaleString()}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#2563EB', marginTop: '2px' }}>
                                            Cycle: {school.billingCycle || 'Monthly'}
                                        </div>
                                    </div>

                                    <div style={{ backgroundColor: overdueMonthsCount > 0 ? '#FFFBEB' : '#F0FDF4', border: `1px solid ${overdueMonthsCount > 0 ? '#FDE68A' : '#86EFAC'}`, borderRadius: '6px', padding: '12px 14px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: overdueMonthsCount > 0 ? '#92400E' : '#166534', textTransform: 'uppercase', marginBottom: '2px' }}>
                                            Account Status
                                        </div>
                                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: overdueMonthsCount > 0 ? '#B45309' : '#15803D', marginTop: '4px' }}>
                                            {overdueMonthsCount > 0 ? `⚠️ Arrears Notice` : `✅ Good Standing`}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                            {paidMonthsCount === 12 ? '100% Cleared for Year' : `${12 - paidMonthsCount} Months Ahead/Pending`}
                                        </div>
                                    </div>
                                </div>

                                {/* 12-Month Calendar Grid */}
                                {loadingInvoices ? (
                                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                                        <Loader2 className="animate-spin" size={28} color="#2563EB" style={{ margin: '0 auto 8px' }} />
                                        <span style={{ fontSize: '12px', color: '#64748B' }}>Loading Financial Ledger...</span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                                        {MONTHS_LIST.map((m) => {
                                            const monthKey = `${selectedYear}_${String(m.num).padStart(2, '0')}`;
                                            const inv = invoices[monthKey];
                                            const isPaid = inv && inv.status === 'paid';
                                            const isPastOrCurrent = (selectedYear < currentYear) || (selectedYear === currentYear && m.num <= currentMonth);
                                            const status = isPaid ? 'paid' : (isPastOrCurrent ? 'due' : 'upcoming');
                                            const monthRate = inv?.amount || currentMonthlyRate;

                                            return (
                                                <div
                                                    key={m.num}
                                                    style={{
                                                        backgroundColor: isPaid ? '#FFFFFF' : (status === 'due' ? '#FFFDFD' : '#F8FAFC'),
                                                        border: isPaid ? '1.5px solid #86EFAC' : (status === 'due' ? '1.5px solid #FCA5A5' : '1px solid #CBD5E1'),
                                                        borderRadius: '6px',
                                                        padding: '12px 14px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between',
                                                        boxShadow: isPaid ? '0 1px 3px rgba(34, 197, 94, 0.08)' : 'none'
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                                                                {m.name} {selectedYear}
                                                            </span>

                                                            {isPaid && (
                                                                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', backgroundColor: '#DEF7EC', color: '#03543F', border: '1px solid #84E1BC', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <CheckCircle2 size={12} /> PAID
                                                                </span>
                                                            )}

                                                            {status === 'due' && (
                                                                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <AlertCircle size={12} /> DUE
                                                                </span>
                                                            )}

                                                            {status === 'upcoming' && (
                                                                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Clock size={12} /> UPCOMING
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div style={{ marginBottom: '10px' }}>
                                                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: isPaid ? '#15803D' : (status === 'due' ? '#B91C1C' : '#475569') }}>
                                                                Rs. {(isPaid ? (inv.paidAmount || inv.amount || monthRate) : monthRate).toLocaleString()}
                                                            </div>

                                                            {isPaid ? (
                                                                <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    <div><strong>Paid On:</strong> {inv.paidDate || 'N/A'}</div>
                                                                    <div><strong>Via:</strong> {inv.paymentMethod || 'Bank Transfer'} {inv.referenceNo && inv.referenceNo !== 'N/A' ? `(${inv.referenceNo})` : ''}</div>
                                                                    {inv.voucherNumber && (
                                                                        <div style={{ fontSize: '10.5px', color: '#1E40AF', fontFamily: 'monospace' }}>
                                                                            {inv.voucherNumber}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                                                                    {status === 'due' ? 'Payment overdue for this period' : 'Scheduled future billing month'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                                        {isPaid ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setViewVoucherData({
                                                                    month: m,
                                                                    year: selectedYear,
                                                                    invoice: inv,
                                                                    school: school,
                                                                    principal: principal
                                                                })}
                                                                className="win-btn"
                                                                style={{
                                                                    fontSize: '11.5px',
                                                                    padding: '5px 8px',
                                                                    color: '#1D4ED8',
                                                                    borderColor: '#BFDBFE',
                                                                    backgroundColor: '#EFF6FF',
                                                                    width: '100%',
                                                                    justifyContent: 'center',
                                                                    fontWeight: '700'
                                                                }}
                                                            >
                                                                <Printer size={13} /> View Official Voucher
                                                            </button>
                                                        ) : (
                                                            canManagePricing ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenPaymentModal(m, inv)}
                                                                    className="win-btn"
                                                                    style={{
                                                                        fontSize: '11.5px',
                                                                        padding: '5px 10px',
                                                                        color: '#FFFFFF',
                                                                        backgroundColor: '#2563EB',
                                                                        borderColor: '#1D4ED8',
                                                                        width: '100%',
                                                                        justifyContent: 'center',
                                                                        fontWeight: '700'
                                                                    }}
                                                                >
                                                                    <CreditCard size={13} /> Record Payment
                                                                </button>
                                                            ) : (
                                                                <span style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Lock size={11} /> Read Only
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Quick Edit & Reset Password Modal */}
            {showEditModal && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9999999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    boxSizing: 'border-box'
                }}>
                    <div style={{ width: '100%', maxWidth: '640px', background: '#FFFFFF', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                        <InlineEditSchool
                            school={school}
                            displayId={school.id}
                            onClose={() => setShowEditModal(false)}
                            onSuccess={() => {
                                setShowEditModal(false);
                            }}
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* Record Payment Modal */}
            {paymentModalMonth && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    backdropFilter: 'blur(5px)',
                    zIndex: 9999999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    boxSizing: 'border-box'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '520px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                        border: '1px solid #CBD5E1'
                    }}>
                        {/* Title Bar */}
                        <div style={{
                            padding: '14px 18px',
                            backgroundColor: '#1E3A8A',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CreditCard size={18} color="#93C5FD" />
                                <span style={{ fontWeight: '800', fontSize: '14px' }}>
                                    Record Subscription Payment
                                </span>
                            </div>
                            <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                                {paymentModalMonth.name} {selectedYear}
                            </span>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSavePaymentRecord} style={{ padding: '20px', margin: 0 }}>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                                    School Campus
                                </label>
                                <input
                                    type="text"
                                    disabled
                                    value={`${school?.name || 'School'} (${school?.campusCode || school?.id})`}
                                    className="win-input"
                                    style={{ backgroundColor: '#F1F5F9', cursor: 'not-allowed', color: '#475569' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                                        Amount Paid (Rs) *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        className="win-input"
                                        value={paymentFormData.amount}
                                        onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                                        placeholder="5000"
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                                        Paid Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        className="win-input"
                                        value={paymentFormData.paidDate}
                                        onChange={(e) => setPaymentFormData({ ...paymentFormData, paidDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                                        Payment Method *
                                    </label>
                                    <select
                                        className="win-input"
                                        value={paymentFormData.paymentMethod}
                                        onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                                    >
                                        <option value="Bank Transfer">Bank Transfer / Raast</option>
                                        <option value="JazzCash">JazzCash</option>
                                        <option value="EasyPaisa">EasyPaisa</option>
                                        <option value="Direct Cash Deposit">Direct Cash Deposit</option>
                                        <option value="Bank Cheque">Bank Cheque</option>
                                        <option value="Other">Other Mode</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                                        Reference / Slip No
                                    </label>
                                    <input
                                        type="text"
                                        className="win-input"
                                        value={paymentFormData.referenceNo}
                                        onChange={(e) => setPaymentFormData({ ...paymentFormData, referenceNo: e.target.value })}
                                        placeholder="e.g. TRX-902192, Slip #4"
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                                    Internal Accounting Notes (Optional)
                                </label>
                                <textarea
                                    className="win-input"
                                    rows="2"
                                    value={paymentFormData.notes}
                                    onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                                    placeholder="e.g. Received via Meezan corporate account"
                                    style={{ resize: 'none' }}
                                />
                            </div>

                            {/* Permanent Audit Warning */}
                            <div style={{ padding: '8px 12px', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '4px', color: '#92400E', fontSize: '11px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Lock size={13} style={{ flexShrink: 0 }} />
                                <span><strong>Permanent Record:</strong> Once verified and recorded, subscription payments cannot be undone or reverted. System access will automatically start.</span>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                                <button
                                    type="button"
                                    onClick={() => setPaymentModalMonth(null)}
                                    className="win-btn"
                                    disabled={savingPayment}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="win-btn win-btn-primary"
                                    disabled={savingPayment}
                                >
                                    {savingPayment ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Save Payment & Generate Voucher
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* View & Print Payment Voucher Modal */}
            {viewVoucherData && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(5px)',
                    zIndex: 9999999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    overflowY: 'auto',
                    boxSizing: 'border-box'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '720px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '10px',
                        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
                        overflow: 'hidden',
                        margin: 'auto'
                    }}>
                        {/* Top Utility Bar (Not Printed) */}
                        <div style={{
                            padding: '10px 16px',
                            backgroundColor: '#0F172A',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <span style={{ fontSize: '13px', fontWeight: '700' }}>
                                Official SaaS Subscription Voucher Preview
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="win-btn"
                                    style={{
                                        backgroundColor: '#2563EB',
                                        color: '#FFFFFF',
                                        borderColor: '#1D4ED8',
                                        fontSize: '12px',
                                        padding: '4px 10px'
                                    }}
                                >
                                    <Printer size={13} /> Print / Save as PDF
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewVoucherData(null)}
                                    className="win-btn"
                                    style={{ fontSize: '12px', padding: '4px 8px' }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        {/* Printable Voucher Content Area */}
                        <div id="mai-printable-voucher" style={{ padding: '32px 36px', backgroundColor: '#FFFFFF', color: '#0F172A', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
                            {/* Voucher Header with MAI Tech Branding */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #1E3A8A', paddingBottom: '18px', marginBottom: '22px' }}>
                                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                    {/* MAI Tech Official Logo (Image 3) */}
                                    <img
                                        src={maiLogo}
                                        alt="MAI Tech Solutions Logo"
                                        style={{
                                            width: '68px',
                                            height: '68px',
                                            objectFit: 'contain',
                                            borderRadius: '10px',
                                            border: '1.5px solid #CBD5E1',
                                            backgroundColor: '#FFFFFF',
                                            padding: '4px',
                                            boxShadow: '0 3px 10px rgba(30, 58, 138, 0.12)',
                                            flexShrink: 0
                                        }}
                                    />
                                    <div>
                                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.3px' }}>
                                            MAI TECH SOLUTIONS
                                        </div>
                                        <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600' }}>
                                            Next-Gen School Management & Cloud Architecture Ecosystem
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#2563EB', fontWeight: '600', marginTop: '1px' }}>
                                            support@mai-sms.web.app • https://mai-sms.web.app
                                        </div>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        SUBSCRIPTION RECEIPT
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', fontFamily: 'monospace', marginTop: '3px' }}>
                                        {viewVoucherData.invoice.voucherNumber || `MAI-INV-${viewVoucherData.year}-${viewVoucherData.month.num}`}
                                    </div>
                                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                                        Issue Date: {viewVoucherData.invoice.paidDate || new Date().toISOString().split('T')[0]}
                                    </div>
                                </div>
                            </div>

                            {/* Bill To & School Particulars */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '22px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 18px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Billed School Campus:
                                    </div>
                                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>
                                        {viewVoucherData.school.name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                                        Campus Code: <strong>{viewVoucherData.school.campusCode || viewVoucherData.school.id}</strong>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#475569' }}>
                                        Location: {[viewVoucherData.school.city, viewVoucherData.school.district, viewVoucherData.school.state].filter(Boolean).join(', ') || 'Pakistan'}
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Principal / Administrator:
                                    </div>
                                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1E293B' }}>
                                        {viewVoucherData.principal?.name || viewVoucherData.school.principalName || 'Principal Office'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                                        Email: {viewVoucherData.principal?.email || viewVoucherData.school.email || 'N/A'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#475569' }}>
                                        Phone: {viewVoucherData.principal?.phone || viewVoucherData.school.phone || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            {/* Service Item Table */}
                            <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#1E3A8A', color: '#FFFFFF', textAlign: 'left' }}>
                                            <th style={{ padding: '9px 12px', fontWeight: '700' }}>Service Description</th>
                                            <th style={{ padding: '9px 12px', fontWeight: '700' }}>Tier</th>
                                            <th style={{ padding: '9px 12px', fontWeight: '700' }}>Period</th>
                                            <th style={{ padding: '9px 12px', fontWeight: '700', textAlign: 'right' }}>Amount (PKR)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ fontWeight: '800', color: '#0F172A' }}>
                                                    MAI School Cloud Software Platform
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#64748B' }}>
                                                    Student LMS, Parent & Teacher Mobile Apps, Automated Timetables, Attendance & Fee Suite
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px', color: '#334155', fontWeight: '700' }}>
                                                {viewVoucherData.school.package === 'premium' ? 'Premium Pro Tier ⭐' : 'Standard Tier'}
                                            </td>
                                            <td style={{ padding: '12px', color: '#1E40AF', fontWeight: '800' }}>
                                                {viewVoucherData.month.name} {viewVoucherData.year}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#0F172A', fontSize: '14px' }}>
                                                Rs. {(viewVoucherData.invoice.paidAmount || viewVoucherData.invoice.amount || 5000).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: '#F0FDF4' }}>
                                            <td colSpan="3" style={{ padding: '10px 12px', fontWeight: '800', color: '#166534', textAlign: 'right' }}>
                                                TOTAL PAID (IN FULL):
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '900', color: '#14532D', fontSize: '16px' }}>
                                                Rs. {(viewVoucherData.invoice.paidAmount || viewVoucherData.invoice.amount || 5000).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Payment Meta Audit & Paid Badge */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px', alignItems: 'center', marginBottom: '22px' }}>
                                <div style={{ fontSize: '11.5px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <div><strong>Payment Method:</strong> {viewVoucherData.invoice.paymentMethod || 'Bank Transfer / Raast'}</div>
                                    <div><strong>Transaction / Slip Reference:</strong> {viewVoucherData.invoice.referenceNo || 'Verified Online Transfer'}</div>
                                    <div><strong>Verified & Issued By:</strong> {viewVoucherData.invoice.recordedBy || 'MAI Central Finance Department'}</div>
                                    {viewVoucherData.invoice.notes && (
                                        <div><strong>Accounting Notes:</strong> {viewVoucherData.invoice.notes}</div>
                                    )}
                                </div>

                                <div style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', border: '2px dashed #16A34A', backgroundColor: '#F0FDF4' }}>
                                    <div style={{ fontSize: '15px', fontWeight: '900', color: '#15803D', letterSpacing: '1px' }}>
                                        ✔ VERIFIED PAID
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: '#166534', fontWeight: '700' }}>
                                        MAI Central Ledger Clearance
                                    </div>
                                </div>
                            </div>

                            {/* Motivational Line in English */}
                            <div style={{
                                backgroundColor: '#FFFBEB',
                                borderLeft: '4px solid #D97706',
                                borderRadius: '0 6px 6px 0',
                                padding: '10px 14px',
                                marginBottom: '22px'
                            }}>
                                <div style={{ fontSize: '12px', fontStyle: 'italic', fontWeight: '700', color: '#92400E' }}>
                                    "Empowering Educational Excellence through Innovation, Dedication & Seamless Technology."
                                </div>
                            </div>

                            {/* Voucher Footer */}
                            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: '#94A3B8' }}>
                                <span>This is a computer-generated voucher and requires no physical signature.</span>
                                <span>Powered by MAI Tech Smart Campus Ecosystem</span>
                            </div>

                            {/* Step 2 Auto Email Note (Non-Printed Helper) */}
                            <div style={{ marginTop: '16px', padding: '8px 12px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', fontSize: '11px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Mail size={13} />
                                <span>
                                    <strong>Step 2 Ready:</strong> Automated email dispatch of this voucher to Principal ({viewVoucherData.principal?.email || viewVoucherData.school.email || 'No email on file'}) will be hooked in next.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
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
