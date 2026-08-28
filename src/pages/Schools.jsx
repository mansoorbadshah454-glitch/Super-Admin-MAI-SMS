import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Search, Filter, Plus, MoreHorizontal, ExternalLink, Trash2, Edit2, Users, MapPin, Power, CreditCard, Megaphone, RotateCcw, X, SlidersHorizontal } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy, getCountFromServer, where, Timestamp, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import CreateSchoolModal from '../components/CreateSchoolModal';
import InlineEditSchool from '../components/InlineEditSchool';
import DeleteSchoolModal from '../components/DeleteSchoolModal';
import BroadcastModal from '../components/BroadcastModal';
import { calculateTrialDays } from '../utils/dateUtils';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Schools = () => {
    const { hasPermission, isMasterAdmin } = useAdminAuth();
    const [schools, setSchools] = useState([]);
    const [stats, setStats] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedState, setSelectedState] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [schoolToDelete, setSchoolToDelete] = useState(null);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const navigate = useNavigate();

    const fetchSchoolStats = async (schoolId) => {
        try {
            const studentsRef = collection(db, `schools/${schoolId}/students`);
            let total = 0;
            try {
                const totalSnapshot = await getCountFromServer(studentsRef);
                total = totalSnapshot.data()?.count || 0;
            } catch (err) {
                console.warn(`Total students count error for ${schoolId}:`, err.message);
            }

            setStats(prev => ({
                ...prev,
                [schoolId]: { total }
            }));
        } catch (error) {
            console.error(`Error fetching stats for school ${schoolId}:`, error);
        }
    };

    useEffect(() => {
        const q = collection(db, "schools");
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => {
                const data = doc.data() || {};
                const trialInfo = calculateTrialDays(data.trialStartDate);
                list.push({ id: doc.id, ...data, trialInfo });
            });
            list.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0));
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0));
                return timeB - timeA;
            });
            setSchools(list);

            // Fetch stats for each school
            list.forEach(school => {
                if (school.id) {
                    fetchSchoolStats(school.id);
                }
            });
        }, (error) => {
            console.error("Super Admin Schools query error:", error);
        });
        return () => unsubscribe();
    }, []);

    const handleTogglePayment = async (schoolId, currentStatus) => {
        if (!isMasterAdmin && !hasPermission('manageBilling')) {
            alert("Permission Denied: You do not have permission to manage school billing.");
            return;
        }
        try {
            const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
            await updateDoc(doc(db, "schools", schoolId), {
                paymentStatus: newStatus,
                updatedAt: new Date()
            });
        } catch (error) {
            alert("Failed to update payment status: " + error.message);
        }
    };

    const handleToggleSystemStatus = async (schoolId, currentStatus) => {
        if (!isMasterAdmin && !hasPermission('systemControl')) {
            alert("Permission Denied: You do not have permission to start/stop school systems.");
            return;
        }
        try {
            const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
            await updateDoc(doc(db, "schools", schoolId), {
                status: newStatus,
                updatedAt: new Date()
            });
        } catch (error) {
            alert("Failed to update system status: " + error.message);
        }
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

    const pakistanStates = [
        'Punjab',
        'Sindh',
        'Khyber Pakhtunkhwa',
        'Balochistan',
        'Islamabad (ICT)',
        'Azad Jammu & Kashmir',
        'Gilgit-Baltistan'
    ];

    // Dynamic unique districts and cities extracted from existing schools
    const availableDistricts = [...new Set(
        schools
            .filter(s => !selectedState || (s.state || '').toLowerCase() === selectedState.toLowerCase())
            .map(s => s.district)
            .filter(Boolean)
    )].sort();

    const availableCities = [...new Set(
        schools
            .filter(s => (!selectedState || (s.state || '').toLowerCase() === selectedState.toLowerCase()) &&
                         (!selectedDistrict || (s.district || '').toLowerCase() === selectedDistrict.toLowerCase()))
            .map(s => s.city)
            .filter(Boolean)
    )].sort();

    const activeFilterCount = (selectedState ? 1 : 0) + (selectedDistrict ? 1 : 0) + (selectedCity ? 1 : 0);

    const handleResetFilters = () => {
        setSelectedState('');
        setSelectedDistrict('');
        setSelectedCity('');
        setSearchTerm('');
    };

    const sortedForIds = [...schools].sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0));
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0));
        return timeB - timeA;
    });

    const filteredSchools = sortedForIds.filter(s => {
        const term = searchTerm.toLowerCase().trim();
        const nameMatch = (s.name || s.schoolName || '').toLowerCase().includes(term);
        const idMatch = (s.id || '').toLowerCase().includes(term);
        const contactMatch = (s.contact || s.schoolContact || '').toLowerCase().includes(term);
        const addressMatch = (s.address || '').toLowerCase().includes(term);
        const cityMatch = (s.city || '').toLowerCase().includes(term);
        const districtMatch = (s.district || '').toLowerCase().includes(term);
        const stateMatch = (s.state || '').toLowerCase().includes(term);

        const matchesSearch = !term || nameMatch || idMatch || contactMatch || addressMatch || cityMatch || districtMatch || stateMatch;
        const matchesState = !selectedState || (s.state || '').toLowerCase() === selectedState.toLowerCase();
        const matchesDistrict = !selectedDistrict || (s.district || '').toLowerCase() === selectedDistrict.toLowerCase();
        const matchesCity = !selectedCity || (s.city || '').toLowerCase() === selectedCity.toLowerCase();

        return matchesSearch && matchesState && matchesDistrict && matchesCity;
    });

    const pulseKeyframes = `
        @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.5; }
        }
    `;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <style>{pulseKeyframes}</style>
            {schoolToDelete && (
                <DeleteSchoolModal
                    school={schoolToDelete}
                    onClose={() => setSchoolToDelete(null)}
                    onSuccess={() => setSchoolToDelete(null)}
                />
            )}
            {showCreateModal && (
                <CreateSchoolModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => setShowCreateModal(false)}
                />
            )}
            {showBroadcastModal && (
                <BroadcastModal
                    onClose={() => setShowBroadcastModal(false)}
                />
            )}

            <header className="page-header">
                <div>
                    <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }} className="text-gradient">Schools Directory</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Manage and monitor all school registrations.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn"
                        style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
                        onClick={() => setShowBroadcastModal(true)}
                    >
                        <Megaphone size={20} />
                        Broadcast Message
                    </button>
                    {(isMasterAdmin || hasPermission('manageSchools')) && (
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowCreateModal(true)}
                        >
                            <Plus size={20} />
                            Register New School
                        </button>
                    )}
                </div>
            </header>

            {/* SEARCH & FILTERS SECTION */}
            <div className="card glass" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 280px', position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                        <input
                            type="text"
                            placeholder="Search by school name, city, district, or ID..."
                            className="input-field"
                            style={{ width: '100%', paddingLeft: '3rem', marginBottom: '0' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        className="btn"
                        onClick={() => setShowFilterPanel(!showFilterPanel)}
                        style={{
                            background: showFilterPanel || activeFilterCount > 0 ? 'rgba(37, 99, 235, 0.15)' : 'var(--card-inner-bg)',
                            color: showFilterPanel || activeFilterCount > 0 ? '#1d4ed8' : 'inherit',
                            borderColor: showFilterPanel || activeFilterCount > 0 ? 'rgba(37, 99, 235, 0.4)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: '600'
                        }}
                    >
                        <Filter size={18} />
                        Filters
                        {activeFilterCount > 0 && (
                            <span style={{
                                background: '#2563eb',
                                color: 'white',
                                borderRadius: '999px',
                                padding: '0.1rem 0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                            }}>
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                    {(activeFilterCount > 0 || searchTerm) && (
                        <button
                            className="btn"
                            onClick={handleResetFilters}
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#dc2626',
                                borderColor: 'rgba(239, 68, 68, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontSize: '0.85rem'
                            }}
                            title="Reset all filters and search"
                        >
                            <RotateCcw size={15} />
                            Reset
                        </button>
                    )}
                </div>

                {/* EXPANDABLE FILTER CONTROLS */}
                {showFilterPanel && (
                    <div style={{
                        marginTop: '1.25rem',
                        paddingTop: '1.25rem',
                        borderTop: '1px solid #bae6fd',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem'
                    }} className="animate-in slide-in-from-top duration-300">
                        {/* State Filter */}
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1e40af', marginBottom: '0.35rem', display: 'block', textTransform: 'uppercase' }}>
                                🏛️ State / Province
                            </label>
                            <select
                                className="input-field"
                                style={{ width: '100%', marginBottom: 0, padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
                                value={selectedState}
                                onChange={(e) => {
                                    setSelectedState(e.target.value);
                                    setSelectedDistrict('');
                                    setSelectedCity('');
                                }}
                            >
                                <option value="">All States / Provinces</option>
                                {pakistanStates.map((st) => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                        </div>

                        {/* District Filter */}
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1e40af', marginBottom: '0.35rem', display: 'block', textTransform: 'uppercase' }}>
                                🏢 District
                            </label>
                            <select
                                className="input-field"
                                style={{ width: '100%', marginBottom: 0, padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
                                value={selectedDistrict}
                                onChange={(e) => {
                                    setSelectedDistrict(e.target.value);
                                    setSelectedCity('');
                                }}
                            >
                                <option value="">All Districts ({availableDistricts.length})</option>
                                {availableDistricts.map((dst) => (
                                    <option key={dst} value={dst}>{dst}</option>
                                ))}
                            </select>
                        </div>

                        {/* City Filter */}
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1e40af', marginBottom: '0.35rem', display: 'block', textTransform: 'uppercase' }}>
                                📍 City
                            </label>
                            <select
                                className="input-field"
                                style={{ width: '100%', marginBottom: 0, padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
                                value={selectedCity}
                                onChange={(e) => setSelectedCity(e.target.value)}
                            >
                                <option value="">All Cities ({availableCities.length})</option>
                                {availableCities.map((cty) => (
                                    <option key={cty} value={cty}>{cty}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.5rem'
            }}>
                {filteredSchools.map((school) => {
                    const displayId = school.id;
                    const isEditing = selectedSchool && selectedSchool.id === school.id;

                    return (
                        <div key={school.id} className="card animate-in zoom-in duration-500" style={{ padding: 0, overflow: 'hidden', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '24px' }}>
                            {isEditing ? (
                                <InlineEditSchool 
                                    school={school} 
                                    displayId={displayId}
                                    onClose={() => setSelectedSchool(null)} 
                                    onSuccess={() => setSelectedSchool(null)} 
                                />
                            ) : (
                                <div
                                    onClick={() => navigate(`/schools/${school.id}`)}
                                    style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
                                >
                            {/* --- HEADER --- */}
                            <div style={{ background: '#bfdbfe', padding: '1.5rem', borderBottom: '1px solid #93c5fd' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: '16px',
                                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)'
                                    }}>
                                        <School size={28} color="white" />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                        {(isMasterAdmin || hasPermission('manageSchools')) && (
                                            <button className="logout-btn" onClick={() => setSelectedSchool(school)} style={{ padding: '0.5rem', color: '#1e40af', background: 'rgba(255,255,255,0.5)', borderRadius: '12px' }} title="Edit School">
                                                <Edit2 size={18} />
                                            </button>
                                        )}
                                        {(isMasterAdmin || hasPermission('deleteSchool')) && (
                                            <button className="logout-btn" onClick={() => setSchoolToDelete(school)} style={{ padding: '0.5rem', color: '#dc2626', background: 'rgba(255,255,255,0.5)', borderRadius: '12px' }} title="Delete School">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                        <button className="logout-btn" style={{ padding: '0.5rem', color: '#1e40af', background: 'rgba(255,255,255,0.5)', borderRadius: '12px' }} title="School Website">
                                            <ExternalLink size={18} />
                                        </button>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3
                                        className="clickable-title"
                                        style={{ fontSize: '1.25rem', margin: 0, color: '#1e3a8a', fontWeight: 'bold' }}
                                    >
                                        {school.name || school.schoolName || 'Unnamed School'}
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '8px',
                                            fontSize: '0.65rem',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            background: school.status === 'active' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                                            color: school.status === 'active' ? '#059669' : '#dc2626'
                                        }}>
                                            {school.status || 'inactive'}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleSystemStatus(school.id, school.status); }}
                                            className="btn"
                                            style={{
                                                padding: '0.4rem 0.8rem',
                                                fontSize: '0.7rem',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                background: school.status === 'suspended' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: school.status === 'suspended' ? '#059669' : '#dc2626',
                                                borderColor: school.status === 'suspended' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                borderRadius: '8px'
                                            }}
                                        >
                                            <Power size={14} />
                                            {school.status === 'suspended' ? 'Start' : 'Stop'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* --- BODY --- */}
                            <div style={{ padding: '1.5rem' }}>
                                {/* Formatted Address & City Block */}
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.7)',
                                    padding: '0.85rem 1rem',
                                    borderRadius: '16px',
                                    border: '1px solid #bae6fd',
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem'
                                }}>
                                    {(school.city || school.district || school.state) && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                                            {school.city && (
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: '800',
                                                    padding: '0.2rem 0.55rem',
                                                    borderRadius: '6px',
                                                    background: '#dbeafe',
                                                    color: '#1e40af',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.04em',
                                                    display: 'inline-flex',
                                                    alignItems: 'center'
                                                }}>
                                                    📍 {school.city}
                                                </span>
                                            )}
                                            {school.district && school.district.toLowerCase() !== (school.city || '').toLowerCase() && (
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: '700',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '6px',
                                                    background: 'rgba(255,255,255,0.85)',
                                                    color: '#334155',
                                                    border: '1px solid #cbd5e1'
                                                }}>
                                                    Dist. {school.district}
                                                </span>
                                            )}
                                            {school.state && (
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: '700',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '6px',
                                                    background: 'rgba(99, 102, 241, 0.1)',
                                                    color: '#4f46e5',
                                                    border: '1px solid rgba(99, 102, 241, 0.2)'
                                                }}>
                                                    {school.state}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                                        <MapPin size={15} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
                                        <p style={{
                                            color: '#1e293b',
                                            fontSize: '0.85rem',
                                            margin: 0,
                                            fontWeight: '500',
                                            lineHeight: '1.4',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}>
                                            {school.address || 'No address provided'}
                                        </p>
                                    </div>
                                </div>

                                {/* Total Students Box (Clean Full Width) */}
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.7)',
                                    padding: '0.85rem 1.2rem',
                                    borderRadius: '16px',
                                    border: '1px solid #bae6fd',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '1.25rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <div style={{
                                            padding: '0.45rem',
                                            borderRadius: '10px',
                                            background: '#dbeafe',
                                            color: '#1e40af',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Users size={18} />
                                        </div>
                                        <div>
                                            <div style={{ color: '#1e40af', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Total Students
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Enrolled count</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1e3a8a' }}>
                                        {stats[school.id]?.total ?? '...'}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #bae6fd' }}>
                                    <span style={{
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        textTransform: 'uppercase',
                                        background: school.paymentStatus === 'paid' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                        color: school.paymentStatus === 'paid' ? '#059669' : '#d97706'
                                    }}>
                                        {school.paymentStatus || 'unpaid'}
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleTogglePayment(school.id, school.paymentStatus); }}
                                        className="btn"
                                        style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            fontSize: '0.75rem',
                                            justifyContent: 'center',
                                            gap: '0.4rem',
                                            background: school.paymentStatus === 'paid' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                            color: school.paymentStatus === 'paid' ? '#d97706' : '#059669',
                                            borderColor: school.paymentStatus === 'paid' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'
                                        }}
                                    >
                                        <CreditCard size={14} />
                                        {school.paymentStatus === 'paid' ? 'Unpay' : 'Pay'}
                                    </button>
                                </div>

                                <div style={{ marginTop: '1rem', flexGrow: 1 }}>
                                    <code style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: '600' }}>{displayId}</code>
                                </div>

                                {/* 7-Day Trial Status Badge Section */}
                                {school.trialInfo?.notStarted ? (
                                    <div style={{
                                        marginTop: '0.75rem',
                                        padding: '0.75rem',
                                        borderRadius: '12px',
                                        background: 'rgba(255,255,255,0.6)',
                                        border: '1px dashed #bae6fd',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>7-Day Trial</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Not Started</div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleStartTrial(school.id); }}
                                            className="btn btn-primary"
                                            style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}
                                        >
                                            Start Trial
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{
                                        marginTop: '0.75rem',
                                        padding: '0.75rem',
                                        borderRadius: '12px',
                                        background: school.trialInfo?.isExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                        border: school.trialInfo?.isExpired ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: '#475569' }}>7-Day Trial</div>
                                            <div style={{ fontSize: '0.8rem', color: '#1e293b' }}>Started: {school.trialInfo?.startDateFormatted}</div>
                                        </div>
                                        <div style={{
                                            fontWeight: '700',
                                            fontSize: '0.85rem',
                                            color: school.trialInfo?.isExpired ? '#dc2626' : '#4f46e5'
                                        }}>
                                            {school.trialInfo?.isExpired ? 'Trial Expired' : `${school.trialInfo?.daysLeft} Days Left`}
                                        </div>
                                    </div>
                                )}
                            </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {
                filteredSchools.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '5rem' }}>
                        <div style={{ opacity: 0.2, marginBottom: '1rem' }}><Search size={64} style={{ margin: '0 auto' }} /></div>
                        <h3 style={{ color: 'var(--text-muted)' }}>No schools found matching your search.</h3>
                    </div>
                )
            }
        </div >
    );
};

export default Schools;
