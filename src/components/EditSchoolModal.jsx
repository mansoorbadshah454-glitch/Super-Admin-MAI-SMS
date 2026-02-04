import React, { useState, useEffect } from 'react';
import { X, Save, Shield, School as SchoolIcon, Loader2, Key, Lock } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';

const EditSchoolModal = ({ school, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        schoolName: school.name,
        address: school.address,
        paymentStatus: school.paymentStatus || 'unpaid',
        status: school.status || 'active',
        newPassword: '',
        principalEmail: '',
        schoolContact: school.contact || '', // Added
        principalContact: '' // Added
    });

    useEffect(() => {
        const fetchPrincipalEmail = async () => {
            if (school.principalId) {
                const userDoc = await getDoc(doc(db, "global_users", school.principalId));
                if (userDoc.exists()) {
                    setFormData(prev => ({
                        ...prev,
                        principalEmail: userDoc.data().email || '',
                        principalContact: userDoc.data().contact || '' // Added
                    }));
                } else {
                    // Try fallback
                    const schoolUserDoc = await getDoc(doc(doc(db, "schools", school.id), "users", school.principalId));
                    if (schoolUserDoc.exists()) {
                        setFormData(prev => ({
                            ...prev,
                            principalEmail: schoolUserDoc.data().email || '',
                            principalContact: schoolUserDoc.data().contact || '' // Added
                        }));
                    }
                }
            }
        };
        fetchPrincipalEmail();
    }, [school.principalId, school.id]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleResetPassword = async () => {
        if (!school.principalId) {
            setMessage({ type: 'error', text: 'Critical Error: This school record has no Principal UID linked to it.' });
            return;
        }

        if (!window.confirm("Send password reset email to the Principal?")) return;

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            // STEP 1: Check source of truth (global_users)
            const userDoc = await getDoc(doc(db, "global_users", school.principalId));

            if (userDoc.exists() && userDoc.data().email) {
                const principalEmail = userDoc.data().email;
                await sendPasswordResetEmail(auth, principalEmail);
                setMessage({ type: 'success', text: `Success! Reset email sent to ${principalEmail}` });
                setLoading(false);
                return;
            }

            // STEP 2: Fallback to School Registry (for older records)
            console.log("Global registry entry missing email, trying fallback...");
            const schoolUserDoc = await getDoc(doc(db, `schools/${school.id}/users`, school.principalId));

            if (schoolUserDoc.exists() && schoolUserDoc.data().email) {
                const backupEmail = schoolUserDoc.data().email;
                await sendPasswordResetEmail(auth, backupEmail);
                setMessage({ type: 'success', text: `Success! (Fallback) Reset email sent to ${backupEmail}` });
            } else {
                setMessage({ type: 'error', text: `Principal UID (${school.principalId}) not fully registered. Please contact support to manually update registry.` });
            }

        } catch (error) {
            console.error("Error sending reset email:", error);
            setMessage({ type: 'error', text: 'Reset failed: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const schoolRef = doc(db, "schools", school.id);
            const updateData = {
                name: formData.schoolName,
                address: formData.address,
                contact: formData.schoolContact, // Added
                paymentStatus: formData.paymentStatus,
                status: formData.status,
                updatedAt: new Date()
            };

            // 1. Update Principal Credentials (Manual Bypass System)
            if (school.principalId) {
                const normalizedEmail = formData.principalEmail.toLowerCase().trim();

                // Update Global User Registry
                const globalUserRef = doc(db, "global_users", school.principalId);
                await setDoc(globalUserRef, {
                    email: normalizedEmail,
                    contact: formData.principalContact, // Added
                    role: 'principal',
                    schoolId: school.id,
                    uid: school.principalId
                }, { merge: true });

                // Update School Internal User Registry
                const schoolUserRef = doc(db, `schools/${school.id}/users`, school.principalId);
                const userUpdateData = {
                    email: normalizedEmail,
                    contact: formData.principalContact // Added
                };

                if (formData.newPassword) {
                    userUpdateData.manualPassword = formData.newPassword;
                    userUpdateData.passwordLastReset = new Date();
                }

                await setDoc(schoolUserRef, userUpdateData, { merge: true });
                console.log("Principal credentials updated manually.");
            }

            await updateDoc(schoolRef, updateData);

            setMessage({ type: 'success', text: 'Credentials and school updated successfully!' });
            setTimeout(() => {
                onSuccess();
            }, 1000);
        } catch (error) {
            console.error("Error updating school:", error);
            setMessage({ type: 'error', text: 'Failed to update school. ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
        }}>
            <div className="card glass animate-in zoom-in duration-300" style={{
                width: '100%',
                maxWidth: '500px',
                padding: '2.5rem',
                position: 'relative',
                background: 'rgba(30, 41, 59, 0.95)',
                border: '1px solid var(--glass-border)'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    <X size={24} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SchoolIcon color="white" size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Edit School</h2>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>School ID: <span style={{ color: 'white' }}>{school.id}</span></p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Principal ID: <span style={{ color: school.principalId ? 'white' : '#ef4444' }}>{school.principalId || 'MISSING'}</span></p>
                        </div>
                    </div>
                </div>

                {message.text && (
                    <div style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: message.type === 'success' ? '#34d399' : '#f87171',
                        border: message.type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                        textAlign: 'center'
                    }}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="input-group">
                        <label className="label">School Name</label>
                        <input
                            type="text"
                            className="input-field"
                            value={formData.schoolName}
                            onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="label">Address</label>
                        <input
                            type="text"
                            className="input-field"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="label">School Contact Number</label>
                        <input
                            type="text"
                            className="input-field"
                            value={formData.schoolContact}
                            onChange={(e) => setFormData({ ...formData, schoolContact: e.target.value })}
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group">
                            <label className="label">Payment Status</label>
                            <select
                                className="input-field"
                                value={formData.paymentStatus}
                                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                                style={{ background: 'rgba(15, 23, 42, 0.5)' }}
                            >
                                <option value="unpaid">Unpaid</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <label className="label">System Status</label>
                            <select
                                className="input-field"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                style={{ background: 'rgba(15, 23, 42, 0.5)' }}
                            >
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '0.5rem', paddingTop: '1.5rem' }}>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Lock size={14} /> Account Overrides (Manual Reset)
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="input-group">
                                <label className="label" style={{ fontSize: '0.75rem' }}>Principal Email (Username)</label>
                                <input
                                    type="email"
                                    className="input-field"
                                    placeholder="principal@school.com"
                                    value={formData.principalEmail}
                                    onChange={(e) => setFormData({ ...formData, principalEmail: e.target.value })}
                                    style={{ background: 'rgba(99, 102, 241, 0.05)' }}
                                />
                            </div>
                            <div className="input-group">
                                <label className="label" style={{ fontSize: '0.75rem' }}>Principal Contact</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={formData.principalContact}
                                    onChange={(e) => setFormData({ ...formData, principalContact: e.target.value })}
                                    style={{ background: 'rgba(99, 102, 241, 0.05)' }}
                                />
                            </div>
                            <div className="input-group">
                                <label className="label" style={{ fontSize: '0.75rem' }}>New Manual Password</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Enter New Password"
                                    value={formData.newPassword}
                                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                                    style={{ background: 'rgba(99, 102, 241, 0.05)', borderColor: formData.newPassword ? 'var(--primary)' : 'var(--glass-border)' }}
                                />
                            </div>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Use these fields to force update the Principal's login credentials.
                            </p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1rem', justifyContent: 'center', height: '50px' }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (
                            <>
                                <Save size={20} />
                                Save Changes
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EditSchoolModal;
