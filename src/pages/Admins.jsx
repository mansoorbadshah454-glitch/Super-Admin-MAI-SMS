import React, { useState, useEffect } from 'react';
import {
    Shield,
    ShieldCheck,
    UserPlus,
    Search,
    X,
    Save,
    Mail,
    Lock,
    Trash2,
    Edit2,
    ShieldAlert,
    Loader2,
    Check,
    Building,
    CreditCard,
    Power,
    Users as UsersIcon
} from 'lucide-react';
import { db, auth, functions } from '../firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAlert } from '../contexts/AlertContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const PERMISSION_CONFIG = [
    {
        key: 'manageSchools',
        label: 'Manage Schools',
        desc: 'Create, edit profile & manage school details',
        icon: Building,
        color: '#3b82f6'
    },
    {
        key: 'deleteSchool',
        label: 'Delete School',
        desc: 'Permanently remove schools and all their data',
        icon: Trash2,
        color: '#ef4444'
    },
    {
        key: 'manageBilling',
        label: 'Billing & Payments',
        desc: 'View and toggle Paid / Unpaid status of schools',
        icon: CreditCard,
        color: '#f59e0b'
    },
    {
        key: 'systemControl',
        label: 'System Control (Start/Stop)',
        desc: 'Activate or suspend/stop school operations',
        icon: Power,
        color: '#10b981'
    },
    {
        key: 'manageAdmins',
        label: 'Manage Office Admins',
        desc: 'Create and configure other office admin accounts',
        icon: ShieldCheck,
        color: '#8b5cf6'
    }
];

const AddAdminModal = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        permissions: {
            manageSchools: true,
            deleteSchool: false,
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
            const createSuperAdmin = httpsCallable(functions, 'createSuperAdmin');
            await createSuperAdmin({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                permissions: formData.permissions
            });

            onSuccess();
            onClose();
        } catch (err) {
            console.error("Error creating admin:", err);
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
                maxWidth: '560px',
                padding: '2.5rem',
                position: 'relative',
                background: 'var(--bg-card)',
                border: '1px solid var(--glass-border)',
                maxHeight: '90vh',
                overflowY: 'auto'
            }}>
                <button onClick={onClose} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={24} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary), #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserPlus color="white" size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Add Office Admin</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Create an office staff account with custom permissions.</p>
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
                            placeholder="e.g. Ali Ahmed"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="input-group">
                        <label className="label">Email Address (Login ID)</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                required
                                className="input-field"
                                style={{ paddingLeft: '3rem' }}
                                placeholder="staff@superadmin.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="label">Login Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="password"
                                required
                                minLength={6}
                                className="input-field"
                                style={{ paddingLeft: '3rem' }}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <label className="label" style={{ margin: 0, fontWeight: '700' }}>Admin Permissions</label>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Toggle granted features</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {PERMISSION_CONFIG.map((perm) => {
                                const isChecked = formData.permissions[perm.key];
                                const Icon = perm.icon;
                                return (
                                    <div
                                        key={perm.key}
                                        onClick={() => togglePermission(perm.key)}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            borderRadius: '12px',
                                            background: isChecked ? 'rgba(99, 102, 241, 0.1)' : 'var(--card-inner-bg)',
                                            border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--glass-border)'}`,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.75rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                padding: '0.4rem',
                                                borderRadius: '8px',
                                                background: isChecked ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                                                color: perm.color
                                            }}>
                                                <Icon size={16} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: isChecked ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                    {perm.label}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {perm.desc}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '6px',
                                            border: `1.5px solid ${isChecked ? 'var(--primary)' : 'var(--text-muted)'}`,
                                            background: isChecked ? 'var(--primary)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            flexShrink: 0
                                        }}>
                                            {isChecked && <Check size={14} strokeWidth={3} />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center', height: '48px', fontWeight: '700' }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (
                            <>
                                <Save size={18} />
                                Create Admin Account
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

const EditAdminModal = ({ adminUser, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [permissions, setPermissions] = useState({
        manageSchools: true,
        deleteSchool: false,
        manageBilling: false,
        systemControl: false,
        manageAdmins: false,
        ...(adminUser.permissions || {})
    });
    const [status, setStatus] = useState(adminUser.status || 'active');

    const togglePermission = (key) => {
        setPermissions(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await updateDoc(doc(db, "global_users", adminUser.id), {
                permissions,
                status,
                updatedAt: serverTimestamp()
            });

            onSuccess();
            onClose();
        } catch (err) {
            console.error("Error updating admin permissions:", err);
            setError("Failed to update: " + err.message);
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
                maxWidth: '560px',
                padding: '2.5rem',
                position: 'relative',
                background: 'var(--bg-card)',
                border: '1px solid var(--glass-border)',
                maxHeight: '90vh',
                overflowY: 'auto'
            }}>
                <button onClick={onClose} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={24} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldCheck color="white" size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: '700' }}>Edit Admin Permissions</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{adminUser.name} ({adminUser.email})</p>
                    </div>
                </div>

                {error && (
                    <div style={{ padding: '0.75rem', borderRadius: '12px', marginBottom: '1.25rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '0.85rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="input-group">
                        <label className="label">Account Status</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setStatus('active')}
                                style={{
                                    flex: 1,
                                    padding: '0.6rem',
                                    borderRadius: '10px',
                                    border: status === 'active' ? '2px solid #10b981' : '1px solid var(--glass-border)',
                                    background: status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'var(--card-inner-bg)',
                                    color: status === 'active' ? '#10b981' : 'var(--text-muted)',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Active
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatus('disabled')}
                                style={{
                                    flex: 1,
                                    padding: '0.6rem',
                                    borderRadius: '10px',
                                    border: status === 'disabled' ? '2px solid #ef4444' : '1px solid var(--glass-border)',
                                    background: status === 'disabled' ? 'rgba(239, 68, 68, 0.15)' : 'var(--card-inner-bg)',
                                    color: status === 'disabled' ? '#ef4444' : 'var(--text-muted)',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Disabled / Suspended
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="label" style={{ marginBottom: '0.75rem', display: 'block', fontWeight: '700' }}>
                            Assigned Permissions
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {PERMISSION_CONFIG.map((perm) => {
                                const isChecked = permissions[perm.key];
                                const Icon = perm.icon;
                                return (
                                    <div
                                        key={perm.key}
                                        onClick={() => togglePermission(perm.key)}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            borderRadius: '12px',
                                            background: isChecked ? 'rgba(99, 102, 241, 0.1)' : 'var(--card-inner-bg)',
                                            border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--glass-border)'}`,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.75rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                padding: '0.4rem',
                                                borderRadius: '8px',
                                                background: isChecked ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                                                color: perm.color
                                            }}>
                                                <Icon size={16} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: isChecked ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                    {perm.label}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {perm.desc}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '6px',
                                            border: `1.5px solid ${isChecked ? 'var(--primary)' : 'var(--text-muted)'}`,
                                            background: isChecked ? 'var(--primary)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            flexShrink: 0
                                        }}>
                                            {isChecked && <Check size={14} strokeWidth={3} />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1.25rem', justifyContent: 'center', height: '48px', fontWeight: '700' }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (
                            <>
                                <Save size={18} />
                                Update Permissions
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

const Admins = () => {
    const { showAlert, showConfirm } = useAlert();
    const { hasPermission, isMasterAdmin } = useAdminAuth();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedAdminForEdit, setSelectedAdminForEdit] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Query only users whose role is 'super-admin' or 'admin'
        // This strictly prevents school teachers and parents from showing up!
        const q = query(
            collection(db, "global_users"),
            where("role", "in", ["super-admin", "admin"])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
                list.push({ id: docSnap.id, ...docSnap.data() });
            });

            list.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return timeB - timeA;
            });

            setAdmins(list);
            setLoading(false);
        }, (error) => {
            console.error("Super Admin fetch error:", error);
            // Fallback: If 'in' query fails or lacks index, query all and filter locally
            const fallbackUnsub = onSnapshot(collection(db, "global_users"), (snap) => {
                const list = [];
                snap.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    if (data.role === 'super-admin' || data.role === 'admin') {
                        list.push({ id: docSnap.id, ...data });
                    }
                });
                setAdmins(list);
                setLoading(false);
            });
            return () => fallbackUnsub();
        });

        return () => unsubscribe();
    }, []);

    const handleDeleteAdmin = async (adminUser) => {
        if (adminUser.id === auth.currentUser?.uid) {
            showAlert({ title: "Action Not Allowed", message: "You cannot delete your own active account.", type: "warning" });
            return;
        }

        showConfirm({
            title: "Delete Admin Account?",
            message: `Are you sure you want to permanently remove admin account for ${adminUser.name} (${adminUser.email})? This action cannot be undone.`,
            confirmText: "Delete Account",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const deleteFn = httpsCallable(functions, 'deleteSuperAdmin');
                    await deleteFn({ adminUid: adminUser.id });
                    showAlert({ title: "Success", message: "Admin account deleted successfully.", type: "success" });
                } catch (err) {
                    console.error("Delete admin error:", err);
                    try {
                        await deleteDoc(doc(db, "global_users", adminUser.id));
                        showAlert({ title: "Success", message: "Admin profile removed.", type: "success" });
                    } catch (fsErr) {
                        showAlert({ title: "Error", message: "Failed to delete: " + err.message, type: "error" });
                    }
                }
            }
        });
    };

    const handleToggleStatus = async (adminUser) => {
        const newStatus = adminUser.status === 'disabled' ? 'active' : 'disabled';
        try {
            await updateDoc(doc(db, "global_users", adminUser.id), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            showAlert({
                title: "Status Updated",
                message: `Account is now ${newStatus}.`,
                type: "success"
            });
        } catch (err) {
            showAlert({ title: "Error", message: "Failed to update status: " + err.message, type: "error" });
        }
    };

    const filteredAdmins = admins.filter(admin =>
        (admin.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (admin.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="animate-in fade-in duration-500">
            {/* Header with Prominent Add Admin Button */}
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Shield className="text-primary" size={32} />
                            Office Admins Management
                        </h1>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Manage central office team accounts, control roles and assign granular operational permissions.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="btn btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.85rem 1.6rem',
                            fontWeight: '700',
                            fontSize: '0.95rem',
                            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                        }}
                    >
                        <UserPlus size={20} />
                        Add New Office Admin
                    </button>
                </div>
            </header>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="card glass" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UsersIcon size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Office Admins</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>{admins.length}</div>
                    </div>
                </div>

                <div className="card glass" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Active Staff</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>
                            {admins.filter(a => a.status !== 'disabled').length}
                        </div>
                    </div>
                </div>

                <div className="card glass" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Delete School Permission</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>
                            {admins.filter(a => a.permissions?.deleteSchool === true || (!a.permissions && a.role === 'super-admin')).length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="card glass" style={{ padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Search size={20} style={{ color: 'var(--text-muted)' }} />
                <input
                    type="text"
                    placeholder="Search office admins by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-main)',
                        fontSize: '0.95rem',
                        width: '100%',
                        outline: 'none'
                    }}
                />
            </div>

            {/* Admins Grid */}
            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <Loader2 className="animate-spin" size={40} color="var(--primary)" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading Office Admins...</p>
                </div>
            ) : filteredAdmins.length === 0 ? (
                <div className="card glass" style={{ padding: '4rem', textAlign: 'center' }}>
                    <ShieldAlert size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>No Office Admins Found</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                        {searchTerm ? 'No admins match your search term.' : 'Click below to create your first office admin account.'}
                    </p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="btn btn-primary"
                        style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <UserPlus size={18} />
                        Add New Office Admin
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
                    {filteredAdmins.map((adminUser) => {
                        const isSelf = adminUser.id === auth.currentUser?.uid;
                        const isDisabled = adminUser.status === 'disabled';
                        const perms = adminUser.permissions || {};
                        const isMaster = adminUser.role === 'super-admin' && (!adminUser.permissions || Object.keys(adminUser.permissions).length === 0);

                        return (
                            <div
                                key={adminUser.id}
                                className="card glass"
                                style={{
                                    padding: '1.75rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    position: 'relative',
                                    border: isSelf ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                                    opacity: isDisabled ? 0.75 : 1
                                }}
                            >
                                <div>
                                    {/* Top Row: Info & Status */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '12px',
                                                background: isMaster
                                                    ? 'linear-gradient(135deg, #6366f1, #ec4899)'
                                                    : 'linear-gradient(135deg, #3b82f6, #10b981)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: '800',
                                                fontSize: '1.25rem',
                                                color: 'white'
                                            }}>
                                                {(adminUser.name || 'A')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {adminUser.name || 'Admin User'}
                                                    {isSelf && (
                                                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '6px', background: 'var(--primary)', color: 'white' }}>
                                                            YOU
                                                        </span>
                                                    )}
                                                </h3>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                                                    {adminUser.email}
                                                </p>
                                            </div>
                                        </div>

                                        <span style={{
                                            fontSize: '0.7rem',
                                            fontWeight: '700',
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '8px',
                                            textTransform: 'uppercase',
                                            background: isDisabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                            color: isDisabled ? '#ef4444' : '#10b981',
                                            border: `1px solid ${isDisabled ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                                        }}>
                                            {isDisabled ? 'Disabled' : 'Active'}
                                        </span>
                                    </div>

                                    {/* Permissions Badges */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                                            Assigned Permissions:
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {isMaster ? (
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    padding: '0.3rem 0.6rem',
                                                    borderRadius: '8px',
                                                    background: 'rgba(99, 102, 241, 0.15)',
                                                    color: 'var(--primary)',
                                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                                    fontWeight: '700'
                                                }}>
                                                    ⭐ Full Super Admin (All Permissions)
                                                </span>
                                            ) : (
                                                PERMISSION_CONFIG.map((perm) => {
                                                    const hasP = perms[perm.key];
                                                    const Icon = perm.icon;
                                                    return (
                                                        <span
                                                            key={perm.key}
                                                            style={{
                                                                fontSize: '0.72rem',
                                                                padding: '0.25rem 0.5rem',
                                                                borderRadius: '8px',
                                                                background: hasP ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                                                                color: hasP ? perm.color : 'rgba(255,255,255,0.3)',
                                                                border: `1px solid ${hasP ? perm.color + '40' : 'rgba(255,255,255,0.05)'}`,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.35rem',
                                                                textDecoration: hasP ? 'none' : 'line-through'
                                                            }}
                                                        >
                                                            <Icon size={12} />
                                                            {perm.label}
                                                        </span>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div style={{
                                    paddingTop: '1rem',
                                    borderTop: '1px solid var(--glass-border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <button
                                        onClick={() => handleToggleStatus(adminUser)}
                                        disabled={isSelf}
                                        className="btn"
                                        style={{
                                            fontSize: '0.75rem',
                                            padding: '0.4rem 0.8rem',
                                            background: 'var(--card-inner-bg)',
                                            color: isDisabled ? '#10b981' : '#ef4444',
                                            opacity: isSelf ? 0.4 : 1
                                        }}
                                        title={isSelf ? "You cannot disable your own account" : "Toggle account status"}
                                    >
                                        <Power size={14} />
                                        {isDisabled ? 'Activate' : 'Disable'}
                                    </button>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => setSelectedAdminForEdit(adminUser)}
                                            className="btn btn-primary"
                                            style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                                        >
                                            <Edit2 size={14} />
                                            Permissions
                                        </button>

                                        {!isSelf && (
                                            <button
                                                onClick={() => handleDeleteAdmin(adminUser)}
                                                className="btn"
                                                style={{
                                                    fontSize: '0.75rem',
                                                    padding: '0.4rem 0.6rem',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    color: '#ef4444',
                                                    borderColor: 'rgba(239, 68, 68, 0.2)'
                                                }}
                                                title="Delete Admin Account"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modals */}
            {showAddModal && (
                <AddAdminModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        showAlert({
                            title: "Admin Created",
                            message: "New office admin account has been created successfully.",
                            type: "success"
                        });
                    }}
                />
            )}

            {selectedAdminForEdit && (
                <EditAdminModal
                    adminUser={selectedAdminForEdit}
                    onClose={() => setSelectedAdminForEdit(null)}
                    onSuccess={() => {
                        showAlert({
                            title: "Updated",
                            message: "Admin permissions and settings updated successfully.",
                            type: "success"
                        });
                    }}
                />
            )}
        </div>
    );
};

export default Admins;
