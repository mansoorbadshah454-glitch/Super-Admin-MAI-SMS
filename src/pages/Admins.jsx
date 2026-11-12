import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    Users as UsersIcon,
    AlertCircle
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
        color: '#2563EB'
    },
    {
        key: 'deleteSchool',
        label: 'Delete School',
        desc: 'Permanently remove schools and all their data',
        icon: Trash2,
        color: '#DC2626'
    },
    {
        key: 'manageBilling',
        label: 'Billing & Payments',
        desc: 'View and toggle Paid / Unpaid status of schools',
        icon: CreditCard,
        color: '#D97706'
    },
    {
        key: 'systemControl',
        label: 'System Control (Start/Stop)',
        desc: 'Activate or suspend/stop school operations',
        icon: Power,
        color: '#16A34A'
    },
    {
        key: 'manageAdmins',
        label: 'Manage Office Admins',
        desc: 'Create and configure other office admin accounts',
        icon: ShieldCheck,
        color: '#7C3AED'
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

    return createPortal(
        <div
            onClick={onClose}
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
                boxSizing: 'border-box',
                fontFamily: "'Segoe UI', Tahoma, Verdana, sans-serif"
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '560px',
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
                        Create New Office Administrator
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
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

                {/* Form Content */}
                <form onSubmit={handleSubmit} style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px', maxHeight: '65vh', overflowY: 'auto', backgroundColor: '#ECE9D8' }}>
                        {error && (
                            <div style={{ padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '12px' }}>
                                {error}
                            </div>
                        )}

                        <fieldset style={{ border: '1px solid #C5C0B8', borderRadius: '4px', padding: '12px 14px', marginBottom: '12px', backgroundColor: '#F4F2E8' }}>
                            <legend style={{ fontSize: '11px', fontWeight: '700', color: '#003399', padding: '0 6px', textTransform: 'uppercase' }}>Administrator Profile</legend>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '3px' }}>Full Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Asad Khan"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: '2px', border: '1px solid #7F9DB9', fontSize: '13px', background: '#FFFFFF' }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '3px' }}>Email Address *</label>
                                        <input
                                            type="email"
                                            required
                                            placeholder="admin@school.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: '2px', border: '1px solid #7F9DB9', fontSize: '13px', background: '#FFFFFF' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '3px' }}>Login Password *</label>
                                        <input
                                            type="password"
                                            required
                                            placeholder="Min. 6 chars"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: '2px', border: '1px solid #7F9DB9', fontSize: '13px', background: '#FFFFFF' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        <fieldset style={{ border: '1px solid #C5C0B8', borderRadius: '4px', padding: '12px 14px', backgroundColor: '#F4F2E8' }}>
                            <legend style={{ fontSize: '11px', fontWeight: '700', color: '#003399', padding: '0 6px', textTransform: 'uppercase' }}>Operational Permissions</legend>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {PERMISSION_CONFIG.map((perm) => {
                                    const isChecked = formData.permissions[perm.key];
                                    return (
                                        <div
                                            key={perm.key}
                                            onClick={() => togglePermission(perm.key)}
                                            style={{
                                                padding: '7px 10px',
                                                borderRadius: '3px',
                                                background: isChecked ? '#E1ECFA' : '#FFFFFF',
                                                border: `1px solid ${isChecked ? '#0055EA' : '#CBD5E1'}`,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#1F2937' }}>{perm.label}</div>
                                                <div style={{ fontSize: '11px', color: '#64748B' }}>{perm.desc}</div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={!!isChecked}
                                                onChange={() => {}}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563EB' }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </fieldset>
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '10px 16px', backgroundColor: '#ECE9D8', borderTop: '1px solid #999', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" onClick={onClose} className="win-btn" disabled={loading}>Cancel</button>
                        <button type="submit" disabled={loading} className="win-btn win-btn-primary">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create Administrator
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

const EditPermissionsModal = ({ adminUser, onClose, onSuccess }) => {
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

    return createPortal(
        <div
            onClick={onClose}
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
                boxSizing: 'border-box',
                fontFamily: "'Segoe UI', Tahoma, Verdana, sans-serif"
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '560px',
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
                        Edit Permissions — {adminUser.name}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
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

                <form onSubmit={handleSave} style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px', maxHeight: '65vh', overflowY: 'auto', backgroundColor: '#ECE9D8' }}>
                        {error && (
                            <div style={{ padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '12px' }}>
                                {error}
                            </div>
                        )}

                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>Account Status</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setStatus('active')}
                                    className="win-btn"
                                    style={{
                                        backgroundColor: status === 'active' ? '#DEF7EC' : '#FFFFFF',
                                        color: status === 'active' ? '#03543F' : '#64748B',
                                        borderColor: status === 'active' ? '#84E1BC' : '#CBD5E1',
                                        justifyContent: 'center',
                                        fontWeight: '700'
                                    }}
                                >
                                    Active Access
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatus('disabled')}
                                    className="win-btn"
                                    style={{
                                        backgroundColor: status === 'disabled' ? '#FEE2E2' : '#FFFFFF',
                                        color: status === 'disabled' ? '#991B1B' : '#64748B',
                                        borderColor: status === 'disabled' ? '#FCA5A5' : '#CBD5E1',
                                        justifyContent: 'center',
                                        fontWeight: '700'
                                    }}
                                >
                                    Disabled / Suspended
                                </button>
                            </div>
                        </div>

                        <fieldset style={{ border: '1px solid #C5C0B8', borderRadius: '4px', padding: '12px 14px', backgroundColor: '#F4F2E8' }}>
                            <legend style={{ fontSize: '11px', fontWeight: '700', color: '#003399', padding: '0 6px', textTransform: 'uppercase' }}>Assigned Permissions</legend>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {PERMISSION_CONFIG.map((perm) => {
                                    const isChecked = permissions[perm.key];
                                    return (
                                        <div
                                            key={perm.key}
                                            onClick={() => togglePermission(perm.key)}
                                            style={{
                                                padding: '7px 10px',
                                                borderRadius: '3px',
                                                background: isChecked ? '#E1ECFA' : '#FFFFFF',
                                                border: `1px solid ${isChecked ? '#0055EA' : '#CBD5E1'}`,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#1F2937' }}>{perm.label}</div>
                                                <div style={{ fontSize: '11px', color: '#64748B' }}>{perm.desc}</div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={!!isChecked}
                                                onChange={() => {}}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563EB' }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </fieldset>
                    </div>

                    <div style={{ padding: '10px 16px', backgroundColor: '#ECE9D8', borderTop: '1px solid #999', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" onClick={onClose} className="win-btn" disabled={loading}>Cancel</button>
                        <button type="submit" disabled={loading} className="win-btn win-btn-primary">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
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
            `}</style>

            {showAddModal && (
                <AddAdminModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => showAlert({ title: "Success", message: "New office admin created.", type: "success" })}
                />
            )}

            {selectedAdminForEdit && (
                <EditPermissionsModal
                    adminUser={selectedAdminForEdit}
                    onClose={() => setSelectedAdminForEdit(null)}
                    onSuccess={() => showAlert({ title: "Updated", message: "Permissions successfully saved.", type: "success" })}
                />
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                        Office Administrators & Permissions
                    </h2>
                    <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '2px 0 0 0' }}>
                        Manage central office staff, define operator roles, and assign security privileges.
                    </p>
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="win-btn win-btn-primary"
                    style={{ padding: '7px 16px' }}
                >
                    <UserPlus size={16} /> Add New Admin
                </button>
            </div>

            {/* Metric Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '1.25rem' }}>
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '5px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UsersIcon size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Office Staff</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0F172A' }}>{admins.length}</div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '5px', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Active Staff</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0F172A' }}>
                            {admins.filter(a => a.status !== 'disabled').length}
                        </div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '5px', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Delete School Privilege</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0F172A' }}>
                            {admins.filter(a => a.permissions?.deleteSchool === true || (!a.permissions && a.role === 'super-admin')).length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Input */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px 12px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Search size={16} color="#64748B" />
                <input
                    type="text"
                    placeholder="Search office admins by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#1E293B',
                        fontSize: '13px',
                        width: '100%',
                        outline: 'none',
                        fontFamily: 'inherit'
                    }}
                />
            </div>

            {/* Admins Grid */}
            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                    <Loader2 className="animate-spin" size={36} color="#2563EB" style={{ margin: '0 auto 8px' }} />
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Loading Office Admins...</span>
                </div>
            ) : filteredAdmins.length === 0 ? (
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '3rem 1rem', textAlign: 'center' }}>
                    <ShieldAlert size={40} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>No Office Admins Found</h3>
                    <p style={{ color: '#64748B', fontSize: '12px', margin: '4px 0 14px 0' }}>
                        {searchTerm ? 'No admins match your search term.' : 'Click below to create your first office admin account.'}
                    </p>
                    <button onClick={() => setShowAddModal(true)} className="win-btn win-btn-primary">
                        <UserPlus size={14} /> Add New Office Admin
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                    {filteredAdmins.map((adminUser) => {
                        const isSelf = adminUser.id === auth.currentUser?.uid;
                        const isDisabled = adminUser.status === 'disabled';
                        const perms = adminUser.permissions || {};
                        const isMaster = adminUser.role === 'super-admin' && (!adminUser.permissions || Object.keys(adminUser.permissions).length === 0);

                        return (
                            <div
                                key={adminUser.id}
                                style={{
                                    backgroundColor: '#FFFFFF',
                                    border: isSelf ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                    borderRadius: '6px',
                                    padding: '14px 16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                    opacity: isDisabled ? 0.75 : 1
                                }}
                            >
                                <div>
                                    {/* Top Row: Info & Status */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <div style={{
                                                width: '38px',
                                                height: '38px',
                                                borderRadius: '5px',
                                                background: isMaster
                                                    ? 'linear-gradient(135deg, #2563EB, #7C3AED)'
                                                    : 'linear-gradient(135deg, #059669, #10B981)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#FFFFFF',
                                                fontWeight: '800',
                                                fontSize: '15px',
                                                flexShrink: 0
                                            }}>
                                                {(adminUser.name || 'A')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A' }}>
                                                    {adminUser.name || 'Admin User'}
                                                    {isSelf && (
                                                        <span style={{ marginLeft: '6px', fontSize: '10.5px', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '1px 5px', borderRadius: '3px', fontWeight: '700' }}>
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                                                    {adminUser.email}
                                                </div>
                                            </div>
                                        </div>

                                        <span style={{
                                            padding: '2px 7px',
                                            borderRadius: '3px',
                                            fontSize: '10.5px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            backgroundColor: isDisabled ? '#FEE2E2' : '#DEF7EC',
                                            color: isDisabled ? '#991B1B' : '#03543F'
                                        }}>
                                            {isDisabled ? 'Disabled' : 'Active'}
                                        </span>
                                    </div>

                                    {/* Role Badge */}
                                    <div style={{ marginBottom: '10px' }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '3px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            backgroundColor: isMaster ? '#EFF6FF' : '#F1F5F9',
                                            color: isMaster ? '#1D4ED8' : '#334155',
                                            border: isMaster ? '1px solid #BFDBFE' : '1px solid #CBD5E1'
                                        }}>
                                            {isMaster ? '⭐ Master Administrator' : 'Office Staff Operator'}
                                        </span>
                                    </div>

                                    {/* Permission Pills */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {isMaster ? (
                                            <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: '600' }}>
                                                ✓ Full Master Privileges (Unrestricted)
                                            </span>
                                        ) : (
                                            PERMISSION_CONFIG.map(p => {
                                                const hasIt = perms[p.key] === true;
                                                return (
                                                    <span
                                                        key={p.key}
                                                        style={{
                                                            fontSize: '10.5px',
                                                            padding: '2px 6px',
                                                            borderRadius: '3px',
                                                            backgroundColor: hasIt ? '#EFF6FF' : '#F8FAFC',
                                                            color: hasIt ? '#1D4ED8' : '#94A3B8',
                                                            border: `1px solid ${hasIt ? '#BFDBFE' : '#E2E8F0'}`,
                                                            fontWeight: hasIt ? '600' : '500'
                                                        }}
                                                    >
                                                        {hasIt ? '✓' : '✗'} {p.label}
                                                    </span>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Actions */}
                                {!isMaster && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                                        <button
                                            onClick={() => setSelectedAdminForEdit(adminUser)}
                                            className="win-btn"
                                            style={{ padding: '3px 8px', fontSize: '11.5px' }}
                                        >
                                            <Edit2 size={12} /> Edit Permissions
                                        </button>
                                        {!isSelf && (
                                            <button
                                                onClick={() => handleDeleteAdmin(adminUser)}
                                                className="win-btn"
                                                style={{ padding: '3px 8px', fontSize: '11.5px', color: '#DC2626', borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}
                                            >
                                                <Trash2 size={12} /> Delete
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Admins;
