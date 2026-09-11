import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, School, User, Mail, Shield,
    CreditCard, Power, Loader2, Save, Calendar,
    MapPin, Hash, CheckCircle, XCircle, Users, Phone,
    Landmark, Building2, Plus, Trash2, Crown, Sparkles, Bus, Tv
} from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, getDoc, collection, getCountFromServer, setDoc } from 'firebase/firestore';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const SchoolDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { hasPermission, isMasterAdmin } = useAdminAuth();
    const [school, setSchool] = useState(null);
    const [principal, setPrincipal] = useState(null);
    const [stats, setStats] = useState({ total: '...', teachers: '...', parents: '...' });
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [savingBanking, setSavingBanking] = useState(false);

    // Listen to School's banking settings
    useEffect(() => {
        if (!id) return;
        const unsub = onSnapshot(doc(db, `schools/${id}/settings`, 'banking'), (snap) => {
            if (snap.exists()) {
                setBankAccounts(snap.data().accounts || []);
            } else {
                setBankAccounts([]);
            }
        });
        return () => unsub();
    }, [id]);

    const handleBankChange = (index, field, value) => {
        const updated = [...bankAccounts];
        updated[index] = { ...updated[index], [field]: value };
        setBankAccounts(updated);
    };

    const addBankAccount = () => {
        setBankAccounts([
            ...bankAccounts,
            { bankName: '', accountTitle: '', accountNumber: '', iban: '' }
        ]);
    };

    const removeBankAccount = (index) => {
        const updated = bankAccounts.filter((_, i) => i !== index);
        setBankAccounts(updated);
    };

    const handleSaveBanking = async () => {
        setSavingBanking(true);
        try {
            await setDoc(doc(db, `schools/${id}/settings`, 'banking'), {
                accounts: bankAccounts,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            alert("Payment methods saved successfully for " + (school?.name || 'School') + "!");
        } catch (err) {
            console.error("Failed to save banking:", err);
            alert("Error saving banking details: " + err.message);
        } finally {
            setSavingBanking(false);
        }
    };

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

            setStats({ total, teachers, parents });
        } catch (error) {
            console.error("Error fetching stats:", error);
            setStats(prev => ({ ...prev, total: 0, teachers: 0, parents: 0 }));
        }
    };

    const handleTogglePayment = async () => {
        if (!isMasterAdmin && !hasPermission('manageBilling')) {
            alert("Permission Denied: You do not have permission to manage billing.");
            return;
        }
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

    const handlePackageUpdate = async (newPackage) => {
        setUpdating(true);
        try {
            const defaultModules = newPackage === 'premium'
                ? { transport: true, surveillance: true, paperGenerator: true, store: true }
                : { transport: false, surveillance: false, paperGenerator: false, store: false };
            await updateDoc(doc(db, "schools", id), {
                package: newPackage,
                modules: defaultModules,
                updatedAt: new Date()
            });
        } catch (error) {
            alert("Failed to update subscription package: " + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleModuleToggle = async (moduleKey) => {
        setUpdating(true);
        try {
            const currentModules = school.modules || {
                transport: school.package === 'premium',
                surveillance: school.package === 'premium',
                paperGenerator: school.package === 'premium',
                store: school.package === 'premium',
            };
            const updatedModules = {
                ...currentModules,
                [moduleKey]: !currentModules[moduleKey]
            };
            await updateDoc(doc(db, "schools", id), {
                modules: updatedModules,
                updatedAt: new Date()
            });
        } catch (error) {
            alert("Failed to update module: " + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleToggleSystemStatus = async () => {
        if (!isMasterAdmin && !hasPermission('systemControl')) {
            alert("Permission Denied: You do not have permission to start/stop school systems.");
            return;
        }
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
                            <InfoItem icon={Landmark} label="State / Province" value={school.state || 'Not Specified'} />
                            <InfoItem icon={Building2} label="District" value={school.district || 'Not Specified'} />
                            <InfoItem icon={MapPin} label="City" value={school.city || 'Not Specified'} />
                            <InfoItem icon={MapPin} label="Physical Address" value={school.address || 'Not Provided'} />
                            <InfoItem icon={Phone} label="School Contact" value={school.contact || 'Not Provided'} />
                            <InfoItem icon={Calendar} label="Registered On" value={school.createdAt?.toDate ? school.createdAt.toDate().toLocaleDateString() : 'N/A'} />
                            <InfoItem
                                icon={isSuspended ? XCircle : CheckCircle}
                                label="Current Access"
                                value={isSuspended ? 'Suspended' : 'Active Access'}
                                color={isSuspended ? '#f87171' : '#34d399'}
                            />
                        </div>

                        {/* Student Stats in Detail Page */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
                            {/* Students */}
                            <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                    <Users size={18} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Total Students</span>
                                </div>
                                <div style={{ fontSize: '2rem', fontWeight: '800' }}>{typeof stats.total === 'number' ? stats.total.toLocaleString() : (stats.total || '...')}</div>
                            </div>

                            {/* Teachers */}
                            <div style={{ background: 'rgba(236, 72, 153, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(236, 72, 153, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ec4899', marginBottom: '0.5rem' }}>
                                    <User size={18} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Total Teachers</span>
                                </div>
                                <div style={{ fontSize: '2rem', fontWeight: '800' }}>{typeof stats.teachers === 'number' ? stats.teachers.toLocaleString() : (stats.teachers || '0')}</div>
                            </div>

                            {/* Parents */}
                            <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f59e0b', marginBottom: '0.5rem' }}>
                                    <Users size={18} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Total Parents</span>
                                </div>
                                <div style={{ fontSize: '2rem', fontWeight: '800' }}>{typeof stats.parents === 'number' ? stats.parents.toLocaleString() : (stats.parents || '0')}</div>
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
                            <InfoItem icon={Phone} label="Vice Principal Contact" value={school.vicePrincipalContact || 'Not Provided'} />
                            <InfoItem icon={Phone} label="Landline" value={school.landline || 'Not Provided'} />
                            <InfoItem icon={Phone} label="School Contact" value={school.contact || 'Not Provided'} />
                            <InfoItem icon={Hash} label="Principal UID" value={school.principalId || 'N/A'} />
                            <InfoItem icon={Calendar} label="Last Updated" value={school.updatedAt?.toDate().toLocaleDateString() || 'Never'} />
                        </div>
                    </div>

                    {/* Official Fee Collection Accounts Card */}
                    <div className="card glass" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
                                <Landmark size={22} color="var(--primary)" />
                                Fee Collection Accounts (EasyPaisa, JazzCash, Bank)
                            </h3>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    onClick={addBankAccount}
                                    className="btn"
                                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', background: 'var(--card-inner-bg)', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                                >
                                    <Plus size={16} /> Add Method
                                </button>
                                <button
                                    onClick={handleSaveBanking}
                                    disabled={savingBanking}
                                    className="btn btn-primary"
                                    style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', fontWeight: '700' }}
                                >
                                    {savingBanking ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Accounts
                                </button>
                            </div>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            These account details are rendered in the Parent App when parents click "Pay Now" to transfer fees.
                        </p>

                        {bankAccounts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--card-inner-bg)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                                No payment accounts configured yet for this school. Click "+ Add Method" to set up EasyPaisa, JazzCash, or Bank accounts.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {bankAccounts.map((acc, index) => (
                                    <div key={index} style={{
                                        position: 'relative', padding: '1.25rem', background: 'var(--card-inner-bg)',
                                        borderRadius: '12px', border: '1px solid var(--glass-border)',
                                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem',
                                        paddingRight: '3rem'
                                    }}>
                                        <button
                                            onClick={() => removeBankAccount(index)}
                                            style={{
                                                position: 'absolute', top: '1rem', right: '1rem', background: 'transparent',
                                                border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px'
                                            }}
                                            title="Delete Account"
                                        >
                                            <Trash2 size={18} />
                                        </button>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                                Method / Bank Name
                                            </label>
                                            <input
                                                type="text"
                                                value={acc.bankName || ''}
                                                onChange={(e) => handleBankChange(index, 'bankName', e.target.value)}
                                                placeholder="e.g. EasyPaisa, JazzCash, Meezan Bank"
                                                className="input"
                                                style={{ width: '100%', fontSize: '0.85rem' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                                Account Title
                                            </label>
                                            <input
                                                type="text"
                                                value={acc.accountTitle || ''}
                                                onChange={(e) => handleBankChange(index, 'accountTitle', e.target.value)}
                                                placeholder="e.g. School Account"
                                                className="input"
                                                style={{ width: '100%', fontSize: '0.85rem' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                                Account / Mobile Number
                                            </label>
                                            <input
                                                type="text"
                                                value={acc.accountNumber || ''}
                                                onChange={(e) => handleBankChange(index, 'accountNumber', e.target.value)}
                                                placeholder="e.g. 03001234567"
                                                className="input"
                                                style={{ width: '100%', fontSize: '0.85rem' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                                IBAN / Details (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={acc.iban || ''}
                                                onChange={(e) => handleBankChange(index, 'iban', e.target.value)}
                                                placeholder="PK00..."
                                                className="input"
                                                style={{ width: '100%', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Controls Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="card glass" style={{ padding: '2rem', border: '1px solid var(--primary-glow)' }}>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Administrative Controls</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* SaaS Subscription Package Tier Control */}
                            <div style={{
                                padding: '1.5rem',
                                borderRadius: '20px',
                                background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                boxShadow: '0 12px 30px -5px rgba(15, 23, 42, 0.45)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
                                    <div>
                                        <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Crown size={19} color="#fbbf24" />
                                            Subscription Tier
                                        </h4>
                                        <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '3px 0 0 0', fontWeight: '500' }}>
                                            School feature access level
                                        </p>
                                    </div>
                                    <span style={{
                                        padding: '0.3rem 0.75rem',
                                        borderRadius: '9999px',
                                        fontSize: '0.75rem',
                                        fontWeight: '800',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        background: school.package === 'premium' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(99, 102, 241, 0.25)',
                                        color: school.package === 'premium' ? '#fde047' : '#c7d2fe',
                                        border: school.package === 'premium' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(99, 102, 241, 0.5)',
                                        boxShadow: school.package === 'premium' ? '0 0 12px rgba(245, 158, 11, 0.3)' : 'none'
                                    }}>
                                        {school.package === 'premium' ? '⭐ Premium Pro' : 'Standard Tier'}
                                    </span>
                                </div>

                                {/* Modern Animated Tier Switch Buttons */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1.1rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => handlePackageUpdate('standard')}
                                        disabled={updating || school.package !== 'premium'}
                                        style={{
                                            padding: '0.75rem 0.6rem',
                                            fontSize: '0.85rem',
                                            fontWeight: '800',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            cursor: school.package !== 'premium' ? 'default' : 'pointer',
                                            transition: 'all 0.25s ease',
                                            background: school.package !== 'premium'
                                                ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)'
                                                : 'rgba(30, 41, 59, 0.8)',
                                            border: school.package !== 'premium'
                                                ? '2px solid #818cf8'
                                                : '1px solid rgba(255, 255, 255, 0.1)',
                                            color: '#ffffff',
                                            boxShadow: school.package !== 'premium'
                                                ? '0 6px 16px -2px rgba(79, 70, 229, 0.5)'
                                                : 'none',
                                            opacity: updating ? 0.7 : 1
                                        }}
                                    >
                                        <Sparkles size={16} color={school.package !== 'premium' ? '#ffffff' : '#94a3b8'} />
                                        Standard
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handlePackageUpdate('premium')}
                                        disabled={updating || school.package === 'premium'}
                                        style={{
                                            padding: '0.75rem 0.6rem',
                                            fontSize: '0.85rem',
                                            fontWeight: '800',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            cursor: school.package === 'premium' ? 'default' : 'pointer',
                                            transition: 'all 0.25s ease',
                                            background: school.package === 'premium'
                                                ? 'linear-gradient(135deg, #d97706 0%, #92400e 100%)'
                                                : 'rgba(30, 41, 59, 0.8)',
                                            border: school.package === 'premium'
                                                ? '2px solid #fbbf24'
                                                : '1px solid rgba(255, 255, 255, 0.1)',
                                            color: '#ffffff',
                                            boxShadow: school.package === 'premium'
                                                ? '0 6px 16px -2px rgba(217, 119, 6, 0.5)'
                                                : 'none',
                                            opacity: updating ? 0.7 : 1
                                        }}
                                    >
                                        <Crown size={16} color={school.package === 'premium' ? '#fde047' : '#94a3b8'} />
                                        Premium Pro
                                    </button>
                                </div>

                                {/* Granular Module Switches with Custom Modern Toggle Switches */}
                                <div style={{
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    borderRadius: '14px',
                                    padding: '0.85rem',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.65rem'
                                }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.06em' }}>
                                        Active Add-on Modules:
                                    </div>

                                    {/* Transport Toggle */}
                                    <div
                                        onClick={() => !updating && handleModuleToggle('transport')}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.55rem 0.7rem',
                                            borderRadius: '10px',
                                            background: (school.modules?.transport ?? (school.package === 'premium')) ? 'rgba(245, 158, 11, 0.12)' : 'rgba(30, 41, 59, 0.5)',
                                            border: (school.modules?.transport ?? (school.package === 'premium')) ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                                            cursor: updating ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{
                                                width: '30px',
                                                height: '30px',
                                                borderRadius: '8px',
                                                background: 'rgba(245, 158, 11, 0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Bus size={17} color="#fbbf24" />
                                            </div>
                                            <div>
                                                <div style={{ color: '#ffffff', fontSize: '0.86rem', fontWeight: '700' }}>Transport & Fleet Hub</div>
                                                <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Live GPS tracking & routes</div>
                                            </div>
                                        </div>

                                        {/* Custom Modern Switch */}
                                        <div style={{
                                            width: '42px',
                                            height: '23px',
                                            borderRadius: '9999px',
                                            background: (school.modules?.transport ?? (school.package === 'premium')) ? '#10b981' : '#334155',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: (school.modules?.transport ?? (school.package === 'premium')) ? 'flex-end' : 'flex-start',
                                            transition: 'all 0.25s ease',
                                            boxShadow: (school.modules?.transport ?? (school.package === 'premium')) ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none'
                                        }}>
                                            <div style={{
                                                width: '19px',
                                                height: '19px',
                                                borderRadius: '50%',
                                                background: '#ffffff',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                            }} />
                                        </div>
                                    </div>

                                    {/* Surveillance Toggle */}
                                    <div
                                        onClick={() => !updating && handleModuleToggle('surveillance')}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.55rem 0.7rem',
                                            borderRadius: '10px',
                                            background: (school.modules?.surveillance ?? (school.package === 'premium')) ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                                            border: (school.modules?.surveillance ?? (school.package === 'premium')) ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(255, 255, 255, 0.05)',
                                            cursor: updating ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{
                                                width: '30px',
                                                height: '30px',
                                                borderRadius: '8px',
                                                background: 'rgba(99, 102, 241, 0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Tv size={17} color="#818cf8" />
                                            </div>
                                            <div>
                                                <div style={{ color: '#ffffff', fontSize: '0.86rem', fontWeight: '700' }}>Live CCTV Surveillance</div>
                                                <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Multi-camera live streams</div>
                                            </div>
                                        </div>

                                        {/* Custom Modern Switch */}
                                        <div style={{
                                            width: '42px',
                                            height: '23px',
                                            borderRadius: '9999px',
                                            background: (school.modules?.surveillance ?? (school.package === 'premium')) ? '#10b981' : '#334155',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: (school.modules?.surveillance ?? (school.package === 'premium')) ? 'flex-end' : 'flex-start',
                                            transition: 'all 0.25s ease',
                                            boxShadow: (school.modules?.surveillance ?? (school.package === 'premium')) ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none'
                                        }}>
                                            <div style={{
                                                width: '19px',
                                                height: '19px',
                                                borderRadius: '50%',
                                                background: '#ffffff',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

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
