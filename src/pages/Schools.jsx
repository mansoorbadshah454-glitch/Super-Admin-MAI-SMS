import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    School, Search, Filter, Plus, MoreHorizontal, ExternalLink, Trash2, Edit2, 
    Users, MapPin, Power, CreditCard, Megaphone, RotateCcw, X, SlidersHorizontal,
    Table as TableIcon, LayoutGrid, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Calendar, CheckCircle, AlertTriangle, ArrowRight
} from 'lucide-react';
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
    
    // View Mode & Pagination states (Windows 7 / XP Explorer Style)
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem('super_admin_schools_view') || 'table';
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const navigate = useNavigate();

    const handleViewModeChange = (mode) => {
        setViewMode(mode);
        localStorage.setItem('super_admin_schools_view', mode);
    };

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
        setCurrentPage(1);
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

    // Reset pagination on filter or search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedState, selectedDistrict, selectedCity]);

    // Pagination calculations
    const totalItems = filteredSchools.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedSchools = filteredSchools.slice(startIndex, endIndex);

    return (
        <div className="animate-in fade-in duration-300">
            {/* Modal for Inline Edit in Table View */}
            {selectedSchool && viewMode === 'table' && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div style={{ width: '100%', maxWidth: '640px', background: '#FFFFFF', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                        <InlineEditSchool
                            school={selectedSchool}
                            displayId={selectedSchool.id}
                            onClose={() => setSelectedSchool(null)}
                            onSuccess={() => setSelectedSchool(null)}
                        />
                    </div>
                </div>
            )}

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

            {/* PAGE HEADER */}
            <header className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.85rem', marginBottom: '0.2rem' }} className="text-gradient">Schools Directory</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                        Manage, monitor and supervise all registered school client instances.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        className="btn"
                        style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '0.6rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => setShowBroadcastModal(true)}
                    >
                        <Megaphone size={17} />
                        Broadcast
                    </button>
                    {(isMasterAdmin || hasPermission('manageSchools')) && (
                        <button
                            className="btn btn-primary"
                            style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                            onClick={() => setShowCreateModal(true)}
                        >
                            <Plus size={18} />
                            Register New School
                        </button>
                    )}
                </div>
            </header>

            {/* WINDOWS 7 / XP STYLE TOOLBAR & FILTERS */}
            <div
                style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '1.25rem',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    {/* Left: Search Bar */}
                    <div style={{ flex: '1 1 280px', position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} size={16} />
                        <input
                            type="text"
                            placeholder="Search by school name, city, district, or ID..."
                            style={{
                                width: '100%',
                                paddingLeft: '34px',
                                paddingRight: '12px',
                                paddingTop: '7px',
                                paddingBottom: '7px',
                                borderRadius: '4px',
                                border: '1px solid #94A3B8',
                                fontSize: '13px',
                                outline: 'none',
                                color: '#1E293B',
                                boxSizing: 'border-box'
                            }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Middle: Filter Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={() => setShowFilterPanel(!showFilterPanel)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                background: showFilterPanel || activeFilterCount > 0 ? '#EFF6FF' : '#F8FAFC',
                                color: showFilterPanel || activeFilterCount > 0 ? '#1D4ED8' : '#334155',
                                fontSize: '12.5px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            <Filter size={15} />
                            Filters
                            {activeFilterCount > 0 && (
                                <span style={{
                                    background: '#2563EB',
                                    color: '#FFFFFF',
                                    borderRadius: '999px',
                                    padding: '0.1rem 0.45rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold'
                                }}>
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {(activeFilterCount > 0 || searchTerm) && (
                            <button
                                onClick={handleResetFilters}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid #FCA5A5',
                                    background: '#FEF2F2',
                                    color: '#DC2626',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                                title="Reset filters"
                            >
                                <RotateCcw size={13} />
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Right: Counter & Windows Explorer View Switcher */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                            Total: <strong style={{ color: '#1E293B' }}>{filteredSchools.length}</strong> schools
                        </span>

                        {/* View Switcher Button Group */}
                        <div
                            style={{
                                display: 'inline-flex',
                                backgroundColor: '#F1F5F9',
                                border: '1px solid #CBD5E1',
                                borderRadius: '5px',
                                padding: '2px',
                                gap: '2px'
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => handleViewModeChange('table')}
                                title="Table / Details View"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 12px',
                                    borderRadius: '3px',
                                    border: 'none',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    backgroundColor: viewMode === 'table' ? '#2563EB' : 'transparent',
                                    color: viewMode === 'table' ? '#FFFFFF' : '#475569',
                                    boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <TableIcon size={14} />
                                Table
                            </button>

                            <button
                                type="button"
                                onClick={() => handleViewModeChange('grid')}
                                title="Grid / Tiles View"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 12px',
                                    borderRadius: '3px',
                                    border: 'none',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    backgroundColor: viewMode === 'grid' ? '#2563EB' : 'transparent',
                                    color: viewMode === 'grid' ? '#FFFFFF' : '#475569',
                                    boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <LayoutGrid size={14} />
                                Grid
                            </button>
                        </div>
                    </div>
                </div>

                {/* EXPANDABLE FILTER CONTROLS */}
                {showFilterPanel && (
                    <div style={{
                        paddingTop: '10px',
                        borderTop: '1px solid #E2E8F0',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '10px'
                    }}>
                        {/* State Filter */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#1E40AF', marginBottom: '3px', display: 'block', textTransform: 'uppercase' }}>
                                State / Province
                            </label>
                            <select
                                style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', background: '#FFFFFF' }}
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
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#1E40AF', marginBottom: '3px', display: 'block', textTransform: 'uppercase' }}>
                                District
                            </label>
                            <select
                                style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', background: '#FFFFFF' }}
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
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#1E40AF', marginBottom: '3px', display: 'block', textTransform: 'uppercase' }}>
                                City
                            </label>
                            <select
                                style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', background: '#FFFFFF' }}
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

            {/* 1. TABLE / DETAILS VIEW (HIGH CAPACITY FOR 1000s OF SCHOOLS) */}
            {viewMode === 'table' && (
                <div
                    style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                    }}
                >
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                            <thead>
                                <tr style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%)', borderBottom: '2px solid #CBD5E1', color: '#334155' }}>
                                    <th style={{ padding: '10px 14px', fontWeight: '700', width: '22%' }}>School Name & ID</th>
                                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '15%' }}>Location</th>
                                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '10%' }}>Students</th>
                                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '14%' }}>Subscription Fee</th>
                                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '11%' }}>Payment</th>
                                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '11%' }}>System Status</th>
                                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '10%' }}>7-Day Trial</th>
                                    <th style={{ padding: '10px 14px', fontWeight: '700', width: '7%', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedSchools.map((school, index) => {
                                    const displayId = school.id;
                                    const totalStudents = stats[school.id]?.total ?? '...';
                                    const feeAmount = school.billingCycle === 'yearly' 
                                        ? Number(school.yearlySubscriptionFee || 50000).toLocaleString() 
                                        : Number(school.monthlySubscriptionFee || 5000).toLocaleString();
                                    const cycleLabel = school.billingCycle === 'yearly' ? 'yr' : 'mo';
                                    const isPaid = school.paymentStatus === 'paid';
                                    const isActive = school.status === 'active';

                                    return (
                                        <tr
                                            key={school.id}
                                            onClick={() => navigate(`/schools/${school.id}`)}
                                            style={{
                                                backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                                                borderBottom: '1px solid #E2E8F0',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.1s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}
                                        >
                                            {/* School Name & ID */}
                                            <td style={{ padding: '10px 14px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                                    <div style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '6px',
                                                        background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#FFFFFF',
                                                        flexShrink: 0
                                                    }}>
                                                        <School size={16} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '700', color: '#1E3A8A', fontSize: '13px' }}>
                                                            {school.name || school.schoolName || 'Unnamed School'}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                                                            {displayId}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Location */}
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#334155', fontWeight: '500' }}>
                                                    <MapPin size={13} style={{ color: '#2563EB', flexShrink: 0 }} />
                                                    <span>{school.city || school.district || 'N/A'}</span>
                                                </div>
                                                {school.state && (
                                                    <div style={{ fontSize: '11px', color: '#64748B', paddingLeft: '17px' }}>
                                                        {school.state}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Students */}
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: '#EFF6FF',
                                                    color: '#1E40AF',
                                                    fontWeight: '700',
                                                    fontSize: '12px'
                                                }}>
                                                    <Users size={12} />
                                                    {totalStudents}
                                                </span>
                                            </td>

                                            {/* Subscription Rate */}
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ fontWeight: '700', color: '#0F172A' }}>
                                                    ₨ {feeAmount}
                                                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>/{cycleLabel}</span>
                                                </div>
                                                <div style={{ fontSize: '10.5px', color: '#64748B', textTransform: 'capitalize' }}>
                                                    {school.billingCycle === 'yearly' ? 'Yearly Plan' : 'Monthly Plan'}
                                                </div>
                                            </td>

                                            {/* Payment Status & Toggle */}
                                            <td style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        padding: '2px 7px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        textTransform: 'uppercase',
                                                        backgroundColor: isPaid ? '#DEF7EC' : '#FEF08A',
                                                        color: isPaid ? '#03543F' : '#854D0E',
                                                        border: isPaid ? '1px solid #84E1BC' : '1px solid #FDE047'
                                                    }}>
                                                        {school.paymentStatus || 'unpaid'}
                                                    </span>
                                                    <button
                                                        onClick={() => handleTogglePayment(school.id, school.paymentStatus)}
                                                        title="Toggle Payment Status"
                                                        style={{
                                                            padding: '3px 6px',
                                                            borderRadius: '3px',
                                                            border: '1px solid #CBD5E1',
                                                            backgroundColor: '#FFFFFF',
                                                            color: isPaid ? '#D97706' : '#059669',
                                                            cursor: 'pointer',
                                                            fontSize: '10.5px',
                                                            fontWeight: '600'
                                                        }}
                                                    >
                                                        {isPaid ? 'Unpay' : 'Pay'}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* System Status & Toggle */}
                                            <td style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        padding: '2px 7px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        textTransform: 'uppercase',
                                                        backgroundColor: isActive ? '#DEF7EC' : '#FDE8E8',
                                                        color: isActive ? '#03543F' : '#9B1C1C',
                                                        border: isActive ? '1px solid #84E1BC' : '1px solid #F8B4B4'
                                                    }}>
                                                        {school.status || 'inactive'}
                                                    </span>
                                                    <button
                                                        onClick={() => handleToggleSystemStatus(school.id, school.status)}
                                                        title="Start/Stop System"
                                                        style={{
                                                            padding: '3px 6px',
                                                            borderRadius: '3px',
                                                            border: '1px solid #CBD5E1',
                                                            backgroundColor: '#FFFFFF',
                                                            color: school.status === 'suspended' ? '#059669' : '#DC2626',
                                                            cursor: 'pointer',
                                                            fontSize: '10.5px',
                                                            fontWeight: '600',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '3px'
                                                        }}
                                                    >
                                                        <Power size={11} />
                                                        {school.status === 'suspended' ? 'Start' : 'Stop'}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* 7-Day Trial */}
                                            <td style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
                                                {school.trialInfo?.notStarted ? (
                                                    <button
                                                        onClick={() => handleStartTrial(school.id)}
                                                        style={{
                                                            padding: '2px 7px',
                                                            borderRadius: '3px',
                                                            border: '1px solid #93C5FD',
                                                            backgroundColor: '#EFF6FF',
                                                            color: '#1D4ED8',
                                                            fontSize: '11px',
                                                            fontWeight: '600',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Start Trial
                                                    </button>
                                                ) : (
                                                    <span style={{
                                                        padding: '2px 6px',
                                                        borderRadius: '3px',
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        backgroundColor: school.trialInfo?.isExpired ? '#FEE2E2' : '#E0E7FF',
                                                        color: school.trialInfo?.isExpired ? '#991B1B' : '#3730A3'
                                                    }}>
                                                        {school.trialInfo?.isExpired ? 'Expired' : `${school.trialInfo?.daysLeft}d Left`}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td style={{ padding: '10px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    {(isMasterAdmin || hasPermission('manageSchools')) && (
                                                        <button
                                                            onClick={() => setSelectedSchool(school)}
                                                            title="Edit School"
                                                            style={{
                                                                padding: '4px',
                                                                borderRadius: '4px',
                                                                border: '1px solid #CBD5E1',
                                                                backgroundColor: '#FFFFFF',
                                                                color: '#2563EB',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <Edit2 size={13} />
                                                        </button>
                                                    )}
                                                    {(isMasterAdmin || hasPermission('deleteSchool')) && (
                                                        <button
                                                            onClick={() => setSchoolToDelete(school)}
                                                            title="Delete School"
                                                            style={{
                                                                padding: '4px',
                                                                borderRadius: '4px',
                                                                border: '1px solid #FECACA',
                                                                backgroundColor: '#FEF2F2',
                                                                color: '#DC2626',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => navigate(`/schools/${school.id}`)}
                                                        title="Open School Details"
                                                        style={{
                                                            padding: '4px',
                                                            borderRadius: '4px',
                                                            border: '1px solid #CBD5E1',
                                                            backgroundColor: '#FFFFFF',
                                                            color: '#475569',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <ArrowRight size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* TABLE PAGINATION BAR (CRITICAL FOR 1000s OF SCHOOLS) */}
                    <div
                        style={{
                            padding: '10px 16px',
                            backgroundColor: '#F8FAFC',
                            borderTop: '1px solid #E2E8F0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px',
                            fontSize: '12px',
                            color: '#475569'
                        }}
                    >
                        {/* Left: Range Info & Page Size */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span>
                                Showing <strong>{totalItems > 0 ? startIndex + 1 : 0}</strong> - <strong>{endIndex}</strong> of <strong>{totalItems}</strong> schools
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>Per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    style={{
                                        padding: '3px 6px',
                                        borderRadius: '3px',
                                        border: '1px solid #CBD5E1',
                                        fontSize: '12px',
                                        backgroundColor: '#FFFFFF',
                                        color: '#1E293B'
                                    }}
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>

                        {/* Right: Page Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                title="First Page"
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: '3px',
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: currentPage === 1 ? '#F1F5F9' : '#FFFFFF',
                                    color: currentPage === 1 ? '#94A3B8' : '#1E293B',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <ChevronsLeft size={13} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                title="Previous Page"
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: '3px',
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: currentPage === 1 ? '#F1F5F9' : '#FFFFFF',
                                    color: currentPage === 1 ? '#94A3B8' : '#1E293B',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <ChevronLeft size={13} />
                            </button>

                            <span style={{ padding: '0 8px', fontWeight: '700', color: '#1E293B' }}>
                                Page {currentPage} of {totalPages}
                            </span>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage >= totalPages}
                                title="Next Page"
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: '3px',
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: currentPage >= totalPages ? '#F1F5F9' : '#FFFFFF',
                                    color: currentPage >= totalPages ? '#94A3B8' : '#1E293B',
                                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <ChevronRight size={13} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage >= totalPages}
                                title="Last Page"
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: '3px',
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: currentPage >= totalPages ? '#F1F5F9' : '#FFFFFF',
                                    color: currentPage >= totalPages ? '#94A3B8' : '#1E293B',
                                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <ChevronsRight size={13} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. COMPACT GRID / TILES VIEW (SLEEK & NON-BULKY) */}
            {viewMode === 'grid' && (
                <div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '1rem'
                        }}
                    >
                        {paginatedSchools.map((school) => {
                            const displayId = school.id;
                            const isEditing = selectedSchool && selectedSchool.id === school.id;
                            const totalStudents = stats[school.id]?.total ?? '...';
                            const feeAmount = school.billingCycle === 'yearly' 
                                ? Number(school.yearlySubscriptionFee || 50000).toLocaleString() 
                                : Number(school.monthlySubscriptionFee || 5000).toLocaleString();
                            const isPaid = school.paymentStatus === 'paid';
                            const isActive = school.status === 'active';

                            if (isEditing) {
                                return (
                                    <div key={school.id} style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #CBD5E1', overflow: 'hidden' }}>
                                        <InlineEditSchool
                                            school={school}
                                            displayId={displayId}
                                            onClose={() => setSelectedSchool(null)}
                                            onSuccess={() => setSelectedSchool(null)}
                                        />
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={school.id}
                                    onClick={() => navigate(`/schools/${school.id}`)}
                                    style={{
                                        backgroundColor: '#FFFFFF',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '8px',
                                        padding: '12px 14px',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#3B82F6';
                                        e.currentTarget.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = '#CBD5E1';
                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.03)';
                                    }}
                                >
                                    {/* Top Row: School Icon + Name + City + Actions */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '6px',
                                                background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#FFFFFF',
                                                flexShrink: 0
                                            }}>
                                                <School size={18} />
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: '#1E3A8A', lineHeight: 1.3 }}>
                                                    {school.name || school.schoolName || 'Unnamed School'}
                                                </h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                                    <MapPin size={11} style={{ color: '#2563EB' }} />
                                                    <span>{school.city || school.district || 'N/A'}</span>
                                                    {school.state && <span>• {school.state}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                                            {(isMasterAdmin || hasPermission('manageSchools')) && (
                                                <button
                                                    onClick={() => setSelectedSchool(school)}
                                                    title="Edit School"
                                                    style={{ padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#2563EB', cursor: 'pointer' }}
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                            )}
                                            {(isMasterAdmin || hasPermission('deleteSchool')) && (
                                                <button
                                                    onClick={() => setSchoolToDelete(school)}
                                                    title="Delete School"
                                                    style={{ padding: '4px', borderRadius: '4px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Middle Row: Quick Stats */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        backgroundColor: '#F8FAFC',
                                        padding: '6px 10px',
                                        borderRadius: '5px',
                                        fontSize: '11.5px',
                                        border: '1px solid #E2E8F0'
                                    }}>
                                        <div>
                                            <span style={{ color: '#64748B' }}>Students: </span>
                                            <strong style={{ color: '#1E40AF' }}>{totalStudents}</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748B' }}>Fee: </span>
                                            <strong style={{ color: '#0F172A' }}>₨ {feeAmount}</strong>
                                            <span style={{ fontSize: '10px', color: '#64748B' }}>/{school.billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                                        </div>
                                        <div>
                                            {school.trialInfo?.notStarted ? (
                                                <span style={{ color: '#64748B' }}>Trial: Off</span>
                                            ) : (
                                                <span style={{ color: school.trialInfo?.isExpired ? '#DC2626' : '#2563EB', fontWeight: '700' }}>
                                                    {school.trialInfo?.isExpired ? 'Trial End' : `${school.trialInfo?.daysLeft}d left`}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Row: Status Badges & Quick Action Controls */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            paddingTop: '4px',
                                            borderTop: '1px solid #F1F5F9'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Payment */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                fontSize: '10px',
                                                fontWeight: '700',
                                                textTransform: 'uppercase',
                                                backgroundColor: isPaid ? '#DEF7EC' : '#FEF08A',
                                                color: isPaid ? '#03543F' : '#854D0E'
                                            }}>
                                                {school.paymentStatus || 'unpaid'}
                                            </span>
                                            <button
                                                onClick={() => handleTogglePayment(school.id, school.paymentStatus)}
                                                style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    border: '1px solid #CBD5E1',
                                                    background: '#FFFFFF',
                                                    color: isPaid ? '#D97706' : '#059669',
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {isPaid ? 'Unpay' : 'Pay'}
                                            </button>
                                        </div>

                                        {/* System Status */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                fontSize: '10px',
                                                fontWeight: '700',
                                                textTransform: 'uppercase',
                                                backgroundColor: isActive ? '#DEF7EC' : '#FDE8E8',
                                                color: isActive ? '#03543F' : '#9B1C1C'
                                            }}>
                                                {school.status || 'inactive'}
                                            </span>
                                            <button
                                                onClick={() => handleToggleSystemStatus(school.id, school.status)}
                                                style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    border: '1px solid #CBD5E1',
                                                    background: '#FFFFFF',
                                                    color: school.status === 'suspended' ? '#059669' : '#DC2626',
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '2px'
                                                }}
                                            >
                                                <Power size={10} />
                                                {school.status === 'suspended' ? 'Start' : 'Stop'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* GRID PAGINATION BAR */}
                    <div
                        style={{
                            marginTop: '1.25rem',
                            padding: '10px 16px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px',
                            fontSize: '12px',
                            color: '#475569'
                        }}
                    >
                        <span>
                            Showing <strong>{totalItems > 0 ? startIndex + 1 : 0}</strong> - <strong>{endIndex}</strong> of <strong>{totalItems}</strong> schools
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: '3px',
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: currentPage === 1 ? '#F1F5F9' : '#FFFFFF',
                                    color: currentPage === 1 ? '#94A3B8' : '#1E293B',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <ChevronsLeft size={13} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: '3px',
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: currentPage === 1 ? '#F1F5F9' : '#FFFFFF',
                                    color: currentPage === 1 ? '#94A3B8' : '#1E293B',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <ChevronLeft size={13} />
                            </button>
                            <span style={{ padding: '0 8px', fontWeight: '700', color: '#1E293B' }}>
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage >= totalPages}
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: '3px',
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: currentPage >= totalPages ? '#F1F5F9' : '#FFFFFF',
                                    color: currentPage >= totalPages ? '#94A3B8' : '#1E293B',
                                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <ChevronRight size={13} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage >= totalPages}
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: '3px',
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: currentPage >= totalPages ? '#F1F5F9' : '#FFFFFF',
                                    color: currentPage >= totalPages ? '#94A3B8' : '#1E293B',
                                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <ChevronsRight size={13} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EMPTY STATE */}
            {filteredSchools.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                    <div style={{ opacity: 0.25, marginBottom: '0.75rem' }}><Search size={48} style={{ margin: '0 auto' }} /></div>
                    <h3 style={{ color: '#1E293B', fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>No schools found matching your search.</h3>
                    <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>Try clearing the search query or adjusting your state, district, or city filters.</p>
                </div>
            )}
        </div>
    );
};

export default Schools;
