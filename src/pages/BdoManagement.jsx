import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    Briefcase, Users, TrendingUp, Award, Clock, CheckCircle, Search,
    Download, Calendar, Target, Eye, Edit2, X, Save, Loader2, MapPin,
    ExternalLink, AlertTriangle, UserPlus, Link2, Phone, Mail, School, Power
} from 'lucide-react';
import { db, functions } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { calculateTrialDays } from '../utils/dateUtils';
import { useAlert } from '../contexts/AlertContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const PROVINCES_LIST = [
    "Punjab",
    "Sindh",
    "Khyber Pakhtunkhwa",
    "Balochistan",
    "Islamabad (ICT)",
    "Azad Jammu & Kashmir",
    "Gilgit-Baltistan"
];

const toDateSafe = (val) => {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

const isInSelectedMonth = (dateVal, monthStr) => {
    if (monthStr === 'all') return true;
    const d = toDateSafe(dateVal);
    if (!d) return false;
    const [year, month] = monthStr.split('-').map(Number);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
};

const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (monthStr) => {
    if (monthStr === 'all') return 'All Time';
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const isBdoDoc = (u) => {
    if (!u) return false;
    const rt = (u.roleType || '').toLowerCase();
    const r = (u.role || '').toLowerCase();
    const title = (u.roleTitle || '').toLowerCase();
    return rt === 'bdo' || r === 'bdo' || title.includes('bdo') || title.includes('business development');
};

const BdoManagement = () => {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAlert();
    const { adminProfile, isMasterAdmin, isBdoInTerritory, isSchoolInTerritory, user } = useAdminAuth();

    const isRestrictedState = !isMasterAdmin && adminProfile?.territoryScope && adminProfile.territoryScope !== 'all' && Boolean(adminProfile.territoryState);
    const isRestrictedDistrict = !isMasterAdmin && (adminProfile?.territoryScope === 'district' || adminProfile?.territoryScope === 'city') && Boolean(adminProfile.territoryDistrict);
    const isRestrictedCity = !isMasterAdmin && adminProfile?.territoryScope === 'city' && Boolean(adminProfile.territoryCity);

    const [allBdos, setAllBdos] = useState([]);
    const [allSchools, setAllSchools] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'disabled'

    // Modals
    const [selectedBdoForSchools, setSelectedBdoForSchools] = useState(null);
    const [editingTargetBdo, setEditingTargetBdo] = useState(null);
    const [targetForm, setTargetForm] = useState({ monthlyTrialTarget: 10, monthlyOnboardTarget: 5, phone: '' });
    const [savingTarget, setSavingTarget] = useState(false);

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignSchoolId, setAssignSchoolId] = useState('');
    const [assignBdoId, setAssignBdoId] = useState('');
    const [assigning, setAssigning] = useState(false);

    // Create BDO Modal (available to Master Admin & Operations Manager directly inside BDO tab)
    const [showCreateBdoModal, setShowCreateBdoModal] = useState(false);
    const [creatingBdo, setCreatingBdo] = useState(false);
    const [createBdoError, setCreateBdoError] = useState(null);
    const [newBdoForm, setNewBdoForm] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        monthlyTrialTarget: 10,
        monthlyOnboardTarget: 5,
        territoryScope: 'city',
        territoryState: 'Punjab',
        territoryDistrict: '',
        territoryCity: ''
    });

    const handleOpenCreateBdo = () => {
        setCreateBdoError(null);
        setNewBdoForm({
            name: '',
            email: '',
            password: '',
            phone: '',
            monthlyTrialTarget: 10,
            monthlyOnboardTarget: 5,
            territoryScope: (!isMasterAdmin && adminProfile?.territoryScope && adminProfile.territoryScope !== 'all')
                ? adminProfile.territoryScope
                : 'city',
            territoryState: isRestrictedState ? adminProfile.territoryState : 'Punjab',
            territoryDistrict: isRestrictedDistrict ? adminProfile.territoryDistrict : '',
            territoryCity: isRestrictedCity ? adminProfile.territoryCity : ''
        });
        setShowCreateBdoModal(true);
    };

    const handleCreateBdoSubmit = async (e) => {
        e.preventDefault();
        setCreatingBdo(true);
        setCreateBdoError(null);

        try {
            const bdoPermissions = {
                manageSchools: true,
                deleteSchool: false,
                manageBilling: false,
                viewRevenue: false,
                systemControl: true,
                manageSettings: false,
                broadcastAnnouncements: false,
                resetCredentials: false,
                manageBdos: false,
                manageAdmins: false
            };

            const createSuperAdmin = httpsCallable(functions, 'createSuperAdmin');
            const res = await createSuperAdmin({
                name: newBdoForm.name.trim(),
                email: newBdoForm.email.trim(),
                password: newBdoForm.password,
                permissions: bdoPermissions
            });

            const newUid = res?.data?.uid;
            if (newUid) {
                const effScope = newBdoForm.territoryScope || 'city';
                await updateDoc(doc(db, 'global_users', newUid), {
                    roleType: 'bdo',
                    roleTitle: 'BDO (Business Development Officer)',
                    phone: newBdoForm.phone.trim(),
                    monthlyTrialTarget: Number(newBdoForm.monthlyTrialTarget) || 0,
                    monthlyOnboardTarget: Number(newBdoForm.monthlyOnboardTarget) || 0,
                    territoryScope: effScope,
                    territoryState: effScope !== 'all' ? newBdoForm.territoryState : '',
                    territoryDistrict: (effScope === 'district' || effScope === 'city') ? newBdoForm.territoryDistrict.trim() : '',
                    territoryCity: effScope === 'city' ? newBdoForm.territoryCity.trim() : '',
                    createdByUid: adminProfile?.id || user?.uid || '',
                    createdByName: adminProfile?.name || user?.displayName || '',
                    updatedAt: serverTimestamp()
                });
            }

            showAlert({ title: 'BDO Created', message: `BDO account for ${newBdoForm.name} created successfully.`, type: 'success' });
            setShowCreateBdoModal(false);
        } catch (err) {
            console.error('Create BDO error:', err);
            setCreateBdoError(err.message || 'Failed to create BDO account.');
        } finally {
            setCreatingBdo(false);
        }
    };

    const handleToggleBdoStatus = (bdo) => {
        const isDisabled = bdo.status === 'disabled';
        const nextStatus = isDisabled ? 'active' : 'disabled';
        showConfirm({
            title: isDisabled ? 'Activate BDO Account?' : 'Suspend BDO Account?',
            message: isDisabled
                ? `Re-enable access for ${bdo.name} (${bdo.email})? They will be able to log in and manage their schools again.`
                : `Suspend ${bdo.name} (${bdo.email})? They will be blocked from logging into their BDO account until reactivated.`,
            confirmText: isDisabled ? 'Activate BDO' : 'Suspend BDO',
            isDestructive: !isDisabled,
            onConfirm: async () => {
                try {
                    await updateDoc(doc(db, 'global_users', bdo.id), {
                        status: nextStatus,
                        updatedAt: serverTimestamp()
                    });
                    showAlert({
                        title: isDisabled ? 'BDO Activated' : 'BDO Suspended',
                        message: `${bdo.name} is now ${nextStatus}.`,
                        type: 'success'
                    });
                } catch (err) {
                    showAlert({ title: 'Error', message: 'Failed to update status: ' + err.message, type: 'error' });
                }
            }
        });
    };

    useEffect(() => {
        let usersLoaded = false;
        let schoolsLoaded = false;

        const unsubUsers = onSnapshot(collection(db, 'global_users'), (snap) => {
            const list = [];
            snap.forEach((d) => {
                const data = d.data() || {};
                if (isBdoDoc(data)) {
                    list.push({ id: d.id, ...data });
                }
            });
            list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setAllBdos(list);
            usersLoaded = true;
            if (usersLoaded && schoolsLoaded) setLoading(false);
        }, (err) => {
            console.error('Error fetching BDOs:', err);
            setLoading(false);
        });

        const unsubSchools = onSnapshot(collection(db, 'schools'), (snap) => {
            const list = [];
            snap.forEach((d) => {
                const data = d.data() || {};
                const trialInfo = calculateTrialDays(
                    data.trialStartDate,
                    data.trialDurationDays || 7,
                    data.trialEndDate,
                    data.accountType,
                    Boolean(data.isPermanentDemo || data.permanentDemo)
                );
                list.push({ id: d.id, ...data, trialInfo });
            });
            setAllSchools(list);
            schoolsLoaded = true;
            if (usersLoaded && schoolsLoaded) setLoading(false);
        }, (err) => {
            console.error('Error fetching schools for BDO metrics:', err);
            setLoading(false);
        });

        return () => {
            unsubUsers();
            unsubSchools();
        };
    }, []);

    // Scope BDOs and Schools to the logged-in Operations Manager's territory (Master Admin sees all)
    const bdos = useMemo(
        () => allBdos.filter((b) => isBdoInTerritory(b, adminProfile)),
        [allBdos, adminProfile, isBdoInTerritory]
    );
    const schools = useMemo(
        () => allSchools.filter((s) => isSchoolInTerritory(s, adminProfile)),
        [allSchools, adminProfile, isSchoolInTerritory]
    );

    // Compute per-BDO performance metrics
    const bdoMetrics = useMemo(() => {
        return bdos.map((bdo) => {
            const bdoSchools = schools.filter(
                (s) => s.assignedBdoId === bdo.id || s.createdByUid === bdo.id
            );

            // Trials started in selected month:
            // Uses firstTrialStartedAt (preserved forever), or trialStartDate, or createdAt if demo
            const trialsStartedInMonth = bdoSchools.filter((s) => {
                const trialDate = s.firstTrialStartedAt || s.trialStartDate || (s.accountType === 'demo' ? s.createdAt : null);
                if (!trialDate) return false;
                return isInSelectedMonth(trialDate, selectedMonth);
            });

            // Onboarded in selected month:
            const onboardedInMonth = bdoSchools.filter((s) => {
                if (s.accountType !== 'onboarded') return false;
                const onboardDate = s.onboardedAt || s.createdAt;
                return isInSelectedMonth(onboardDate, selectedMonth);
            });

            const activeTrials = bdoSchools.filter((s) => s.accountType === 'demo' && !s.trialInfo?.isExpired);
            const expiredTrials = bdoSchools.filter((s) => s.accountType === 'demo' && s.trialInfo?.isExpired);
            const totalAllTimeOnboarded = bdoSchools.filter((s) => s.accountType === 'onboarded').length;
            const totalAllTimeTrials = bdoSchools.filter(
                (s) => Boolean(s.firstTrialStartedAt || s.trialStartDate || s.accountType === 'demo')
            ).length;

            // Conversion rate: onboarded in month / (trials started in month || onboarded in month)
            const denom = Math.max(trialsStartedInMonth.length, onboardedInMonth.length);
            const conversionRate = denom > 0
                ? Math.min(100, Math.round((onboardedInMonth.length / denom) * 100))
                : 0;

            const trialTarget = Number(bdo.monthlyTrialTarget) || 0;
            const onboardTarget = Number(bdo.monthlyOnboardTarget) || 0;

            const territoryLabel = (!bdo.territoryScope || bdo.territoryScope === 'all')
                ? 'All Pakistan'
                : bdo.territoryScope === 'state'
                    ? (bdo.territoryState || 'Province')
                    : bdo.territoryScope === 'district'
                        ? `${bdo.territoryDistrict || ''}, ${bdo.territoryState || ''}`
                        : `${bdo.territoryCity || ''}${bdo.territoryDistrict ? `, ${bdo.territoryDistrict}` : ''}`;

            return {
                bdo,
                bdoSchools,
                territoryLabel,
                trialsCount: trialsStartedInMonth.length,
                onboardedCount: onboardedInMonth.length,
                activeTrialsCount: activeTrials.length,
                expiredTrialsCount: expiredTrials.length,
                totalAllTimeOnboarded,
                totalAllTimeTrials,
                totalSchools: bdoSchools.length,
                conversionRate,
                trialTarget,
                onboardTarget
            };
        });
    }, [bdos, schools, selectedMonth]);

    const filteredMetrics = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return bdoMetrics
            .filter((m) => {
                if (statusFilter === 'active' && m.bdo.status === 'disabled') return false;
                if (statusFilter === 'disabled' && m.bdo.status !== 'disabled') return false;
                if (!q) return true;
                return (
                    (m.bdo.name || '').toLowerCase().includes(q) ||
                    (m.bdo.email || '').toLowerCase().includes(q) ||
                    (m.bdo.phone || '').toLowerCase().includes(q) ||
                    (m.territoryLabel || '').toLowerCase().includes(q)
                );
            })
            .sort((a, b) => b.onboardedCount - a.onboardedCount || b.trialsCount - a.trialsCount);
    }, [bdoMetrics, searchTerm, statusFilter]);

    // Global summary KPIs
    const summary = useMemo(() => {
        const totalBdos = bdos.length;
        const activeBdos = bdos.filter((b) => b.status !== 'disabled').length;
        const totalTrialsMonth = bdoMetrics.reduce((acc, m) => acc + m.trialsCount, 0);
        const totalOnboardedMonth = bdoMetrics.reduce((acc, m) => acc + m.onboardedCount, 0);
        const totalActiveTrials = bdoMetrics.reduce((acc, m) => acc + m.activeTrialsCount, 0);
        const denom = Math.max(totalTrialsMonth, totalOnboardedMonth);
        const overallConversion = denom > 0 ? Math.min(100, Math.round((totalOnboardedMonth / denom) * 100)) : 0;

        let topPerformer = null;
        if (bdoMetrics.length > 0) {
            const sorted = [...bdoMetrics].sort(
                (a, b) => b.onboardedCount - a.onboardedCount || b.trialsCount - a.trialsCount
            );
            if (sorted[0].onboardedCount > 0 || sorted[0].trialsCount > 0) {
                topPerformer = sorted[0];
            }
        }

        return {
            totalBdos,
            activeBdos,
            disabledBdos: totalBdos - activeBdos,
            totalTrialsMonth,
            totalOnboardedMonth,
            totalActiveTrials,
            overallConversion,
            topPerformer
        };
    }, [bdos, bdoMetrics]);

    const handleOpenEditTarget = (bdo) => {
        setEditingTargetBdo(bdo);
        setTargetForm({
            monthlyTrialTarget: bdo.monthlyTrialTarget ?? 10,
            monthlyOnboardTarget: bdo.monthlyOnboardTarget ?? 5,
            phone: bdo.phone || ''
        });
    };

    const handleSaveTarget = async (e) => {
        e.preventDefault();
        if (!editingTargetBdo) return;
        setSavingTarget(true);
        try {
            await updateDoc(doc(db, 'global_users', editingTargetBdo.id), {
                monthlyTrialTarget: Number(targetForm.monthlyTrialTarget) || 0,
                monthlyOnboardTarget: Number(targetForm.monthlyOnboardTarget) || 0,
                phone: targetForm.phone.trim(),
                updatedAt: serverTimestamp()
            });
            showAlert({ title: 'Targets Updated', message: `Monthly targets updated for ${editingTargetBdo.name}.`, type: 'success' });
            setEditingTargetBdo(null);
        } catch (err) {
            showAlert({ title: 'Error', message: 'Failed to save targets: ' + err.message, type: 'error' });
        } finally {
            setSavingTarget(false);
        }
    };

    const handleAssignSchoolToBdo = async (e) => {
        e.preventDefault();
        if (!assignSchoolId || !assignBdoId) return;
        setAssigning(true);
        try {
            const targetBdo = bdos.find((b) => b.id === assignBdoId);
            await updateDoc(doc(db, 'schools', assignSchoolId), {
                assignedBdoId: assignBdoId,
                assignedBdoName: targetBdo?.name || '',
                updatedAt: new Date()
            });
            showAlert({ title: 'School Assigned', message: `School assigned to ${targetBdo?.name || 'BDO'} successfully.`, type: 'success' });
            setShowAssignModal(false);
            setAssignSchoolId('');
            setAssignBdoId('');
        } catch (err) {
            showAlert({ title: 'Error', message: 'Failed to assign school: ' + err.message, type: 'error' });
        } finally {
            setAssigning(false);
        }
    };

    const handleExportCSV = () => {
        const headers = [
            'BDO Name',
            'Email',
            'Phone',
            'Territory',
            'Status',
            'Period',
            'Monthly Trial Target',
            'Trials Started',
            'Monthly Onboard Target',
            'Schools Onboarded',
            'Active Trials',
            'Expired Trials',
            'Conversion Rate (%)',
            'All-Time Onboarded',
            'Total Schools'
        ];
        const rows = filteredMetrics.map((m) => [
            `"${(m.bdo.name || '').replace(/"/g, '""')}"`,
            `"${(m.bdo.email || '').replace(/"/g, '""')}"`,
            `"${(m.bdo.phone || '').replace(/"/g, '""')}"`,
            `"${(m.territoryLabel || '').replace(/"/g, '""')}"`,
            m.bdo.status === 'disabled' ? 'Disabled' : 'Active',
            formatMonthLabel(selectedMonth),
            m.trialTarget,
            m.trialsCount,
            m.onboardTarget,
            m.onboardedCount,
            m.activeTrialsCount,
            m.expiredTrialsCount,
            `${m.conversionRate}%`,
            m.totalAllTimeOnboarded,
            m.totalSchools
        ]);

        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `BDO_Performance_${selectedMonth}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const fontFamily = "'Segoe UI', Tahoma, Verdana, sans-serif";

    return (
        <div className="animate-in fade-in duration-300" style={{ fontFamily }}>
            <style>{`
                .bdo-btn {
                    font-family: inherit;
                    font-size: 12.5px;
                    font-weight: 600;
                    padding: 6px 13px;
                    border-radius: 4px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    border: 1px solid #CBD5E1;
                    background: #FFFFFF;
                    color: #334155;
                    transition: all 0.14s ease;
                }
                .bdo-btn:hover { background: #F1F5F9; border-color: #94A3B8; }
                .bdo-btn-primary {
                    border: 1px solid #6D28D9;
                    background: linear-gradient(180deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%);
                    color: #FFFFFF;
                }
                .bdo-btn-primary:hover {
                    background: linear-gradient(180deg, #A78BFA 0%, #8B5CF6 50%, #7C3AED 100%);
                }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <Briefcase size={24} color="#7C3AED" />
                        BDO Performance & Sales Dashboard
                        {!isMasterAdmin && adminProfile?.territoryScope && adminProfile.territoryScope !== 'all' && (
                            <span style={{
                                padding: '2px 9px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700',
                                backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}>
                                <MapPin size={12} /> {[adminProfile.territoryCity, adminProfile.territoryDistrict, adminProfile.territoryState].filter(Boolean).join(', ')}
                            </span>
                        )}
                    </h2>
                    <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '3px 0 0 0' }}>
                        Track Business Development Officers, monthly school trials, onboardings, targets, and conversion rates.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => setShowAssignModal(true)} className="bdo-btn">
                        <Link2 size={14} color="#2563EB" /> Assign School to BDO
                    </button>
                    <button onClick={handleExportCSV} className="bdo-btn" disabled={filteredMetrics.length === 0}>
                        <Download size={14} color="#059669" /> Export CSV
                    </button>
                    <button onClick={handleOpenCreateBdo} className="bdo-btn bdo-btn-primary">
                        <UserPlus size={14} /> Add New BDO
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '1.25rem' }}>
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '6px', background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Users size={21} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total BDOs</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0F172A', lineHeight: 1.2 }}>{summary.totalBdos}</div>
                        <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                            {summary.activeBdos} Active {summary.disabledBdos > 0 ? `• ${summary.disabledBdos} Disabled` : ''}
                        </div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '6px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Clock size={21} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Trials Started ({selectedMonth === 'all' ? 'All' : 'Month'})</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#B45309', lineHeight: 1.2 }}>{summary.totalTrialsMonth}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                            {summary.totalActiveTrials} currently active trials
                        </div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '6px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CheckCircle size={21} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Onboarded ({selectedMonth === 'all' ? 'All' : 'Month'})</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#15803D', lineHeight: 1.2 }}>{summary.totalOnboardedMonth}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                            Official production schools
                        </div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '6px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <TrendingUp size={21} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Conversion Rate</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1D4ED8', lineHeight: 1.2 }}>{summary.overallConversion}%</div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                            {formatMonthLabel(selectedMonth)}
                        </div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: '6px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 100%)' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '6px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Award size={21} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#92400E', textTransform: 'uppercase' }}>Top Performer</div>
                        <div style={{ fontSize: '1rem', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {summary.topPerformer ? summary.topPerformer.bdo.name : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#B45309', fontWeight: '600' }}>
                            {summary.topPerformer
                                ? `${summary.topPerformer.onboardedCount} Onboarded • ${summary.topPerformer.trialsCount} Trials`
                                : 'No activity yet'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '10px 14px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 260px', backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '6px 10px' }}>
                    <Search size={15} color="#64748B" />
                    <input
                        type="text"
                        placeholder="Search BDO by name, email, phone, or territory..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '12.5px', color: '#0F172A', fontFamily: 'inherit' }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Month Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px 8px' }}>
                        <Calendar size={14} color="#7C3AED" />
                        <input
                            type="month"
                            value={selectedMonth === 'all' ? getCurrentMonthKey() : selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            style={{ border: 'none', background: 'transparent', fontSize: '12px', fontWeight: '700', color: '#1E293B', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setSelectedMonth(selectedMonth === 'all' ? getCurrentMonthKey() : 'all')}
                        className="bdo-btn"
                        style={{
                            padding: '5px 10px',
                            fontSize: '11.5px',
                            backgroundColor: selectedMonth === 'all' ? '#7C3AED' : '#FFFFFF',
                            color: selectedMonth === 'all' ? '#FFFFFF' : '#334155',
                            borderColor: selectedMonth === 'all' ? '#6D28D9' : '#CBD5E1'
                        }}
                    >
                        {selectedMonth === 'all' ? '✓ All Time' : 'All Time'}
                    </button>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ padding: '5px 9px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', fontWeight: '600', color: '#334155', backgroundColor: '#FFFFFF', fontFamily: 'inherit' }}
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active Only</option>
                        <option value="disabled">Disabled Only</option>
                    </select>
                </div>
            </div>

            {/* BDO Performance Table */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#1E293B' }}>
                        BDO Monthly Breakdown — <span style={{ color: '#7C3AED' }}>{formatMonthLabel(selectedMonth)}</span>
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600' }}>
                        Showing {filteredMetrics.length} of {bdos.length} BDOs
                    </span>
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}>
                        <Loader2 className="animate-spin" size={32} color="#7C3AED" style={{ margin: '0 auto 8px' }} />
                        <div style={{ fontSize: '13px', color: '#64748B' }}>Loading BDO performance data...</div>
                    </div>
                ) : filteredMetrics.length === 0 ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                        <Briefcase size={40} color="#CBD5E1" style={{ margin: '0 auto 10px' }} />
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '14.5px', fontWeight: '700', color: '#1E293B' }}>
                            {bdos.length === 0 ? 'No BDO Accounts Created Yet' : 'No BDOs Match Your Filter'}
                        </h3>
                        <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#64748B' }}>
                            {bdos.length === 0
                                ? 'Click below to create your first BDO account and start tracking monthly trials and onboardings.'
                                : 'Try clearing your search or changing the status filter.'}
                        </p>
                        {bdos.length === 0 && (
                            <button onClick={handleOpenCreateBdo} className="bdo-btn bdo-btn-primary">
                                <UserPlus size={14} /> Create First BDO
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                    <th style={{ padding: '10px 12px' }}>BDO Officer</th>
                                    <th style={{ padding: '10px 12px' }}>Territory</th>
                                    <th style={{ padding: '10px 12px' }}>Status</th>
                                    <th style={{ padding: '10px 12px' }}>Trials Started</th>
                                    <th style={{ padding: '10px 12px' }}>Onboarded</th>
                                    <th style={{ padding: '10px 12px' }}>Active / Expired Trials</th>
                                    <th style={{ padding: '10px 12px' }}>Conversion</th>
                                    <th style={{ padding: '10px 12px' }}>All-Time</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMetrics.map((m) => {
                                    const trialPct = m.trialTarget > 0 ? Math.min(100, Math.round((m.trialsCount / m.trialTarget) * 100)) : 0;
                                    const onboardPct = m.onboardTarget > 0 ? Math.min(100, Math.round((m.onboardedCount / m.onboardTarget) * 100)) : 0;
                                    const isDisabled = m.bdo.status === 'disabled';

                                    return (
                                        <tr
                                            key={m.bdo.id}
                                            style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: isDisabled ? '#FAFAFA' : '#FFFFFF' }}
                                        >
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '5px',
                                                        background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                                                        color: '#FFFFFF', fontWeight: '800', fontSize: '13px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                    }}>
                                                        {(m.bdo.name || 'B')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '700', color: '#0F172A' }}>{m.bdo.name || 'Unnamed BDO'}</div>
                                                        <div style={{ fontSize: '11px', color: '#64748B' }}>{m.bdo.email}</div>
                                                        {m.bdo.phone && (
                                                            <div style={{ fontSize: '10.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                <Phone size={10} /> {m.bdo.phone}
                                                            </div>
                                                        )}
                                                        {m.bdo.createdByName && (
                                                            <div style={{ fontSize: '10px', color: '#7C3AED', fontWeight: '600' }}>
                                                                Added by: {m.bdo.createdByName}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#334155', fontWeight: '600' }}>
                                                    <MapPin size={12} color="#64748B" /> {m.territoryLabel}
                                                </span>
                                            </td>

                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{
                                                    padding: '2px 7px', borderRadius: '3px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase',
                                                    backgroundColor: isDisabled ? '#FEE2E2' : '#DCFCE7',
                                                    color: isDisabled ? '#991B1B' : '#166534'
                                                }}>
                                                    {isDisabled ? 'Disabled' : 'Active'}
                                                </span>
                                            </td>

                                            {/* Trials Started + Progress */}
                                            <td style={{ padding: '10px 12px', minWidth: '130px' }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#B45309' }}>{m.trialsCount}</span>
                                                    {m.trialTarget > 0 && (
                                                        <span style={{ fontSize: '11px', color: '#64748B' }}>/ {m.trialTarget} target</span>
                                                    )}
                                                </div>
                                                {m.trialTarget > 0 && (
                                                    <div style={{ marginTop: '4px', height: '5px', width: '100%', backgroundColor: '#FEF3C7', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${trialPct}%`, backgroundColor: '#D97706', borderRadius: '3px' }} />
                                                    </div>
                                                )}
                                            </td>

                                            {/* Onboarded + Progress */}
                                            <td style={{ padding: '10px 12px', minWidth: '130px' }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#15803D' }}>{m.onboardedCount}</span>
                                                    {m.onboardTarget > 0 && (
                                                        <span style={{ fontSize: '11px', color: '#64748B' }}>/ {m.onboardTarget} target</span>
                                                    )}
                                                </div>
                                                {m.onboardTarget > 0 && (
                                                    <div style={{ marginTop: '4px', height: '5px', width: '100%', backgroundColor: '#DCFCE7', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${onboardPct}%`, backgroundColor: '#16A34A', borderRadius: '3px' }} />
                                                    </div>
                                                )}
                                            </td>

                                            {/* Active / Expired Trials */}
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '3px', backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                                        {m.activeTrialsCount} Active
                                                    </span>
                                                    {m.expiredTrialsCount > 0 && (
                                                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '3px', backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                                                            {m.expiredTrialsCount} Expired
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Conversion Rate */}
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{
                                                    padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '800',
                                                    backgroundColor: m.conversionRate >= 50 ? '#DCFCE7' : (m.conversionRate >= 25 ? '#EFF6FF' : '#F1F5F9'),
                                                    color: m.conversionRate >= 50 ? '#15803D' : (m.conversionRate >= 25 ? '#1D4ED8' : '#475569')
                                                }}>
                                                    {m.conversionRate}%
                                                </span>
                                            </td>

                                            {/* All-Time */}
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ fontWeight: '700', color: '#0F172A' }}>{m.totalAllTimeOnboarded} Onboarded</div>
                                                <div style={{ fontSize: '11px', color: '#64748B' }}>{m.totalSchools} Total Schools</div>
                                            </td>

                                            {/* Actions */}
                                            <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditTarget(m.bdo)}
                                                        className="bdo-btn"
                                                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
                                                        title="Edit Monthly Targets"
                                                    >
                                                        <Target size={12} color="#7C3AED" /> Targets
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleBdoStatus(m.bdo)}
                                                        className="bdo-btn"
                                                        style={{
                                                            padding: '4px 8px', fontSize: '11.5px',
                                                            color: isDisabled ? '#15803D' : '#DC2626',
                                                            borderColor: isDisabled ? '#BBF7D0' : '#FECACA',
                                                            backgroundColor: isDisabled ? '#F0FDF4' : '#FEF2F2'
                                                        }}
                                                        title={isDisabled ? 'Activate BDO' : 'Suspend BDO'}
                                                    >
                                                        <Power size={12} /> {isDisabled ? 'Activate' : 'Suspend'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedBdoForSchools(m)}
                                                        className="bdo-btn"
                                                        style={{ padding: '4px 8px', fontSize: '11.5px', color: '#1D4ED8', borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}
                                                    >
                                                        <Eye size={12} /> Schools ({m.totalSchools})
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Drill-Down Modal: View BDO's Schools */}
            {selectedBdoForSchools && createPortal(
                <div
                    onClick={() => setSelectedBdoForSchools(null)}
                    style={{
                        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                        zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%', maxWidth: '760px', maxHeight: '82vh', backgroundColor: '#FFFFFF',
                            border: '2px solid #7C3AED', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
                        }}
                    >
                        <div style={{ padding: '12px 16px', background: 'linear-gradient(180deg, #7C3AED 0%, #6D28D9 100%)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: '800' }}>{selectedBdoForSchools.bdo.name} — Schools Portfolio</div>
                                <div style={{ fontSize: '11.5px', opacity: 0.9 }}>
                                    {selectedBdoForSchools.territoryLabel} • {selectedBdoForSchools.totalSchools} Total Schools
                                </div>
                            </div>
                            <button onClick={() => setSelectedBdoForSchools(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#FFFFFF', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}>
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
                            {selectedBdoForSchools.bdoSchools.length === 0 ? (
                                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                                    This BDO has not created or been assigned any schools yet.
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #CBD5E1', textAlign: 'left', color: '#475569' }}>
                                            <th style={{ padding: '8px 10px' }}>School Name</th>
                                            <th style={{ padding: '8px 10px' }}>City</th>
                                            <th style={{ padding: '8px 10px' }}>Account Mode</th>
                                            <th style={{ padding: '8px 10px' }}>Created / Onboarded</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Open</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedBdoForSchools.bdoSchools.map((s) => {
                                            const createdD = toDateSafe(s.createdAt);
                                            const onboardD = toDateSafe(s.onboardedAt);
                                            const isDemo = s.accountType === 'demo';
                                            return (
                                                <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                    <td style={{ padding: '8px 10px' }}>
                                                        <div style={{ fontWeight: '700', color: '#0F172A' }}>{s.name || s.schoolName}</div>
                                                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>{s.id}</div>
                                                    </td>
                                                    <td style={{ padding: '8px 10px', color: '#334155' }}>{s.city || '—'}</td>
                                                    <td style={{ padding: '8px 10px' }}>
                                                        {isDemo ? (
                                                            <span style={{
                                                                padding: '2px 7px', borderRadius: '3px', fontSize: '10.5px', fontWeight: '700',
                                                                backgroundColor: s.trialInfo?.isExpired ? '#FEE2E2' : '#FEF3C7',
                                                                color: s.trialInfo?.isExpired ? '#991B1B' : '#92400E'
                                                            }}>
                                                                {s.trialInfo?.isExpired ? 'Expired Trial' : `Demo (${s.trialInfo?.daysRemaining ?? '?'}d left)`}
                                                            </span>
                                                        ) : (
                                                            <span style={{ padding: '2px 7px', borderRadius: '3px', fontSize: '10.5px', fontWeight: '700', backgroundColor: '#DCFCE7', color: '#166534' }}>
                                                                Onboarded
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '8px 10px', fontSize: '11px', color: '#475569' }}>
                                                        <div>Created: {createdD ? createdD.toLocaleDateString() : '—'}</div>
                                                        {onboardD && <div style={{ color: '#15803D', fontWeight: '600' }}>Onboarded: {onboardD.toLocaleDateString()}</div>}
                                                    </td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedBdoForSchools(null);
                                                                navigate(`/schools/${s.id}`);
                                                            }}
                                                            className="bdo-btn"
                                                            style={{ padding: '3px 8px', fontSize: '11px' }}
                                                        >
                                                            <ExternalLink size={11} /> Manage
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Edit Monthly Targets Modal */}
            {editingTargetBdo && createPortal(
                <div
                    onClick={() => setEditingTargetBdo(null)}
                    style={{
                        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                        zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '420px', backgroundColor: '#FFFFFF', border: '2px solid #7C3AED', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}
                    >
                        <div style={{ padding: '11px 15px', background: 'linear-gradient(180deg, #7C3AED 0%, #6D28D9 100%)', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px' }}>Edit Monthly Targets — {editingTargetBdo.name}</span>
                            <button onClick={() => setEditingTargetBdo(null)} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSaveTarget} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Monthly Trial Target (Schools)</label>
                                <input
                                    type="number"
                                    min="0"
                                    required
                                    value={targetForm.monthlyTrialTarget}
                                    onChange={(e) => setTargetForm({ ...targetForm, monthlyTrialTarget: e.target.value })}
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Monthly Onboarding Target (Schools)</label>
                                <input
                                    type="number"
                                    min="0"
                                    required
                                    value={targetForm.monthlyOnboardTarget}
                                    onChange={(e) => setTargetForm({ ...targetForm, monthlyOnboardTarget: e.target.value })}
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Phone / WhatsApp</label>
                                <input
                                    type="text"
                                    placeholder="0300-1234567"
                                    value={targetForm.phone}
                                    onChange={(e) => setTargetForm({ ...targetForm, phone: e.target.value })}
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                                <button type="button" onClick={() => setEditingTargetBdo(null)} className="bdo-btn" disabled={savingTarget}>Cancel</button>
                                <button type="submit" className="bdo-btn bdo-btn-primary" disabled={savingTarget}>
                                    {savingTarget ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Targets
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Assign / Reassign School to BDO Modal */}
            {showAssignModal && createPortal(
                <div
                    onClick={() => setShowAssignModal(false)}
                    style={{
                        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                        zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '460px', backgroundColor: '#FFFFFF', border: '2px solid #2563EB', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}
                    >
                        <div style={{ padding: '11px 15px', background: 'linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px' }}>Assign / Reassign School to BDO</span>
                            <button onClick={() => setShowAssignModal(false)} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleAssignSchoolToBdo} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Select School *</label>
                                <select
                                    required
                                    value={assignSchoolId}
                                    onChange={(e) => setAssignSchoolId(e.target.value)}
                                    style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                                >
                                    <option value="">-- Choose a School --</option>
                                    {schools.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name || s.schoolName} ({s.city || s.id}) {s.assignedBdoName ? `— Current: ${s.assignedBdoName}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Assign to BDO *</label>
                                <select
                                    required
                                    value={assignBdoId}
                                    onChange={(e) => setAssignBdoId(e.target.value)}
                                    style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                                >
                                    <option value="">-- Choose a BDO --</option>
                                    {bdos.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name} ({b.email})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                                <button type="button" onClick={() => setShowAssignModal(false)} className="bdo-btn" disabled={assigning}>Cancel</button>
                                <button type="submit" className="bdo-btn bdo-btn-primary" disabled={assigning}>
                                    {assigning ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Assign School
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
            {/* Create New BDO Modal (Direct from BDO tab for Master Admin & Operations Manager) */}
            {showCreateBdoModal && createPortal(
                <div
                    onClick={() => !creatingBdo && setShowCreateBdoModal(false)}
                    style={{
                        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                        zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%', maxWidth: '520px', maxHeight: '90vh', backgroundColor: '#FFFFFF',
                            border: '2px solid #7C3AED', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.45)'
                        }}
                    >
                        <div style={{ padding: '12px 16px', background: 'linear-gradient(180deg, #7C3AED 0%, #6D28D9 100%)', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '800', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <UserPlus size={16} /> Create New BDO Account
                            </span>
                            <button onClick={() => !creatingBdo && setShowCreateBdoModal(false)} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateBdoSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {createBdoError && (
                                    <div style={{ padding: '8px 12px', borderRadius: '4px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '12px' }}>
                                        {createBdoError}
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Full Name *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Bilal Ahmed"
                                            value={newBdoForm.name}
                                            onChange={(e) => setNewBdoForm({ ...newBdoForm, name: e.target.value })}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Phone / WhatsApp</label>
                                        <input
                                            type="text"
                                            placeholder="0300-1234567"
                                            value={newBdoForm.phone}
                                            onChange={(e) => setNewBdoForm({ ...newBdoForm, phone: e.target.value })}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Email Address *</label>
                                        <input
                                            type="email"
                                            required
                                            placeholder="bdo@school.com"
                                            value={newBdoForm.email}
                                            onChange={(e) => setNewBdoForm({ ...newBdoForm, email: e.target.value })}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Login Password *</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            placeholder="Min. 6 characters"
                                            value={newBdoForm.password}
                                            onChange={(e) => setNewBdoForm({ ...newBdoForm, password: e.target.value })}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                                        />
                                    </div>
                                </div>

                                {/* Monthly Targets */}
                                <div style={{ backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '6px', padding: '10px 12px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#6D28D9', textTransform: 'uppercase', marginBottom: '8px' }}>Monthly Performance Targets</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#4C1D95', marginBottom: '3px' }}>Monthly Trial Target</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={newBdoForm.monthlyTrialTarget}
                                                onChange={(e) => setNewBdoForm({ ...newBdoForm, monthlyTrialTarget: e.target.value })}
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: '4px', border: '1px solid #C4B5FD', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#4C1D95', marginBottom: '3px' }}>Monthly Onboard Target</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={newBdoForm.monthlyOnboardTarget}
                                                onChange={(e) => setNewBdoForm({ ...newBdoForm, monthlyOnboardTarget: e.target.value })}
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: '4px', border: '1px solid #C4B5FD', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Territory Assignment (auto-locked for Operations Managers) */}
                                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#334155', textTransform: 'uppercase' }}>
                                        Assigned Territory {(isRestrictedState || isRestrictedDistrict || isRestrictedCity) ? '(Locked to Your Jurisdiction)' : ''}
                                    </div>

                                    {isMasterAdmin || !adminProfile?.territoryScope || adminProfile.territoryScope === 'all' ? (
                                        <select
                                            value={newBdoForm.territoryScope}
                                            onChange={(e) => setNewBdoForm({ ...newBdoForm, territoryScope: e.target.value })}
                                            style={{ width: '100%', padding: '6px 9px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                                        >
                                            <option value="all">🌐 All Pakistan (National)</option>
                                            <option value="state">🏛️ Province / State Level</option>
                                            <option value="district">🏙️ District Level</option>
                                            <option value="city">📍 City / Tehsil Level</option>
                                        </select>
                                    ) : null}

                                    {newBdoForm.territoryScope !== 'all' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: newBdoForm.territoryScope === 'city' ? '1fr 1fr 1fr' : (newBdoForm.territoryScope === 'district' ? '1fr 1fr' : '1fr'), gap: '8px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>Province *</label>
                                                <select
                                                    value={newBdoForm.territoryState}
                                                    disabled={isRestrictedState}
                                                    onChange={(e) => setNewBdoForm({ ...newBdoForm, territoryState: e.target.value })}
                                                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: isRestrictedState ? '#E2E8F0' : '#FFFFFF' }}
                                                >
                                                    {PROVINCES_LIST.map((p) => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>

                                            {(newBdoForm.territoryScope === 'district' || newBdoForm.territoryScope === 'city') && (
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>District *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        readOnly={isRestrictedDistrict}
                                                        placeholder="e.g. Rawalpindi"
                                                        value={newBdoForm.territoryDistrict}
                                                        onChange={(e) => setNewBdoForm({ ...newBdoForm, territoryDistrict: e.target.value })}
                                                        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: isRestrictedDistrict ? '#E2E8F0' : '#FFFFFF' }}
                                                    />
                                                </div>
                                            )}

                                            {newBdoForm.territoryScope === 'city' && (
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>City *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        readOnly={isRestrictedCity}
                                                        placeholder="e.g. Taxila"
                                                        value={newBdoForm.territoryCity}
                                                        onChange={(e) => setNewBdoForm({ ...newBdoForm, territoryCity: e.target.value })}
                                                        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: isRestrictedCity ? '#E2E8F0' : '#FFFFFF' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div style={{ fontSize: '11px', color: '#64748B', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '4px', padding: '7px 10px' }}>
                                    ℹ️ This account will be created with the <strong>BDO role</strong> (access only to their personal Dashboard and their own Schools — no Billing, Settings, or Admin privileges).
                                </div>
                            </div>

                            <div style={{ padding: '10px 16px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" onClick={() => setShowCreateBdoModal(false)} className="bdo-btn" disabled={creatingBdo}>Cancel</button>
                                <button type="submit" className="bdo-btn bdo-btn-primary" disabled={creatingBdo}>
                                    {creatingBdo ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create BDO
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default BdoManagement;
