import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, School, User, Mail, Shield,
    CreditCard, Power, Loader2, Save, Calendar,
    MapPin, Hash, CheckCircle, XCircle, Users, UserPlus, Phone
} from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';

const SchoolDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [school, setSchool] = useState(null);
    const [principal, setPrincipal] = useState(null);
    const [stats, setStats] = useState({ total: '...', recent: '...' });
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, "schools", id), async (docSnap) => {
            if (docSnap.exists()) {
                const schoolData = { id: docSnap.id, ...docSnap.data() };
                setSchool(schoolData);

                // Fetch principal info
                if (schoolData.principalId) {
                    const principalSnap = await getDoc(doc(db, "global_users", schoolData.principalId));
                    let pData = principalSnap.exists() ? principalSnap.data() : null;

                    // Always try to fetch from school registry to get the Name, 
                    // as global_users might only have email/role
                    const fallbackSnap = await getDoc(doc(db, `schools/${id}/users`, schoolData.principalId));
                    if (fallbackSnap.exists()) {
                        pData = { ...pData, ...fallbackSnap.data() };
                    }
                    setPrincipal(pData);
                }

                // Fetch stats
                fetchSchoolStats(id);
            } else {
                console.error("School not found");
                navigate('/schools');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id, navigate]);

    const fetchSchoolStats = async (schoolId) => {
        try {
            const { getCountFromServer, query, where, Timestamp, collection } = await import('firebase/firestore');
            const studentsRef = collection(db, `schools/${schoolId}/students`);

            const totalSnapshot = await getCountFromServer(studentsRef);
            const total = totalSnapshot.data().count;

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentQuery = query(studentsRef, where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)));
            const recentSnapshot = await getCountFromServer(recentQuery);
            const recent = recentSnapshot.data().count;

            setStats({ total, recent });
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    };

    const handleTogglePayment = async () => {
        setUpdating(true);
        try {
            const newStatus = school.paymentStatus === 'paid' ? 'unpaid' : 'paid';
            await updateDoc(doc(db, "schools", id), {
                paymentStatus: newStatus,
                updatedAt: new Date()
            });
        } catch (error) {
            alert("Failed to update payment status: " + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleToggleSystemStatus = async () => {
        setUpdating(true);
        try {
            const newStatus = school.status === 'active' ? 'suspended' : 'active';
            await updateDoc(doc(db, "schools", id), {
                status: newStatus,
                updatedAt: new Date()
            });
        } catch (error) {
            alert("Failed to update system status: " + error.message);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="animate-spin" size={48} color="var(--primary)" />
            </div>
        );
    }

    const isSuspended = school.status === 'suspended';

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => navigate('/schools')}
                        className="btn"
                        style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)' }}
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: '2rem' }} className="text-gradient">{school.name}</h2>
                        <p style={{ color: 'var(--text-muted)' }}>Detailed school management and administrative controls.</p>
                    </div>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                {/* Main Info Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* School Profile Card */}
                    <div className="card glass" style={{ padding: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <School size={22} color="var(--primary)" />
                            School Profile
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <InfoItem icon={Hash} label="School ID" value={school.id} />
                            <InfoItem icon={MapPin} label="Location" value={school.address} />
                            <InfoItem icon={Phone} label="School Contact" value={school.contact || 'Not Provided'} />
                            <InfoItem icon={Calendar} label="Registered On" value={school.createdAt?.toDate().toLocaleDateString() || 'N/A'} />
                            <InfoItem
                                icon={isSuspended ? XCircle : CheckCircle}
                                label="Current Access"
                                value={isSuspended ? 'Suspended' : 'Active Access'}
                                color={isSuspended ? '#f87171' : '#34d399'}
                            />
                        </div>

                        {/* Student Stats in Detail Page */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
                            <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                    <Users size={18} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Total Students</span>
                                </div>
                                <div style={{ fontSize: '2rem', fontWeight: '800' }}>{stats.total.toLocaleString()}</div>
                            </div>
                            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#10b981', marginBottom: '0.5rem' }}>
                                    <UserPlus size={18} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Recent Admissions</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#34d399' }}>{stats.recent.toLocaleString()}</div>
                                    {stats.recent > 0 && typeof stats.recent === 'number' && (
                                        <div style={{ padding: '0.2rem 0.5rem', background: '#34d399', color: '#064e3b', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '800', animation: 'pulse 2s infinite' }}>NEW</div>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>In the last 30 days</p>
                            </div>
                        </div>
                    </div>

                    {/* Principal Profile Card */}
                    <div className="card glass" style={{ padding: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Shield size={22} color="var(--accent)" />
                            Principal Administrative Info
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <InfoItem icon={User} label="Principal Name" value={principal?.name || 'Loading...'} />
                            <InfoItem icon={Mail} label="Contact Email" value={principal?.email || 'N/A'} />
                            <InfoItem icon={Phone} label="Principal Phone" value={principal?.contact || 'Not Provided'} />
                            <InfoItem icon={Hash} label="Principal UID" value={school.principalId || 'N/A'} />
                            <InfoItem icon={Calendar} label="Last Updated" value={school.updatedAt?.toDate().toLocaleDateString() || 'Never'} />
                        </div>
                    </div>
                </div>

                {/* Controls Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="card glass" style={{ padding: '2rem', border: '1px solid var(--primary-glow)' }}>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Administrative Controls</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Payment Toggle */}
                            <div style={{ padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>Billing Status</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cycle: Monthly Subscription</p>
                                    </div>
                                    <span style={{
                                        padding: '0.25rem 0.6rem',
                                        borderRadius: '12px',
                                        fontSize: '0.7rem',
                                        fontWeight: '700',
                                        textTransform: 'uppercase',
                                        background: school.paymentStatus === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        color: school.paymentStatus === 'paid' ? '#34d399' : '#fbbf24'
                                    }}>
                                        {school.paymentStatus || 'unpaid'}
                                    </span>
                                </div>
                                <button
                                    onClick={handleTogglePayment}
                                    disabled={updating}
                                    className="btn"
                                    style={{
                                        width: '100%',
                                        justifyContent: 'center',
                                        background: school.paymentStatus === 'paid' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                        color: school.paymentStatus === 'paid' ? '#fbbf24' : '#34d399',
                                        borderColor: school.paymentStatus === 'paid' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'
                                    }}
                                >
                                    {updating ? <Loader2 className="animate-spin" size={18} /> : (
                                        <>
                                            <CreditCard size={18} />
                                            Mark as {school.paymentStatus === 'paid' ? 'Unpaid' : 'Paid'}
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* System Status Toggle (Start/Stop) */}
                            <div style={{ padding: '1.25rem', borderRadius: '16px', background: isSuspended ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--glass-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>System Access</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Principal, Teacher & Parent Apps</p>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        color: isSuspended ? '#f87171' : '#34d399',
                                        fontSize: '0.75rem',
                                        fontWeight: '700'
                                    }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor', boxShadow: '0 0 8px currentColor' }}></div>
                                        {isSuspended ? 'OFF' : 'ON'}
                                    </div>
                                </div>
                                <button
                                    onClick={handleToggleSystemStatus}
                                    disabled={updating}
                                    className="btn"
                                    style={{
                                        width: '100%',
                                        justifyContent: 'center',
                                        background: isSuspended ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        color: isSuspended ? '#34d399' : '#f87171',
                                        borderColor: isSuspended ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                                    }}
                                >
                                    {updating ? <Loader2 className="animate-spin" size={18} /> : (
                                        <>
                                            <Power size={18} />
                                            {isSuspended ? 'Start System' : 'Stop System'}
                                        </>
                                    )}
                                </button>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center' }}>
                                    {isSuspended
                                        ? "System is currently offline for this school. All apps are locked."
                                        : "System is active. All apps (Principal, Teacher, Parent) are accessible."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InfoItem = ({ icon: Icon, label, value, color }) => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{
            marginTop: '0.25rem',
            padding: '0.6rem',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            color: color || 'var(--text-muted)'
        }}>
            <Icon size={18} />
        </div>
        <div>
            <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
            </p>
            <p style={{ fontSize: '1rem', fontWeight: '700', color: color || 'white' }}>
                {value}
            </p>
        </div>
    </div>
);

export default SchoolDetail;
