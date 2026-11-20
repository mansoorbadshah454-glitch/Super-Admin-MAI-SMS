import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Briefcase, MapPin, Phone, Mail, Calendar, Clock, CheckCircle,
    TrendingUp, School, ExternalLink, Edit2, Trash2, Power, Save, X, Loader2,
    AlertTriangle, Search, Download, KeyRound, ArrowRightLeft, Coins, FileText,
    Link2, MessageCircle, ShieldAlert, UserCheck, Building2
} from 'lucide-react';
import { db, auth, functions } from '../firebase';
import {
    collection, doc, onSnapshot, updateDoc, deleteDoc, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
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

const DEFAULT_COMMISSION_PKR = 2000;

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

const getLast6MonthKeys = () => {
    const keys = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys;
};

const isBdoDoc = (u) => {
    if (!u) return false;
    const rt = (u.roleType || '').toLowerCase();
    const r = (u.role || '').toLowerCase();
    const title = (u.roleTitle || '').toLowerCase();
    return rt === 'bdo' || r === 'bdo' || title.includes('bdo') || title.includes('business development');
};

const getWhatsAppUrl = (phone) => {
    if (!phone) return null;
    let digits = String(phone).replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('03') && digits.length === 11) {
        digits = '92' + digits.slice(1);
    } else if (digits.startsWith('3') && digits.length === 10) {
        digits = '92' + digits;
    }
    return `https://wa.me/${digits}`;
};

const getCommissionRate = (bdo) => {
    if (!bdo) return DEFAULT_COMMISSION_PKR;
    if (bdo.commissionPerSchool === undefined || bdo.commissionPerSchool === null || bdo.commissionPerSchool === '') {
        return DEFAULT_COMMISSION_PKR;
    }
    const parsed = Number(bdo.commissionPerSchool);
    return isNaN(parsed) ? DEFAULT_COMMISSION_PKR : parsed;
};

const BdoDetail = () => {
    const { bdoId } = useParams();
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAlert();
    const { adminProfile, isMasterAdmin, isBdoInTerritory, isSchoolInTerritory } = useAdminAuth();

    const isRestrictedState = !isMasterAdmin && adminProfile?.territoryScope && adminProfile.territoryScope !== 'all' && Boolean(adminProfile.territoryState);
    const isRestrictedDistrict = !isMasterAdmin && (adminProfile?.territoryScope === 'district' || adminProfile?.territoryScope === 'city') && Boolean(adminProfile.territoryDistrict);
    const isRestrictedCity = !isMasterAdmin && adminProfile?.territoryScope === 'city' && Boolean(adminProfile.territoryCity);

    const [bdo, setBdo] = useState(null);
    const [allBdos, setAllBdos] = useState([]);
    const [allSchools, setAllSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
    const [schoolSearch, setSchoolSearch] = useState('');
    const [schoolFilter, setSchoolFilter] = useState('all'); // 'all' | 'onboarded' | 'active_demo' | 'expired_demo'

    // Edit BDO Modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        phone: '',
        cnic: '',
        joiningDate: '',
        adminNotes: '',
        monthlyTrialTarget: 10,
        monthlyOnboardTarget: 5,
        commissionPerSchool: DEFAULT_COMMISSION_PKR,
        territoryScope: 'city',
        territoryState: 'Punjab',
        territoryDistrict: '',
        territoryCity: '',
        status: 'active'
    });
    const [savingEdit, setSavingEdit] = useState(false);

    // Delete BDO Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteSchoolAction, setDeleteSchoolAction] = useState('unassign'); // 'unassign' | 'reassign'
    const [deleteReassignBdoId, setDeleteReassignBdoId] = useState('');
    const [deletingBdo, setDeletingBdo] = useState(false);

    // Bulk Transfer Modal
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferTargetBdoId, setTransferTargetBdoId] = useState('');
    const [transferring, setTransferring] = useState(false);

    // Assign Existing School Modal
    const [showAssignSchoolModal, setShowAssignSchoolModal] = useState(false);
    const [assignSchoolId, setAssignSchoolId] = useState('');
    const [assigningSchool, setAssigningSchool] = useState(false);

    // Single School Reassign Modal
    const [reassigningSchool, setReassigningSchool] = useState(null);
    const [singleReassignBdoId, setSingleReassignBdoId] = useState('');
    const [savingSingleReassign, setSavingSingleReassign] = useState(false);

    // Password reset state
    const [sendingReset, setSendingReset] = useState(false);

    useEffect(() => {
        if (!bdoId) return;
        let bdoLoaded = false;
        let schoolsLoaded = false;

        const unsubBdo = onSnapshot(doc(db, 'global_users', bdoId), (snap) => {
            if (snap.exists()) {
                setBdo({ id: snap.id, ...snap.data() });
                setNotFound(false);
            } else {
                setBdo(null);
                setNotFound(true);
            }
            bdoLoaded = true;
            if (bdoLoaded && schoolsLoaded) setLoading(false);
        }, (err) => {
            console.error('Error loading BDO profile:', err);
            setLoading(false);
        });

        const unsubAllBdos = onSnapshot(collection(db, 'global_users'), (snap) => {
            const list = [];
            snap.forEach((d) => {
                const data = d.data() || {};
                if (isBdoDoc(data)) list.push({ id: d.id, ...data });
            });
            list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setAllBdos(list);
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
            list.sort((a, b) => {
                const tA = toDateSafe(a.createdAt)?.getTime() || 0;
                const tB = toDateSafe(b.createdAt)?.getTime() || 0;
                return tB - tA;
            });
            setAllSchools(list);
            schoolsLoaded = true;
            if (bdoLoaded && schoolsLoaded) setLoading(false);
        }, (err) => {
            console.error('Error loading schools:', err);
            setLoading(false);
        });

        return () => {
            unsubBdo();
            unsubAllBdos();
            unsubSchools();
        };
    }, [bdoId]);

    const otherBdos = useMemo(
        () => allBdos.filter((b) => b.id !== bdoId && b.status !== 'disabled' && isBdoInTerritory(b, adminProfile)),
        [allBdos, bdoId, adminProfile, isBdoInTerritory]
    );

    const territorySchools = useMemo(
        () => allSchools.filter((s) => isSchoolInTerritory(s, adminProfile)),
        [allSchools, adminProfile, isSchoolInTerritory]
    );

    const bdoSchools = useMemo(
        () => territorySchools.filter((s) => s.assignedBdoId === bdoId || s.createdByUid === bdoId),
        [territorySchools, bdoId]
    );

    const unassignedOrOtherSchools = useMemo(
        () => territorySchools.filter((s) => s.assignedBdoId !== bdoId && s.createdByUid !== bdoId),
        [territorySchools, bdoId]
    );

    const commissionRate = useMemo(() => getCommissionRate(bdo), [bdo]);

    const metrics = useMemo(() => {
        const trialsInMonth = bdoSchools.filter((s) => {
            const trialDate = s.firstTrialStartedAt || s.trialStartDate || (s.accountType === 'demo' ? s.createdAt : null);
            if (!trialDate) return false;
            return isInSelectedMonth(trialDate, selectedMonth);
        });

        const onboardedInMonth = bdoSchools.filter((s) => {
            if (s.accountType !== 'onboarded') return false;
            const onboardDate = s.onboardedAt || s.createdAt;
            return isInSelectedMonth(onboardDate, selectedMonth);
        });

        const activeTrials = bdoSchools.filter((s) => s.accountType === 'demo' && !s.trialInfo?.isExpired);
        const expiredTrials = bdoSchools.filter((s) => s.accountType === 'demo' && s.trialInfo?.isExpired);
        const totalAllTimeOnboarded = bdoSchools.filter((s) => s.accountType === 'onboarded').length;

        const denom = Math.max(trialsInMonth.length, onboardedInMonth.length);
        const conversionRate = denom > 0 ? Math.min(100, Math.round((onboardedInMonth.length / denom) * 100)) : 0;

        const followUpSchools = bdoSchools.filter((s) => {
            if (s.accountType !== 'demo' || s.isPermanentDemo || s.permanentDemo) return false;
            if (s.trialInfo?.isExpired) return true;
            return typeof s.trialInfo?.daysRemaining === 'number' && s.trialInfo.daysRemaining <= 3;
        });

        const earnedCommission = onboardedInMonth.length * commissionRate;
        const allTimeCommission = totalAllTimeOnboarded * commissionRate;

        return {
            trialsCount: trialsInMonth.length,
            onboardedCount: onboardedInMonth.length,
            activeTrialsCount: activeTrials.length,
            expiredTrialsCount: expiredTrials.length,
            totalAllTimeOnboarded,
            totalSchools: bdoSchools.length,
            conversionRate,
            followUpSchools,
            earnedCommission,
            allTimeCommission
        };
    }, [bdoSchools, selectedMonth, commissionRate]);

    // 6-Month Performance History
    const sixMonthHistory = useMemo(() => {
        const keys = getLast6MonthKeys();
        return keys.map((monthKey) => {
            const trials = bdoSchools.filter((s) => {
                const trialDate = s.firstTrialStartedAt || s.trialStartDate || (s.accountType === 'demo' ? s.createdAt : null);
                if (!trialDate) return false;
                return isInSelectedMonth(trialDate, monthKey);
            }).length;

            const onboarded = bdoSchools.filter((s) => {
                if (s.accountType !== 'onboarded') return false;
                const onboardDate = s.onboardedAt || s.createdAt;
                return isInSelectedMonth(onboardDate, monthKey);
            }).length;

            const denom = Math.max(trials, onboarded);
            const conv = denom > 0 ? Math.min(100, Math.round((onboarded / denom) * 100)) : 0;

            return {
                monthKey,
                label: formatMonthLabel(monthKey),
                trials,
                onboarded,
                conversion: conv,
                commission: onboarded * commissionRate
            };
        });
    }, [bdoSchools, commissionRate]);

    const filteredSchools = useMemo(() => {
        const q = schoolSearch.trim().toLowerCase();
        return bdoSchools.filter((s) => {
            if (schoolFilter === 'onboarded' && s.accountType !== 'onboarded') return false;
            if (schoolFilter === 'active_demo' && !(s.accountType === 'demo' && !s.trialInfo?.isExpired)) return false;
            if (schoolFilter === 'expired_demo' && !(s.accountType === 'demo' && s.trialInfo?.isExpired)) return false;
            if (!q) return true;
            return (
                (s.name || s.schoolName || '').toLowerCase().includes(q) ||
                (s.city || '').toLowerCase().includes(q) ||
                (s.district || '').toLowerCase().includes(q) ||
                (s.id || '').toLowerCase().includes(q) ||
                (s.contact || '').toLowerCase().includes(q)
            );
        });
    }, [bdoSchools, schoolSearch, schoolFilter]);

    const territoryLabel = useMemo(() => {
        if (!bdo) return '—';
        if (!bdo.territoryScope || bdo.territoryScope === 'all') return 'All Pakistan';
        if (bdo.territoryScope === 'state') return bdo.territoryState || 'Province';
        if (bdo.territoryScope === 'district') return `${bdo.territoryDistrict || ''}, ${bdo.territoryState || ''}`;
        return `${bdo.territoryCity || ''}${bdo.territoryDistrict ? `, ${bdo.territoryDistrict}` : ''}`;
    }, [bdo]);

    const handleOpenEditModal = () => {
        if (!bdo) return;
        setEditForm({
            name: bdo.name || '',
            phone: bdo.phone || '',
            cnic: bdo.cnic || '',
            joiningDate: bdo.joiningDate || '',
            adminNotes: bdo.adminNotes || '',
            monthlyTrialTarget: bdo.monthlyTrialTarget ?? 10,
            monthlyOnboardTarget: bdo.monthlyOnboardTarget ?? 5,
            commissionPerSchool: getCommissionRate(bdo),
            territoryScope: bdo.territoryScope || 'city',
            territoryState: bdo.territoryState || (isRestrictedState ? adminProfile.territoryState : 'Punjab'),
            territoryDistrict: bdo.territoryDistrict || (isRestrictedDistrict ? adminProfile.territoryDistrict : ''),
            territoryCity: bdo.territoryCity || (isRestrictedCity ? adminProfile.territoryCity : ''),
            status: bdo.status || 'active'
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!bdo) return;
        setSavingEdit(true);
        try {
            const effScope = editForm.territoryScope || 'city';
            await updateDoc(doc(db, 'global_users', bdo.id), {
                name: editForm.name.trim(),
                phone: editForm.phone.trim(),
                cnic: editForm.cnic.trim(),
                joiningDate: editForm.joiningDate.trim(),
                adminNotes: editForm.adminNotes.trim(),
                monthlyTrialTarget: Number(editForm.monthlyTrialTarget) || 0,
                monthlyOnboardTarget: Number(editForm.monthlyOnboardTarget) || 0,
                commissionPerSchool: Number(editForm.commissionPerSchool) >= 0 ? Number(editForm.commissionPerSchool) : DEFAULT_COMMISSION_PKR,
                territoryScope: effScope,
                territoryState: effScope !== 'all' ? editForm.territoryState : '',
                territoryDistrict: (effScope === 'district' || effScope === 'city') ? editForm.territoryDistrict.trim() : '',
                territoryCity: effScope === 'city' ? editForm.territoryCity.trim() : '',
                status: editForm.status,
                updatedAt: serverTimestamp()
            });
            showAlert({ title: 'BDO Updated', message: `Profile and commission settings updated for ${editForm.name.trim()}.`, type: 'success' });
            setShowEditModal(false);
        } catch (err) {
            showAlert({ title: 'Error', message: 'Failed to update BDO: ' + err.message, type: 'error' });
        } finally {
            setSavingEdit(false);
        }
    };

    const handleToggleStatus = () => {
        if (!bdo) return;
        const isDisabled = bdo.status === 'disabled';
        const nextStatus = isDisabled ? 'active' : 'disabled';
        showConfirm({
            title: isDisabled ? 'Activate BDO Account?' : 'Suspend BDO Account?',
            message: isDisabled
                ? `Re-enable access for ${bdo.name} (${bdo.email})?`
                : `Suspend ${bdo.name} (${bdo.email})? They will be blocked from logging in until reactivated.`,
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

    const handleSendPasswordReset = () => {
        if (!bdo?.email) return;
        showConfirm({
            title: 'Send Password Reset Email?',
            message: `Send a Firebase password reset link to ${bdo.email}?`,
            confirmText: 'Send Reset Link',
            onConfirm: async () => {
                setSendingReset(true);
                try {
                    await sendPasswordResetEmail(auth, bdo.email);
                    showAlert({
                        title: 'Reset Link Sent',
                        message: `Password reset email sent to ${bdo.email}.`,
                        type: 'success'
                    });
                } catch (err) {
                    showAlert({ title: 'Error', message: 'Failed to send reset email: ' + err.message, type: 'error' });
                } finally {
                    setSendingReset(false);
                }
            }
        });
    };

    const handleConfirmDeleteBdo = async (e) => {
        e.preventDefault();
        if (!bdo) return;
        if (bdoSchools.length > 0 && deleteSchoolAction === 'reassign' && !deleteReassignBdoId) {
            showAlert({ title: 'Select Target BDO', message: 'Please select a BDO to reassign schools to.', type: 'warning' });
            return;
        }
        setDeletingBdo(true);
        try {
            // Step 1: Handle BDO's schools safely
            if (bdoSchools.length > 0) {
                const targetBdo = deleteSchoolAction === 'reassign'
                    ? allBdos.find((b) => b.id === deleteReassignBdoId)
                    : null;

                const batch = writeBatch(db);
                bdoSchools.forEach((s) => {
                    const ref = doc(db, 'schools', s.id);
                    if (deleteSchoolAction === 'reassign' && targetBdo) {
                        batch.update(ref, {
                            assignedBdoId: targetBdo.id,
                            assignedBdoName: targetBdo.name || '',
                            ...(s.createdByUid === bdo.id ? { createdByUid: targetBdo.id } : {}),
                            updatedAt: new Date()
                        });
                    } else {
                        batch.update(ref, {
                            assignedBdoId: '',
                            assignedBdoName: '',
                            ...(s.createdByUid === bdo.id ? { createdByUid: '' } : {}),
                            updatedAt: new Date()
                        });
                    }
                });
                await batch.commit();
            }

            // Step 2: Delete BDO from Firebase Auth + global_users
            try {
                const deleteFn = httpsCallable(functions, 'deleteSuperAdmin');
                await deleteFn({ adminUid: bdo.id });
            } catch (fnErr) {
                console.warn('deleteSuperAdmin cloud function error, falling back to Firestore delete:', fnErr);
                await deleteDoc(doc(db, 'global_users', bdo.id));
            }

            showAlert({
                title: 'BDO Deleted',
                message: `${bdo.name}'s account has been deleted successfully.`,
                type: 'success'
            });
            setShowDeleteModal(false);
            navigate('/bdo');
        } catch (err) {
            showAlert({ title: 'Delete Failed', message: err.message || 'Could not delete BDO.', type: 'error' });
        } finally {
            setDeletingBdo(false);
        }
    };

    const handleBulkTransfer = async (e) => {
        e.preventDefault();
        if (!transferTargetBdoId || bdoSchools.length === 0) return;
        const targetBdo = allBdos.find((b) => b.id === transferTargetBdoId);
        if (!targetBdo) return;

        setTransferring(true);
        try {
            const batch = writeBatch(db);
            bdoSchools.forEach((s) => {
                batch.update(doc(db, 'schools', s.id), {
                    assignedBdoId: targetBdo.id,
                    assignedBdoName: targetBdo.name || '',
                    ...(s.createdByUid === bdo.id ? { createdByUid: targetBdo.id } : {}),
                    updatedAt: new Date()
                });
            });
            await batch.commit();
            showAlert({
                title: 'Schools Transferred',
                message: `${bdoSchools.length} school(s) transferred to ${targetBdo.name}.`,
                type: 'success'
            });
            setShowTransferModal(false);
            setTransferTargetBdoId('');
        } catch (err) {
            showAlert({ title: 'Error', message: 'Transfer failed: ' + err.message, type: 'error' });
        } finally {
            setTransferring(false);
        }
    };

    const handleAssignExistingSchool = async (e) => {
        e.preventDefault();
        if (!assignSchoolId || !bdo) return;
        setAssigningSchool(true);
        try {
            await updateDoc(doc(db, 'schools', assignSchoolId), {
                assignedBdoId: bdo.id,
                assignedBdoName: bdo.name || '',
                updatedAt: new Date()
            });
            showAlert({ title: 'School Assigned', message: `School assigned to ${bdo.name}.`, type: 'success' });
            setShowAssignSchoolModal(false);
            setAssignSchoolId('');
        } catch (err) {
            showAlert({ title: 'Error', message: 'Failed to assign school: ' + err.message, type: 'error' });
        } finally {
            setAssigningSchool(false);
        }
    };

    const handleSingleSchoolReassign = async (e) => {
        e.preventDefault();
        if (!reassigningSchool) return;
        setSavingSingleReassign(true);
        try {
            if (singleReassignBdoId === '__unassign__') {
                await updateDoc(doc(db, 'schools', reassigningSchool.id), {
                    assignedBdoId: '',
                    assignedBdoName: '',
                    ...(reassigningSchool.createdByUid === bdoId ? { createdByUid: '' } : {}),
                    updatedAt: new Date()
                });
                showAlert({ title: 'School Unassigned', message: `${reassigningSchool.name || reassigningSchool.schoolName} removed from ${bdo?.name}.`, type: 'success' });
            } else {
                const target = allBdos.find((b) => b.id === singleReassignBdoId);
                await updateDoc(doc(db, 'schools', reassigningSchool.id), {
                    assignedBdoId: target?.id || '',
                    assignedBdoName: target?.name || '',
                    ...(reassigningSchool.createdByUid === bdoId ? { createdByUid: target?.id || '' } : {}),
                    updatedAt: new Date()
                });
                showAlert({ title: 'School Reassigned', message: `School reassigned to ${target?.name || 'BDO'}.`, type: 'success' });
            }
            setReassigningSchool(null);
            setSingleReassignBdoId('');
        } catch (err) {
            showAlert({ title: 'Error', message: 'Failed to update assignment: ' + err.message, type: 'error' });
        } finally {
            setSavingSingleReassign(false);
        }
    };

    const handleExportBdoCSV = () => {
        if (!bdo) return;
        const headers = ['School Name', 'School ID', 'City', 'District', 'Contact', 'Mode', 'Trial Status', 'Created Date', 'Onboarded Date', 'Commission (PKR)'];
        const rows = bdoSchools.map((s) => {
            const isDemo = s.accountType === 'demo';
            const createdD = toDateSafe(s.createdAt);
            const onboardD = toDateSafe(s.onboardedAt);
            return [
                `"${(s.name || s.schoolName || '').replace(/"/g, '""')}"`,
                `"${s.id}"`,
                `"${(s.city || '').replace(/"/g, '""')}"`,
                `"${(s.district || '').replace(/"/g, '""')}"`,
                `"${(s.contact || '').replace(/"/g, '""')}"`,
                isDemo ? 'Demo' : 'Onboarded',
                isDemo ? (s.trialInfo?.isExpired ? 'Expired' : `${s.trialInfo?.daysRemaining ?? '?'}d left`) : 'Production',
                createdD ? createdD.toLocaleDateString() : '',
                onboardD ? onboardD.toLocaleDateString() : '',
                s.accountType === 'onboarded' ? commissionRate : 0
            ];
        });
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `BDO_${(bdo.name || 'Report').replace(/\s+/g, '_')}_${selectedMonth}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const fontFamily = "'Segoe UI', Tahoma, Verdana, sans-serif";

    if (loading) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center', fontFamily }}>
                <Loader2 className="animate-spin" size={34} color="#7C3AED" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: '13px', color: '#64748B' }}>Loading BDO dashboard...</div>
            </div>
        );
    }

    if (notFound || !bdo) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', fontFamily, backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px' }}>
                <ShieldAlert size={42} color="#DC2626" style={{ margin: '0 auto 10px' }} />
                <h3 style={{ margin: '0 0 6px 0', color: '#0F172A' }}>BDO Account Not Found</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B' }}>
                    This BDO account may have been deleted or does not exist.
                </p>
                <button
                    onClick={() => navigate('/bdo')}
                    style={{ padding: '7px 14px', borderRadius: '4px', border: '1px solid #7C3AED', background: '#7C3AED', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer' }}
                >
                    ← Back to BDO Management
                </button>
            </div>
        );
    }

    // Territory guard for Operations Managers
    if (!isMasterAdmin && !isBdoInTerritory(bdo, adminProfile)) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', fontFamily, backgroundColor: '#FFFFFF', border: '1px solid #FECACA', borderRadius: '8px' }}>
                <ShieldAlert size={42} color="#DC2626" style={{ margin: '0 auto 10px' }} />
                <h3 style={{ margin: '0 0 6px 0', color: '#991B1B' }}>Outside Your Territory</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B' }}>
                    You do not have jurisdiction to view or manage this BDO account.
                </p>
                <button
                    onClick={() => navigate('/bdo')}
                    style={{ padding: '7px 14px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155', fontWeight: '700', cursor: 'pointer' }}
                >
                    ← Back to BDO Management
                </button>
            </div>
        );
    }

    const isDisabled = bdo.status === 'disabled';
    const trialTarget = Number(bdo.monthlyTrialTarget) || 0;
    const onboardTarget = Number(bdo.monthlyOnboardTarget) || 0;
    const trialPct = trialTarget > 0 ? Math.min(100, Math.round((metrics.trialsCount / trialTarget) * 100)) : 0;
    const onboardPct = onboardTarget > 0 ? Math.min(100, Math.round((metrics.onboardedCount / onboardTarget) * 100)) : 0;
    const bdoWhatsappUrl = getWhatsAppUrl(bdo.phone);

    return (
        <div className="animate-in fade-in duration-300" style={{ fontFamily }}>
            <style>{`
                .bdod-btn {
                    font-family: inherit;
                    font-size: 12px;
                    font-weight: 600;
                    padding: 6px 11px;
                    border-radius: 4px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    border: 1px solid #CBD5E1;
                    background: #FFFFFF;
                    color: #334155;
                    transition: all 0.14s ease;
                }
                .bdod-btn:hover { background: #F1F5F9; border-color: #94A3B8; }
                .bdod-btn-primary {
                    border: 1px solid #6D28D9;
                    background: linear-gradient(180deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%);
                    color: #FFFFFF;
                }
                .bdod-btn-primary:hover {
                    background: linear-gradient(180deg, #A78BFA 0%, #8B5CF6 50%, #7C3AED 100%);
                }
                .bdod-btn-danger {
                    border: 1px solid #FECACA;
                    background: #FEF2F2;
                    color: #DC2626;
                }
                .bdod-btn-danger:hover {
                    background: #FEE2E2;
                    border-color: #FCA5A5;
                }
            `}</style>

            {/* Back Navigation */}
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <button onClick={() => navigate('/bdo')} className="bdod-btn">
                    <ArrowLeft size={14} /> Back to All BDOs
                </button>

                {/* Month Filter Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px 9px' }}>
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
                        className="bdod-btn"
                        style={{
                            backgroundColor: selectedMonth === 'all' ? '#7C3AED' : '#FFFFFF',
                            color: selectedMonth === 'all' ? '#FFFFFF' : '#334155',
                            borderColor: selectedMonth === 'all' ? '#6D28D9' : '#CBD5E1'
                        }}
                    >
                        {selectedMonth === 'all' ? '✓ All Time' : 'All Time'}
                    </button>
                </div>
            </div>

            {/* BDO Profile Header Card */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '16px 18px', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <div style={{
                            width: '54px', height: '54px', borderRadius: '8px',
                            background: isDisabled ? '#94A3B8' : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                            color: '#FFFFFF', fontWeight: '800', fontSize: '22px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            {(bdo.name || 'B')[0].toUpperCase()}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', color: '#0F172A' }}>
                                    {bdo.name || 'Unnamed BDO'}
                                </h2>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase',
                                    backgroundColor: isDisabled ? '#FEE2E2' : '#DCFCE7',
                                    color: isDisabled ? '#991B1B' : '#166534'
                                }}>
                                    {isDisabled ? 'Suspended' : 'Active'}
                                </span>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                                    backgroundColor: '#F5F3FF', color: '#6D28D9', border: '1px solid #DDD6FE',
                                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                                }}>
                                    <MapPin size={11} /> {territoryLabel}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '6px', fontSize: '12px', color: '#475569' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Mail size={12} color="#64748B" /> {bdo.email}
                                </span>
                                {bdo.phone && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        <Phone size={12} color="#64748B" /> {bdo.phone}
                                        {bdoWhatsappUrl && (
                                            <a
                                                href={bdoWhatsappUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px',
                                                    borderRadius: '3px', backgroundColor: '#DCFCE7', color: '#15803D',
                                                    fontSize: '10.5px', fontWeight: '700', textDecoration: 'none'
                                                }}
                                            >
                                                <MessageCircle size={10} /> WhatsApp
                                            </a>
                                        )}
                                    </span>
                                )}
                                {bdo.cnic && (
                                    <span style={{ color: '#64748B' }}>CNIC: <strong>{bdo.cnic}</strong></span>
                                )}
                                {bdo.joiningDate && (
                                    <span style={{ color: '#64748B' }}>Joined: <strong>{bdo.joiningDate}</strong></span>
                                )}
                                {bdo.createdByName && (
                                    <span style={{ color: '#7C3AED', fontWeight: '600' }}>Added by: {bdo.createdByName}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <button onClick={handleOpenEditModal} className="bdod-btn bdod-btn-primary">
                            <Edit2 size={13} /> Edit Profile & Commission
                        </button>
                        <button onClick={handleSendPasswordReset} className="bdod-btn" disabled={sendingReset} title="Send Firebase Password Reset Email">
                            {sendingReset ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} color="#0284C7" />} Reset Password
                        </button>
                        {bdoSchools.length > 0 && (
                            <button onClick={() => setShowTransferModal(true)} className="bdod-btn" title="Transfer all schools to another BDO">
                                <ArrowRightLeft size={13} color="#2563EB" /> Transfer Schools
                            </button>
                        )}
                        <button onClick={handleExportBdoCSV} className="bdod-btn" disabled={bdoSchools.length === 0}>
                            <Download size={13} color="#059669" /> Export CSV
                        </button>
                        <button
                            onClick={handleToggleStatus}
                            className="bdod-btn"
                            style={{
                                color: isDisabled ? '#15803D' : '#B45309',
                                borderColor: isDisabled ? '#BBF7D0' : '#FDE68A',
                                backgroundColor: isDisabled ? '#F0FDF4' : '#FFFBEB'
                            }}
                        >
                            <Power size={13} /> {isDisabled ? 'Activate' : 'Suspend'}
                        </button>
                        <button
                            onClick={() => {
                                setDeleteSchoolAction(bdoSchools.length > 0 && otherBdos.length > 0 ? 'reassign' : 'unassign');
                                setDeleteReassignBdoId(otherBdos[0]?.id || '');
                                setShowDeleteModal(true);
                            }}
                            className="bdod-btn bdod-btn-danger"
                        >
                            <Trash2 size={13} /> Delete BDO
                        </button>
                    </div>
                </div>

                {/* Admin Internal Notes Banner (if present) */}
                {bdo.adminNotes && (
                    <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '5px', fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <FileText size={14} color="#64748B" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div>
                            <strong style={{ color: '#0F172A' }}>Admin Internal Notes:</strong> {bdo.adminNotes}
                        </div>
                    </div>
                )}
            </div>

            {/* KPI Cards (5 Cards including Commission / Incentive Tracker) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '1.25rem' }}>
                {/* Trials Started */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                            Trials ({selectedMonth === 'all' ? 'All Time' : 'Month'})
                        </span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '5px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Clock size={17} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#B45309' }}>{metrics.trialsCount}</span>
                        {trialTarget > 0 && selectedMonth !== 'all' && (
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>/ {trialTarget} target</span>
                        )}
                    </div>
                    {trialTarget > 0 && selectedMonth !== 'all' && (
                        <div style={{ marginTop: '8px' }}>
                            <div style={{ height: '6px', width: '100%', backgroundColor: '#FEF3C7', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${trialPct}%`, backgroundColor: '#D97706', borderRadius: '3px' }} />
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#92400E', fontWeight: '600', marginTop: '3px' }}>{trialPct}% of trial target</div>
                        </div>
                    )}
                </div>

                {/* Schools Onboarded */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                            Onboarded ({selectedMonth === 'all' ? 'All Time' : 'Month'})
                        </span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '5px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle size={17} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#15803D' }}>{metrics.onboardedCount}</span>
                        {onboardTarget > 0 && selectedMonth !== 'all' && (
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>/ {onboardTarget} target</span>
                        )}
                    </div>
                    {onboardTarget > 0 && selectedMonth !== 'all' && (
                        <div style={{ marginTop: '8px' }}>
                            <div style={{ height: '6px', width: '100%', backgroundColor: '#DCFCE7', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${onboardPct}%`, backgroundColor: '#16A34A', borderRadius: '3px' }} />
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#166534', fontWeight: '600', marginTop: '3px' }}>{onboardPct}% of onboard target</div>
                        </div>
                    )}
                </div>

                {/* Commission / Incentive Tracker */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '14px 16px', background: 'linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 100%)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#065F46', textTransform: 'uppercase' }}>
                            Commission ({selectedMonth === 'all' ? 'All Time' : 'Month'})
                        </span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '5px', background: '#D1FAE5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Coins size={17} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#047857', lineHeight: 1.2 }}>
                        Rs. {metrics.earnedCommission.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#065F46', fontWeight: '600', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span>Rs. {commissionRate.toLocaleString()} / school</span>
                        <button
                            type="button"
                            onClick={handleOpenEditModal}
                            style={{ background: 'transparent', border: 'none', color: '#059669', fontWeight: '800', fontSize: '10.5px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                            Edit Rate
                        </button>
                    </div>
                    {selectedMonth !== 'all' && (
                        <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>
                            All-Time Earned: Rs. {metrics.allTimeCommission.toLocaleString()}
                        </div>
                    )}
                </div>

                {/* Active Trials Pipeline */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Active Trials</span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '5px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <School size={17} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1D4ED8' }}>{metrics.activeTrialsCount}</div>
                    <div style={{ fontSize: '11px', color: metrics.expiredTrialsCount > 0 ? '#DC2626' : '#64748B', fontWeight: '600', marginTop: '4px' }}>
                        {metrics.expiredTrialsCount > 0
                            ? `${metrics.expiredTrialsCount} expired trial(s) pending`
                            : `${metrics.totalSchools} total schools in portfolio`}
                    </div>
                </div>

                {/* Conversion Rate */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Conversion Rate</span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '5px', background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={17} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#6D28D9' }}>{metrics.conversionRate}%</div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginTop: '4px' }}>
                        {metrics.totalAllTimeOnboarded} all-time onboarded • {formatMonthLabel(selectedMonth)}
                    </div>
                </div>
            </div>

            {/* Priority Follow-Up Alerts Panel */}
            {metrics.followUpSchools.length > 0 && (
                <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '6px', padding: '14px 16px', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '13px', color: '#92400E', marginBottom: '10px' }}>
                        <AlertTriangle size={16} color="#D97706" />
                        Priority Follow-Ups — Expiring / Expired Trials ({metrics.followUpSchools.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                        {metrics.followUpSchools.map((s) => {
                            const wa = getWhatsAppUrl(s.contact);
                            return (
                                <div key={s.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: '5px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {s.name || s.schoolName}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                            {s.contact && <span><Phone size={10} style={{ display: 'inline' }} /> {s.contact}</span>}
                                            <span style={{ fontWeight: '700', color: s.trialInfo?.isExpired ? '#DC2626' : '#D97706' }}>
                                                {s.trialInfo?.isExpired ? 'Trial Expired' : `${s.trialInfo?.daysRemaining}d left`}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                        {wa && (
                                            <a
                                                href={wa}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    padding: '4px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                                                    backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', textDecoration: 'none'
                                                }}
                                                title="WhatsApp School"
                                            >
                                                <MessageCircle size={12} />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => navigate(`/schools/${s.id}`)}
                                            style={{
                                                padding: '4px 9px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                                                border: '1px solid #D97706', backgroundColor: '#FEF3C7', color: '#92400E'
                                            }}
                                        >
                                            Open
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 6-Month Performance History */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden', marginBottom: '1.25rem' }}>
                <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                        Last 6 Months Performance & Commission History
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                        Click any month to filter dashboard
                    </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                                <th style={{ padding: '8px 12px' }}>Month</th>
                                <th style={{ padding: '8px 12px' }}>Trials Started</th>
                                <th style={{ padding: '8px 12px' }}>Onboarded</th>
                                <th style={{ padding: '8px 12px' }}>Conversion</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Commission Earned (PKR)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sixMonthHistory.map((row) => {
                                const isSelected = selectedMonth === row.monthKey;
                                return (
                                    <tr
                                        key={row.monthKey}
                                        onClick={() => setSelectedMonth(row.monthKey)}
                                        style={{
                                            borderBottom: '1px solid #F1F5F9',
                                            cursor: 'pointer',
                                            backgroundColor: isSelected ? '#F5F3FF' : '#FFFFFF'
                                        }}
                                    >
                                        <td style={{ padding: '8px 12px', fontWeight: isSelected ? '800' : '600', color: isSelected ? '#6D28D9' : '#0F172A' }}>
                                            {row.label} {isSelected && <span style={{ fontSize: '10px', marginLeft: '6px', padding: '1px 5px', borderRadius: '3px', backgroundColor: '#DDD6FE', color: '#5B21B6' }}>Selected</span>}
                                        </td>
                                        <td style={{ padding: '8px 12px', fontWeight: '700', color: '#B45309' }}>{row.trials}</td>
                                        <td style={{ padding: '8px 12px', fontWeight: '700', color: '#15803D' }}>{row.onboarded}</td>
                                        <td style={{ padding: '8px 12px', fontWeight: '700', color: '#1D4ED8' }}>{row.conversion}%</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#047857' }}>
                                            Rs. {row.commission.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BDO Schools Portfolio Table */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ padding: '11px 14px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={16} color="#7C3AED" />
                        <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                            {bdo.name}'s Schools ({filteredSchools.length} / {bdoSchools.length})
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px 8px' }}>
                            <Search size={13} color="#64748B" />
                            <input
                                type="text"
                                placeholder="Search schools..."
                                value={schoolSearch}
                                onChange={(e) => setSchoolSearch(e.target.value)}
                                style={{ border: 'none', outline: 'none', fontSize: '12px', width: '160px', fontFamily: 'inherit' }}
                            />
                        </div>

                        <select
                            value={schoolFilter}
                            onChange={(e) => setSchoolFilter(e.target.value)}
                            style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', fontWeight: '600', color: '#334155', backgroundColor: '#FFFFFF', fontFamily: 'inherit' }}
                        >
                            <option value="all">All ({bdoSchools.length})</option>
                            <option value="onboarded">Onboarded ({metrics.totalAllTimeOnboarded})</option>
                            <option value="active_demo">Active Demo ({metrics.activeTrialsCount})</option>
                            <option value="expired_demo">Expired Trial ({metrics.expiredTrialsCount})</option>
                        </select>

                        <button onClick={() => setShowAssignSchoolModal(true)} className="bdod-btn bdod-btn-primary">
                            <Link2 size={13} /> Assign School to {bdo.name?.split(' ')[0] || 'BDO'}
                        </button>
                    </div>
                </div>

                {filteredSchools.length === 0 ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                        <School size={38} color="#CBD5E1" style={{ margin: '0 auto 10px' }} />
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>
                            {bdoSchools.length === 0 ? 'No Schools Assigned Yet' : 'No Schools Match Your Filter'}
                        </h3>
                        <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#64748B' }}>
                            {bdoSchools.length === 0
                                ? 'Assign an existing school to this BDO or wait for them to register a school.'
                                : 'Try clearing your search or changing the filter.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '9px 12px' }}>School</th>
                                    <th style={{ padding: '9px 12px' }}>Location</th>
                                    <th style={{ padding: '9px 12px' }}>Contact</th>
                                    <th style={{ padding: '9px 12px' }}>Mode / Trial</th>
                                    <th style={{ padding: '9px 12px' }}>Created / Onboarded</th>
                                    <th style={{ padding: '9px 12px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSchools.map((s) => {
                                    const createdD = toDateSafe(s.createdAt);
                                    const onboardD = toDateSafe(s.onboardedAt);
                                    const isDemo = s.accountType === 'demo';
                                    const wa = getWhatsAppUrl(s.contact);
                                    return (
                                        <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                            <td style={{ padding: '9px 12px' }}>
                                                <div style={{ fontWeight: '700', color: '#0F172A' }}>{s.name || s.schoolName}</div>
                                                <div style={{ fontSize: '10.5px', color: '#64748B' }}>{s.id}</div>
                                            </td>
                                            <td style={{ padding: '9px 12px', color: '#334155' }}>
                                                {[s.city, s.district].filter(Boolean).join(', ') || '—'}
                                            </td>
                                            <td style={{ padding: '9px 12px', color: '#334155' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>{s.contact || '—'}</span>
                                                    {wa && (
                                                        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#16A34A' }} title="WhatsApp">
                                                            <MessageCircle size={13} />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '9px 12px' }}>
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
                                            <td style={{ padding: '9px 12px', fontSize: '11px', color: '#475569' }}>
                                                <div>Created: {createdD ? createdD.toLocaleDateString() : '—'}</div>
                                                {onboardD && <div style={{ color: '#15803D', fontWeight: '600' }}>Onboarded: {onboardD.toLocaleDateString()}</div>}
                                            </td>
                                            <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                    <button
                                                        onClick={() => {
                                                            setReassigningSchool(s);
                                                            setSingleReassignBdoId(otherBdos[0]?.id || '__unassign__');
                                                        }}
                                                        className="bdod-btn"
                                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                                        title="Reassign or Unassign School"
                                                    >
                                                        <ArrowRightLeft size={11} color="#7C3AED" /> Reassign
                                                    </button>
                                                    <button
                                                        onClick={() => navigate(`/schools/${s.id}`)}
                                                        className="bdod-btn"
                                                        style={{ padding: '4px 8px', fontSize: '11px', color: '#1D4ED8', borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}
                                                    >
                                                        <ExternalLink size={11} /> Manage
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

            {/* MODAL 1: Full Edit BDO Modal */}
            {showEditModal && createPortal(
                <div
                    onClick={() => !savingEdit && setShowEditModal(false)}
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '540px', maxHeight: '90vh', backgroundColor: '#FFFFFF', border: '2px solid #7C3AED', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.45)' }}
                    >
                        <div style={{ padding: '12px 16px', background: 'linear-gradient(180deg, #7C3AED 0%, #6D28D9 100%)', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '800', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Edit2 size={15} /> Edit BDO Profile — {bdo.name}
                            </span>
                            <button onClick={() => !savingEdit && setShowEditModal(false)} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}><X size={16} /></button>
                        </div>

                        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Full Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Phone / WhatsApp</label>
                                        <input
                                            type="text"
                                            placeholder="0300-1234567"
                                            value={editForm.phone}
                                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>CNIC (Optional)</label>
                                        <input
                                            type="text"
                                            placeholder="37405-1234567-1"
                                            value={editForm.cnic}
                                            onChange={(e) => setEditForm({ ...editForm, cnic: e.target.value })}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Joining Date (Optional)</label>
                                        <input
                                            type="date"
                                            value={editForm.joiningDate}
                                            onChange={(e) => setEditForm({ ...editForm, joiningDate: e.target.value })}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                                        />
                                    </div>
                                </div>

                                {/* Commission & Targets */}
                                <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '10px 12px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#065F46', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Coins size={13} /> Commission & Monthly Targets
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#065F46', marginBottom: '3px' }}>Commission / School (PKR)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                required
                                                value={editForm.commissionPerSchool}
                                                onChange={(e) => setEditForm({ ...editForm, commissionPerSchool: e.target.value })}
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: '4px', border: '1px solid #6EE7B7', fontSize: '12.5px', fontWeight: '700', backgroundColor: '#FFFFFF' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '3px' }}>Monthly Trial Target</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editForm.monthlyTrialTarget}
                                                onChange={(e) => setEditForm({ ...editForm, monthlyTrialTarget: e.target.value })}
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '3px' }}>Monthly Onboard Target</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editForm.monthlyOnboardTarget}
                                                onChange={(e) => setEditForm({ ...editForm, monthlyOnboardTarget: e.target.value })}
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Territory */}
                                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#334155', textTransform: 'uppercase' }}>
                                        Assigned Territory
                                    </div>
                                    {(isMasterAdmin || !adminProfile?.territoryScope || adminProfile.territoryScope === 'all') && (
                                        <select
                                            value={editForm.territoryScope}
                                            onChange={(e) => setEditForm({ ...editForm, territoryScope: e.target.value })}
                                            style={{ width: '100%', padding: '6px 9px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                                        >
                                            <option value="all">🌐 All Pakistan (National)</option>
                                            <option value="state">🏛️ Province / State Level</option>
                                            <option value="district">🏙️ District Level</option>
                                            <option value="city">📍 City / Tehsil Level</option>
                                        </select>
                                    )}

                                    {editForm.territoryScope !== 'all' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: editForm.territoryScope === 'city' ? '1fr 1fr 1fr' : (editForm.territoryScope === 'district' ? '1fr 1fr' : '1fr'), gap: '8px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>Province *</label>
                                                <select
                                                    value={editForm.territoryState}
                                                    disabled={isRestrictedState}
                                                    onChange={(e) => setEditForm({ ...editForm, territoryState: e.target.value })}
                                                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: isRestrictedState ? '#E2E8F0' : '#FFFFFF' }}
                                                >
                                                    {PROVINCES_LIST.map((p) => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>
                                            {(editForm.territoryScope === 'district' || editForm.territoryScope === 'city') && (
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>District *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        readOnly={isRestrictedDistrict}
                                                        value={editForm.territoryDistrict}
                                                        onChange={(e) => setEditForm({ ...editForm, territoryDistrict: e.target.value })}
                                                        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: isRestrictedDistrict ? '#E2E8F0' : '#FFFFFF' }}
                                                    />
                                                </div>
                                            )}
                                            {editForm.territoryScope === 'city' && (
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>City *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        readOnly={isRestrictedCity}
                                                        value={editForm.territoryCity}
                                                        onChange={(e) => setEditForm({ ...editForm, territoryCity: e.target.value })}
                                                        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: isRestrictedCity ? '#E2E8F0' : '#FFFFFF' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Account Status</label>
                                    <select
                                        value={editForm.status}
                                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                        style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                                    >
                                        <option value="active">Active</option>
                                        <option value="disabled">Suspended / Disabled</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Internal Admin Notes (Hidden from BDO)</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Remarks, performance notes, address..."
                                        value={editForm.adminNotes}
                                        onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })}
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px', fontFamily: 'inherit', resize: 'vertical' }}
                                    />
                                </div>
                            </div>

                            <div style={{ padding: '10px 16px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" onClick={() => setShowEditModal(false)} className="bdod-btn" disabled={savingEdit}>Cancel</button>
                                <button type="submit" className="bdod-btn bdod-btn-primary" disabled={savingEdit}>
                                    {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL 2: Safe Delete BDO Modal */}
            {showDeleteModal && createPortal(
                <div
                    onClick={() => !deletingBdo && setShowDeleteModal(false)}
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '460px', backgroundColor: '#FFFFFF', border: '2px solid #DC2626', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.45)' }}
                    >
                        <div style={{ padding: '12px 16px', background: 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '800', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trash2 size={15} /> Permanently Delete BDO Account
                            </span>
                            <button onClick={() => !deletingBdo && setShowDeleteModal(false)} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}><X size={16} /></button>
                        </div>

                        <form onSubmit={handleConfirmDeleteBdo} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ padding: '10px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '5px', fontSize: '12.5px', color: '#991B1B' }}>
                                You are about to permanently delete <strong>{bdo.name}</strong> ({bdo.email}). Their login credentials and BDO profile will be removed.
                            </div>

                            {bdoSchools.length > 0 && (
                                <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#92400E' }}>
                                        ⚠️ This BDO currently manages {bdoSchools.length} school(s). What should happen to them?
                                    </div>

                                    {otherBdos.length > 0 && (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1E293B', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="deleteSchoolAction"
                                                value="reassign"
                                                checked={deleteSchoolAction === 'reassign'}
                                                onChange={() => setDeleteSchoolAction('reassign')}
                                            />
                                            <span><strong>Reassign all {bdoSchools.length} school(s)</strong> to another BDO</span>
                                        </label>
                                    )}

                                    {deleteSchoolAction === 'reassign' && otherBdos.length > 0 && (
                                        <select
                                            required
                                            value={deleteReassignBdoId}
                                            onChange={(e) => setDeleteReassignBdoId(e.target.value)}
                                            style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                                        >
                                            <option value="">-- Select Target BDO --</option>
                                            {otherBdos.map((ob) => (
                                                <option key={ob.id} value={ob.id}>{ob.name} ({ob.email})</option>
                                            ))}
                                        </select>
                                    )}

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1E293B', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="deleteSchoolAction"
                                            value="unassign"
                                            checked={deleteSchoolAction === 'unassign'}
                                            onChange={() => setDeleteSchoolAction('unassign')}
                                        />
                                        <span><strong>Keep schools unassigned</strong> (schools remain safe, BDO link removed)</span>
                                    </label>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                                <button type="button" onClick={() => setShowDeleteModal(false)} className="bdod-btn" disabled={deletingBdo}>Cancel</button>
                                <button
                                    type="submit"
                                    disabled={deletingBdo}
                                    style={{
                                        padding: '7px 14px', borderRadius: '4px', border: '1px solid #B91C1C',
                                        background: '#DC2626', color: '#FFFFFF', fontSize: '12px', fontWeight: '700',
                                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    {deletingBdo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Confirm Delete BDO
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL 3: Bulk Transfer All Schools */}
            {showTransferModal && createPortal(
                <div
                    onClick={() => !transferring && setShowTransferModal(false)}
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '440px', backgroundColor: '#FFFFFF', border: '2px solid #2563EB', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}
                    >
                        <div style={{ padding: '11px 15px', background: 'linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px' }}>Bulk Transfer All {bdoSchools.length} School(s)</span>
                            <button onClick={() => !transferring && setShowTransferModal(false)} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleBulkTransfer} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '12.5px', color: '#475569' }}>
                                Transfer all <strong>{bdoSchools.length}</strong> school(s) currently under <strong>{bdo.name}</strong> to another active BDO:
                            </div>
                            <select
                                required
                                value={transferTargetBdoId}
                                onChange={(e) => setTransferTargetBdoId(e.target.value)}
                                style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                            >
                                <option value="">-- Choose Target BDO --</option>
                                {otherBdos.map((ob) => (
                                    <option key={ob.id} value={ob.id}>{ob.name} ({ob.email})</option>
                                ))}
                            </select>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" onClick={() => setShowTransferModal(false)} className="bdod-btn" disabled={transferring}>Cancel</button>
                                <button type="submit" className="bdod-btn bdod-btn-primary" disabled={transferring || !transferTargetBdoId}>
                                    {transferring ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />} Transfer All
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL 4: Assign Existing School to this BDO */}
            {showAssignSchoolModal && createPortal(
                <div
                    onClick={() => !assigningSchool && setShowAssignSchoolModal(false)}
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '450px', backgroundColor: '#FFFFFF', border: '2px solid #7C3AED', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}
                    >
                        <div style={{ padding: '11px 15px', background: 'linear-gradient(180deg, #7C3AED 0%, #6D28D9 100%)', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px' }}>Assign School to {bdo.name}</span>
                            <button onClick={() => !assigningSchool && setShowAssignSchoolModal(false)} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleAssignExistingSchool} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Select School *</label>
                                <select
                                    required
                                    value={assignSchoolId}
                                    onChange={(e) => setAssignSchoolId(e.target.value)}
                                    style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                                >
                                    <option value="">-- Choose a School --</option>
                                    {unassignedOrOtherSchools.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name || s.schoolName} ({s.city || s.id}) {s.assignedBdoName ? `— Current: ${s.assignedBdoName}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" onClick={() => setShowAssignSchoolModal(false)} className="bdod-btn" disabled={assigningSchool}>Cancel</button>
                                <button type="submit" className="bdod-btn bdod-btn-primary" disabled={assigningSchool || !assignSchoolId}>
                                    {assigningSchool ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Assign School
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL 5: Single School Reassign / Unassign */}
            {reassigningSchool && createPortal(
                <div
                    onClick={() => !savingSingleReassign && setReassigningSchool(null)}
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '430px', backgroundColor: '#FFFFFF', border: '2px solid #7C3AED', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}
                    >
                        <div style={{ padding: '11px 15px', background: 'linear-gradient(180deg, #7C3AED 0%, #6D28D9 100%)', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px' }}>Reassign School</span>
                            <button onClick={() => !savingSingleReassign && setReassigningSchool(null)} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSingleSchoolReassign} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '12.5px', color: '#334155' }}>
                                School: <strong>{reassigningSchool.name || reassigningSchool.schoolName}</strong>
                            </div>
                            <select
                                required
                                value={singleReassignBdoId}
                                onChange={(e) => setSingleReassignBdoId(e.target.value)}
                                style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                            >
                                {otherBdos.map((ob) => (
                                    <option key={ob.id} value={ob.id}>Reassign to: {ob.name} ({ob.email})</option>
                                ))}
                                <option value="__unassign__">— Remove BDO Assignment (Unassign) —</option>
                            </select>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" onClick={() => setReassigningSchool(null)} className="bdod-btn" disabled={savingSingleReassign}>Cancel</button>
                                <button type="submit" className="bdod-btn bdod-btn-primary" disabled={savingSingleReassign}>
                                    {savingSingleReassign ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Update
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

export default BdoDetail;
