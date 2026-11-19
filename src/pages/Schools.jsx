import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
    School, Search, Filter, Plus, MoreHorizontal, ExternalLink, Trash2, Edit2, 
    Users, MapPin, Power, CreditCard, Megaphone, RotateCcw, X, SlidersHorizontal,
    Table as TableIcon, LayoutGrid, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Calendar, CheckCircle, AlertTriangle, ArrowRight, Key, Eye, EyeOff, Copy, Check, Lock,
    Zap, Loader2, Clock
} from 'lucide-react';
import { db, auth, functions } from '../firebase';
import { collection, onSnapshot, query, orderBy, getCountFromServer, where, Timestamp, doc, updateDoc, serverTimestamp, getDoc, setDoc, deleteField } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import CreateSchoolModal from '../components/CreateSchoolModal';
import InlineEditSchool from '../components/InlineEditSchool';
import DeleteSchoolModal from '../components/DeleteSchoolModal';
import BroadcastModal from '../components/BroadcastModal';
import { calculateTrialDays } from '../utils/dateUtils';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Schools = () => {
    const { hasPermission, isMasterAdmin, adminProfile, isSchoolInTerritory } = useAdminAuth();
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
    const [showPassMap, setShowPassMap] = useState({});
    const [copiedSchoolId, setCopiedSchoolId] = useState(null);
    const [paymentFilter, setPaymentFilter] = useState('all'); // 'all' | 'paid' | 'unpaid'
    const [accountTypeFilter, setAccountTypeFilter] = useState('all'); // 'all' | 'onboarded' | 'demo_active' | 'demo_expired'
    const [resetModalData, setResetModalData] = useState(null); // { schoolId, schoolName, principalEmail }
    const [resetTargetType, setResetTargetType] = useState('onboarded');
    const [resetConfirmationText, setResetConfirmationText] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const [extendModalData, setExtendModalData] = useState(null); // { schoolId, schoolName }
    const [extendDays, setExtendDays] = useState(7);
    const [isExtending, setIsExtending] = useState(false);
    const [startDemoModalData, setStartDemoModalData] = useState(null); // { schoolId, schoolName }

    const toggleShowPass = (id) => {
        setShowPassMap(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleCopyPass = (password, id, e) => {
        if (e) e.stopPropagation();
        if (!password) return;
        navigator.clipboard.writeText(password);
        setCopiedSchoolId(id);
        setTimeout(() => setCopiedSchoolId(null), 2000);
    };
    
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
                const trialInfo = calculateTrialDays(data.trialStartDate, data.trialDurationDays || 7, data.trialEndDate, data.accountType, Boolean(data.isPermanentDemo || data.permanentDemo));
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


    const handleStartDemoWithConfig = async (schoolId, durationDays = 7, isPermanent = false) => {
        try {
            if (isPermanent) {
                await updateDoc(doc(db, "schools", schoolId), {
                    accountType: 'demo',
                    isPermanentDemo: true,
                    demoStatus: 'active',
                    status: 'active',
                    trialStartDate: serverTimestamp(),
                    trialEndDate: deleteField(),
                    trialDurationDays: deleteField(),
                    updatedAt: new Date()
                });
                alert("School configured as Permanent Showcase Demo (Never Expires)!");
            } else {
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + Number(durationDays));
                await updateDoc(doc(db, "schools", schoolId), {
                    accountType: 'demo',
                    isPermanentDemo: false,
                    demoStatus: 'active',
                    status: 'active',
                    trialDurationDays: Number(durationDays),
                    trialStartDate: serverTimestamp(),
                    trialEndDate: Timestamp.fromDate(endDate),
                    updatedAt: new Date()
                });
                alert(`Demo started for ${durationDays} days! Expiry: ${endDate.toLocaleDateString()}`);
            }
            setStartDemoModalData(null);
        } catch (err) {
            alert("Failed to configure demo: " + err.message);
        }
    };

    const handleStartTrial = async (schoolId, durationDays = 7) => {
        return handleStartDemoWithConfig(schoolId, durationDays, false);
    };

    const handleExecuteReset = async () => {
        if (!resetModalData) return;
        if (resetConfirmationText.trim().toUpperCase() !== 'RESET') {
            alert("Please type 'RESET' to confirm.");
            return;
        }

        setIsResetting(true);
        try {
            const resetSchool = httpsCallable(functions, 'resetSchoolData');
            const res = await resetSchool({
                schoolId: resetModalData.schoolId,
                targetAccountType: resetTargetType,
                trialDurationDays: 7
            });
            alert(res.data?.message || 'School reset successfully!');
            setResetModalData(null);
            setResetConfirmationText('');
        } catch (err) {
            alert("Failed to reset school: " + err.message);
        } finally {
            setIsResetting(false);
        }
    };

    const handleExtendTrialSubmit = async () => {
        if (!extendModalData) return;
        setIsExtending(true);
        try {
            const schoolRef = doc(db, "schools", extendModalData.schoolId);
            const schoolDoc = await getDoc(schoolRef);
            const currentData = schoolDoc.data() || {};
            let baseDate = new Date();
            if (currentData.trialEndDate) {
                const existingEnd = currentData.trialEndDate.toDate ? currentData.trialEndDate.toDate() : new Date(currentData.trialEndDate);
                if (existingEnd > baseDate) {
                    baseDate = existingEnd;
                }
            }
            baseDate.setDate(baseDate.getDate() + Number(extendDays));

            await updateDoc(schoolRef, {
                accountType: 'demo',
                demoStatus: 'active',
                status: 'active',
                trialEndDate: Timestamp.fromDate(baseDate),
                trialDurationDays: (currentData.trialDurationDays || 7) + Number(extendDays),
                updatedAt: new Date()
            });
            alert(`Demo extended by +${extendDays} days! New end date: ${baseDate.toLocaleDateString()}`);
            setExtendModalData(null);
        } catch (err) {
            alert("Failed to extend demo: " + err.message);
        } finally {
            setIsExtending(false);
        }
    };

    const handleConvertToOfficialKeepData = async (schoolId) => {
        if (!window.confirm("Convert this school to Official (Keep all current data)?")) return;
        try {
            const schoolObj = schools.find(s => s.id === schoolId);
            const payload = {
                accountType: 'onboarded',
                status: 'active',
                demoStatus: deleteField(),
                trialStartDate: deleteField(),
                trialEndDate: deleteField(),
                trialDurationDays: deleteField(),
                onboardedAt: serverTimestamp(),
                onboardedByUid: adminProfile?.id || auth.currentUser?.uid || '',
                updatedAt: new Date()
            };
            if (schoolObj && !schoolObj.firstTrialStartedAt && (schoolObj.trialStartDate || schoolObj.createdAt)) {
                payload.firstTrialStartedAt = schoolObj.trialStartDate || schoolObj.createdAt;
            }
            await updateDoc(doc(db, "schools", schoolId), payload);
            alert("School successfully converted to Official!");
        } catch (err) {
            alert("Failed to convert: " + err.message);
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

    const isRestrictedManager = !isMasterAdmin && adminProfile?.territoryScope && adminProfile.territoryScope !== 'all';

    // Auto-sync territory defaults for restricted managers
    useEffect(() => {
        if (isRestrictedManager) {
            if (adminProfile.territoryState) setSelectedState(adminProfile.territoryState);
            if (adminProfile.territoryDistrict) setSelectedDistrict(adminProfile.territoryDistrict);
            if (adminProfile.territoryCity) setSelectedCity(adminProfile.territoryCity);
        }
    }, [isRestrictedManager, adminProfile]);

    const activeFilterCount = (selectedState ? 1 : 0) + (selectedDistrict ? 1 : 0) + (selectedCity ? 1 : 0);

    const handleResetFilters = () => {
        if (isRestrictedManager) {
            setSelectedState(adminProfile.territoryState || '');
            setSelectedDistrict(adminProfile.territoryDistrict || '');
            setSelectedCity(adminProfile.territoryCity || '');
        } else {
            setSelectedState('');
            setSelectedDistrict('');
            setSelectedCity('');
        }
        setSearchTerm('');
        setCurrentPage(1);
    };

    const sortedForIds = [...schools].sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0));
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0));
        return timeB - timeA;
    });

    // Territory-scoped schools and billing counts
    const territorySchools = sortedForIds.filter(s => isSchoolInTerritory(s, adminProfile));
    const totalCount = territorySchools.length;
    const paidCount = territorySchools.filter(s => s.paymentStatus === 'paid').length;
    const unpaidCount = totalCount - paidCount;

    // Account Mode counts
    const officialCount = territorySchools.filter(s => s.accountType === 'onboarded').length;
    const demoActiveCount = territorySchools.filter(s => s.accountType === 'demo' && !s.trialInfo?.isExpired).length;
    const demoExpiredCount = territorySchools.filter(s => s.accountType === 'demo' && s.trialInfo?.isExpired).length;

    const filteredSchools = territorySchools.filter(s => {
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
        const matchesPayment = paymentFilter === 'all'
            ? true
            : (paymentFilter === 'paid' ? s.paymentStatus === 'paid' : s.paymentStatus !== 'paid');

        const matchesAccountType = accountTypeFilter === 'all'
            ? true
            : accountTypeFilter === 'onboarded'
                ? s.accountType === 'onboarded'
                : accountTypeFilter === 'demo_active'
                    ? (s.accountType === 'demo' && !s.trialInfo?.isExpired)
                    : (s.accountType === 'demo' && s.trialInfo?.isExpired);

        return matchesSearch && matchesState && matchesDistrict && matchesCity && matchesPayment && matchesAccountType;
    });

    // Reset pagination on filter or search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedState, selectedDistrict, selectedCity, paymentFilter, accountTypeFilter]);

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

            {/* FRESH ACCOUNT RESET & ONBOARD MODAL */}
            {resetModalData && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(5px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '520px',
                        background: '#ECE9D8',
                        border: '2px solid #0055EA',
                        borderRadius: '8px 8px 4px 4px',
                        boxShadow: '0 20px 45px rgba(0,0,0,0.5)',
                        fontFamily: 'Tahoma, "Segoe UI", sans-serif',
                        overflow: 'hidden'
                    }}>
                        {/* Windows Titlebar */}
                        <div style={{
                            background: 'linear-gradient(180deg, #0055EA 0%, #0040B0 100%)',
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            color: '#fff',
                            borderBottom: '1px solid #003399'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RotateCcw size={16} color="#fff" />
                                <span style={{ fontSize: '12px', fontWeight: 'bold', textShadow: '1px 1px 1px rgba(0,0,0,0.5)' }}>
                                    Fresh Account Reset & Onboarding Wizard
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => { setResetModalData(null); setResetConfirmationText(''); }}
                                    style={{
                                        width: '22px',
                                        height: '20px',
                                        background: '#c53030',
                                        border: '1px solid #fff',
                                        borderRadius: '3px',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                    title="Close"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <fieldset style={{
                                border: '1px solid #D0D0BF',
                                borderRadius: '4px',
                                padding: '10px 14px',
                                background: '#FFFFFF'
                            }}>
                                <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#003399', padding: '0 6px' }}>
                                    School Instance
                                </legend>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0F172A' }}>
                                    {resetModalData.schoolName}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                    School ID: <strong style={{ color: '#0055EA' }}>{resetModalData.schoolId}</strong> • Principal: {resetModalData.principalEmail || 'Configured'}
                                </div>
                            </fieldset>

                            {/* What stays vs what is wiped */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '4px', padding: '10px' }}>
                                    <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#166534', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <CheckCircle size={14} /> Preserved (Safe):
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: '#14532D', lineHeight: 1.5 }}>
                                        <li>Same School ID</li>
                                        <li>Principal Login & Pass</li>
                                        <li>School Name & Location</li>
                                    </ul>
                                </div>

                                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '4px', padding: '10px' }}>
                                    <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#991B1B', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Trash2 size={14} /> Wiped Clean:
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: '#7F1D1D', lineHeight: 1.5 }}>
                                        <li>Dummy Students & Teachers</li>
                                        <li>Parents & Drivers</li>
                                        <li>Store items, fees, attendance</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Target Mode Selection */}
                            <fieldset style={{
                                border: '1px solid #D0D0BF',
                                borderRadius: '4px',
                                padding: '10px 14px',
                                background: '#FFFFFF'
                            }}>
                                <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#003399', padding: '0 6px' }}>
                                    Target Account Mode After Reset
                                </legend>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setResetTargetType('onboarded')}
                                        style={{
                                            padding: '8px',
                                            borderRadius: '4px',
                                            border: `1.5px solid ${resetTargetType === 'onboarded' ? '#16A34A' : '#CBD5E1'}`,
                                            backgroundColor: resetTargetType === 'onboarded' ? '#DCFCE7' : '#F8FAFC',
                                            color: resetTargetType === 'onboarded' ? '#15803D' : '#475569',
                                            cursor: 'pointer',
                                            fontWeight: '800',
                                            fontSize: '11.5px',
                                            fontFamily: 'inherit'
                                        }}
                                    >
                                        🟢 Official Onboarded
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setResetTargetType('demo')}
                                        style={{
                                            padding: '8px',
                                            borderRadius: '4px',
                                            border: `1.5px solid ${resetTargetType === 'demo' ? '#D97706' : '#CBD5E1'}`,
                                            backgroundColor: resetTargetType === 'demo' ? '#FEF3C7' : '#F8FAFC',
                                            color: resetTargetType === 'demo' ? '#92400E' : '#475569',
                                            cursor: 'pointer',
                                            fontWeight: '800',
                                            fontSize: '11.5px',
                                            fontFamily: 'inherit'
                                        }}
                                    >
                                        🟡 Fresh Demo (7 Days)
                                    </button>
                                </div>
                            </fieldset>

                            {/* Confirmation Input */}
                            <div style={{ background: '#FFFFFF', border: '1px solid #D0D0BF', borderRadius: '4px', padding: '10px 14px' }}>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                                    Type <strong>RESET</strong> to confirm wipe & fresh start:
                                </label>
                                <input
                                    type="text"
                                    value={resetConfirmationText}
                                    onChange={(e) => setResetConfirmationText(e.target.value)}
                                    placeholder="Type RESET"
                                    style={{
                                        width: '100%',
                                        padding: '6px 10px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        letterSpacing: '1px',
                                        border: '1.5px solid #7F9DB9',
                                        borderRadius: '3px',
                                        boxSizing: 'border-box',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => { setResetModalData(null); setResetConfirmationText(''); }}
                                    disabled={isResetting}
                                    style={{
                                        padding: '6px 16px',
                                        borderRadius: '3px',
                                        border: '1px solid #7F9DB9',
                                        background: 'linear-gradient(180deg, #FFFFFF 0%, #ECE9D8 100%)',
                                        color: '#111827',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExecuteReset}
                                    disabled={isResetting || resetConfirmationText.trim().toUpperCase() !== 'RESET'}
                                    style={{
                                        padding: '6px 18px',
                                        borderRadius: '3px',
                                        fontSize: '12px',
                                        fontWeight: '800',
                                        backgroundColor: resetConfirmationText.trim().toUpperCase() === 'RESET' ? '#2563EB' : '#94A3B8',
                                        color: '#FFFFFF',
                                        border: resetConfirmationText.trim().toUpperCase() === 'RESET' ? '1px solid #1D4ED8' : '1px solid #94A3B8',
                                        cursor: resetConfirmationText.trim().toUpperCase() === 'RESET' && !isResetting ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    {isResetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                                    {isResetting ? 'Wiping & Resetting...' : 'Confirm Reset & Fresh Start'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* EXTEND DEMO TRIAL MODAL */}
            {extendModalData && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(5px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '440px',
                        background: '#ECE9D8',
                        border: '2px solid #0055EA',
                        borderRadius: '8px 8px 4px 4px',
                        boxShadow: '0 20px 45px rgba(0,0,0,0.5)',
                        fontFamily: 'Tahoma, "Segoe UI", sans-serif',
                        overflow: 'hidden'
                    }}>
                        {/* Titlebar */}
                        <div style={{
                            background: 'linear-gradient(180deg, #0055EA 0%, #0040B0 100%)',
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            color: '#fff',
                            borderBottom: '1px solid #003399'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={16} color="#fff" />
                                <span style={{ fontSize: '12px', fontWeight: 'bold', textShadow: '1px 1px 1px rgba(0,0,0,0.5)' }}>
                                    Extend Demo Trial Duration
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => setExtendModalData(null)}
                                    style={{
                                        width: '22px',
                                        height: '20px',
                                        background: '#c53030',
                                        border: '1px solid #fff',
                                        borderRadius: '3px',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                    title="Close"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <fieldset style={{
                                border: '1px solid #D0D0BF',
                                borderRadius: '4px',
                                padding: '10px 14px',
                                background: '#FFFFFF'
                            }}>
                                <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#003399', padding: '0 6px' }}>
                                    School Instance
                                </legend>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0F172A' }}>
                                    {extendModalData.schoolName}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                    Select additional days to extend demo trial:
                                </div>
                            </fieldset>

                            <fieldset style={{
                                border: '1px solid #D0D0BF',
                                borderRadius: '4px',
                                padding: '12px 14px',
                                background: '#FFFFFF'
                            }}>
                                <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#003399', padding: '0 6px' }}>
                                    Extension Period
                                </legend>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[
                                        { label: '+1 Week (7d)', value: 7 },
                                        { label: '+2 Weeks (14d)', value: 14 },
                                        { label: '+1 Month (30d)', value: 30 }
                                    ].map((item) => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            onClick={() => setExtendDays(item.value)}
                                            style={{
                                                flex: 1,
                                                padding: '8px 4px',
                                                fontSize: '11.5px',
                                                fontWeight: extendDays === item.value ? '800' : '600',
                                                backgroundColor: extendDays === item.value ? '#FEF3C7' : '#F8FAFC',
                                                color: extendDays === item.value ? '#92400E' : '#334155',
                                                border: `1.5px solid ${extendDays === item.value ? '#D97706' : '#CBD5E1'}`,
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontFamily: 'inherit'
                                            }}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => setExtendModalData(null)}
                                    disabled={isExtending}
                                    style={{
                                        padding: '6px 16px',
                                        borderRadius: '3px',
                                        border: '1px solid #7F9DB9',
                                        background: 'linear-gradient(180deg, #FFFFFF 0%, #ECE9D8 100%)',
                                        color: '#111827',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExtendTrialSubmit}
                                    disabled={isExtending}
                                    style={{
                                        padding: '6px 18px',
                                        fontSize: '12px',
                                        fontWeight: '800',
                                        backgroundColor: '#2563EB',
                                        color: '#FFFFFF',
                                        border: '1px solid #1D4ED8',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    {isExtending ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                                    {isExtending ? 'Extending...' : `Extend +${extendDays} Days`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* START DEMO CONFIGURATION MODAL */}
            {startDemoModalData && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(5px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '480px',
                        background: '#ECE9D8',
                        border: '2px solid #0055EA',
                        borderRadius: '8px 8px 4px 4px',
                        boxShadow: '0 20px 45px rgba(0,0,0,0.5)',
                        fontFamily: 'Tahoma, "Segoe UI", sans-serif',
                        overflow: 'hidden'
                    }}>
                        {/* Windows XP / 7 Style Titlebar */}
                        <div style={{
                            background: 'linear-gradient(180deg, #0055EA 0%, #0040B0 100%)',
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            color: '#fff',
                            borderBottom: '1px solid #003399'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={16} color="#fff" />
                                <span style={{ fontSize: '12px', fontWeight: 'bold', textShadow: '1px 1px 1px rgba(0,0,0,0.5)' }}>
                                    Start Demo Account Timer — Configuration
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => setStartDemoModalData(null)}
                                    style={{
                                        width: '22px',
                                        height: '20px',
                                        background: '#c53030',
                                        border: '1px solid #fff',
                                        borderRadius: '3px',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                    title="Close"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Body Area */}
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <fieldset style={{
                                border: '1px solid #D0D0BF',
                                borderRadius: '4px',
                                padding: '10px 14px',
                                background: '#FFFFFF'
                            }}>
                                <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#003399', padding: '0 6px' }}>
                                    Target School Instance
                                </legend>
                                <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#1E3A8A' }}>
                                    {startDemoModalData.schoolName}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                    Select trial duration to start the demo countdown timer:
                                </div>
                            </fieldset>

                            <fieldset style={{
                                border: '1px solid #D0D0BF',
                                borderRadius: '4px',
                                padding: '12px 14px',
                                background: '#FFFFFF'
                            }}>
                                <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#003399', padding: '0 6px' }}>
                                    Choose Demo Period
                                </legend>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleStartDemoWithConfig(startDemoModalData.schoolId, 7, false)}
                                        style={{
                                            padding: '10px 14px',
                                            borderRadius: '4px',
                                            border: '1px solid #FDE68A',
                                            background: '#FFFBEB',
                                            color: '#92400E',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontWeight: '700',
                                            fontFamily: 'inherit',
                                            fontSize: '12px'
                                        }}
                                    >
                                        <span>🟡 Start 1 Week Demo (7 Days)</span>
                                        <span style={{ fontSize: '11px', color: '#B45309' }}>Standard Trial</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleStartDemoWithConfig(startDemoModalData.schoolId, 14, false)}
                                        style={{
                                            padding: '10px 14px',
                                            borderRadius: '4px',
                                            border: '1px solid #FCD34D',
                                            background: '#FEF3C7',
                                            color: '#78350F',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontWeight: '700',
                                            fontFamily: 'inherit',
                                            fontSize: '12px'
                                        }}
                                    >
                                        <span>🟡 Start 2 Weeks Demo (14 Days)</span>
                                        <span style={{ fontSize: '11px', color: '#92400E' }}>Extended Trial</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleStartDemoWithConfig(startDemoModalData.schoolId, 0, true)}
                                        style={{
                                            padding: '10px 14px',
                                            borderRadius: '4px',
                                            border: '1px solid #DDD6FE',
                                            background: '#F5F3FF',
                                            color: '#5B21B6',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontWeight: '700',
                                            fontFamily: 'inherit',
                                            fontSize: '12px'
                                        }}
                                    >
                                        <span>♾️ Permanent Showcase Demo</span>
                                        <span style={{ fontSize: '11px', color: '#6D28D9' }}>Never Expires</span>
                                    </button>
                                </div>
                            </fieldset>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => setStartDemoModalData(null)}
                                    style={{
                                        padding: '6px 18px',
                                        borderRadius: '3px',
                                        border: '1px solid #7F9DB9',
                                        background: 'linear-gradient(180deg, #FFFFFF 0%, #ECE9D8 100%)',
                                        color: '#111827',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* PAGE HEADER */}
            <header className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.85rem', marginBottom: '0.2rem' }} className="text-gradient">Schools Directory</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                        Manage, monitor and supervise all registered school client instances.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {(isMasterAdmin || hasPermission('broadcastAnnouncements')) && (
                        <button
                            className="btn"
                            style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '0.6rem 1rem', fontSize: '0.85rem' }}
                            onClick={() => setShowBroadcastModal(true)}
                        >
                            <Megaphone size={17} />
                            Broadcast
                        </button>
                    )}
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

            {/* Territory Jurisdiction Info Banner for Regional Managers */}
            {!isMasterAdmin && adminProfile?.territoryScope && adminProfile.territoryScope !== 'all' && (
                <div style={{
                    padding: '8px 14px',
                    marginBottom: '1rem',
                    borderRadius: '6px',
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={16} color="#2563EB" />
                        <span style={{ fontSize: '12px', color: '#1E40AF', fontWeight: '600' }}>
                            Operational Territory: <strong>{[adminProfile.territoryCity, adminProfile.territoryDistrict, adminProfile.territoryState].filter(Boolean).join(' • ')}</strong>
                        </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#3B82F6', fontWeight: 'bold' }}>
                        Filtered to your jurisdiction ({filteredSchools.length} Schools)
                    </span>
                </div>
            )}

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
                {/* 1. Subscription Billing Filter Buttons Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748B', marginRight: '4px', textTransform: 'uppercase' }}>
                            Billing Status:
                        </span>

                        <button
                            type="button"
                            onClick={() => setPaymentFilter('all')}
                            className="win-btn"
                            style={{
                                backgroundColor: paymentFilter === 'all' ? '#1E293B' : '#FFFFFF',
                                color: paymentFilter === 'all' ? '#FFFFFF' : '#334155',
                                borderColor: paymentFilter === 'all' ? '#0F172A' : '#CBD5E1',
                                fontWeight: '700',
                                fontSize: '11.5px',
                                padding: '3px 10px'
                            }}
                        >
                            All Schools ({totalCount})
                        </button>

                        <button
                            type="button"
                            onClick={() => setPaymentFilter('paid')}
                            className="win-btn"
                            style={{
                                backgroundColor: paymentFilter === 'paid' ? '#059669' : '#FFFFFF',
                                color: paymentFilter === 'paid' ? '#FFFFFF' : '#065F46',
                                borderColor: paymentFilter === 'paid' ? '#047857' : '#A7F3D0',
                                fontWeight: '700',
                                fontSize: '11.5px',
                                padding: '3px 10px'
                            }}
                        >
                            🟢 Paid Schools ({paidCount})
                        </button>

                        <button
                            type="button"
                            onClick={() => setPaymentFilter('unpaid')}
                            className="win-btn"
                            style={{
                                backgroundColor: paymentFilter === 'unpaid' ? '#DC2626' : '#FFFFFF',
                                color: paymentFilter === 'unpaid' ? '#FFFFFF' : '#991B1B',
                                borderColor: paymentFilter === 'unpaid' ? '#B91C1C' : '#FECACA',
                                fontWeight: '700',
                                fontSize: '11.5px',
                                padding: '3px 10px'
                            }}
                        >
                            🔴 Unpaid / Due ({unpaidCount})
                        </button>
                    </div>

                    <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                        Showing <strong>{filteredSchools.length}</strong> of {totalCount} Schools
                    </div>
                </div>

                {/* 2. Account Mode Filter Buttons Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748B', marginRight: '4px', textTransform: 'uppercase' }}>
                            Account Mode:
                        </span>

                        <button
                            type="button"
                            onClick={() => setAccountTypeFilter('all')}
                            className="win-btn"
                            style={{
                                backgroundColor: accountTypeFilter === 'all' ? '#334155' : '#FFFFFF',
                                color: accountTypeFilter === 'all' ? '#FFFFFF' : '#334155',
                                borderColor: accountTypeFilter === 'all' ? '#1E293B' : '#CBD5E1',
                                fontWeight: '700',
                                fontSize: '11.5px',
                                padding: '3px 10px'
                            }}
                        >
                            All Modes
                        </button>

                        <button
                            type="button"
                            onClick={() => setAccountTypeFilter('onboarded')}
                            className="win-btn"
                            style={{
                                backgroundColor: accountTypeFilter === 'onboarded' ? '#059669' : '#FFFFFF',
                                color: accountTypeFilter === 'onboarded' ? '#FFFFFF' : '#065F46',
                                borderColor: accountTypeFilter === 'onboarded' ? '#047857' : '#A7F3D0',
                                fontWeight: '700',
                                fontSize: '11.5px',
                                padding: '3px 10px'
                            }}
                        >
                            🟢 Official ({officialCount})
                        </button>

                        <button
                            type="button"
                            onClick={() => setAccountTypeFilter('demo_active')}
                            className="win-btn"
                            style={{
                                backgroundColor: accountTypeFilter === 'demo_active' ? '#D97706' : '#FFFFFF',
                                color: accountTypeFilter === 'demo_active' ? '#FFFFFF' : '#92400E',
                                borderColor: accountTypeFilter === 'demo_active' ? '#B45309' : '#FDE68A',
                                fontWeight: '700',
                                fontSize: '11.5px',
                                padding: '3px 10px'
                            }}
                        >
                            🟡 Active Demo ({demoActiveCount})
                        </button>

                        <button
                            type="button"
                            onClick={() => setAccountTypeFilter('demo_expired')}
                            className="win-btn"
                            style={{
                                backgroundColor: accountTypeFilter === 'demo_expired' ? '#DC2626' : '#FFFFFF',
                                color: accountTypeFilter === 'demo_expired' ? '#FFFFFF' : '#991B1B',
                                borderColor: accountTypeFilter === 'demo_expired' ? '#B91C1C' : '#FECACA',
                                fontWeight: '700',
                                fontSize: '11.5px',
                                padding: '3px 10px'
                            }}
                        >
                            ⚠️ Expired Demo ({demoExpiredCount})
                        </button>
                    </div>
                </div>

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
                                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '13%' }}>Subscription Fee</th>
                                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '10%' }}>Payment</th>
                                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '10%' }}>System Status</th>
                                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '12%' }}>Mode & Trial</th>
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
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontWeight: '700', color: '#1E3A8A', fontSize: '13px' }}>
                                                                {school.name || school.schoolName || 'Unnamed School'}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '11px', color: '#64748B', fontFamily: 'monospace', marginTop: '2px' }}>
                                                            <span>{displayId}</span>
                                                            {(school.temporaryPassword || school.initialPassword) && (
                                                                <span
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '3px',
                                                                        color: '#1E293B',
                                                                        background: '#F1F5F9',
                                                                        border: '1px solid #CBD5E1',
                                                                        padding: '1px 5px',
                                                                        borderRadius: '3px',
                                                                        fontSize: '10px'
                                                                    }}
                                                                >
                                                                    <Key size={10} color="#2563EB" />
                                                                    <span>Pass:</span>
                                                                    <strong>
                                                                        {showPassMap[school.id] ? (school.temporaryPassword || school.initialPassword) : '••••'}
                                                                    </strong>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleShowPass(school.id)}
                                                                        style={{ marginLeft: '2px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#64748B', display: 'flex', alignItems: 'center' }}
                                                                        title="Toggle password view"
                                                                    >
                                                                        {showPassMap[school.id] ? <EyeOff size={10} /> : <Eye size={10} />}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleCopyPass((school.temporaryPassword || school.initialPassword), school.id, e)}
                                                                        style={{ marginLeft: '2px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: copiedSchoolId === school.id ? '#16A34A' : '#2563EB', display: 'flex', alignItems: 'center' }}
                                                                        title="Copy password"
                                                                    >
                                                                        {copiedSchoolId === school.id ? <Check size={10} /> : <Copy size={10} />}
                                                                    </button>
                                                                </span>
                                                            )}
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
                                                        {isPaid ? 'Paid' : 'Unpaid'}
                                                    </span>
                                                    {!isPaid && (
                                                        <button
                                                            onClick={() => navigate('/schools/' + school.id)}
                                                            title="Record Payment in Ledger"
                                                            style={{
                                                                padding: '3px 8px',
                                                                borderRadius: '3px',
                                                                border: '1px solid #1D4ED8',
                                                                backgroundColor: '#2563EB',
                                                                color: '#FFFFFF',
                                                                cursor: 'pointer',
                                                                fontSize: '10.5px',
                                                                fontWeight: '700'
                                                            }}
                                                        >
                                                            Pay
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* System Status */}
                                            <td style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
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
                                            </td>

                                            {/* Mode & Trial */}
                                            <td style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
                                                {school.trialInfo?.isPermanent || school.isPermanentDemo || school.permanentDemo ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '3px',
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            backgroundColor: '#F5F3FF',
                                                            color: '#5B21B6',
                                                            border: '1px solid #DDD6FE',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '3px'
                                                        }}>
                                                            ♾️ Permanent Demo
                                                        </span>
                                                        <button
                                                            type="button"
                                                            title="Wipe test data for fresh demo showcase"
                                                            onClick={() => setResetModalData({ schoolId: school.id, schoolName: school.name, principalEmail: school.email || school.principalEmail })}
                                                            style={{
                                                                fontSize: '10px',
                                                                fontWeight: '600',
                                                                padding: '1px 5px',
                                                                backgroundColor: '#F8FAFC',
                                                                color: '#64748B',
                                                                border: '1px solid #CBD5E1',
                                                                borderRadius: '3px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Fresh Reset
                                                        </button>
                                                    </div>
                                                ) : school.accountType === 'onboarded' ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '3px',
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            backgroundColor: '#DCFCE7',
                                                            color: '#166534',
                                                            border: '1px solid #86EFAC',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '3px'
                                                        }}>
                                                            <CheckCircle size={11} /> Official
                                                        </span>
                                                        <button
                                                            type="button"
                                                            title="Wipe test data for fresh restart"
                                                            onClick={() => setResetModalData({ schoolId: school.id, schoolName: school.name, principalEmail: school.email || school.principalEmail })}
                                                            style={{
                                                                fontSize: '10px',
                                                                fontWeight: '600',
                                                                padding: '1px 5px',
                                                                backgroundColor: '#F8FAFC',
                                                                color: '#64748B',
                                                                border: '1px solid #CBD5E1',
                                                                borderRadius: '3px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Fresh Reset
                                                        </button>
                                                    </div>
                                                ) : school.trialInfo?.notStarted ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                                                        <span style={{
                                                            padding: '2px 6px',
                                                            borderRadius: '3px',
                                                            fontSize: '10.5px',
                                                            fontWeight: '700',
                                                            backgroundColor: '#F1F5F9',
                                                            color: '#475569',
                                                            border: '1px solid #CBD5E1'
                                                        }}>
                                                            ⚪ Demo: Not Started
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => setStartDemoModalData({ schoolId: school.id, schoolName: school.name })}
                                                                style={{
                                                                    padding: '2px 7px',
                                                                    borderRadius: '3px',
                                                                    border: '1px solid #93C5FD',
                                                                    backgroundColor: '#EFF6FF',
                                                                    color: '#1D4ED8',
                                                                    fontSize: '10.5px',
                                                                    fontWeight: '700',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                ▶️ Start Demo
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleConvertToOfficialKeepData(school.id)}
                                                                style={{
                                                                    padding: '2px 6px',
                                                                    borderRadius: '3px',
                                                                    border: '1px solid #86EFAC',
                                                                    backgroundColor: '#F0FDF4',
                                                                    color: '#166534',
                                                                    fontSize: '10.5px',
                                                                    fontWeight: '700',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Official
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : school.accountType === 'demo' ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                        <span style={{
                                                            padding: '2px 6px',
                                                            borderRadius: '3px',
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            backgroundColor: school.trialInfo?.isExpired ? '#FEE2E2' : '#FEF3C7',
                                                            color: school.trialInfo?.isExpired ? '#991B1B' : '#92400E',
                                                            border: `1px solid ${school.trialInfo?.isExpired ? '#FCA5A5' : '#FDE68A'}`
                                                        }}>
                                                            {school.trialInfo?.isExpired ? '⚠️ Expired' : `🟡 Demo (${school.trialInfo?.daysLeft}d left)`}
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button
                                                                type="button"
                                                                title="Wipe test data & convert to Official onboarded school"
                                                                onClick={() => setResetModalData({ schoolId: school.id, schoolName: school.name, principalEmail: school.email || school.principalEmail })}
                                                                style={{
                                                                    fontSize: '10px',
                                                                    fontWeight: '700',
                                                                    padding: '1px 6px',
                                                                    backgroundColor: '#EFF6FF',
                                                                    color: '#1E40AF',
                                                                    border: '1px solid #BFDBFE',
                                                                    borderRadius: '3px',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Reset & Onboard
                                                            </button>
                                                            <button
                                                                type="button"
                                                                title="Extend demo by 7 or 14 days"
                                                                onClick={() => setExtendModalData({ schoolId: school.id, schoolName: school.name, currentDays: school.trialDurationDays || 7 })}
                                                                style={{
                                                                    fontSize: '10px',
                                                                    fontWeight: '600',
                                                                    padding: '1px 5px',
                                                                    backgroundColor: '#F8FAFC',
                                                                    color: '#475569',
                                                                    border: '1px solid #CBD5E1',
                                                                    borderRadius: '3px',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                +Extend
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
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
                                                        <button
                                                            type="button"
                                                            onClick={() => setResetModalData({ schoolId: school.id, schoolName: school.name, principalEmail: school.email || school.principalEmail })}
                                                            style={{
                                                                fontSize: '10px',
                                                                fontWeight: '700',
                                                                padding: '1px 5px',
                                                                backgroundColor: '#EFF6FF',
                                                                color: '#1E40AF',
                                                                border: '1px solid #BFDBFE',
                                                                borderRadius: '3px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Reset & Onboard
                                                        </button>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td style={{ padding: '10px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    {(isMasterAdmin || hasPermission('manageSchools') || hasPermission('resetCredentials')) && (
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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: '#1E3A8A', lineHeight: 1.3 }}>
                                                        {school.name || school.schoolName || 'Unnamed School'}
                                                    </h4>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                                    <MapPin size={11} style={{ color: '#2563EB' }} />
                                                    <span>{school.city || school.district || 'N/A'}</span>
                                                    {school.state && <span>• {school.state}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                                            {(isMasterAdmin || hasPermission('manageSchools') || hasPermission('resetCredentials')) && (
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
                                            <span style={{ color: '#64748B' }}>Tier: </span>
                                            <strong style={{ color: school.package === 'premium' ? '#B45309' : '#0F172A', textTransform: 'capitalize' }}>
                                                {school.package || 'standard'}
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Temporary / Login Credentials Row */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            backgroundColor: (school.temporaryPassword || school.initialPassword) ? '#F0F9FF' : '#F8FAFC',
                                            padding: '5px 8px',
                                            borderRadius: '5px',
                                            fontSize: '11px',
                                            border: (school.temporaryPassword || school.initialPassword) ? '1px solid #BAE6FD' : '1px dashed #CBD5E1'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                                            <Key size={11} color={(school.temporaryPassword || school.initialPassword) ? '#0284C7' : '#94A3B8'} />
                                            <span style={{ color: '#475569', fontWeight: '600', fontSize: '10.5px' }}>Temp Pass:</span>
                                            <span style={{
                                                fontFamily: 'monospace',
                                                fontWeight: 'bold',
                                                fontSize: '11px',
                                                color: (school.temporaryPassword || school.initialPassword) ? '#0369A1' : '#94A3B8'
                                            }}>
                                                {(school.temporaryPassword || school.initialPassword)
                                                    ? (showPassMap[school.id] ? (school.temporaryPassword || school.initialPassword) : '••••••••')
                                                    : 'Not Set'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            {(school.temporaryPassword || school.initialPassword) && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleShowPass(school.id)}
                                                        title={showPassMap[school.id] ? 'Hide Password' : 'Show Password'}
                                                        style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}
                                                    >
                                                        {showPassMap[school.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleCopyPass((school.temporaryPassword || school.initialPassword), school.id, e)}
                                                        title="Copy Password"
                                                        style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: copiedSchoolId === school.id ? '#16A34A' : '#0284C7', display: 'flex', alignItems: 'center' }}
                                                    >
                                                        {copiedSchoolId === school.id ? <Check size={11} /> : <Copy size={11} />}
                                                    </button>
                                                </>
                                            )}
                                            {(isMasterAdmin || hasPermission('manageSchools') || hasPermission('resetCredentials')) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedSchool(school)}
                                                    title="Quick Edit / Reset Credentials"
                                                    style={{
                                                        padding: '1px 6px',
                                                        borderRadius: '3px',
                                                        border: '1px solid #7F9DB9',
                                                        background: 'linear-gradient(180deg, #FFFFFF 0%, #ECE9D8 100%)',
                                                        color: '#003399',
                                                        fontSize: '10px',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer',
                                                        fontFamily: 'Tahoma, sans-serif'
                                                    }}
                                                >
                                                    Edit Pass
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Bar: 3 Badges Inline (Payment | Status | Account Mode) */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '6px 8px',
                                            backgroundColor: '#F8FAFC',
                                            borderRadius: '6px',
                                            border: '1px solid #E2E8F0',
                                            marginTop: '2px',
                                            gap: '6px',
                                            flexWrap: 'nowrap'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* 1. Payment Status */}
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                fontWeight: '700',
                                                textTransform: 'uppercase',
                                                backgroundColor: isPaid ? '#DEF7EC' : '#FEF2F2',
                                                color: isPaid ? '#03543F' : '#991B1B',
                                                border: isPaid ? '1px solid #84E1BC' : '1px solid #FCA5A5',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px'
                                            }}>
                                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: isPaid ? '#10B981' : '#EF4444' }}></span>
                                                {isPaid ? 'Paid' : 'Unpaid'}
                                            </span>
                                            {!isPaid && (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate('/schools/' + school.id)}
                                                    style={{
                                                        padding: '2px 5px',
                                                        borderRadius: '3px',
                                                        border: '1px solid #1D4ED8',
                                                        background: '#2563EB',
                                                        color: '#FFFFFF',
                                                        fontSize: '9.5px',
                                                        fontWeight: '700',
                                                        cursor: 'pointer',
                                                        lineHeight: 1
                                                    }}
                                                    title="Record Payment"
                                                >
                                                    Pay
                                                </button>
                                            )}
                                        </div>

                                        {/* 2. System Status */}
                                        <span style={{
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            backgroundColor: isActive ? '#DEF7EC' : '#FEF2F2',
                                            color: isActive ? '#03543F' : '#991B1B',
                                            border: isActive ? '1px solid #84E1BC' : '1px solid #FCA5A5',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            flexShrink: 0
                                        }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: isActive ? '#10B981' : '#EF4444' }}></span>
                                            {school.status || 'inactive'}
                                        </span>

                                        {/* 3. Account Mode / Type */}
                                        <div style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                                            {school.trialInfo?.isPermanent || school.isPermanentDemo || school.permanentDemo ? (
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    backgroundColor: '#F5F3FF',
                                                    color: '#5B21B6',
                                                    border: '1px solid #DDD6FE',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px'
                                                }}>
                                                    ♾️ Demo: Perm
                                                </span>
                                            ) : school.accountType === 'onboarded' ? (
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    backgroundColor: '#DCFCE7',
                                                    color: '#166534',
                                                    border: '1px solid #86EFAC',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px'
                                                }}>
                                                    🟢 Official
                                                </span>
                                            ) : school.trialInfo?.notStarted ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setStartDemoModalData({ schoolId: school.id, schoolName: school.name })}
                                                    style={{
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '10px',
                                                        fontWeight: '700',
                                                        backgroundColor: '#EFF6FF',
                                                        color: '#1D4ED8',
                                                        border: '1px solid #93C5FD',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '3px',
                                                        lineHeight: 1.2
                                                    }}
                                                    title="Click to Start Demo"
                                                >
                                                    ▶️ Start Demo
                                                </button>
                                            ) : (
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    backgroundColor: school.trialInfo?.isExpired ? '#FEF2F2' : '#FEF3C7',
                                                    color: school.trialInfo?.isExpired ? '#991B1B' : '#92400E',
                                                    border: `1px solid ${school.trialInfo?.isExpired ? '#FCA5A5' : '#FDE68A'}`,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px'
                                                }}>
                                                    {school.trialInfo?.isExpired ? '⚠️ Demo: Expired' : `🟡 Demo: ${school.trialInfo?.daysLeft || 0}d left`}
                                                </span>
                                            )}
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
