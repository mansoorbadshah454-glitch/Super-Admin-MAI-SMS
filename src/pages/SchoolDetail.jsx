import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, School, User, Mail, Shield,
    CreditCard, Power, Loader2, Save, Calendar,
    MapPin, Hash, CheckCircle, XCircle, Users, UserPlus, Phone
} from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, getDoc, collection, getCountFromServer, query, where, Timestamp } from 'firebase/firestore';

const SchoolDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [school, setSchool] = useState(null);
    const [principal, setPrincipal] = useState(null);
    const [stats, setStats] = useState({ total: '...', recent: '...' });
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        setLoading(true); // Reset loading on ID change
        const unsubscribe = onSnapshot(doc(db, "schools", id), async (docSnap) => {
            try {
                if (docSnap.exists()) {
                    const schoolData = { id: docSnap.id, ...docSnap.data() };
                    setSchool(schoolData);
                    console.log("School Data Loaded:", schoolData);

                    // Fetch principal info (Fail gracefully)
                    if (schoolData.principalId) {
                        try {
                            const principalSnap = await getDoc(doc(db, "global_users", schoolData.principalId));
                            let pData = principalSnap.exists() ? principalSnap.data() : null;

                            // Fallback to school-specific user doc
                            const fallbackSnap = await getDoc(doc(db, `schools/${id}/users`, schoolData.principalId));
                            if (fallbackSnap.exists()) {
                                pData = { ...pData, ...fallbackSnap.data() };
                            }
                            setPrincipal(pData);
                        } catch (pError) {
                            console.error("Principal Fetch Error (Non-fatal):", pError);
                        }
                    }

                    // Fetch stats
                    fetchSchoolStats(id);
                } else {
                    console.error("School not found");
                    // alert("School not found!"); // Optional
                    navigate('/schools');
                }
            } catch (err) {
                console.error("Error processing school data:", err);
                alert("Error processing data: " + err.message);
            } finally {
                setLoading(false);
            }
        }, (error) => {
            console.error("School Query Error:", error);
            alert(`Error loading school: ${error.message}`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id, navigate]);

    const fetchSchoolStats = async (schoolId) => {
        try {
            // 1. Students
            const studentsRef = collection(db, `schools/${schoolId}/students`);
            const totalSnapshot = await getCountFromServer(studentsRef);
            const total = totalSnapshot.data().count;

            // 2. Teachers
            const teachersRef = collection(db, `schools/${schoolId}/teachers`);
            const teachersSnapshot = await getCountFromServer(teachersRef);
            const teachers = teachersSnapshot.data().count;

            // 3. Parents
            const parentsRef = collection(db, `schools/${schoolId}/parents`);
            const parentsSnapshot = await getCountFromServer(parentsRef);
            const parents = parentsSnapshot.data().count;

            // 4. Recent Admissions
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentQuery = query(studentsRef, where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)));
            const recentSnapshot = await getCountFromServer(recentQuery);
            const recent = recentSnapshot.data().count;

            setStats({ total, teachers, parents, recent });
        } catch (error) {
            console.error("Error fetching stats:", error);
            setStats(prev => ({ ...prev, total: 0, teachers: 0, parents: 0, recent: 0 }));
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
                        style={{ padding: '0.5rem', background: 'var(--card-inner-bg)' }}
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
                            {/* Students */}
                            <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                    <Users size={18} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Total Students</span>
                                </div>
                                <div style={{ fontSize: '2rem', fontWeight: '800' }}>{stats.total.toLocaleString()}</div>
                            </div>

                            {/* Teachers */}
                            <div style={{ background: 'rgba(236, 72, 153, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(236, 72, 153, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ec4899', marginBottom: '0.5rem' }}>
                                    <User size={18} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Total Teachers</span>
                                </div>
                                <div style={{ fontSize: '2rem', fontWeight: '800' }}>{stats.teachers?.toLocaleString() || '0'}</div>
                            </div>

                            {/* Parents */}
                            <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f59e0b', marginBottom: '0.5rem' }}>
                                    <Users size={18} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Total Parents</span>
                                </div>
                                <div style={{ fontSize: '2rem', fontWeight: '800' }}>{stats.parents?.toLocaleString() || '0'}</div>
                            </div>

                            {/* Recent Admissions */}
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
                            <InfoItem icon={User} label="Principal Name" value={principal?.name || 'Not Found'} />
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
                            <div style={{ padding: '1.25rem', borderRadius: '16px', background: 'var(--card-inner-bg)', border: '1px solid var(--glass-border)' }}>
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
            background: 'var(--card-inner-bg)',
            color: color || 'var(--text-muted)'
        }}>
            <Icon size={18} />
        </div>
        <div>
            <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
            </p>
            <p style={{ fontSize: '1rem', fontWeight: '700', color: color || 'var(--text-main)' }}>
                {value}
            </p>
        </div>
    </div>
);

export default SchoolDetail;
