import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Briefcase, Plus, Clock, CheckCircle, TrendingUp, Target, Calendar,
    AlertTriangle, School, ExternalLink, MapPin, Phone, Loader2, ArrowRight, Coins
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { calculateTrialDays } from '../utils/dateUtils';
import CreateSchoolModal from '../components/CreateSchoolModal';

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

const BdoDashboard = () => {
    const navigate = useNavigate();
    const { adminProfile, user } = useAdminAuth();
    const bdoUid = adminProfile?.id || user?.uid;

    const [mySchools, setMySchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (!bdoUid) return;
        const unsub = onSnapshot(collection(db, 'schools'), (snap) => {
            const list = [];
            snap.forEach((docSnap) => {
                const data = docSnap.data() || {};
                if (data.assignedBdoId === bdoUid || data.createdByUid === bdoUid) {
                    const trialInfo = calculateTrialDays(
                        data.trialStartDate,
                        data.trialDurationDays || 7,
                        data.trialEndDate,
                        data.accountType,
                        Boolean(data.isPermanentDemo || data.permanentDemo)
                    );
                    list.push({ id: docSnap.id, ...data, trialInfo });
                }
            });
            list.sort((a, b) => {
                const tA = toDateSafe(a.createdAt)?.getTime() || 0;
                const tB = toDateSafe(b.createdAt)?.getTime() || 0;
                return tB - tA;
            });
            setMySchools(list);
            setLoading(false);
        }, (err) => {
            console.error('Error loading BDO schools:', err);
            setLoading(false);
        });

        return () => unsub();
    }, [bdoUid]);

    const metrics = useMemo(() => {
        const trialsInMonth = mySchools.filter((s) => {
            const trialDate = s.firstTrialStartedAt || s.trialStartDate || (s.accountType === 'demo' ? s.createdAt : null);
            if (!trialDate) return false;
            return isInSelectedMonth(trialDate, selectedMonth);
        });

        const onboardedInMonth = mySchools.filter((s) => {
            if (s.accountType !== 'onboarded') return false;
            const onboardDate = s.onboardedAt || s.createdAt;
            return isInSelectedMonth(onboardDate, selectedMonth);
        });

        const activeTrials = mySchools.filter((s) => s.accountType === 'demo' && !s.trialInfo?.isExpired);
        const expiredTrials = mySchools.filter((s) => s.accountType === 'demo' && s.trialInfo?.isExpired);
        const totalAllTimeOnboarded = mySchools.filter((s) => s.accountType === 'onboarded').length;

        const denom = Math.max(trialsInMonth.length, onboardedInMonth.length);
        const conversionRate = denom > 0 ? Math.min(100, Math.round((onboardedInMonth.length / denom) * 100)) : 0;

        // Follow-up list: expired trials + active trials expiring within 3 days
        const followUpSchools = mySchools.filter((s) => {
            if (s.accountType !== 'demo' || s.isPermanentDemo || s.permanentDemo) return false;
            if (s.trialInfo?.isExpired) return true;
            return typeof s.trialInfo?.daysRemaining === 'number' && s.trialInfo.daysRemaining <= 3;
        });

        return {
            trialsCount: trialsInMonth.length,
            onboardedCount: onboardedInMonth.length,
            activeTrialsCount: activeTrials.length,
            expiredTrialsCount: expiredTrials.length,
            totalAllTimeOnboarded,
            totalSchools: mySchools.length,
            conversionRate,
            followUpSchools
        };
    }, [mySchools, selectedMonth]);

    const trialTarget = Number(adminProfile?.monthlyTrialTarget) || 0;
    const onboardTarget = Number(adminProfile?.monthlyOnboardTarget) || 0;
    const trialPct = trialTarget > 0 ? Math.min(100, Math.round((metrics.trialsCount / trialTarget) * 100)) : 0;
    const onboardPct = onboardTarget > 0 ? Math.min(100, Math.round((metrics.onboardedCount / onboardTarget) * 100)) : 0;
    const commissionRate = (adminProfile?.commissionPerSchool !== undefined && adminProfile?.commissionPerSchool !== null && adminProfile?.commissionPerSchool !== '')
        ? Number(adminProfile.commissionPerSchool)
        : 2000;
    const earnedCommission = metrics.onboardedCount * commissionRate;
    const allTimeCommission = metrics.totalAllTimeOnboarded * commissionRate;

    const territoryLabel = (!adminProfile?.territoryScope || adminProfile.territoryScope === 'all')
        ? 'All Pakistan'
        : adminProfile.territoryScope === 'state'
            ? (adminProfile.territoryState || 'Province')
            : adminProfile.territoryScope === 'district'
                ? `${adminProfile.territoryDistrict || ''}, ${adminProfile.territoryState || ''}`
                : `${adminProfile.territoryCity || ''}${adminProfile.territoryDistrict ? `, ${adminProfile.territoryDistrict}` : ''}`;

    const fontFamily = "'Segoe UI', Tahoma, Verdana, sans-serif";

    return (
        <div className="animate-in fade-in duration-300" style={{ fontFamily }}>
            {showCreateModal && (
                <CreateSchoolModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => setShowCreateModal(false)}
                />
            )}

            {/* Header Banner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: '1.55rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                            Welcome, {adminProfile?.name || 'BDO'}
                        </h2>
                        <span style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                            backgroundColor: '#F5F3FF', color: '#6D28D9', border: '1px solid #DDD6FE',
                            display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                            <MapPin size={11} /> {territoryLabel}
                        </span>
                    </div>
                    <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '3px 0 0 0' }}>
                        Your personal monthly school trials, onboarding progress, and follow-up pipeline.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '5px 9px' }}>
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
                        style={{
                            padding: '6px 11px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
                            backgroundColor: selectedMonth === 'all' ? '#7C3AED' : '#FFFFFF',
                            color: selectedMonth === 'all' ? '#FFFFFF' : '#334155',
                            border: `1px solid ${selectedMonth === 'all' ? '#6D28D9' : '#CBD5E1'}`
                        }}
                    >
                        {selectedMonth === 'all' ? '✓ All Time' : 'All Time'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowCreateModal(true)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '7px 14px', borderRadius: '4px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                            border: '1px solid #1D4ED8',
                            background: 'linear-gradient(180deg, #3B82F6 0%, #2563EB 50%, #1D4ED8 100%)',
                            color: '#FFFFFF', boxShadow: '0 1px 2px rgba(37,99,235,0.3)'
                        }}
                    >
                        <Plus size={15} /> Register New School
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <Loader2 className="animate-spin" size={34} color="#7C3AED" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '13px', color: '#64748B' }}>Loading your progress dashboard...</div>
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '1.25rem' }}>
                        {/* Trials Started */}
                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '15px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                                    Trials Started ({selectedMonth === 'all' ? 'All Time' : 'This Month'})
                                </span>
                                <div style={{ width: '32px', height: '32px', borderRadius: '5px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Clock size={17} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#B45309' }}>{metrics.trialsCount}</span>
                                {trialTarget > 0 && selectedMonth !== 'all' && (
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>/ {trialTarget} target</span>
                                )}
                            </div>
                            {trialTarget > 0 && selectedMonth !== 'all' && (
                                <div style={{ marginTop: '8px' }}>
                                    <div style={{ height: '6px', width: '100%', backgroundColor: '#FEF3C7', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${trialPct}%`, backgroundColor: '#D97706', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: '#92400E', fontWeight: '600', marginTop: '3px' }}>{trialPct}% of monthly trial target</div>
                                </div>
                            )}
                        </div>

                        {/* Schools Onboarded */}
                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '15px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                                    Onboarded ({selectedMonth === 'all' ? 'All Time' : 'This Month'})
                                </span>
                                <div style={{ width: '32px', height: '32px', borderRadius: '5px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckCircle size={17} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#15803D' }}>{metrics.onboardedCount}</span>
                                {onboardTarget > 0 && selectedMonth !== 'all' && (
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>/ {onboardTarget} target</span>
                                )}
                            </div>
                            {onboardTarget > 0 && selectedMonth !== 'all' && (
                                <div style={{ marginTop: '8px' }}>
                                    <div style={{ height: '6px', width: '100%', backgroundColor: '#DCFCE7', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${onboardPct}%`, backgroundColor: '#16A34A', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: '#166534', fontWeight: '600', marginTop: '3px' }}>{onboardPct}% of monthly onboard target</div>
                                </div>
                            )}
                        </div>

                        {/* Active Trials Pipeline */}
                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '15px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Active Trials Pipeline</span>
                                <div style={{ width: '32px', height: '32px', borderRadius: '5px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <School size={17} />
                                </div>
                            </div>
                            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1D4ED8' }}>{metrics.activeTrialsCount}</div>
                            <div style={{ fontSize: '11px', color: metrics.expiredTrialsCount > 0 ? '#DC2626' : '#64748B', fontWeight: '600', marginTop: '4px' }}>
                                {metrics.expiredTrialsCount > 0
                                    ? `${metrics.expiredTrialsCount} expired trial(s) need follow-up`
                                    : `${metrics.totalSchools} total schools in your portfolio`}
                            </div>
                        </div>

                        {/* Commission / Incentive Tracker */}
                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '15px 16px', background: 'linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 100%)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#065F46', textTransform: 'uppercase' }}>
                                    My Commission ({selectedMonth === 'all' ? 'All Time' : 'This Month'})
                                </span>
                                <div style={{ width: '32px', height: '32px', borderRadius: '5px', background: '#D1FAE5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Coins size={17} />
                                </div>
                            </div>
                            <div style={{ fontSize: '1.7rem', fontWeight: '800', color: '#047857', lineHeight: 1.2 }}>
                                Rs. {earnedCommission.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '11px', color: '#065F46', fontWeight: '600', marginTop: '4px' }}>
                                Rs. {commissionRate.toLocaleString()} / school • {metrics.onboardedCount} onboarded
                            </div>
                            {selectedMonth !== 'all' && (
                                <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>
                                    All-Time Earned: Rs. {allTimeCommission.toLocaleString()}
                                </div>
                            )}
                        </div>

                        {/* Conversion Rate */}
                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '15px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Conversion Rate</span>
                                <div style={{ width: '32px', height: '32px', borderRadius: '5px', background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <TrendingUp size={17} />
                                </div>
                            </div>
                            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#6D28D9' }}>{metrics.conversionRate}%</div>
                            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginTop: '4px' }}>
                                {metrics.totalAllTimeOnboarded} all-time onboarded • {formatMonthLabel(selectedMonth)}
                            </div>
                        </div>
                    </div>

                    {/* Follow-up Alert Panel (Expiring Soon / Expired Trials) */}
                    {metrics.followUpSchools.length > 0 && (
                        <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '6px', padding: '14px 16px', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '13px', color: '#92400E' }}>
                                    <AlertTriangle size={16} color="#D97706" />
                                    Priority Follow-Ups — Expiring / Expired Trials ({metrics.followUpSchools.length})
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                                {metrics.followUpSchools.map((s) => (
                                    <div key={s.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: '5px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {s.name || s.schoolName}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                {s.contact && <span><Phone size={10} style={{ display: 'inline' }} /> {s.contact}</span>}
                                                <span style={{
                                                    fontWeight: '700',
                                                    color: s.trialInfo?.isExpired ? '#DC2626' : '#D97706'
                                                }}>
                                                    {s.trialInfo?.isExpired ? 'Trial Expired' : `${s.trialInfo?.daysRemaining}d left`}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/schools/${s.id}`)}
                                            style={{
                                                padding: '4px 9px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                                                border: '1px solid #D97706', backgroundColor: '#FEF3C7', color: '#92400E', flexShrink: 0
                                            }}
                                        >
                                            Open
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* My Recent Schools Table */}
                    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ padding: '11px 14px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                                My Schools ({mySchools.length})
                            </span>
                            <button
                                onClick={() => navigate('/schools')}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: 'none',
                                    color: '#2563EB', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit'
                                }}
                            >
                                Manage All Schools <ArrowRight size={13} />
                            </button>
                        </div>

                        {mySchools.length === 0 ? (
                            <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                                <School size={38} color="#CBD5E1" style={{ margin: '0 auto 10px' }} />
                                <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>No Schools Created Yet</h3>
                                <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#64748B' }}>
                                    Start by registering your first Demo/Trial or Onboarded school.
                                </p>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '4px',
                                        border: '1px solid #1D4ED8', background: '#2563EB', color: '#FFFFFF', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={14} /> Register First School
                                </button>
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
                                            <th style={{ padding: '9px 12px' }}>Created</th>
                                            <th style={{ padding: '9px 12px', textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mySchools.slice(0, 10).map((s) => {
                                            const createdD = toDateSafe(s.createdAt);
                                            const isDemo = s.accountType === 'demo';
                                            return (
                                                <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                    <td style={{ padding: '9px 12px' }}>
                                                        <div style={{ fontWeight: '700', color: '#0F172A' }}>{s.name || s.schoolName}</div>
                                                        <div style={{ fontSize: '11px', color: '#64748B' }}>{s.id}</div>
                                                    </td>
                                                    <td style={{ padding: '9px 12px', color: '#334155' }}>
                                                        {[s.city, s.district].filter(Boolean).join(', ') || '—'}
                                                    </td>
                                                    <td style={{ padding: '9px 12px', color: '#334155' }}>{s.contact || '—'}</td>
                                                    <td style={{ padding: '9px 12px' }}>
                                                        {isDemo ? (
                                                            <span style={{
                                                                padding: '2px 7px', borderRadius: '3px', fontSize: '11px', fontWeight: '700',
                                                                backgroundColor: s.trialInfo?.isExpired ? '#FEE2E2' : '#FEF3C7',
                                                                color: s.trialInfo?.isExpired ? '#991B1B' : '#92400E'
                                                            }}>
                                                                {s.trialInfo?.isExpired ? 'Expired Trial' : `Demo (${s.trialInfo?.daysRemaining ?? '?'}d left)`}
                                                            </span>
                                                        ) : (
                                                            <span style={{ padding: '2px 7px', borderRadius: '3px', fontSize: '11px', fontWeight: '700', backgroundColor: '#DCFCE7', color: '#166534' }}>
                                                                Onboarded
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '9px 12px', color: '#475569', fontSize: '11.5px' }}>
                                                        {createdD ? createdD.toLocaleDateString() : '—'}
                                                    </td>
                                                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => navigate(`/schools/${s.id}`)}
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 9px', borderRadius: '4px',
                                                                border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#1D4ED8', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer'
                                                            }}
                                                        >
                                                            <ExternalLink size={11} /> Manage
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default BdoDashboard;
