import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
    CreditCard,
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    Eye,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Loader2,
    Calendar,
    School,
    Shield,
    X,
    Filter,
    ArrowUpRight,
    Sparkles,
    AlertCircle,
    Landmark,
    FileText,
    ExternalLink,
    Settings,
    Save,
    AlertTriangle,
    Check
} from 'lucide-react';
import { db } from '../firebase';
import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    setDoc,
    getDoc,
    serverTimestamp,
    query,
    orderBy
} from 'firebase/firestore';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const BillingSubscriptions = () => {
    const { hasPermission, isMasterAdmin, adminProfile } = useAdminAuth();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
    const [searchQuery, setSearchQuery] = useState('');

    // Policy & Due Date Configuration States
    const [billingPolicy, setBillingPolicy] = useState({
        dueDay: 5,
        graceDays: 2,
        enabled: true,
        customMessage: ''
    });
    const [showPolicyModal, setShowPolicyModal] = useState(false);
    const [savingPolicy, setSavingPolicy] = useState(false);

    // Modal states
    const [viewingSlipUrl, setViewingSlipUrl] = useState(null);
    const [viewingSub, setViewingSub] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [rejectingSub, setRejectingSub] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [processingId, setProcessingId] = useState(null);

    // Zoom controls
    const handleZoomIn = () => setZoomLevel(prev => Math.min(Number((prev + 0.5).toFixed(1)), 3));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(Number((prev - 0.5).toFixed(1)), 1));
    const handleResetZoom = () => setZoomLevel(1);

    useEffect(() => {
        let platformList = [];
        let poolList = [];

        const updateCombinedList = () => {
            const combined = [...platformList];
            poolList.forEach(p => {
                if (!combined.some(c => c.transactionId === p.transactionId || c.id === p.id)) {
                    combined.push(p);
                }
            });

            combined.sort((a, b) => {
                const timeA = a.submittedAt?.toDate ? a.submittedAt.toDate().getTime() : (a.submittedAt ? new Date(a.submittedAt).getTime() : 0);
                const timeB = b.submittedAt?.toDate ? b.submittedAt.toDate().getTime() : (b.submittedAt ? new Date(b.submittedAt).getTime() : 0);
                return timeB - timeA;
            });

            setSubmissions(combined);
            setLoading(false);
        };

        // 1. Listen to platform_subscriptions collection
        const subsRef = collection(db, 'platform_subscriptions');
        const unsub = onSnapshot(subsRef, (snapshot) => {
            const list = [];
            snapshot.forEach((d) => {
                list.push({ id: d.id, ...d.data() });
            });
            platformList = list;
            updateCombinedList();
        }, (error) => {
            console.warn("platform_subscriptions notice:", error);
            updateCombinedList();
        });

        // 2. Listen to system_configs/platform_submissions pool
        const poolRef = doc(db, 'system_configs', 'platform_submissions');
        const unsubPool = onSnapshot(poolRef, (poolSnap) => {
            if (poolSnap.exists()) {
                const rawPool = poolSnap.data()?.submissions || [];
                poolList = Array.isArray(rawPool) ? rawPool : [];
                updateCombinedList();
            }
        }, (pErr) => {
            console.warn("platform_submissions pool notice:", pErr);
        });

        // 3. Listen to system_configs/platform_billing for Due Date & Suspension Policy
        const configRef = doc(db, 'system_configs', 'platform_billing');
        const unsubPolicy = onSnapshot(configRef, (snap) => {
            if (snap.exists() && snap.data()?.policy) {
                setBillingPolicy(prev => ({
                    ...prev,
                    ...snap.data().policy
                }));
            }
        }, (err) => {
            console.warn("Billing policy listener notice:", err);
        });

        return () => {
            unsub();
            unsubPool();
            unsubPolicy();
        };
    }, []);

    // Save Billing Due Date & Late Notice Policy
    const handleSavePolicy = async () => {
        if (!isMasterAdmin && !hasPermission('manageBilling')) {
            alert("Permission Denied: You do not have permission to manage billing policies.");
            return;
        }

        setSavingPolicy(true);
        try {
            await setDoc(doc(db, 'system_configs', 'platform_billing'), {
                policy: {
                    dueDay: Number(billingPolicy.dueDay) || 5,
                    graceDays: Number(billingPolicy.graceDays) || 2,
                    enabled: billingPolicy.enabled !== false,
                    customMessage: (billingPolicy.customMessage || '').trim()
                },
                updatedAt: serverTimestamp()
            }, { merge: true });

            alert("Due Date & Suspension Policy updated! All schools will now see this policy in their Billing tab.");
            setShowPolicyModal(false);
        } catch (err) {
            console.error("Error saving policy:", err);
            alert("Failed to save policy: " + err.message);
        } finally {
            setSavingPolicy(false);
        }
    };

    // Approve Action
    const handleApprove = async (sub) => {
        if (!isMasterAdmin && !hasPermission('manageBilling')) {
            alert("Permission Denied: You do not have permission to manage billing approvals.");
            return;
        }

        const confirmMsg = `Approve subscription payment of ₨ ${Number(sub.amount || 0).toLocaleString()} for ${sub.schoolName || sub.schoolId}?`;
        if (!window.confirm(confirmMsg)) return;

        setProcessingId(sub.id);
        try {
            const now = new Date();
            const daysToAdd = (sub.cycle === 'yearly') ? 365 : 30;
            const validUntil = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

            // 1. Try updating platform_subscriptions doc
            try {
                await updateDoc(doc(db, 'platform_subscriptions', sub.id), {
                    status: 'approved',
                    reviewedAt: serverTimestamp(),
                    reviewedBy: adminProfile?.name || 'Administrator',
                    approvedUntil: validUntil.toISOString()
                });
            } catch (pErr) {
                console.warn("platform_subscriptions update notice:", pErr);
            }

            // 2. Also update in system_configs/platform_submissions pool
            try {
                const poolRef = doc(db, 'system_configs', 'platform_submissions');
                const poolSnap = await getDoc(poolRef);
                if (poolSnap.exists()) {
                    const poolSubs = poolSnap.data()?.submissions || [];
                    const updatedPool = poolSubs.map(s => {
                        if (s.id === sub.id || s.transactionId === sub.transactionId) {
                            return {
                                ...s,
                                status: 'approved',
                                reviewedAt: new Date().toISOString(),
                                reviewedBy: adminProfile?.name || 'Administrator',
                                approvedUntil: validUntil.toISOString()
                            };
                        }
                        return s;
                    });
                    await setDoc(poolRef, { submissions: updatedPool, updatedAt: serverTimestamp() }, { merge: true });
                }
            } catch (poolErr) {
                console.warn("Pool update notice:", poolErr);
            }

            // 3. Update school doc - Reactivate if stopped/suspended!
            if (sub.schoolId) {
                try {
                    await updateDoc(doc(db, 'schools', sub.schoolId), {
                        status: 'active',
                        paymentStatus: 'paid',
                        paidUntil: validUntil.toISOString(),
                        lastPaymentDate: now.toISOString(),
                        billingCycle: sub.cycle || 'monthly',
                        lastSubmissionId: sub.id,
                        updatedAt: new Date()
                    });
                } catch (schErr) {
                    console.warn("School doc update notice:", schErr);
                }
            }

            alert(`Payment Approved! ${sub.schoolName || 'School'} is now marked as PAID until ${validUntil.toLocaleDateString()}.`);
        } catch (err) {
            console.error("Error approving subscription:", err);
            alert("Failed to approve payment: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    // Open Reject Modal
    const handleOpenReject = (sub) => {
        if (!isMasterAdmin && !hasPermission('manageBilling')) {
            alert("Permission Denied: You do not have permission to manage billing approvals.");
            return;
        }
        setRejectingSub(sub);
        setRejectReason('');
    };

    // Confirm Reject Action
    const handleConfirmReject = async () => {
        if (!rejectingSub) return;
        if (!rejectReason.trim()) {
            alert("Please enter a reason for rejecting the payment slip.");
            return;
        }

        setProcessingId(rejectingSub.id);
        try {
            // 1. Try updating platform_subscriptions doc
            try {
                await updateDoc(doc(db, 'platform_subscriptions', rejectingSub.id), {
                    status: 'rejected',
                    rejectReason: rejectReason.trim(),
                    reviewedAt: serverTimestamp(),
                    reviewedBy: adminProfile?.name || 'Administrator'
                });
            } catch (pErr) {
                console.warn("platform_subscriptions update notice:", pErr);
            }

            // 2. Also update in system_configs/platform_submissions pool
            try {
                const poolRef = doc(db, 'system_configs', 'platform_submissions');
                const poolSnap = await getDoc(poolRef);
                if (poolSnap.exists()) {
                    const poolSubs = poolSnap.data()?.submissions || [];
                    const updatedPool = poolSubs.map(s => {
                        if (s.id === rejectingSub.id || s.transactionId === rejectingSub.transactionId) {
                            return {
                                ...s,
                                status: 'rejected',
                                rejectReason: rejectReason.trim(),
                                reviewedAt: new Date().toISOString(),
                                reviewedBy: adminProfile?.name || 'Administrator'
                            };
                        }
                        return s;
                    });
                    await setDoc(poolRef, { submissions: updatedPool, updatedAt: serverTimestamp() }, { merge: true });
                }
            } catch (poolErr) {
                console.warn("Pool update notice:", poolErr);
            }

            // 3. Update school document payment status
            if (rejectingSub.schoolId) {
                try {
                    await updateDoc(doc(db, 'schools', rejectingSub.schoolId), {
                        paymentStatus: 'unpaid',
                        lastRejectReason: rejectReason.trim(),
                        updatedAt: new Date()
                    });
                } catch (schErr) {
                    console.warn("School doc update notice:", schErr);
                }
            }

            alert("Payment rejected. The reason has been recorded and the school will be prompted to re-upload.");
            setRejectingSub(null);
            setRejectReason('');
        } catch (err) {
            console.error("Error rejecting subscription:", err);
            alert("Failed to reject payment: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    // Filtered list
    const filteredSubmissions = submissions.filter(sub => {
        if (filterStatus !== 'all' && sub.status !== filterStatus) return false;
        if (searchQuery.trim()) {
            const queryLower = searchQuery.toLowerCase();
            const schoolName = (sub.schoolName || '').toLowerCase();
            const schoolId = (sub.schoolId || '').toLowerCase();
            const trxId = (sub.transactionId || '').toLowerCase();
            const method = (sub.paymentMethod || '').toLowerCase();
            return schoolName.includes(queryLower) || schoolId.includes(queryLower) || trxId.includes(queryLower) || method.includes(queryLower);
        }
        return true;
    });

    const pendingCount = submissions.filter(s => s.status === 'pending').length;
    const approvedCount = submissions.filter(s => s.status === 'approved').length;
    const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

    const fontFamily = "'Segoe UI', Tahoma, Verdana, sans-serif";

    return (
        <div className="animate-in fade-in duration-300" style={{ fontFamily: fontFamily }}>
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
                    padding: 7px 14px;
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
            `}</style>

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
                        Billing & Subscriptions Center
                    </h2>
                    <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '2px 0 0 0' }}>
                        Review school subscription payments, verify bank deposit slips, and manage billing policies.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        backgroundColor: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <Clock size={15} color="#2563EB" />
                        <span style={{ fontSize: '12.5px', color: '#1E40AF', fontWeight: '700' }}>
                            {pendingCount} Pending Review
                        </span>
                    </div>

                    {isMasterAdmin && (
                        <Link
                            to="/settings"
                            className="win-btn"
                            style={{ textDecoration: 'none' }}
                        >
                            <Landmark size={15} color="#D97706" /> Company Accounts
                        </Link>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowPolicyModal(true)}
                        className="win-btn win-btn-primary"
                    >
                        <Calendar size={15} /> Due Date & Policy Notice
                    </button>
                </div>
            </div>

            {/* 2. FILTER TABS & SEARCH BAR (Windows Explorer Toolbar) */}
            <div
                style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}
            >
                {/* Status Tabs */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {[
                        { key: 'pending', label: `Pending (${pendingCount})` },
                        { key: 'approved', label: `Approved (${approvedCount})` },
                        { key: 'rejected', label: `Rejected (${rejectedCount})` },
                        { key: 'all', label: `All (${submissions.length})` }
                    ].map(tab => {
                        const isActive = filterStatus === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setFilterStatus(tab.key)}
                                className={`win-tab-header ${isActive ? 'win-tab-header-active' : ''}`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative', width: '300px' }}>
                    <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} size={15} />
                    <input
                        type="text"
                        placeholder="Search school name, TRX ID, method..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            paddingLeft: '32px',
                            paddingRight: '10px',
                            paddingTop: '6px',
                            paddingBottom: '6px',
                            borderRadius: '3px',
                            border: '1px solid #94A3B8',
                            fontSize: '12.5px',
                            outline: 'none',
                            color: '#1E293B',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>
            </div>

            {/* 3. CONTENT SUBMISSIONS LIST */}
            {loading ? (
                <div style={{ height: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <Loader2 className="animate-spin" size={36} color="#2563EB" />
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Loading subscription submissions...</span>
                </div>
            ) : filteredSubmissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                    <CreditCard size={44} style={{ color: '#94A3B8', margin: '0 auto 10px', opacity: 0.5 }} />
                    <h3 style={{ color: '#1E293B', fontSize: '1.1rem', margin: '0 0 4px 0' }}>No submissions found</h3>
                    <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>
                        {filterStatus === 'pending'
                            ? 'All school payments have been reviewed! No pending slips waiting.'
                            : 'No subscription payment records match your search filter.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredSubmissions.map((sub) => {
                        const isProcessing = processingId === sub.id;
                        const dateStr = sub.submittedAt?.toDate
                            ? sub.submittedAt.toDate().toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : (sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Recent');

                        return (
                            <div
                                key={sub.id}
                                style={{
                                    backgroundColor: '#FFFFFF',
                                    border: sub.status === 'pending' ? '1px solid #F59E0B' : '1px solid #CBD5E1',
                                    borderRadius: '6px',
                                    padding: '14px 18px',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}
                            >
                                {/* Header Row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '6px',
                                            background: '#EFF6FF',
                                            color: '#2563EB',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <School size={20} />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                                                {sub.schoolName || 'School Submission'}
                                            </h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '11.5px', color: '#64748B' }}>
                                                <code style={{ color: '#1D4ED8', fontWeight: '700' }}>{sub.schoolId}</code>
                                                <span>•</span>
                                                <span>{dateStr}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <span style={{
                                        padding: '3px 8px',
                                        borderRadius: '3px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        textTransform: 'uppercase',
                                        backgroundColor: sub.status === 'approved' ? '#DEF7EC' : (sub.status === 'rejected' ? '#FEE2E2' : '#FEF3C7'),
                                        color: sub.status === 'approved' ? '#03543F' : (sub.status === 'rejected' ? '#991B1B' : '#92400E'),
                                        border: sub.status === 'approved' ? '1px solid #84E1BC' : (sub.status === 'rejected' ? '1px solid #FCA5A5' : '1px solid #FDE68A')
                                    }}>
                                        {sub.status === 'approved' ? '✓ Approved' : (sub.status === 'rejected' ? '✕ Rejected' : '⏱ Pending Review')}
                                    </span>
                                </div>

                                {/* Transaction Financial Details Grid */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                    gap: '12px',
                                    backgroundColor: '#F8FAFC',
                                    padding: '10px 14px',
                                    borderRadius: '4px',
                                    border: '1px solid #E2E8F0'
                                }}>
                                    <div>
                                        <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Amount Paid</span>
                                        <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0F172A' }}>
                                            ₨ {Number(sub.amount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Billing Cycle</span>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E40AF', textTransform: 'capitalize' }}>
                                            {sub.cycle === 'yearly' ? '⭐ Yearly Plan' : '📅 Monthly Plan'}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Payment Method</span>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                                            {sub.paymentMethod || 'Online Transfer'}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Transaction ID (TRX)</span>
                                        <span style={{ fontSize: '12.5px', fontWeight: '700', fontFamily: 'monospace', color: '#D97706' }}>
                                            {sub.transactionId || 'N/A'}
                                        </span>
                                    </div>
                                </div>

                                {/* Rejection Reason banner if rejected */}
                                {sub.status === 'rejected' && sub.rejectReason && (
                                    <div style={{
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        backgroundColor: '#FEF2F2',
                                        border: '1px solid #FCA5A5',
                                        color: '#991B1B',
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <AlertCircle size={15} color="#DC2626" />
                                        <span><strong>Rejection Reason:</strong> {sub.rejectReason}</span>
                                    </div>
                                )}

                                {/* Action Buttons Strip */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
                                    {sub.proofUrl ? (
                                        <button
                                            type="button"
                                            onClick={() => { setViewingSlipUrl(sub.proofUrl); setViewingSub(sub); setZoomLevel(1); }}
                                            className="win-btn"
                                            style={{ color: '#1D4ED8', borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}
                                        >
                                            <Eye size={14} /> View Payment Slip
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>No deposit slip attached</span>
                                    )}

                                    {sub.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenReject(sub)}
                                                disabled={isProcessing}
                                                className="win-btn"
                                                style={{ color: '#DC2626', borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}
                                            >
                                                <XCircle size={14} /> Reject Slip
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleApprove(sub)}
                                                disabled={isProcessing}
                                                className="win-btn win-btn-primary"
                                                style={{
                                                    background: 'linear-gradient(180deg, #16A34A 0%, #15803D 50%, #166534 100%)',
                                                    borderColor: '#14532D'
                                                }}
                                            >
                                                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                                                Approve Payment
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL 1: Full-Size Canvas Slip Preview Studio (React Portal directly on document.body) */}
            {viewingSlipUrl && createPortal(
                <div
                    onClick={() => { setViewingSlipUrl(null); setViewingSub(null); }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(5px)',
                        zIndex: 9999999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        boxSizing: 'border-box'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '1000px',
                            height: '90vh',
                            backgroundColor: '#ECE9D8',
                            border: '3px solid #0055ea',
                            borderRadius: '8px 8px 4px 4px',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Windows Title Bar */}
                        <div
                            style={{
                                height: '34px',
                                background: 'linear-gradient(180deg, #2b70f0 0%, #1e56cb 12%, #0042b3 88%, #0036a1 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0 8px 0 12px',
                                userSelect: 'none'
                            }}
                        >
                            <span style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: '700' }}>
                                Payment Slip Viewer — {viewingSub?.schoolName || 'School'}
                            </span>
                            <button
                                type="button"
                                onClick={() => { setViewingSlipUrl(null); setViewingSub(null); }}
                                style={{
                                    width: '21px',
                                    height: '21px',
                                    borderRadius: '3px',
                                    border: '1px solid #781010',
                                    background: 'linear-gradient(180deg, #E66453 0%, #D83B26 50%, #B81907 100%)',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={13} strokeWidth={3} />
                            </button>
                        </div>

                        {/* Top Toolbar */}
                        <div style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' }}>
                                <span>TRX: <strong>{viewingSub?.transactionId || 'N/A'}</strong></span>
                                <span>•</span>
                                <span>Amount: <strong>₨ {Number(viewingSub?.amount || 0).toLocaleString()}</strong></span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="win-btn" onClick={handleZoomOut} style={{ padding: '4px 8px' }}><ZoomOut size={14} /></button>
                                <button className="win-btn" onClick={handleResetZoom} style={{ padding: '4px 8px', fontSize: '11px' }}>{Math.round(zoomLevel * 100)}%</button>
                                <button className="win-btn" onClick={handleZoomIn} style={{ padding: '4px 8px' }}><ZoomIn size={14} /></button>
                            </div>
                        </div>

                        {/* Canvas Image Container */}
                        <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                            <img
                                src={viewingSlipUrl}
                                alt="Payment Proof"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    transform: `scale(${zoomLevel})`,
                                    transition: 'transform 0.15s ease',
                                    borderRadius: '4px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                                }}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL 2: Reject Reason Dialog (React Portal) */}
            {rejectingSub && createPortal(
                <div
                    onClick={() => setRejectingSub(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(5px)',
                        zIndex: 9999999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        boxSizing: 'border-box'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '520px',
                            backgroundColor: '#ECE9D8',
                            border: '3px solid #0055ea',
                            borderRadius: '8px 8px 4px 4px',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            margin: 'auto'
                        }}
                    >
                        {/* Title Bar */}
                        <div
                            style={{
                                height: '34px',
                                background: 'linear-gradient(180deg, #2b70f0 0%, #1e56cb 12%, #0042b3 88%, #0036a1 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0 8px 0 12px',
                                userSelect: 'none'
                            }}
                        >
                            <span style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: '700' }}>
                                Reject Payment Submission
                            </span>
                            <button
                                type="button"
                                onClick={() => setRejectingSub(null)}
                                style={{
                                    width: '21px',
                                    height: '21px',
                                    borderRadius: '3px',
                                    border: '1px solid #781010',
                                    background: 'linear-gradient(180deg, #E66453 0%, #D83B26 50%, #B81907 100%)',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={13} strokeWidth={3} />
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '16px', backgroundColor: '#ECE9D8' }}>
                            <div style={{ fontSize: '13px', color: '#1F2937', marginBottom: '10px' }}>
                                Rejecting subscription slip for: <strong>{rejectingSub.schoolName || rejectingSub.schoolId}</strong>
                            </div>

                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                Reason for Rejection <span style={{ color: '#DC2626' }}>*</span>
                            </label>
                            <textarea
                                rows={3}
                                placeholder="e.g. Deposit slip image is unreadable / Transaction ID does not match our bank records..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '8px',
                                    borderRadius: '3px',
                                    border: '1px solid #7F9DB9',
                                    fontSize: '13px',
                                    outline: 'none',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>

                        {/* Sunken Footer */}
                        <div style={{ padding: '10px 16px', backgroundColor: '#ECE9D8', borderTop: '1px solid #999', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button className="win-btn" onClick={() => setRejectingSub(null)}>Cancel</button>
                            <button
                                className="win-btn"
                                onClick={handleConfirmReject}
                                style={{ backgroundColor: '#DC2626', color: '#FFFFFF', borderColor: '#B91C1C' }}
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL 3: Due Date & Suspension Policy Dialog (React Portal) */}
            {showPolicyModal && createPortal(
                <div
                    onClick={() => setShowPolicyModal(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(5px)',
                        zIndex: 9999999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        boxSizing: 'border-box'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '620px',
                            backgroundColor: '#ECE9D8',
                            border: '3px solid #0055ea',
                            borderRadius: '8px 8px 4px 4px',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            margin: 'auto'
                        }}
                    >
                        {/* Title Bar */}
                        <div
                            style={{
                                height: '34px',
                                background: 'linear-gradient(180deg, #2b70f0 0%, #1e56cb 12%, #0042b3 88%, #0036a1 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0 8px 0 12px',
                                userSelect: 'none'
                            }}
                        >
                            <span style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: '700' }}>
                                Monthly Due Date & Suspension Policy Configuration
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowPolicyModal(false)}
                                style={{
                                    width: '21px',
                                    height: '21px',
                                    borderRadius: '3px',
                                    border: '1px solid #781010',
                                    background: 'linear-gradient(180deg, #E66453 0%, #D83B26 50%, #B81907 100%)',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={13} strokeWidth={3} />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div style={{ padding: '16px', maxHeight: '65vh', overflowY: 'auto', backgroundColor: '#ECE9D8' }}>
                            {/* Toggle Enable */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '4px', border: '1px solid #CBD5E1', marginBottom: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>Display Policy Banner in Principal App</div>
                                    <div style={{ fontSize: '11.5px', color: '#64748B' }}>Shows the due date reminder & late suspension notice to school principals</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={billingPolicy.enabled !== false}
                                    onChange={(e) => setBillingPolicy(p => ({ ...p, enabled: e.target.checked }))}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563EB' }}
                                />
                            </div>

                            {/* Due Day & Grace Days */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                        Monthly Due Date (Day of Month)
                                    </label>
                                    <select
                                        value={billingPolicy.dueDay || 5}
                                        onChange={(e) => setBillingPolicy(p => ({ ...p, dueDay: Number(e.target.value) }))}
                                        style={{ width: '100%', padding: '6px', borderRadius: '3px', border: '1px solid #7F9DB9', fontSize: '13px', background: '#FFFFFF' }}
                                    >
                                        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                            <option key={day} value={day}>
                                                {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of each month {day === 5 ? '(Recommended)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                        Grace Period Allowance (Days)
                                    </label>
                                    <select
                                        value={billingPolicy.graceDays ?? 2}
                                        onChange={(e) => setBillingPolicy(p => ({ ...p, graceDays: Number(e.target.value) }))}
                                        style={{ width: '100%', padding: '6px', borderRadius: '3px', border: '1px solid #7F9DB9', fontSize: '13px', background: '#FFFFFF' }}
                                    >
                                        {[0, 1, 2, 3, 4, 5, 7, 10].map(days => (
                                            <option key={days} value={days}>
                                                {days === 0 ? 'No Grace Period (Immediate)' : `${days} Days Grace Period ${days === 2 ? '(Recommended)' : ''}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Custom Message */}
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                    Custom Polite Notice / Specific Instructions (Optional)
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="e.g. Please clear subscription dues on or before the 5th to prevent service pause..."
                                    value={billingPolicy.customMessage || ''}
                                    onChange={(e) => setBillingPolicy(p => ({ ...p, customMessage: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '8px',
                                        borderRadius: '3px',
                                        border: '1px solid #7F9DB9',
                                        fontSize: '12.5px',
                                        outline: 'none',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                            {/* Preview box */}
                            <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '4px', padding: '10px 12px', fontSize: '12px', color: '#1E40AF' }}>
                                <strong>Live Principal Portal Preview:</strong> Monthly subscription dues are requested by the <strong>{billingPolicy.dueDay || 5}th</strong> with <strong>{billingPolicy.graceDays || 2} days</strong> grace period.
                            </div>
                        </div>

                        {/* Sunken Footer */}
                        <div style={{ padding: '10px 16px', backgroundColor: '#ECE9D8', borderTop: '1px solid #999', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button className="win-btn" onClick={() => setShowPolicyModal(false)}>Cancel</button>
                            <button
                                className="win-btn win-btn-primary"
                                onClick={handleSavePolicy}
                                disabled={savingPolicy}
                            >
                                {savingPolicy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save Policy Settings
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default BillingSubscriptions;
