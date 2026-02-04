import React, { useState, useEffect } from 'react';
import {
    Users as UsersIcon,
    UserPlus,
    Shield,
    ShieldCheck,
    Search,
    MoreVertical,
    X,
    Save,
    Mail,
    Lock,
    Trash2,
    ShieldAlert,
    Loader2,
    Check
} from 'lucide-react';
import { db, auth } from '../firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const AddAdminModal = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        permissions: {
            manageSchools: true,
            manageBilling: false,
            systemControl: false,
            manageAdmins: false
        }
    });

    const togglePermission = (key) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [key]: !prev.permissions[key]
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Create User in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // 2. Save in global_users
            await setDoc(doc(db, "global_users", user.uid), {
                uid: user.uid,
                name: formData.name,
                email: formData.email,
                role: 'super-admin', // Role is super-admin for this panel
                permissions: formData.permissions,
                createdAt: serverTimestamp(),
                status: 'active'
            });

            onSuccess();
            onClose();
        } catch (err) {
            console.error("Error adding admin:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem'
        }}>
            <div className="card glass animate-in zoom-in duration-300" style={{
                width: '100%',
                maxWidth: '500px',
                padding: '2.5rem',
                position: 'relative',
                background: 'rgba(30, 41, 59, 0.98)',
                border: '1px solid var(--glass-border)'
            }}>
                <button onClick={onClose} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={24} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary), #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserPlus color="white" size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Add New Admin</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Create a new administrator account.</p>
                    </div>
                </div>

                {error && (
                    <div style={{ padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="input-group">
                        <label className="label">Full Name</label>
                        <input
                            type="text"
                            required
                            className="input-field"
                            placeholder="e.g. John Doe"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="input-group">
                        <label className="label">Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                required
                                className="input-field"
                                style={{ paddingLeft: '3rem' }}
                                placeholder="admin@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="password"
                                required
                                className="input-field"
                                style={{ paddingLeft: '3rem' }}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '0.5rem' }}>
                        <label className="label" style={{ marginBottom: '1rem', display: 'block' }}>Permissions</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            {[
                                { key: 'manageSchools', label: 'Manage Schools' },
                                { key: 'manageBilling', label: 'Billing Access' },
                                { key: 'systemControl', label: 'System Start/Stop' },
                                { key: 'manageAdmins', label: 'User Management' }
                            ].map((perm) => (
                                <div
                                    key={perm.key}
                                    onClick={() => togglePermission(perm.key)}
                                    style={{
                                        padding: '0.75rem',
                                        borderRadius: '12px',
                                        background: formData.permissions[perm.key] ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${formData.permissions[perm.key] ? 'var(--primary)' : 'var(--glass-border)'}`,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '4px',
                                        border: '1px solid currentColor',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: formData.permissions[perm.key] ? 'var(--primary)' : 'var(--text-muted)'
                                    }}>
                                        {formData.permissions[perm.key] && <Check size={14} />}
                                    </div>
                                    <span style={{ fontSize: '0.8rem', color: formData.permissions[perm.key] ? 'white' : 'var(--text-muted)' }}>
                                        {perm.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center', height: '50px' }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (
                            <>
                                <Save size={20} />
                                Create Admin Account
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

const Users = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(collection(db, "global_users"), where("role", "==", "super-admin"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
            setUsers(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDeleteUser = async (uid, name) => {
        if (!window.confirm(`Are you sure you want to remove ${name} from administrators?`)) return;
        try {
            await deleteDoc(doc(db, "global_users", uid));
            // Note: In a real app, you'd also want to delete from Firebase Auth, but that requires Firebase Admin SDK or a cloud function.
        } catch (error) {
            alert("Error deleting user: " + error.message);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {showAddModal && (
                <AddAdminModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => setShowAddModal(false)}
                />
            )}

            <header className="page-header">
                <div>
                    <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }} className="text-gradient">Team Management</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Manage administrator accounts and system permissions.</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowAddModal(true)}
                >
                    <UserPlus size={20} />
                    Add Admin
                </button>
            </header>

            <div className="card glass" style={{ marginBottom: '2rem', padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            className="input-field"
                            style={{ width: '100%', paddingLeft: '3rem', marginBottom: '0' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '1.5rem'
            }}>
                {loading ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem' }}>
                        <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary)', margin: '0 auto' }} />
                        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading administrators...</p>
                    </div>
                ) : filteredUsers.map((user) => (
                    <div key={user.id} className="card glass" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)'
                                }}>
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.15rem' }}>{user.name}</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{user.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.5rem' }}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', marginBottom: '0.75rem' }}>Permissions</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {user.permissions ? Object.entries(user.permissions).map(([key, enabled]) => (
                                    enabled && (
                                        <span key={key} style={{
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '6px',
                                            fontSize: '0.7rem',
                                            background: 'rgba(139, 92, 246, 0.1)',
                                            color: '#a78bfa',
                                            border: '1px solid rgba(139, 92, 246, 0.2)'
                                        }}>
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                    )
                                )) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No permissions set</span>}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }} />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Account</span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                ID: {user.id.slice(0, 8)}...
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Users;
