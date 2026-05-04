import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Search, Filter, Plus, MoreHorizontal, ExternalLink, Trash2, Edit2, Users, UserPlus, Power, CreditCard, Megaphone } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy, getCountFromServer, where, Timestamp, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import CreateSchoolModal from '../components/CreateSchoolModal';
import InlineEditSchool from '../components/InlineEditSchool';
import DeleteSchoolModal from '../components/DeleteSchoolModal';
import BroadcastModal from '../components/BroadcastModal';
import { calculateTrialDays } from '../utils/dateUtils';

const Schools = () => {
    const [schools, setSchools] = useState([]);
    const [stats, setStats] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [schoolToDelete, setSchoolToDelete] = useState(null);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const navigate = useNavigate();

    const fetchSchoolStats = async (schoolId) => {
        try {
            const studentsRef = collection(db, `schools/${schoolId}/students`);

            // Total students
            const totalSnapshot = await getCountFromServer(studentsRef);
            const total = totalSnapshot.data().count;

            // Recent admissions (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const recentQuery = query(studentsRef, where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)));
            const recentSnapshot = await getCountFromServer(recentQuery);
            const recent = recentSnapshot.data().count;

            setStats(prev => ({
                ...prev,
                [schoolId]: { total, recent }
            }));
        } catch (error) {
            console.error(`Error fetching stats for school ${schoolId}:`, error);
        }
    };

    useEffect(() => {
        const q = query(collection(db, "schools"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                const trialInfo = calculateTrialDays(data.trialStartDate);
                list.push({ id: doc.id, ...data, trialInfo });
            });
            setSchools(list);

            // Fetch stats for each school
            list.forEach(school => {
                fetchSchoolStats(school.id);
            });
        });
        return () => unsubscribe();
    }, []);

    const handleTogglePayment = async (schoolId, currentStatus) => {
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

    const sortedForIds = [...schools].sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
    });

    const filteredSchools = sortedForIds.filter(s => {
        const isLegit = s.id === 'SCHOOL_6257' || s.id.startsWith('SCHOOL_');
        if (!isLegit) return false;

        return s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               s.id.toLowerCase().includes(searchTerm.toLowerCase());
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
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <Plus size={20} />
                        Register New School
                    </button>
                </div>
            </header>

            <div className="card glass" style={{ marginBottom: '2rem', padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                        <input
                            type="text"
                            placeholder="Search by school name or ID..."
                            className="input-field"
                            style={{ width: '100%', paddingLeft: '3rem', marginBottom: '0' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="btn" style={{ background: 'var(--card-inner-bg)' }}>
                        <Filter size={18} />
                        Filters
                    </button>
                </div>
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
                                        <button className="logout-btn" onClick={() => setSelectedSchool(school)} style={{ padding: '0.5rem', color: '#1e40af', background: 'rgba(255,255,255,0.5)', borderRadius: '12px' }} title="Edit School">
                                            <Edit2 size={18} />
                                        </button>
                                        <button className="logout-btn" onClick={() => setSchoolToDelete(school)} style={{ padding: '0.5rem', color: '#dc2626', background: 'rgba(255,255,255,0.5)', borderRadius: '12px' }} title="Delete School">
                                            <Trash2 size={18} />
                                        </button>
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
                                        {school.name}
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
                                <p style={{ color: '#334155', fontSize: '0.875rem', marginBottom: '1.25rem', height: '2.5rem', overflow: 'hidden' }}>
                                    {school.address}
                                </p>

                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div style={{
                                        flex: 1,
                                        background: 'rgba(255,255,255,0.6)',
                                        padding: '1rem 0.75rem',
                                        borderRadius: '16px',
                                        border: '1px solid #bae6fd',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        <div style={{ color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Users size={14} />
                                            <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Students</span>
                                        </div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e3a8a' }}>
                                            {stats[school.id]?.total ?? '...'}
                                        </div>
                                    </div>
                                    <div style={{
                                        flex: 1,
                                        background: 'rgba(255,255,255,0.6)',
                                        padding: '1rem 0.75rem',
                                        borderRadius: '16px',
                                        border: '1px solid #bae6fd',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        <div style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <UserPlus size={14} />
                                            <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Admissions</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#059669' }}>
                                                {stats[school.id]?.recent ?? '...'}
                                            </div>
                                            {stats[school.id]?.recent > 0 && (
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: '#10b981',
                                                    boxShadow: '0 0 10px #10b981',
                                                    animation: 'pulse 2s infinite'
                                                }} />
                                            )}
                                        </div>
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

                                {/* Trial Status Badge Section */}
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
                                            <div style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>14-Day Trial</div>
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
                                            <div style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: '#475569' }}>14-Day Trial</div>
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
