import React, { useState, useEffect } from 'react';
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
    AlertTriangle
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

            alert("✅ Due Date & Suspension Policy updated! All schools will now see this policy in their Billing tab.");
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
                        status: 'active', // Auto-reactivate suspended school on approved payment!
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

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <header className="page-header" style={{ marginBottom: '1.75rem' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }} className="text-gradient">
                        Billing & Subscriptions
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        Review school subscription fee payments, verify slips, and approve or reject receipts.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '12px',
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <Clock size={16} color="#818cf8" />
                        <span style={{ fontSize: '0.85rem', color: '#c7d2fe', fontWeight: '700' }}>
                            {pendingCount} Pending Review
                        </span>
                    </div>

                    {isMasterAdmin && (
                        <Link
                            to="/settings"
                            className="btn"
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '12px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                color: '#f59e0b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                textDecoration: 'none',
                                fontSize: '0.85rem',
                                fontWeight: '700'
                            }}
                        >
                            <Landmark size={16} /> Manage Company Accounts
                        </Link>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowPolicyModal(true)}
                        className="btn"
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '12px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            color: '#818cf8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >
                        <Calendar size={16} /> Due Date & Policy Notice
                    </button>
                </div>
            </header>

            {/* Filter Tabs & Search Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                    {[
                        { key: 'pending', label: `Pending (${pendingCount})`, color: '#f59e0b' },
                        { key: 'approved', label: `Approved (${approvedCount})`, color: '#10b981' },
                        { key: 'rejected', label: `Rejected (${rejectedCount})`, color: '#ef4444' },
                        { key: 'all', label: `All (${submissions.length})`, color: '#6366f1' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilterStatus(tab.key)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: filterStatus === tab.key ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: filterStatus === tab.key ? '#ffffff' : 'var(--text-muted)',
                                fontSize: '0.85rem',
                                fontWeight: filterStatus === tab.key ? '700' : '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{ position: 'relative', width: '320px' }}>
                    <Search style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                    <input
                        type="text"
                        placeholder="Search school, TRX ID, method..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: '2.5rem', marginBottom: 0, fontSize: '0.85rem' }}
                    />
                </div>
            </div>

            {/* Content Table / Cards */}
            {loading ? (
                <div style={{ height: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader2 className="animate-spin" size={42} color="var(--primary)" />
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading subscription submissions...</p>
                </div>
            ) : filteredSubmissions.length === 0 ? (
                <div className="card glass" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <CreditCard size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.4 }} />
                    <h3 style={{ color: '#ffffff', fontSize: '1.2rem', marginBottom: '0.5rem' }}>No submissions found</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                        {filterStatus === 'pending'
                            ? 'All school payments have been reviewed! No pending slips waiting.'
                            : 'No subscription payment records match your search filter.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    {filteredSubmissions.map((sub) => {
                        const isProcessing = processingId === sub.id;
                        const dateStr = sub.submittedAt?.toDate
                            ? sub.submittedAt.toDate().toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : (sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Recent');

                        return (
                            <div
                                key={sub.id}
                                className="card glass animate-in fade-in"
                                style={{
                                    padding: '1.5rem',
                                    border: sub.status === 'pending' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--glass-border)',
                                    background: sub.status === 'pending' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, rgba(15, 23, 42, 0.6) 100%)' : 'rgba(15, 23, 42, 0.6)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1.25rem'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                    {/* School & Plan Info */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '14px',
                                            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                                        }}>
                                            <School size={24} />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#ffffff' }}>
                                                {sub.schoolName || 'School Submission'}
                                            </h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#818cf8', fontWeight: '700' }}>
                                                    {sub.schoolId}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>•</span>
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    {dateStr}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{
                                            padding: '0.35rem 0.8rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.75rem',
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            background: sub.status === 'approved'
                                                ? 'rgba(16, 185, 129, 0.15)'
                                                : (sub.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                                            color: sub.status === 'approved'
                                                ? '#34d399'
                                                : (sub.status === 'rejected' ? '#f87171' : '#fbbf24'),
                                            border: sub.status === 'approved'
                                                ? '1px solid rgba(16, 185, 129, 0.3)'
                                                : (sub.status === 'rejected' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)')
                                        }}>
                                            {sub.status === 'approved' ? '✓ Approved' : (sub.status === 'rejected' ? '✕ Rejected' : '⏱ Pending Review')}
                                        </span>
                                    </div>
                                </div>

                                {/* Transaction Details Grid */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: '1rem',
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    padding: '1rem 1.25rem',
                                    borderRadius: '12px',
                                    border: '1px solid var(--glass-border)'
                                }}>
                                    <div>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>AMOUNT PAID</span>
                                        <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>
                                            ₨ {Number(sub.amount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>BILLING CYCLE</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#c7d2fe', textTransform: 'capitalize' }}>
                                            {sub.cycle === 'yearly' ? '⭐ Yearly Plan' : '📅 Monthly Plan'}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>PAYMENT METHOD</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ffffff' }}>
                                            {sub.paymentMethod || 'Online Transfer'}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>TRANSACTION ID (TRX)</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: '700', fontFamily: 'monospace', color: '#f59e0b' }}>
                                            {sub.transactionId || 'N/A'}
                                        </span>
                                    </div>
                                </div>

                                {/* If Rejected, display reason */}
                                {sub.status === 'rejected' && sub.rejectReason && (
                                    <div style={{
                                        padding: '0.85rem 1rem',
                                        borderRadius: '10px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.25)',
                                        color: '#fca5a5',
                                        fontSize: '0.85rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.6rem'
                                    }}>
                                        <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                                        <span><strong>Rejection Reason:</strong> {sub.rejectReason}</span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.5rem' }}>
                                    {/* View Slip Button */}
                                    {sub.proofUrl ? (
                                        <button
                                            type="button"
                                            onClick={() => { setViewingSlipUrl(sub.proofUrl); setViewingSub(sub); setZoomLevel(1); }}
                                            className="btn"
                                            style={{
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.85rem',
                                                background: 'rgba(99, 102, 241, 0.15)',
                                                color: '#818cf8',
                                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            <Eye size={16} /> View Payment Slip
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No slip attached</span>
                                    )}

                                    {/* Action Buttons for Pending */}
                                    {sub.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenReject(sub)}
                                                disabled={isProcessing}
                                                className="btn"
                                                style={{
                                                    padding: '0.5rem 1.25rem',
                                                    fontSize: '0.85rem',
                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                    color: '#f87171',
                                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                                    fontWeight: '700',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem'
                                                }}
                                            >
                                                <XCircle size={16} /> Reject Slip
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleApprove(sub)}
                                                disabled={isProcessing}
                                                className="btn"
                                                style={{
                                                    padding: '0.5rem 1.4rem',
                                                    fontSize: '0.85rem',
                                                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                                    color: 'white',
                                                    border: 'none',
                                                    fontWeight: '700',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                                }}
                                            >
                                                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
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

            {/* Full-Size Canvas Slip Preview Modal Studio */}
            {viewingSlipUrl && (
                <div
                    onClick={() => { setViewingSlipUrl(null); setViewingSub(null); }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(3, 7, 18, 0.88)',
                        backdropFilter: 'blur(10px)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'relative',
                            width: '96vw',
                            maxWidth: '1360px',
                            height: '92vh',
                            maxHeight: '92vh',
                            display: 'flex',
                            flexDirection: 'column',
                            background: '#090d16',
                            borderRadius: '20px',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            overflow: 'hidden',
                            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                        }}
                    >
                        {/* Top Studio Header Bar with School Details & Controls */}
                        <div style={{
                            width: '100%',
                            padding: '0.85rem 1.5rem',
                            background: 'rgba(15, 23, 42, 0.95)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                            flexShrink: 0,
                            flexWrap: 'wrap',
                            gap: '0.75rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <FileText size={20} color="#818cf8" />
                                    <span style={{ fontSize: '1rem', fontWeight: '800', color: '#ffffff' }}>
                                        Payment Slip Preview Studio
                                    </span>
                                </div>
                                {viewingSub && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{
                                            fontSize: '0.8rem',
                                            fontWeight: '700',
                                            padding: '3px 10px',
                                            borderRadius: '8px',
                                            background: 'rgba(99, 102, 241, 0.2)',
                                            color: '#a5b4fc',
                                            border: '1px solid rgba(99, 102, 241, 0.3)'
                                        }}>
                                            {viewingSub.schoolName || viewingSub.schoolId}
                                        </span>
                                        <span style={{
                                            fontSize: '0.82rem',
                                            fontWeight: '800',
                                            padding: '3px 10px',
                                            borderRadius: '8px',
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            color: '#34d399',
                                            border: '1px solid rgba(16, 185, 129, 0.3)'
                                        }}>
                                            ₨ {Number(viewingSub.amount || 0).toLocaleString()}
                                        </span>
                                        {viewingSub.transactionId && (
                                            <span style={{
                                                fontSize: '0.78rem',
                                                fontFamily: 'monospace',
                                                color: '#cbd5e1',
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(255, 255, 255, 0.1)'
                                            }}>
                                                TID: {viewingSub.transactionId}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Zoom Controls & Close Button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    padding: '2px 4px'
                                }}>
                                    <button
                                        type="button"
                                        onClick={handleZoomOut}
                                        className="btn"
                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}
                                        title="Zoom Out"
                                    >
                                        <ZoomOut size={15} />
                                    </button>
                                    <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '700', minWidth: '46px', textAlign: 'center' }}>
                                        {Math.round(zoomLevel * 100)}%
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleZoomIn}
                                        className="btn"
                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}
                                        title="Zoom In"
                                    >
                                        <ZoomIn size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleResetZoom}
                                        className="btn"
                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                        title="Reset 100%"
                                    >
                                        <RotateCcw size={14} />
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => { setViewingSlipUrl(null); setViewingSub(null); }}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '10px',
                                        color: '#f87171',
                                        cursor: 'pointer',
                                        padding: '6px 8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    title="Close Preview (Esc)"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Full-Size Canvas Body */}
                        <div style={{
                            flex: 1,
                            width: '100%',
                            overflow: 'auto',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2rem',
                            background: 'radial-gradient(ellipse at center, #131d31 0%, #070b14 100%)'
                        }}>
                            <img
                                src={viewingSlipUrl}
                                alt="Payment Proof Receipt"
                                style={{
                                    transform: `scale(${zoomLevel})`,
                                    transformOrigin: 'center center',
                                    transition: 'transform 0.15s ease-out',
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    borderRadius: '12px',
                                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.12)'
                                }}
                            />
                        </div>

                        {/* Studio Footer Bar with Open Full Size & Quick Actions */}
                        <div style={{
                            width: '100%',
                            padding: '0.85rem 1.5rem',
                            background: 'rgba(15, 23, 42, 0.95)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            flexShrink: 0,
                            flexWrap: 'wrap',
                            gap: '0.75rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                                <span>Method: <strong style={{ color: '#ffffff' }}>{viewingSub?.paymentMethod || 'Bank Transfer'}</strong></span>
                                <span>Cycle: <strong style={{ color: '#ffffff' }}>{viewingSub?.cycle === 'yearly' ? 'Yearly Plan' : 'Monthly Plan'}</strong></span>
                                {viewingSub?.submittedAt && (
                                    <span style={{ fontSize: '0.78rem' }}>
                                        Submitted: {viewingSub.submittedAt?.toDate ? viewingSub.submittedAt.toDate().toLocaleDateString() : new Date(viewingSub.submittedAt).toLocaleDateString()}
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <a
                                    href={viewingSlipUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn"
                                    style={{
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.82rem',
                                        background: 'rgba(255, 255, 255, 0.06)',
                                        color: '#e2e8f0',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '8px',
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontWeight: '600'
                                    }}
                                >
                                    Open Raw Full Size <ExternalLink size={14} />
                                </a>

                                {viewingSub && viewingSub.status === 'pending' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const current = viewingSub;
                                                setViewingSlipUrl(null);
                                                setViewingSub(null);
                                                handleOpenReject(current);
                                            }}
                                            className="btn"
                                            style={{
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.82rem',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                color: '#f87171',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                borderRadius: '8px',
                                                fontWeight: '700',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <XCircle size={15} /> Reject
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const current = viewingSub;
                                                setViewingSlipUrl(null);
                                                setViewingSub(null);
                                                await handleApprove(current);
                                            }}
                                            className="btn"
                                            style={{
                                                padding: '0.5rem 1.15rem',
                                                fontSize: '0.82rem',
                                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: '800',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                            }}
                                        >
                                            <CheckCircle2 size={15} /> Approve Payment
                                        </button>
                                    </>
                                )}

                                <button
                                    type="button"
                                    onClick={() => { setViewingSlipUrl(null); setViewingSub(null); }}
                                    className="btn"
                                    style={{
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.82rem',
                                        background: '#334155',
                                        color: '#f8fafc',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Close Preview
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Reason Modal */}
            {rejectingSub && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div className="card glass animate-in zoom-in-95 duration-200" style={{ maxWidth: '480px', width: '100%', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                                    <XCircle size={20} />
                                </div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'white' }}>Reject Payment Slip</h3>
                            </div>
                            <button
                                onClick={() => setRejectingSub(null)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Specify why this payment slip is being rejected. The school principal will be able to see this reason and re-upload the correct receipt.
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label className="label" style={{ marginBottom: '0.4rem' }}>Rejection Reason</label>
                            <textarea
                                rows={3}
                                className="input-field"
                                placeholder="e.g. Invalid Transaction ID, amount does not match invoice, or slip image unreadable."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                type="button"
                                onClick={() => setRejectingSub(null)}
                                className="btn"
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmReject}
                                disabled={processingId === rejectingSub.id}
                                className="btn"
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    fontSize: '0.85rem',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: '700'
                                }}
                            >
                                {processingId === rejectingSub.id ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Policy & Due Date Configuration Modal */}
            {showPolicyModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.25rem'
                }}>
                    <div className="card glass animate-in zoom-in-95 duration-200" style={{ maxWidth: '640px', width: '100%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                                    <Calendar size={22} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'white' }}>
                                        Monthly Due Date & Suspension Policy
                                    </h3>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                                        Real-time notice configuration for all school principal portals
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPolicyModal(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Switch Enable/Disable */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1rem',
                            borderRadius: '12px',
                            background: 'rgba(15, 23, 42, 0.6)',
                            border: '1px solid var(--glass-border)',
                            marginBottom: '1.5rem'
                        }}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'white', fontWeight: '700' }}>
                                    Display Policy Banner in Principal WebApp
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Shows the polite due date reminder & late suspension notice to school principals
                                </p>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={billingPolicy.enabled !== false}
                                    onChange={(e) => setBillingPolicy(p => ({ ...p, enabled: e.target.checked }))}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                    position: 'absolute',
                                    cursor: 'pointer',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: billingPolicy.enabled !== false ? '#6366f1' : '#334155',
                                    transition: '0.3s',
                                    borderRadius: '24px'
                                }}>
                                    <span style={{
                                        position: 'absolute',
                                        content: '""',
                                        height: '18px',
                                        width: '18px',
                                        left: billingPolicy.enabled !== false ? '22px' : '3px',
                                        bottom: '3px',
                                        backgroundColor: 'white',
                                        transition: '0.3s',
                                        borderRadius: '50%'
                                    }} />
                                </span>
                            </label>
                        </div>

                        {/* Grid: Due Day & Grace Days */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                            <div>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                                    <Clock size={14} color="#818cf8" />
                                    <span>Monthly Due Date (Day of Month)</span>
                                </label>
                                <select
                                    value={billingPolicy.dueDay || 5}
                                    onChange={(e) => setBillingPolicy(p => ({ ...p, dueDay: Number(e.target.value) }))}
                                    className="input-field"
                                    style={{ cursor: 'pointer' }}
                                >
                                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                        <option key={day} value={day} style={{ background: '#0f172a', color: 'white' }}>
                                            {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of each month {day === 5 ? '(Recommended)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                                    Principals will be asked to clear dues by this date.
                                </span>
                            </div>

                            <div>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                                    <Shield size={14} color="#10b981" />
                                    <span>Grace Period Allowance (Days)</span>
                                </label>
                                <select
                                    value={billingPolicy.graceDays ?? 2}
                                    onChange={(e) => setBillingPolicy(p => ({ ...p, graceDays: Number(e.target.value) }))}
                                    className="input-field"
                                    style={{ cursor: 'pointer' }}
                                >
                                    {[0, 1, 2, 3, 4, 5, 7, 10].map(days => (
                                        <option key={days} value={days} style={{ background: '#0f172a', color: 'white' }}>
                                            {days === 0 ? 'No Grace Period (Immediate)' : `${days} Days Grace Period ${days === 2 ? '(Recommended)' : ''}`}
                                        </option>
                                    ))}
                                </select>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                                    Additional days before system suspension warning turns critical.
                                </span>
                            </div>
                        </div>

                        {/* Custom Policy Notice / Instructions */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label className="label" style={{ marginBottom: '0.4rem' }}>
                                Custom Polite Notice / Specific Instructions (Optional)
                            </label>
                            <textarea
                                rows={3}
                                className="input-field"
                                placeholder="e.g. Please clear your subscription dues on or before the 5th to prevent temporary service pause. Payment proof slips are verified within a few hours."
                                value={billingPolicy.customMessage || ''}
                                onChange={(e) => setBillingPolicy(p => ({ ...p, customMessage: e.target.value }))}
                                style={{ resize: 'vertical', fontSize: '0.85rem' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                                If left blank, the system displays the default polite bilingual (English & Urdu) notice.
                            </span>
                        </div>

                        {/* Live Preview Box */}
                        <div style={{
                            padding: '1rem',
                            borderRadius: '12px',
                            background: 'rgba(99, 102, 241, 0.08)',
                            border: '1px dashed rgba(99, 102, 241, 0.3)',
                            marginBottom: '1.5rem'
                        }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: '#818cf8', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                                👁️ Live Principal Portal Preview:
                            </span>
                            <div style={{
                                padding: '0.85rem 1rem',
                                borderRadius: '10px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#1e293b'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#4f46e5' }}>
                                        📅 Monthly Due Date: {billingPolicy.dueDay || 5}th of Every Month
                                    </span>
                                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px', background: '#e0e7ff', color: '#3730a3', fontWeight: '700' }}>
                                        {billingPolicy.graceDays || 2} Days Grace
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.8rem', margin: '4px 0', color: '#475569', lineHeight: '1.4' }}>
                                    {billingPolicy.customMessage ? billingPolicy.customMessage : `Monthly subscription fees are requested on or before the ${billingPolicy.dueDay || 5}th of each month. Late dues past grace period may lead to temporary portal suspension until payment slip verification.`}
                                </p>
                                <p style={{ fontSize: '0.78rem', margin: '4px 0 0', color: '#64748b', direction: 'rtl', lineHeight: '1.4' }}>
                                    محترم پرنسپل صاحب، براہ کرم ہر ماہ کی {billingPolicy.dueDay || 5} تاریخ تک فیس ادا کر کے سلپ اپلوڈ فرمائیں تاکہ سسٹم بلا تعطل فعال رہے۔
                                </p>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowPolicyModal(false)}
                                className="btn"
                                style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSavePolicy}
                                disabled={savingPolicy}
                                className="btn btn-primary"
                                style={{
                                    padding: '0.55rem 1.5rem',
                                    fontSize: '0.85rem',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                {savingPolicy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                <span>Save Policy Settings</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillingSubscriptions;
