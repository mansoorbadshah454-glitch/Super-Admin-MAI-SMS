import React, { useState, useEffect, useRef } from 'react';
import { School, Users, Activity, Plus, Search, Filter, MoreVertical, GraduationCap, DollarSign, Play, Square, Eye, CheckCircle, XCircle, PlayCircle, StopCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CreateSchoolModal from '../components/CreateSchoolModal';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs, getCountFromServer, collectionGroup, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { calculateTrialDays } from '../utils/dateUtils';
import { useTheme } from '../contexts/ThemeContext';
import { seedDummySchools } from '../utils/seedSchools';

const Dashboard = () => {
    const { isDark } = useTheme();
    const navigate = useNavigate();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [allSchools, setAllSchools] = useState([]);
    const [activeTab, setActiveTab] = useState('recent');
    const [openMenuId, setOpenMenuId] = useState(null);
    const menuRef = useRef(null);
    const [stats, setStats] = useState([
        { label: 'Total Schools', value: '0', icon: School, color: '#6366f1' },
        { label: 'Total Students', value: '0', icon: Activity, color: '#8b5cf6' },
        { label: 'Total Teachers', value: '0', icon: GraduationCap, color: '#ec4899' },
        { label: 'Total Parents', value: '0', icon: Users, color: '#14b8a6' },
        { label: 'Paid Schools', value: '0', icon: Users, color: '#10b981' },
        { label: 'Unpaid Schools', value: '0', icon: Users, color: '#f59e0b' },
    ]);

    useEffect(() => {
        // Fetch Schools for Table and Stats
        const q = query(collection(db, "schools"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const schoolsArray = [];
            let paidCount = 0;
            let unpaidCount = 0;

            querySnapshot.forEach((doc) => {
                const data = doc.data();

                // Calculate Trial Info based on trialStartDate
                const trialInfo = calculateTrialDays(data.trialStartDate);

                schoolsArray.push({
                    id: doc.id,
                    ...data,
                    trialInfo
                });

                if (data.paymentStatus === 'paid') paidCount++;
                else unpaidCount++;
            });

            // Sort logic requested by user:
            // 1. Expired trials (0 days left) above all
            // 2. Active Trials sorted by less days left (ascending)
            // 3. Not Started trials at the bottom
            schoolsArray.sort((a, b) => {
                // If one is "Not Started", it goes to the bottom
                if (a.trialInfo.notStarted && !b.trialInfo.notStarted) return 1;
                if (!a.trialInfo.notStarted && b.trialInfo.notStarted) return -1;

                // If one is expired and other is not, expired comes first
                if (a.trialInfo.isExpired && !b.trialInfo.isExpired) return -1;
                if (!a.trialInfo.isExpired && b.trialInfo.isExpired) return 1;

                // If both are active, sort ascending by days left (fewer days first)
                if (!a.trialInfo.isExpired && !b.trialInfo.isExpired && !a.trialInfo.notStarted && !b.trialInfo.notStarted) {
                    return a.trialInfo.daysLeft - b.trialInfo.daysLeft;
                }

                // If both are expired, retain original sorting (newest first)
                return 0;
            });

            setAllSchools(schoolsArray); // Store all fetched schools

            // Fetch total students, teachers, and parents across all schools
            let totalStudents = 0;
            let totalTeachers = 0;
            let totalParents = 0;

            try {
                // Use collectionGroup to count all documents in subcollections
                const studentsQuery = query(collectionGroup(db, 'students'));
                const teachersQuery = query(collectionGroup(db, 'teachers'));
                const parentsQuery = query(collectionGroup(db, 'parents'));

                const [studentsSnap, teachersSnap, parentsSnap] = await Promise.all([
                    getCountFromServer(studentsQuery),
                    getCountFromServer(teachersQuery),
                    getCountFromServer(parentsQuery)
                ]);

                totalStudents = studentsSnap.data().count;
                totalTeachers = teachersSnap.data().count;
                totalParents = parentsSnap.data().count;
            } catch (error) {
                console.error("Error fetching total counts:", error);
            }

            // Update Stats Grid
            setStats([
                { label: 'Total Schools', value: querySnapshot.size.toString(), icon: School, color: '#6366f1' },
                { label: 'Total Students', value: totalStudents.toLocaleString(), icon: Activity, color: '#8b5cf6' },
                { label: 'Total Teachers', value: totalTeachers.toLocaleString(), icon: GraduationCap, color: '#ec4899' },
                { label: 'Total Parents', value: totalParents.toLocaleString(), icon: Users, color: '#14b8a6' },
                { label: 'Paid Schools', value: paidCount.toString(), icon: Users, color: '#10b981' },
                { label: 'Unpaid Schools', value: unpaidCount.toString(), icon: Users, color: '#f59e0b' },
            ]);
        }, (error) => {
            console.error("Dashboard Fetch Error:", error);
            if (error.code === 'permission-denied') {
                const uid = auth.currentUser ? auth.currentUser.uid : 'UNKNOWN';
                alert(`ACCESS DENIED: Admin Document Missing.\n\nYour UID is:\n${uid}\n\nPlease create a document in 'users' collection with this ID and role: 'admin'.`);
            }
        });

        const handleClickOutside = (event) => {
            // Only close if the click is truly outside the menu AND not on a trigger button
            if (menuRef.current && !menuRef.current.contains(event.target) && !event.target.closest('.menu-trigger')) {
                setOpenMenuId(null);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => {
            unsubscribe();
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

    return (
        <div className="animate-in fade-in duration-700">
            <style>
                {`
                .custom-blue-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-blue-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-blue-scrollbar::-webkit-scrollbar-thumb {
                    background-color: ${!isDark ? 'rgba(255,255,255,0.3)' : '#3b82f6'};
                    border-radius: 10px;
                }
                .custom-blue-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: ${!isDark ? 'rgba(255,255,255,0.5)' : '#2563eb'};
                }
                .sticky-header th {
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }
                .tab-btn-3d {
                    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .tab-btn-3d:hover {
                    transform: translateY(-2px);
                    filter: brightness(1.1);
                }
                .tab-btn-3d:active {
                    transform: translateY(1px) scale(0.97);
                    filter: brightness(0.95);
                }
                .hover-bg:hover {
                    background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'} !important;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                `}
            </style>
            {showCreateModal && (
                <CreateSchoolModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={handleSuccess}
                />
            )}
            <header className="page-header">
                <div>
                    <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }} className="text-gradient">System Overview</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Real-time monitoring of all registered schools.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn"
                        style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.2)' }}
                        onClick={async () => {
                            const conf = window.confirm("Seed 50 dummy schools? This will delete old dummy ones.");
                            if (!conf) return;
                            await seedDummySchools();
                            alert("Seeded 50 dummy schools! Data will refresh momentarily.");
                        }}
                    >
                        Seed Schools (Temp)
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <Plus size={20} />
                        Register New School
                    </button>
                </div>
            </header>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {stats.map((stat, index) => (
                    <div key={index} className="card glass" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5rem',
                        background: !isDark ? stat.color : undefined,
                        boxShadow: !isDark ? '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' : undefined,
                        border: !isDark ? 'none' : undefined
                    }}>
                        <div style={{
                            padding: '1rem',
                            borderRadius: '16px',
                            background: !isDark ? 'rgba(255, 255, 255, 0.25)' : `${stat.color}15`,
                            color: !isDark ? '#ffffff' : stat.color,
                            boxShadow: !isDark ? 'none' : `inset 0 0 12px ${stat.color}10`
                        }}>
                            <stat.icon size={28} />
                        </div>
                        <div>
                            <p style={{ color: !isDark ? 'rgba(255, 255, 255, 0.9)' : 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '500' }}>{stat.label}</p>
                            <h3 style={{ color: !isDark ? '#ffffff' : undefined, fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.02em' }}>{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Schools Section */}
            <div className="card glass" style={{ padding: '0', overflow: 'hidden', background: !isDark ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : undefined, border: !isDark ? 'none' : undefined, boxShadow: !isDark ? '0 10px 30px -5px rgba(99, 102, 241, 0.4)' : undefined }}>
                <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: !isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {[
                            { id: 'recent', label: 'Recently Registered Schools', count: totalRecent },
                            { id: 'active', label: 'Active Schools', count: totalActive },
                            { id: 'unpaid', label: 'Unpaid Schools', count: totalUnpaid },
                            { id: 'suspended', label: 'Suspended Schools', count: totalSuspended },
                        ].map(tab => {
                            const isActive = activeTab === tab.id;

                            let activeColor = '#4f46e5';
                            if (tab.id === 'recent') activeColor = '#3b82f6'; // Blue
                            if (tab.id === 'active') activeColor = '#10b981'; // Emerald
                            if (tab.id === 'unpaid') activeColor = '#f59e0b'; // Amber
                            if (tab.id === 'suspended') activeColor = '#ef4444'; // Red

                            return (
                                <button
                                    key={tab.id}
                                    className="tab-btn-3d"
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        background: isActive ? activeColor : (!isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'),
                                        border: isActive ? `1px solid ${activeColor}` : (!isDark ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent'),
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        fontWeight: isActive ? '700' : '600',
                                        color: '#ffffff',
                                        borderRadius: '24px',
                                        padding: '0.6rem 1.4rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.6rem',
                                        boxShadow: isActive ? `0 6px 16px -4px ${activeColor}` : (!isDark ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none')
                                    }}
                                >
                                    {tab.label}
                                    <span style={{
                                        background: '#ef4444',
                                        color: '#ffffff',
                                        padding: '0.15rem 0.6rem',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)'
                                    }}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn" style={{ background: !isDark ? 'rgba(255,255,255,0.1)' : 'var(--card-inner-bg)', border: !isDark ? '1px solid rgba(255,255,255,0.2)' : 'none', borderRadius: '50%', color: !isDark ? '#ffffff' : undefined, padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Filter size={18} /></button>
                        <button className="btn" style={{ background: !isDark ? 'rgba(255,255,255,0.1)' : 'var(--card-inner-bg)', border: !isDark ? '1px solid rgba(255,255,255,0.2)' : 'none', borderRadius: '50%', color: !isDark ? '#ffffff' : undefined, padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Search size={18} /></button>
                    </div>
                </div>

                <div className="custom-blue-scrollbar" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '720px', background: !isDark ? '#f0f9ff' : undefined }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead className="sticky-header">
                            <tr style={{ textAlign: 'left', background: isDark ? 'rgba(0,0,0,0.6)' : '#ffffff', borderBottom: !isDark ? '1px solid #e2e8f0' : 'none' }}>
                                <th style={{ padding: '1.25rem', color: !isDark ? '#1e293b' : 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>School Name</th>
                                <th style={{ padding: '1.25rem', color: !isDark ? '#1e293b' : 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID</th>
                                <th style={{ padding: '1.25rem', color: !isDark ? '#1e293b' : 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subscription</th>
                                <th style={{ padding: '1.25rem', color: !isDark ? '#1e293b' : 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trial Status</th>
                                <th style={{ padding: '1.25rem', color: !isDark ? '#1e293b' : 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                <th style={{ padding: '1.25rem' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedSchools.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: !isDark ? '#475569' : 'var(--text-muted)' }}>
                                        {activeTab === 'recent'
                                            ? "No schools registered yet."
                                            : activeTab === 'unpaid'
                                                ? "No unpaid schools found."
                                                : activeTab === 'suspended'
                                                    ? "No suspended schools found."
                                                    : "No active schools found."}
                                    </td>
                                </tr>
                            ) : displayedSchools.map((school) => (
                                <tr key={school.id} style={{ borderBottom: !isDark ? '1px solid #bae6fd' : '1px solid var(--glass-border)', transition: 'var(--transition)' }} className="table-row-hover">
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '12px',
                                                background: !isDark ? '#ffffff' : 'linear-gradient(135deg, #1e293b, #334155)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: !isDark ? '1px solid #bae6fd' : '1px solid rgba(255,255,255,0.05)',
                                                boxShadow: !isDark ? '0 2px 4px rgba(0,0,0,0.03)' : 'none'
                                            }}>
                                                <School size={20} color={!isDark ? '#3b82f6' : 'var(--primary)'} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', color: !isDark ? '#0f172a' : 'var(--text-main)' }}>{school.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: !isDark ? '#475569' : 'var(--text-muted)' }}>{school.address}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <code style={{ background: !isDark ? '#dbeafe' : 'rgba(99, 102, 241, 0.1)', color: !isDark ? '#2563eb' : 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                                            {school.id}
                                        </code>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <span style={{
                                            padding: '0.4rem 0.8rem',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            background: school.paymentStatus === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                            color: school.paymentStatus === 'paid' ? (!isDark ? '#059669' : '#34d399') : (!isDark ? '#d97706' : '#fbbf24'),
                                            border: school.paymentStatus === 'paid' ? (!isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(16, 185, 129, 0.2)') : (!isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(245, 158, 11, 0.2)')
                                        }}>{school.paymentStatus || 'unpaid'}</span>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        {school.trialInfo?.notStarted ? (
                                            <button
                                                onClick={() => handleStartTrial(school.id)}
                                                className="btn"
                                                style={{
                                                    padding: '0.4rem 0.8rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '600',
                                                    background: !isDark ? '#ffffff' : 'var(--card-inner-bg)',
                                                    color: !isDark ? '#0f172a' : 'var(--text-main)',
                                                    border: !isDark ? '1px solid #bae6fd' : '1px dashed var(--glass-border)',
                                                    cursor: 'pointer'
                                                }}>
                                                Start Trial
                                            </button>
                                        ) : (
                                            <span style={{
                                                padding: '0.4rem 0.8rem',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                                background: school.trialInfo?.isExpired ? 'rgba(239, 68, 68, 0.15)' : (!isDark ? '#e0e7ff' : 'rgba(99, 102, 241, 0.15)'),
                                                color: school.trialInfo?.isExpired ? (!isDark ? '#dc2626' : '#f87171') : (!isDark ? '#4f46e5' : 'var(--primary)'),
                                                border: school.trialInfo?.isExpired ? (!isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.2)') : (!isDark ? '1px solid #c7d2fe' : '1px solid rgba(99, 102, 241, 0.2)'),
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}>
                                                {school.trialInfo?.isExpired ? 'Trial Ended' : `${school.trialInfo?.daysLeft} Days Left`}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <span style={{
                                            padding: '0.4rem 0.8rem',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            background: school.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            color: school.status === 'active' ? (!isDark ? '#059669' : '#34d399') : (!isDark ? '#dc2626' : '#f87171'),
                                            border: school.status === 'active' ? (!isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(16, 185, 129, 0.2)') : (!isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.2)')
                                        }}>
                                            {school.status === 'active' ? 'Active' : (school.status === 'stop' ? 'Stopped' : 'Suspended')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1.25rem', position: 'relative' }}>
                                        {openMenuId !== school.id && (
                                            <button
                                                className="menu-trigger"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(school.id);
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: !isDark ? '#64748b' : 'var(--text-muted)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <MoreVertical size={20} />
                                            </button>
                                        )}

                                        {openMenuId === school.id && (
                                            <div
                                                ref={menuRef}
                                                style={{
                                                    position: 'absolute',
                                                    right: '1.25rem',
                                                    top: '1.25rem',
                                                    background: isDark ? '#1e293b' : '#ffffff',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '12px',
                                                    boxShadow: '0 15px 30px -10px rgba(0, 0, 0, 0.3), 0 10px 15px -5px rgba(0, 0, 0, 0.2)',
                                                    zIndex: 9999,
                                                    width: '200px',
                                                    overflow: 'hidden',
                                                    animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                                }}
                                            >
                                                <button
                                                    onClick={() => {
                                                        setOpenMenuId(null);
                                                        navigate(`/schools/${school.id}`);
                                                    }}
                                                    style={{ width: '100%', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.875rem', textAlign: 'left' }}
                                                    className="hover-bg"
                                                >
                                                    <Eye size={18} className="text-primary" /> View School
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        togglePaymentStatus(school.id, school.paymentStatus);
                                                    }}
                                                    style={{ width: '100%', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.875rem', textAlign: 'left' }}
                                                    className="hover-bg"
                                                >
                                                    {school.paymentStatus === 'paid' ? <XCircle size={18} className="text-danger" /> : <CheckCircle size={18} className="text-success" />}
                                                    Mark as {school.paymentStatus === 'paid' ? 'Unpaid' : 'Paid'}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleSchoolStatus(school.id, school.status);
                                                    }}
                                                    style={{ width: '100%', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.875rem', textAlign: 'left' }}
                                                    className="hover-bg"
                                                >
                                                    {school.status === 'active' ? <StopCircle size={18} className="text-danger" /> : <PlayCircle size={18} className="text-success" />}
                                                    {school.status === 'active' ? 'Stop School' : 'Start School'}
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
