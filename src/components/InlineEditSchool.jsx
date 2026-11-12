import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Loader2, Key, RefreshCw, Copy, Check, ArrowRight, ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react';
import { db, functions, auth } from '../firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { sendPasswordResetEmail } from 'firebase/auth';

const InlineEditSchool = ({ school, onClose, onSuccess, displayId }) => {
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [formData, setFormData] = useState({
        schoolName: school.name || '',
        state: school.state || 'Punjab',
        district: school.district || '',
        city: school.city || '',
        address: school.address || '',
        principalEmail: '',
        schoolContact: school.contact || '',
        principalContact: '',
        vicePrincipalContact: school.vicePrincipalContact || '',
        landline: school.landline || ''
    });

    const [initialEmail, setInitialEmail] = useState('');

    useEffect(() => {
        const fetchPrincipalEmail = async () => {
            if (school.principalId) {
                let fetchedEmail = '';
                let fetchedContact = '';
                const userDoc = await getDoc(doc(db, "global_users", school.principalId));
                if (userDoc.exists()) {
                    fetchedEmail = userDoc.data().email || '';
                    fetchedContact = userDoc.data().contact || '';
                } else {
                    const schoolUserDoc = await getDoc(doc(db, `schools/${school.id}/users`, school.principalId));
                    if (schoolUserDoc.exists()) {
                        fetchedEmail = schoolUserDoc.data().email || '';
                        fetchedContact = schoolUserDoc.data().contact || '';
                    }
                }
                setFormData(prev => ({
                    ...prev,
                    principalEmail: fetchedEmail,
                    principalContact: fetchedContact
                }));
                setInitialEmail(fetchedEmail);
            }
        };
        fetchPrincipalEmail();
    }, [school.principalId, school.id]);

    const handleSendResetEmail = async () => {
        const targetEmail = (formData.principalEmail || initialEmail || '').trim();
        if (!targetEmail) {
            setMessage({ type: 'error', text: 'Principal email is missing.' });
            return;
        }
        setPasswordLoading(true);
        setMessage({ type: '', text: '' });
        try {
            await sendPasswordResetEmail(auth, targetEmail);
            setMessage({ type: 'success', text: `Password reset link sent to ${targetEmail}. The principal can reset their own private password.` });
        } catch (err) {
            console.error("Reset email error:", err);
            setMessage({ type: 'error', text: 'Failed to send reset email: ' + err.message });
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const schoolRef = doc(db, "schools", school.id);
            const updateData = {
                name: formData.schoolName,
                state: formData.state,
                district: formData.district,
                city: formData.city,
                address: formData.address,
                contact: formData.schoolContact,
                vicePrincipalContact: formData.vicePrincipalContact || '',
                landline: formData.landline || '',
                updatedAt: new Date()
            };

            const normalizedEmail = (formData.principalEmail || '').toLowerCase().trim();
            const emailChanged = normalizedEmail && (normalizedEmail !== initialEmail.toLowerCase().trim());

            if (emailChanged) {
                if (!school.principalId) {
                    setMessage({ type: 'error', text: 'Cannot update email: No Principal Account is linked to this school.' });
                    setLoading(false);
                    return;
                }
                const updateSchoolUserPassword = httpsCallable(functions, 'updateSchoolUserPassword');
                const authPayload = {
                    targetUid: school.principalId,
                    schoolId: school.id,
                    newEmail: normalizedEmail
                };
                await updateSchoolUserPassword(authPayload);
            }

            if (school.principalId && normalizedEmail) {
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
                            <label style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>State / Province</label>
                            <select
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            >
                                <option value="Punjab">Punjab</option>
                                <option value="Sindh">Sindh</option>
                                <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa (KPK)</option>
                                <option value="Balochistan">Balochistan</option>
                                <option value="Islamabad (ICT)">Islamabad (ICT / Federal)</option>
                                <option value="Azad Jammu & Kashmir">Azad Jammu & Kashmir (AJK)</option>
                                <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>District</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Rawalpindi, Lahore..."
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                    value={formData.district}
                                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>City</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Taxila, Gujar Khan..."
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1e293b', fontSize: '0.875rem' }}
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                />
                            </div>
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

                        <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.6)', borderRadius: '12px', border: '1px solid #bfdbfe', marginTop: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                                <Shield size={16} color="#1d4ed8" />
                                <span style={{ fontSize: '0.8rem', color: '#1e3a8a', fontWeight: 'bold' }}>
                                    Principal Privacy & Password Control
                                </span>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0 0 0.75rem 0', lineHeight: 1.4 }}>
                                Principals manage their own private password in their Settings. Super Admin cannot view or overwrite their password directly. If the principal is locked out, send them an official reset link.
                            </p>
                            <button
                                type="button"
                                onClick={handleSendResetEmail}
                                disabled={passwordLoading}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem',
                                    padding: '0.5rem 0.85rem',
                                    borderRadius: '8px',
                                    background: '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    fontSize: '0.78rem',
                                    fontWeight: '600',
                                    cursor: passwordLoading ? 'not-allowed' : 'pointer',
                                    width: '100%'
                                }}
                            >
                                {passwordLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                                {passwordLoading ? 'Sending Reset Link...' : 'Send Password Reset Link to Principal Email'}
                            </button>
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
