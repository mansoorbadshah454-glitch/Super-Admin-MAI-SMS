import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Loader2, Key, RefreshCw, Copy, Check, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { db, functions } from '../firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const InlineEditSchool = ({ school, onClose, onSuccess, displayId }) => {
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [formData, setFormData] = useState({
        schoolName: school.name || '',
        address: school.address || '',
        principalEmail: '',
        schoolContact: school.contact || '',
        principalContact: '',
        vicePrincipalContact: school.vicePrincipalContact || '',
        landline: school.landline || '',
        newPassword: '',
        confirmPassword: ''
    });

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
                    const schoolUserDoc = await getDoc(doc(db, `schools/${school.id}/users`, school.principalId));
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

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        if (formData.newPassword || formData.confirmPassword) {
            if (formData.newPassword !== formData.confirmPassword) {
                setMessage({ type: 'error', text: 'Passwords do not match.' });
                return;
            }
            if (formData.newPassword.length < 6) {
                setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
                return;
            }
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const schoolRef = doc(db, "schools", school.id);
            const updateData = {
                name: formData.schoolName,
                address: formData.address,
                contact: formData.schoolContact,
                vicePrincipalContact: formData.vicePrincipalContact || '',
                landline: formData.landline || '',
                updatedAt: new Date()
            };

            if (formData.newPassword) {
                if (!school.principalId) {
                    setMessage({ type: 'error', text: 'Cannot update password: No Principal Account is linked to this school.' });
                    setLoading(false);
                    return;
                }
                const updateSchoolUserPassword = httpsCallable(functions, 'updateSchoolUserPassword');
                await updateSchoolUserPassword({
                    targetUid: school.principalId,
                    newPassword: formData.newPassword,
                    schoolId: school.id
                });
            }

            if (school.principalId) {
                const normalizedEmail = formData.principalEmail.toLowerCase().trim();

                const globalUserRef = doc(db, "global_users", school.principalId);
                await setDoc(globalUserRef, {
                    email: normalizedEmail,
                    contact: formData.principalContact,
                    role: 'principal',
                    schoolId: school.id,
                    uid: school.principalId
                }, { merge: true });

                const schoolUserRef = doc(db, `schools/${school.id}/users`, school.principalId);
                await setDoc(schoolUserRef, {
                    email: normalizedEmail,
                    contact: formData.principalContact
                }, { merge: true });
            }

            await updateDoc(schoolRef, updateData);

            setMessage({ type: 'success', text: 'School details updated!' });
            setTimeout(() => {
                onSuccess();
            }, 1000);
        } catch (error) {
            console.error("Error updating school:", error);
            setMessage({ type: 'error', text: 'Failed to update. ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', background: '#bfdbfe' }} className="animate-in fade-in duration-300">
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e3a8a', fontWeight: 'bold' }}>
                    {page === 1 ? 'Edit Details' : 'Principal Account'}
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', fontSize: '0.75rem', color: '#1e40af', fontWeight: '600' }}>
                        {displayId}
                    </div>
                    <button onClick={onClose} style={{ color: '#1e3a8a', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.2rem' }}>
                        <X size={20} />
                    </button>
                </div>
            </div>

            {message.text && (
                <div style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.75rem',
                    background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
                    color: message.type === 'success' ? '#059669' : '#dc2626',
                    border: `1px solid ${message.type === 'success' ? '#34d399' : '#f87171'}`
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ flex: 1 }}>
                {page === 1 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="animate-in slide-in-from-left duration-300">
                        <div>
                            <label style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>School Name</label>
                            <input
                                type="text"
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                value={formData.schoolName}
                                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Address</label>
                            <input
                                type="text"
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Principal Contact</label>
                                <input
                                    type="text"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                    value={formData.principalContact}
                                    onChange={(e) => setFormData({ ...formData, principalContact: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Vice Principal Contact</label>
                                <input
                                    type="text"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                    value={formData.vicePrincipalContact}
                                    onChange={(e) => setFormData({ ...formData, vicePrincipalContact: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Landline</label>
                                <input
                                    type="text"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                    value={formData.landline}
                                    onChange={(e) => setFormData({ ...formData, landline: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>School Contact</label>
                                <input
                                    type="text"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                    value={formData.schoolContact}
                                    onChange={(e) => setFormData({ ...formData, schoolContact: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setPage(2)}
                            className="btn btn-primary"
                            style={{ marginTop: '1rem', width: '100%', justifyContent: 'center', background: '#1e40af', color: 'white', border: 'none', padding: '0.6rem', borderRadius: '8px' }}
                        >
                            Next <ArrowRight size={16} />
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="animate-in slide-in-from-right duration-300">
                        <div>
                            <label style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Login (Email/Username)</label>
                            <input
                                type="email"
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                value={formData.principalEmail}
                                onChange={(e) => setFormData({ ...formData, principalEmail: e.target.value })}
                            />
                        </div>

                        <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.4)', borderRadius: '12px', border: '1px dashed #93c5fd', marginTop: '0.5rem' }}>
                            <label style={{ fontSize: '0.75rem', color: '#1e3a8a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.5rem' }}>
                                <Key size={14} /> Update Password
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="New Password (optional)"
                                        style={{ width: '100%', padding: '0.5rem', paddingRight: '2.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                        value={formData.newPassword}
                                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Re-confirm Password"
                                        style={{ width: '100%', padding: '0.5rem', paddingRight: '2.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                    >
                                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setPage(1)}
                                style={{ flex: 1, background: 'rgba(255,255,255,0.6)', border: 'none', padding: '0.6rem', borderRadius: '8px', color: '#1e40af', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}
                            >
                                <ArrowLeft size={16} /> Back
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 'bold' }}
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Save</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InlineEditSchool;
