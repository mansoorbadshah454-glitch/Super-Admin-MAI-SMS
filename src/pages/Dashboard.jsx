import React, { useState, useEffect, useRef } from 'react';
import { 
    School, Users, Activity, Plus, Search, Filter, MoreVertical, GraduationCap, 
    DollarSign, Play, Square, Eye, CheckCircle, XCircle, PlayCircle, StopCircle, 
    CreditCard, ArrowRight, TrendingUp, RefreshCw, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CreateSchoolModal from '../components/CreateSchoolModal';
import { db, auth } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs, getCountFromServer, doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { calculateTrialDays } from '../utils/dateUtils';
import { useTheme } from '../contexts/ThemeContext';

const Dashboard = () => {
    const { isDark } = useTheme();
    const navigate = useNavigate();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [allSchools, setAllSchools] = useState([]);
    const [activeTab, setActiveTab] = useState('recent');
    const [openMenuId, setOpenMenuId] = useState(null);
    const menuRef = useRef(null);
    const [totalPaidRevenue, setTotalPaidRevenue] = useState(0);
    const [paidSchoolsCount, setPaidSchoolsCount] = useState(0);
    const [unpaidSchoolsCount, setUnpaidSchoolsCount] = useState(0);
    const [pendingSlips, setPendingSlips] = useState(0);

    const [stats, setStats] = useState([
        { label: 'Total Schools', value: '0', icon: School, color: '#2563EB', bg: '#EFF6FF' },
        { label: 'Total Students', value: '0', icon: Activity, color: '#7C3AED', bg: '#F5F3FF' },
        { label: 'Total Teachers', value: '0', icon: GraduationCap, color: '#DB2777', bg: '#FDF2F8' },
        { label: 'Total Parents', value: '0', icon: Users, color: '#0D9488', bg: '#F0FDFA' },
        { label: 'Paid Schools', value: '0', icon: CheckCircle, color: '#16A34A', bg: '#F0FDF4' },
        { label: 'Unpaid Schools', value: '0', icon: AlertCircle, color: '#D97706', bg: '#FFFBEB' },
    ]);

    // Listen for pending verification slips
    useEffect(() => {
        const subsRef = collection(db, "platform_subscriptions");
        const unsubSubs = onSnapshot(subsRef, (snapshot) => {
            let pending = 0;
            snapshot.forEach(doc => {
                if (doc.data()?.status === 'pending') pending++;
            });
            setPendingSlips(pending);
        }, (err) => console.warn("Subscriptions count notice:", err));

        return () => unsubSubs();
    }, []);

    useEffect(() => {
        // Fetch Schools for Table and Stats
        const q = collection(db, "schools");
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const schoolsArray = [];
            let paidCount = 0;
            let unpaidCount = 0;
            let calculatedRevenue = 0;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const trialInfo = calculateTrialDays(data.trialStartDate);

                schoolsArray.push({
                    id: doc.id,
                    ...data,
                    trialInfo
                });

                if (data.paymentStatus === 'paid') {
                    paidCount++;
                    const fee = data.billingCycle === 'yearly'
                        ? (Number(data.yearlySubscriptionFee) || 50000)
                        : (Number(data.monthlySubscriptionFee) || 5000);
                    calculatedRevenue += fee;
                } else {
                    unpaidCount++;
                }
            });

            setPaidSchoolsCount(paidCount);
            setUnpaidSchoolsCount(unpaidCount);
            setTotalPaidRevenue(calculatedRevenue);

            // Sort logic: Expired trials first, then ascending days left, then not started
            schoolsArray.sort((a, b) => {
                if (a.trialInfo.notStarted && !b.trialInfo.notStarted) return 1;
                if (!a.trialInfo.notStarted && b.trialInfo.notStarted) return -1;
                if (a.trialInfo.isExpired && !b.trialInfo.isExpired) return -1;
                if (!a.trialInfo.isExpired && b.trialInfo.isExpired) return 1;
                if (!a.trialInfo.isExpired && !b.trialInfo.isExpired && !a.trialInfo.notStarted && !b.trialInfo.notStarted) {
                    return a.trialInfo.daysLeft - b.trialInfo.daysLeft;
                }
                return 0;
            });

            setAllSchools(schoolsArray);

            setStats(prev => {
                const newStats = [...prev];
                newStats[0] = { ...newStats[0], value: schoolsArray.length.toString() };
                newStats[4] = { ...newStats[4], value: `${paidCount} (₨ ${calculatedRevenue.toLocaleString()})` };
                newStats[5] = { ...newStats[5], value: unpaidCount.toString() };
                return newStats;
            });
        }, (error) => {
            console.error("Dashboard Fetch Error:", error);
        });

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target) && !event.target.closest('.menu-trigger')) {
                setOpenMenuId(null);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);

        // Helper to accurately aggregate live counts across all schools and heal database
        const recalculateMetrics = async () => {
            try {
                const schoolsSnap = await getDocs(query(collection(db, "schools")));
                const activeSchools = schoolsSnap.docs.filter(d => d.id && !d.id.includes('test_dummy'));
                
                const stPromises = activeSchools.map(s => getCountFromServer(collection(db, `schools/${s.id}/students`)).catch(() => ({ data: () => ({ count: 0 }) })));
                const tePromises = activeSchools.map(s => getCountFromServer(collection(db, `schools/${s.id}/teachers`)).catch(() => ({ data: () => ({ count: 0 }) })));
                const paPromises = activeSchools.map(s => getCountFromServer(collection(db, `schools/${s.id}/parents`)).catch(() => ({ data: () => ({ count: 0 }) })));

                const [stSnaps, teSnaps, paSnaps] = await Promise.all([
                    Promise.all(stPromises), Promise.all(tePromises), Promise.all(paPromises)
                ]);
                
                const tStudents = Math.max(0, stSnaps.reduce((acc, snap) => acc + (snap.data?.()?.count || 0), 0));
                const tTeachers = Math.max(0, teSnaps.reduce((acc, snap) => acc + (snap.data?.()?.count || 0), 0));
                const tParents = Math.max(0, paSnaps.reduce((acc, snap) => acc + (snap.data?.()?.count || 0), 0));

                setStats(prev => {
                    const newStats = [...prev];
                    newStats[1] = { ...newStats[1], value: tStudents.toLocaleString() };
                    newStats[2] = { ...newStats[2], value: tTeachers.toLocaleString() };
                    newStats[3] = { ...newStats[3], value: tParents.toLocaleString() };
                    return newStats;
                });

                // Auto-heal system/metrics in Firestore to purge negative numbers permanently
                await setDoc(doc(db, "system", "metrics"), {
                    totalStudents: tStudents,
                    totalTeachers: tTeachers,
                    totalParents: tParents,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            } catch (err) {
                console.error("Dashboard: Auto-recalculate & heal metrics failed:", err);
            }
        };

        // Listen for atomic global metrics
        const unsubscribeMetrics = onSnapshot(doc(db, "system", "metrics"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const rawStudents = data.totalStudents ?? 0;
                const rawTeachers = data.totalTeachers ?? 0;
                const rawParents = data.totalParents ?? 0;

                // If any metric in Firestore is negative/corrupted, auto-heal immediately
                if (rawStudents < 0 || rawTeachers < 0 || rawParents < 0) {
                    recalculateMetrics();
                    return;
                }

                setStats(prev => {
                    const newStats = [...prev];
                    newStats[1] = { ...newStats[1], value: Math.max(0, rawStudents).toLocaleString() };
                    newStats[2] = { ...newStats[2], value: Math.max(0, rawTeachers).toLocaleString() };
                    newStats[3] = { ...newStats[3], value: Math.max(0, rawParents).toLocaleString() };
                    return newStats;
                });
            } else {
                recalculateMetrics();
            }
        });

        return () => {
            unsubscribe();
            unsubscribeMetrics();
            window.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSuccess = () => {
        setShowCreateModal(false);
    };

    const handleStartTrial = async (schoolId) => {
        try {
            await updateDoc(doc(db, "schools", schoolId), {
                trialStartDate: serverTimestamp(),
                updatedAt: new Date()
            });
        } catch (error) {
            alert("Failed to start trial: " + error.message);
        }
    };

    const togglePaymentStatus = async (schoolId, currentStatus) => {
        try {
            await updateDoc(doc(db, "schools", schoolId), {
                paymentStatus: currentStatus === 'paid' ? 'unpaid' : 'paid',
                updatedAt: serverTimestamp()
            });
            setOpenMenuId(null);
        } catch (error) {
            alert("Failed to update payment status: " + error.message);
        }
    };

    const toggleSchoolStatus = async (schoolId, currentStatus) => {
        try {
            await updateDoc(doc(db, "schools", schoolId), {
                status: currentStatus === 'active' ? 'stop' : 'active',
                updatedAt: serverTimestamp()
            });
            setOpenMenuId(null);
        } catch (error) {
            alert("Failed to update school status: " + error.message);
        }
    };

    // Categories counts for tabs
    const totalRecent = allSchools.length;
    const totalActive = allSchools.filter(s => s.status === 'active').length;
    const totalUnpaid = allSchools.filter(s => s.paymentStatus !== 'paid').length;
    const totalSuspended = allSchools.filter(s => s.status === 'suspended' || s.status === 'stop').length;

    const displayedSchools = activeTab === 'recent'
        ? allSchools
        : activeTab === 'unpaid'
            ? allSchools.filter(s => s.paymentStatus !== 'paid')
            : activeTab === 'suspended'
                ? allSchools.filter(s => s.status === 'suspended' || s.status === 'stop')
                : allSchools.filter(s => s.status === 'active');

    const fontFamily = "'Segoe UI', Tahoma, Verdana, sans-serif";

    return (
        <div className="animate-in fade-in duration-300" style={{ fontFamily: fontFamily }}>
            <style>{`
                .win-card {
                    background-color: #FFFFFF;
                    border: 1px solid #CBD5E1;
                    border-radius: 6px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
                }
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
                .win-btn-primary {
                    border: 1px solid #1D4ED8;
                    background: linear-gradient(180deg, #3B82F6 0%, #2563EB 50%, #1D4ED8 100%);
                    color: #FFFFFF;
                    box-shadow: 0 1px 2px rgba(37, 99, 235, 0.3);
                }
                .win-btn-primary:hover {
                    background: linear-gradient(180deg, #60A5FA 0%, #3B82F6 50%, #2563EB 100%);
                }
                .win-tab-header {
                    padding: 8px 14px;
                    font-size: 12.5px;
                    font-weight: 700;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    border-radius: 4px;
                    border: 1px solid transparent;
                    color: #64748B;
                    transition: all 0.12s ease;
                    user-select: none;
                }
                .win-tab-header-active {
                    color: #1D4ED8;
                    background-color: #EFF6FF;
                    border-color: #BFDBFE;
                }
                .win-table th {
                    background: linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%);
                    border-bottom: 2px solid #CBD5E1;
                    color: #334155;
                    font-weight: 700;
                    padding: 10px 14px;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .win-table td {
                    padding: 10px 14px;
                    border-bottom: 1px solid #E2E8F0;
                    font-size: 12.5px;
                    vertical-align: middle;
                }
                .win-table tr:hover td {
                    background-color: #EFF6FF !important;
                }
            `}</style>

            {showCreateModal && (
                <CreateSchoolModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={handleSuccess}
                />
            )}

            {/* 1. TOP HEADER & COMMAND TOOLBAR */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.25rem',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}
            >
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                        System Overview & Performance
                    </h2>
                    <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '2px 0 0 0' }}>
                        Real-time status monitoring, institutional metrics, and global SaaS management.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="win-btn win-btn-primary"
                        onClick={() => setShowCreateModal(true)}
                        style={{ padding: '7px 16px' }}
                    >
                        <Plus size={16} /> Register New School
                    </button>
                </div>
            </div>

            {/* 2. FINANCIAL REVENUE PANEL (Windows 7 Resource Strip) */}
            <div
                className="win-card"
                style={{
                    padding: '14px 18px',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                    backgroundColor: '#FFFFFF',
                    borderLeft: '4px solid #16A34A'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #16A34A, #15803D)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        flexShrink: 0
                    }}>
                        <CreditCard size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#16A34A', letterSpacing: '0.04em' }}>
                            Total Subscription Revenue (Active Paid Schools)
                        </div>
                        <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#0F172A', lineHeight: 1.2 }}>
                            ₨ {totalPaidRevenue.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                            Paid: <strong style={{ color: '#16A34A' }}>{paidSchoolsCount} schools</strong> • Unpaid / Due: <strong style={{ color: '#D97706' }}>{unpaidSchoolsCount} schools</strong>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {pendingSlips > 0 && (
                        <button
                            onClick={() => navigate('/billing-subscriptions')}
                            className="win-btn"
                            style={{
                                backgroundColor: '#FFFBEB',
                                borderColor: '#FDE68A',
                                color: '#B45309',
                                fontWeight: '700'
                            }}
                        >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D97706' }} />
                            {pendingSlips} New Slip{pendingSlips > 1 ? 's' : ''} to Review
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/billing-subscriptions')}
                        className="win-btn"
                    >
                        Billing & Invoices <ArrowRight size={14} />
                    </button>
                </div>
            </div>

            {/* 3. SYSTEM STATS TILES (Windows 7 Performance Monitor Style) */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    marginBottom: '1.25rem'
                }}
            >
                {stats.map((stat, index) => {
                    const IconComponent = stat.icon;
                    return (
                        <div
                            key={index}
                            className="win-card"
                            style={{
                                padding: '12px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}
                        >
                            <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '5px',
                                backgroundColor: stat.bg,
                                color: stat.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <IconComponent size={20} />
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>
                                    {stat.label}
                                </div>
                                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {stat.value}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 4. SCHOOLS MONITOR CONSOLE TABLE */}
            <div className="win-card" style={{ overflow: 'hidden' }}>
                {/* Console Tab Bar */}
                <div
                    style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #CBD5E1',
                        backgroundColor: '#F8FAFC',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px'
                    }}
                >
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[
                            { id: 'recent', label: 'All Schools', count: totalRecent },
                            { id: 'active', label: 'Active', count: totalActive },
                            { id: 'unpaid', label: 'Unpaid', count: totalUnpaid },
                            { id: 'suspended', label: 'Suspended', count: totalSuspended },
                        ].map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`win-tab-header ${isActive ? 'win-tab-header-active' : ''}`}
                                >
                                    <span>{tab.label}</span>
                                    <span style={{
                                        fontSize: '11px',
                                        padding: '1px 6px',
                                        borderRadius: '999px',
                                        backgroundColor: isActive ? '#2563EB' : '#E2E8F0',
                                        color: isActive ? '#FFFFFF' : '#475569',
                                        fontWeight: '700'
                                    }}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => navigate('/schools')}
                        className="win-btn"
                        style={{ fontSize: '12px' }}
                    >
                        View Full Directory <ArrowRight size={13} />
                    </button>
                </div>

                {/* Table Content */}
                <div style={{ overflowX: 'auto', maxHeight: '520px' }}>
                    <table className="win-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '30%' }}>School Profile</th>
                                <th style={{ width: '18%' }}>School ID</th>
                                <th style={{ width: '14%' }}>Payment Status</th>
                                <th style={{ width: '15%' }}>7-Day Trial</th>
                                <th style={{ width: '13%' }}>System Status</th>
                                <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedSchools.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B' }}>
                                        No schools found under this category.
                                    </td>
                                </tr>
                            ) : displayedSchools.map((school, index) => {
                                const isPaid = school.paymentStatus === 'paid';
                                const isActive = school.status === 'active';
                                const isDemo = school.id === 'SCHOOL_6257' || school.schoolId === 'SCHOOL_6257' || school.isDemo === true;

                                return (
                                    <tr
                                        key={school.id}
                                        onClick={() => navigate(`/schools/${school.id}`)}
                                        style={{
                                            backgroundColor: isDemo
                                                ? (index % 2 === 0 ? '#FAF5FF' : '#F5EEFD')
                                                : (index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'),
                                            borderLeft: isDemo ? '4px solid #8B5CF6' : '4px solid transparent',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '5px',
                                                    background: isDemo ? '#F3E8FF' : '#EFF6FF',
                                                    color: isDemo ? '#7C3AED' : '#2563EB',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    <School size={16} />
                                                </div>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontWeight: '700', color: isDemo ? '#5B21B6' : '#1E3A8A' }}>
                                                            {school.name || school.schoolName || 'Unnamed School'}
                                                        </span>
                                                        {isDemo && (
                                                            <span style={{
                                                                padding: '1px 6px',
                                                                borderRadius: '999px',
                                                                fontSize: '10px',
                                                                fontWeight: '800',
                                                                backgroundColor: '#EDE9FE',
                                                                color: '#6D28D9',
                                                                border: '1px solid #DDD6FE',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '3px'
                                                            }}>
                                                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#8B5CF6' }} />
                                                                Demo Acc
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                                                        {school.city || school.district || 'Location N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td>
                                            <code style={{
                                                fontSize: '11px',
                                                color: isDemo ? '#6D28D9' : '#1E40AF',
                                                backgroundColor: isDemo ? '#F3E8FF' : '#F1F5F9',
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                border: isDemo ? '1px solid #E9D5FF' : 'none'
                                            }}>
                                                {school.id}
                                            </code>
                                        </td>

                                        <td>
                                            <span style={{
                                                padding: '2px 7px',
                                                borderRadius: '3px',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                textTransform: 'uppercase',
                                                backgroundColor: isPaid ? '#DEF7EC' : '#FEF08A',
                                                color: isPaid ? '#03543F' : '#854D0E',
                                                border: isPaid ? '1px solid #84E1BC' : '1px solid #FDE047'
                                            }}>
                                                {school.paymentStatus || 'unpaid'}
                                            </span>
                                        </td>

                                        <td>
                                            {school.trialInfo?.notStarted ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleStartTrial(school.id); }}
                                                    className="win-btn"
                                                    style={{ padding: '2px 8px', fontSize: '11px' }}
                                                >
                                                    Start Trial
                                                </button>
                                            ) : (
                                                <span style={{
                                                    padding: '2px 7px',
                                                    borderRadius: '3px',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    backgroundColor: school.trialInfo?.isExpired ? '#FEE2E2' : '#EFF6FF',
                                                    color: school.trialInfo?.isExpired ? '#991B1B' : '#1D4ED8'
                                                }}>
                                                    {school.trialInfo?.isExpired ? 'Trial Ended' : `${school.trialInfo?.daysLeft}d Left`}
                                                </span>
                                            )}
                                        </td>

                                        <td>
                                            <span style={{
                                                padding: '2px 7px',
                                                borderRadius: '3px',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                textTransform: 'uppercase',
                                                backgroundColor: isActive ? '#DEF7EC' : '#FDE8E8',
                                                color: isActive ? '#03543F' : '#9B1C1C',
                                                border: isActive ? '1px solid #84E1BC' : '1px solid #F8B4B4'
                                            }}>
                                                {school.status === 'active' ? 'Active' : (school.status === 'stop' ? 'Stopped' : 'Suspended')}
                                            </span>
                                        </td>

                                        <td style={{ textAlign: 'right', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                                            <button
                                                className="menu-trigger win-btn"
                                                onClick={() => setOpenMenuId(openMenuId === school.id ? null : school.id)}
                                                style={{ padding: '4px 6px' }}
                                                title="Options"
                                            >
                                                <MoreVertical size={14} />
                                            </button>

                                            {openMenuId === school.id && (
                                                <div
                                                    ref={menuRef}
                                                    style={{
                                                        position: 'absolute',
                                                        right: '10px',
                                                        top: '36px',
                                                        backgroundColor: '#FFFFFF',
                                                        border: '1px solid #CBD5E1',
                                                        borderRadius: '5px',
                                                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                                                        zIndex: 9999,
                                                        width: '180px',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    <button
                                                        onClick={() => {
                                                            setOpenMenuId(null);
                                                            navigate(`/schools/${school.id}`);
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 12px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            border: 'none',
                                                            background: 'transparent',
                                                            cursor: 'pointer',
                                                            color: '#1E293B',
                                                            fontSize: '12px',
                                                            textAlign: 'left'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        <Eye size={14} color="#2563EB" /> View Details
                                                    </button>

                                                    <button
                                                        onClick={() => togglePaymentStatus(school.id, school.paymentStatus)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 12px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            border: 'none',
                                                            background: 'transparent',
                                                            cursor: 'pointer',
                                                            color: '#1E293B',
                                                            fontSize: '12px',
                                                            textAlign: 'left'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        <CreditCard size={14} color={isPaid ? '#D97706' : '#16A34A'} />
                                                        Mark as {isPaid ? 'Unpaid' : 'Paid'}
                                                    </button>

                                                    <button
                                                        onClick={() => toggleSchoolStatus(school.id, school.status)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 12px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            border: 'none',
                                                            background: 'transparent',
                                                            cursor: 'pointer',
                                                            color: '#1E293B',
                                                            fontSize: '12px',
                                                            textAlign: 'left'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        <PlayCircle size={14} color={isActive ? '#DC2626' : '#16A34A'} />
                                                        {isActive ? 'Stop School' : 'Start School'}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
