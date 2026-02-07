import React, { useState, useEffect } from 'react';
import { X, Save, Shield, School as SchoolIcon, Loader2, Key, Lock, RefreshCw, Copy, Check } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const EditSchoolModal = ({ school, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        schoolName: school.name,
        address: school.address,
        paymentStatus: school.paymentStatus || 'unpaid',
        status: school.status || 'active',
        principalEmail: '',
        schoolContact: school.contact || '',
        principalContact: ''
    });

    const [generatedPassword, setGeneratedPassword] = useState('');
    const [passwordCopied, setPasswordCopied] = useState(false);

    useEffect(() => {
        const fetchPrincipalEmail = async () => {
            if (school.principalId) {
                const userDoc = await getDoc(doc(db, "global_users", school.principalId));
                if (userDoc.exists()) {
                    setFormData(prev => ({
                        ...prev,
                        principalEmail: userDoc.data().email || '',
                        principalContact: userDoc.data().contact || ''
                    }));
                } else {
                    // Try fallback
                    const schoolUserDoc = await getDoc(doc(doc(db, "schools", school.id), "users", school.principalId));
                    if (schoolUserDoc.exists()) {
                        setFormData(prev => ({
                            ...prev,
                            principalEmail: schoolUserDoc.data().email || '',
                            principalContact: schoolUserDoc.data().contact || ''
                        }));
                    }
                }
            }
        };
        fetchPrincipalEmail();
    }, [school.principalId, school.id]);

    const [loading, setLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleGeneratePassword = async () => {
        if (!school.principalId) {
            setMessage({ type: 'error', text: 'Critical Error: This school record has no Principal UID linked to it.' });
            return;
        }

        if (!window.confirm("Are you sure you want to RESET the Principal's password? This will log them out immediately.")) return;

        setPasswordLoading(true);
        setMessage({ type: '', text: '' });
        setGeneratedPassword('');

        try {
            const functions = getFunctions();
            const updateSchoolUserPassword = httpsCallable(functions, 'updateSchoolUserPassword');

            // Generate a secure random password logic simply here or on backend? 
            // Better to generate here and send it, or let backend do it. 
            // Requirement says "make new password reset option (not manual)".
            // User comment: "Super admin... can create new password here"
            // Let's generate a strong random string.
            const newPass = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();

            await updateSchoolUserPassword({
                targetUid: school.principalId,
                newPassword: newPass,
                schoolId: school.id
            });

            setGeneratedPassword(newPass);
            setMessage({ type: 'success', text: 'Password reset successfully!' });

        } catch (error) {
            console.error("Error resetting password:", error);
            setMessage({ type: 'error', text: 'Reset failed: ' + error.message });
        } finally {
            setPasswordLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedPassword);
        setPasswordCopied(true);
        setTimeout(() => setPasswordCopied(false), 2000);
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
                contact: formData.schoolContact,
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
                    contact: formData.principalContact,
                    role: 'principal',
                    schoolId: school.id,
                    uid: school.principalId
                }, { merge: true });

                // Update School Internal User Registry
                const schoolUserRef = doc(db, `schools/${school.id}/users`, school.principalId);
                const userUpdateData = {
                    email: normalizedEmail,
                    contact: formData.principalContact
                };

                await setDoc(schoolUserRef, userUpdateData, { merge: true });
                console.log("Principal credentials details updated.");
            }

            await updateDoc(schoolRef, updateData);

            setMessage({ type: 'success', text: 'School details updated successfully!' });
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
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '1rem',
                cursor: 'pointer' // Indicates click-outside to close
            }}
        >
            <div
                className="card glass animate-in zoom-in duration-300"
                onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
                style={{
                    width: '100%',
                    maxWidth: '800px', // WIDER
                    padding: '2.5rem',
                    position: 'relative',
                    background: 'rgba(30, 41, 59, 0.95)',
                    border: '1px solid var(--glass-border)',
                    cursor: 'default', // Reset cursor inside
                    margin: 'auto' // Center
                }}
            >
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* LEFT COLUMN: School Details */}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.1rem', color: 'white', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>School Details</h3>

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

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '1rem', justifyContent: 'center', height: '46px' }}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                <>
                                    <Save size={18} />
                                    Save Details
                                </>
                            )}
                        </button>
                    </form>

                    {/* RIGHT COLUMN: Account & Password */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '1px solid var(--glass-border)', paddingLeft: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', color: 'white', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Lock size={16} /> Principal Account
                        </h3>

                        <div className="input-group">
                            <label className="label">Principal Email (Username)</label>
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
                            <label className="label">Principal Contact</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.principalContact}
                                onChange={(e) => setFormData({ ...formData, principalContact: e.target.value })}
                                style={{ background: 'rgba(99, 102, 241, 0.05)' }}
                            />
                        </div>

                        <div className="p-4 rounded-xl bg-slate-900/50 border border-indigo-500/20 mt-2">
                            <label className="label" style={{ color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Key size={14} /> Password Reset
                            </label>

                            {!generatedPassword ? (
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.4' }}>
                                        Click below to generate a new secure password for this Principal. This will invalidate their old password immediately.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleGeneratePassword}
                                        disabled={passwordLoading || !school.principalId}
                                        className="btn"
                                        style={{
                                            width: '100%',
                                            background: 'rgba(236, 72, 153, 0.1)',
                                            color: '#f472b6',
                                            border: '1px solid rgba(236, 72, 153, 0.2)',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {passwordLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                                        Generate New Password
                                    </button>
                                </div>
                            ) : (
                                <div className="animate-in fade-in zoom-in duration-300">
                                    <p style={{ fontSize: '0.75rem', color: '#34d399', marginBottom: '0.5rem', fontWeight: '600' }}>
                                        Password Updated! Copy it now:
                                    </p>
                                    <div style={{
                                        display: 'flex',
                                        gap: '0.5rem',
                                        background: 'rgba(0,0,0,0.3)',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--primary)'
                                    }}>
                                        <code style={{ flex: 1, fontSize: '1.1rem', letterSpacing: '0.05em', color: 'white', fontFamily: 'monospace' }}>
                                            {generatedPassword}
                                        </code>
                                        <button
                                            type="button"
                                            onClick={copyToClipboard}
                                            style={{ background: 'transparent', border: 'none', color: passwordCopied ? '#34d399' : 'var(--text-muted)', cursor: 'pointer' }}
                                            title="Copy to clipboard"
                                        >
                                            {passwordCopied ? <Check size={20} /> : <Copy size={20} />}
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                        Please share this with the Principal securely. It will not be shown again.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setGeneratedPassword('')}
                                        style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: '0.5rem', textDecoration: 'underline' }}
                                    >
                                        Reset/Generate Another
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditSchoolModal;
