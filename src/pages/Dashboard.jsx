import React, { useState, useEffect } from 'react';
import { School, Users, Activity, Plus, Search, Filter, MoreVertical, GraduationCap } from 'lucide-react';
import CreateSchoolModal from '../components/CreateSchoolModal';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs, getCountFromServer, collectionGroup, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { calculateTrialDays } from '../utils/dateUtils';

const Dashboard = () => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [schools, setSchools] = useState([]);
    const [stats, setStats] = useState([
        { label: 'Total Schools', value: '0', icon: School, color: '#6366f1' },
        { label: 'Total Students', value: '0', icon: Activity, color: '#8b5cf6' },
        { label: 'Total Teachers', value: '0', icon: GraduationCap, color: '#ec4899' },
        { label: 'Total Parents', value: '0', icon: Users, color: '#14b8a6' },
        { label: 'Paid Schools', value: '0', icon: Users, color: '#10b981' },
        { label: 'Unpaid Schools', value: '0', icon: Users, color: '#f59e0b' },
    ]);

    useEffect(() => {
        // Fetch Schools for Table and Stats
        const q = query(collection(db, "schools"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const schoolsArray = [];
            let paidCount = 0;
            let unpaidCount = 0;

            querySnapshot.forEach((doc) => {
                const data = doc.data();

                // Calculate Trial Info based on trialStartDate
                const trialInfo = calculateTrialDays(data.trialStartDate);

                schoolsArray.push({
                    id: doc.id,
                    ...data,
                    trialInfo
                });

                if (data.paymentStatus === 'paid') paidCount++;
                else unpaidCount++;
            });

            // Sort logic requested by user:
            // 1. Expired trials (0 days left) above all
            // 2. Active Trials sorted by less days left (ascending)
            // 3. Not Started trials at the bottom
            schoolsArray.sort((a, b) => {
                // If one is "Not Started", it goes to the bottom
                if (a.trialInfo.notStarted && !b.trialInfo.notStarted) return 1;
                if (!a.trialInfo.notStarted && b.trialInfo.notStarted) return -1;

                // If one is expired and other is not, expired comes first
                if (a.trialInfo.isExpired && !b.trialInfo.isExpired) return -1;
                if (!a.trialInfo.isExpired && b.trialInfo.isExpired) return 1;

                // If both are active, sort ascending by days left (fewer days first)
                if (!a.trialInfo.isExpired && !b.trialInfo.isExpired && !a.trialInfo.notStarted && !b.trialInfo.notStarted) {
                    return a.trialInfo.daysLeft - b.trialInfo.daysLeft;
                }

                // If both are expired, retain original sorting (newest first)
                return 0;
            });

            setSchools(schoolsArray.slice(0, 5)); // Only show last 5 in dashboard table

            // Fetch total students, teachers, and parents across all schools
            let totalStudents = 0;
            let totalTeachers = 0;
            let totalParents = 0;

            try {
                // Use collectionGroup to count all documents in subcollections
                const studentsQuery = query(collectionGroup(db, 'students'));
                const teachersQuery = query(collectionGroup(db, 'teachers'));
                const parentsQuery = query(collectionGroup(db, 'parents'));

                const [studentsSnap, teachersSnap, parentsSnap] = await Promise.all([
                    getCountFromServer(studentsQuery),
                    getCountFromServer(teachersQuery),
                    getCountFromServer(parentsQuery)
                ]);

                totalStudents = studentsSnap.data().count;
                totalTeachers = teachersSnap.data().count;
                totalParents = parentsSnap.data().count;
            } catch (error) {
                console.error("Error fetching total counts:", error);
            }

            // Update Stats Grid
            setStats([
                { label: 'Total Schools', value: querySnapshot.size.toString(), icon: School, color: '#6366f1' },
                { label: 'Total Students', value: totalStudents.toLocaleString(), icon: Activity, color: '#8b5cf6' },
                { label: 'Total Teachers', value: totalTeachers.toLocaleString(), icon: GraduationCap, color: '#ec4899' },
                { label: 'Total Parents', value: totalParents.toLocaleString(), icon: Users, color: '#14b8a6' },
                { label: 'Paid Schools', value: paidCount.toString(), icon: Users, color: '#10b981' },
                { label: 'Unpaid Schools', value: unpaidCount.toString(), icon: Users, color: '#f59e0b' },
            ]);
        }, (error) => {
            console.error("Dashboard Fetch Error:", error);
            if (error.code === 'permission-denied') {
                const uid = auth.currentUser ? auth.currentUser.uid : 'UNKNOWN';
                alert(`ACCESS DENIED: Admin Document Missing.\n\nYour UID is:\n${uid}\n\nPlease create a document in 'users' collection with this ID and role: 'admin'.`);
            }
        });

        return () => unsubscribe();
    }, []);

    const handleSuccess = () => {
        setShowCreateModal(false);
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

    return (
        <div className="animate-in fade-in duration-700">
            {showCreateModal && (
                <CreateSchoolModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={handleSuccess}
                />
            )}
            <header className="page-header">
                <div>
                    <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }} className="text-gradient">System Overview</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Real-time monitoring of all registered schools.</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowCreateModal(true)}
                >
                    <Plus size={20} />
                    Register New School
                </button>
            </header>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {stats.map((stat, index) => (
                    <div key={index} className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{
                            padding: '1rem',
                            borderRadius: '16px',
                            background: `${stat.color}15`,
                            color: stat.color,
                            boxShadow: `inset 0 0 12px ${stat.color}10`
                        }}>
                            <stat.icon size={28} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '500' }}>{stat.label}</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.02em' }}>{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Schools Section */}
            <div className="card glass" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)' }}>
                    <h3 style={{ fontSize: '1.25rem' }}>Recently Registered Schools</h3>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem' }}><Filter size={18} /></button>
                        <button className="btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem' }}><Search size={18} /></button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', background: 'rgba(0,0,0,0.1)' }}>
                                <th style={{ padding: '1.25rem', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>School Name</th>
                                <th style={{ padding: '1.25rem', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID</th>
                                <th style={{ padding: '1.25rem', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                <th style={{ padding: '1.25rem', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trial Status</th>
                                <th style={{ padding: '1.25rem' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {schools.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No schools registered yet.
                                    </td>
                                </tr>
                            ) : schools.map((school) => (
                                <tr key={school.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'var(--transition)' }} className="table-row-hover">
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '12px',
                                                background: 'linear-gradient(135deg, #1e293b, #334155)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '1px solid rgba(255,255,255,0.05)'
                                            }}>
                                                <School size={20} className="text-primary" />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', color: 'white' }}>{school.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{school.address}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <code style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                                            {school.id}
                                        </code>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <span style={{
                                            padding: '0.4rem 0.8rem',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            background: school.paymentStatus === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                            color: school.paymentStatus === 'paid' ? '#34d399' : '#fbbf24',
                                            border: school.paymentStatus === 'paid' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)'
                                        }}>{school.paymentStatus || 'unpaid'}</span>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        {school.trialInfo?.notStarted ? (
                                            <button
                                                onClick={() => handleStartTrial(school.id)}
                                                className="btn"
                                                style={{
                                                    padding: '0.4rem 0.8rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '600',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    color: 'var(--text-main)',
                                                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                                                    cursor: 'pointer'
                                                }}>
                                                Start Trial
                                            </button>
                                        ) : (
                                            <span style={{
                                                padding: '0.4rem 0.8rem',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                                background: school.trialInfo?.isExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                                                color: school.trialInfo?.isExpired ? '#f87171' : 'var(--primary)',
                                                border: school.trialInfo?.isExpired ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}>
                                                {school.trialInfo?.isExpired ? 'Trial Ended' : `${school.trialInfo?.daysLeft} Days Left`}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                            <MoreVertical size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
