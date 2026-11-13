import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Loader2, ArrowRight, ArrowLeft, Mail, Lock, Eye, EyeOff, Copy, Check, Key } from 'lucide-react';
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
    const [newPassword, setNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [currentTempPassword, setCurrentTempPassword] = useState(school.temporaryPassword || school.initialPassword || '');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchPrincipalEmail = async () => {
            if (school.principalId) {
                let fetchedEmail = '';
                let fetchedContact = '';
                let fetchedPassword = school.temporaryPassword || school.initialPassword || '';
                try {
                    const userDoc = await getDoc(doc(db, "global_users", school.principalId));
                    if (userDoc.exists()) {
                        fetchedEmail = userDoc.data().email || '';
                        fetchedContact = userDoc.data().contact || '';
                        if (!fetchedPassword) {
                            fetchedPassword = userDoc.data().temporaryPassword || userDoc.data().initialPassword || '';
                        }
                    } else {
                        const schoolUserDoc = await getDoc(doc(db, `schools/${school.id}/users`, school.principalId));
                        if (schoolUserDoc.exists()) {
                            fetchedEmail = schoolUserDoc.data().email || '';
                            fetchedContact = schoolUserDoc.data().contact || '';
                            if (!fetchedPassword) {
                                fetchedPassword = schoolUserDoc.data().temporaryPassword || schoolUserDoc.data().initialPassword || '';
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Could not fetch principal details:", e);
                }

                setFormData(prev => ({
                    ...prev,
                    principalEmail: fetchedEmail,
                    principalContact: fetchedContact
                }));
                setInitialEmail(fetchedEmail);
                if (fetchedPassword) {
                    setCurrentTempPassword(fetchedPassword);
                }
            }
        };
        fetchPrincipalEmail();
    }, [school.principalId, school.id, school.temporaryPassword, school.initialPassword]);

    const handleCopyPassword = () => {
        if (!currentTempPassword) return;
        navigator.clipboard.writeText(currentTempPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
            const hasNewPassword = Boolean(newPassword.trim());

            if (hasNewPassword && newPassword.trim().length < 6) {
                setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
                setLoading(false);
                return;
            }

            // Direct Credential Update (Email or Password)
            if (hasNewPassword || emailChanged) {
                if (!school.principalId) {
                    setMessage({ type: 'error', text: 'Cannot update credentials: No Principal Account is linked to this school.' });
                    setLoading(false);
                    return;
                }
                const updateSchoolUserPassword = httpsCallable(functions, 'updateSchoolUserPassword');
                const authPayload = {
                    targetUid: school.principalId,
                    schoolId: school.id,
                    newEmail: normalizedEmail
                };
                if (hasNewPassword) {
                    authPayload.newPassword = newPassword.trim();
                }

                await updateSchoolUserPassword(authPayload);

                if (hasNewPassword) {
                    updateData.temporaryPassword = newPassword.trim();
                    setCurrentTempPassword(newPassword.trim());
                    setNewPassword('');
                }
            }

            if (school.principalId && (normalizedEmail || hasNewPassword)) {
                const globalUserUpdates = {
                    contact: formData.principalContact,
                    role: 'principal',
                    schoolId: school.id,
                    uid: school.principalId
                };
                if (normalizedEmail) globalUserUpdates.email = normalizedEmail;
                if (hasNewPassword) globalUserUpdates.temporaryPassword = newPassword.trim();

                const globalUserRef = doc(db, "global_users", school.principalId);
                await setDoc(globalUserRef, globalUserUpdates, { merge: true });

                const schoolUserRef = doc(db, `schools/${school.id}/users`, school.principalId);
                await setDoc(schoolUserRef, globalUserUpdates, { merge: true });
            }

            await updateDoc(schoolRef, updateData);

            setMessage({ type: 'success', text: hasNewPassword ? 'Password reset & School details updated successfully!' : 'School details updated!' });
            setTimeout(() => {
                onSuccess();
            }, 1000);
        } catch (error) {
            console.error("Error updating school:", error);
            setMessage({ type: 'error', text: 'Failed to update: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '5px 8px',
        fontSize: '12px',
        fontFamily: 'Tahoma, sans-serif',
        background: '#fff',
        border: '1px solid #7F9DB9',
        borderRadius: '2px',
        outline: 'none',
        boxSizing: 'border-box'
    };

    const labelStyle = {
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: '3px',
        display: 'block'
    };

    return (
        <div style={{
            padding: '12px',
            background: '#ECE9D8',
            border: '1px solid #7F9DB9',
            fontFamily: 'Tahoma, "Segoe UI", sans-serif',
            borderRadius: '0 0 4px 4px'
        }}>
            {/* Header Area */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '8px',
                borderBottom: '1px solid #D0D0BF',
                marginBottom: '10px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#003399' }}>
                        ⚙ {page === 1 ? 'Quick Edit: Campus Specifications' : 'Quick Edit: Administrator Credentials'}
                    </span>
                    <span style={{ fontSize: '10px', background: '#D9E4F5', border: '1px solid #7F9DB9', padding: '1px 6px', borderRadius: '3px', color: '#003399', fontWeight: 'bold' }}>
                        {displayId}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        background: '#ECE9D8',
                        border: '1px solid #7F9DB9',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        padding: '1px 4px',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                >
                    <X size={14} color="#333" />
                </button>
            </div>

            {message.text && (
                <div style={{
                    padding: '6px 10px',
                    borderRadius: '3px',
                    marginBottom: '10px',
                    fontSize: '11px',
                    background: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                    color: message.type === 'success' ? '#166534' : '#991B1B',
                    border: `1px solid ${message.type === 'success' ? '#16A34A' : '#EF4444'}`
                }}>
                    {message.text}
                </div>
            )}

            <div>
                {page === 1 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={labelStyle}>School / Institution Name</label>
                                <input
                                    type="text"
                                    style={inputStyle}
                                    value={formData.schoolName}
                                    onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>State / Province</label>
                                <select
                                    style={inputStyle}
                                    value={formData.state}
                                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                >
                                    <option value="Punjab">Punjab</option>
                                    <option value="Sindh">Sindh</option>
                                    <option value="Khyber Pakhtunkhwa">KPK</option>
                                    <option value="Balochistan">Balochistan</option>
                                    <option value="Islamabad (ICT)">Islamabad (ICT)</option>
                                    <option value="Azad Jammu & Kashmir">AJK</option>
                                    <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={labelStyle}>District</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Rawalpindi"
                                    style={inputStyle}
                                    value={formData.district}
                                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>City / Tehsil</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Taxila"
                                    style={inputStyle}
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Physical Street Address</label>
                            <input
                                type="text"
                                style={inputStyle}
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={labelStyle}>Principal Mobile</label>
                                <input
                                    type="text"
                                    style={inputStyle}
                                    value={formData.principalContact}
                                    onChange={(e) => setFormData({ ...formData, principalContact: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Vice Principal</label>
                                <input
                                    type="text"
                                    style={inputStyle}
                                    value={formData.vicePrincipalContact}
                                    onChange={(e) => setFormData({ ...formData, vicePrincipalContact: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Landline</label>
                                <input
                                    type="text"
                                    style={inputStyle}
                                    value={formData.landline}
                                    onChange={(e) => setFormData({ ...formData, landline: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Official Office Phone</label>
                                <input
                                    type="text"
                                    style={inputStyle}
                                    value={formData.schoolContact}
                                    onChange={(e) => setFormData({ ...formData, schoolContact: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                            <button
                                type="button"
                                onClick={() => setPage(2)}
                                style={{
                                    padding: '4px 14px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    fontFamily: 'Tahoma, sans-serif',
                                    background: 'linear-gradient(180deg, #FFFFFF 0%, #ECE9D8 100%)',
                                    border: '1px solid #7F9DB9',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    color: '#003399',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                Next: Principal Security <ArrowRight size={12} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                            <label style={labelStyle}>Principal Login Email</label>
                            <input
                                type="email"
                                style={inputStyle}
                                value={formData.principalEmail}
                                onChange={(e) => setFormData({ ...formData, principalEmail: e.target.value })}
                            />
                        </div>

                        {/* Current Temporary Password Info Card */}
                        <div style={{
                            background: '#F8FAFC',
                            border: '1px solid #CBD5E1',
                            borderRadius: '4px',
                            padding: '8px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px'
                        }}>
                            <div>
                                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>
                                    Current / Initial Password
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                    <Key size={13} color="#2563EB" />
                                    <span style={{ fontSize: '13px', fontWeight: 'bold', fontFamily: 'monospace', color: currentTempPassword ? '#0F172A' : '#94A3B8' }}>
                                        {currentTempPassword ? (showCurrentPassword ? currentTempPassword : '••••••••••••') : 'No temp password recorded'}
                                    </span>
                                </div>
                            </div>
                            {currentTempPassword && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        title={showCurrentPassword ? "Hide password" : "Show password"}
                                        style={{
                                            padding: '4px 6px',
                                            background: '#FFFFFF',
                                            border: '1px solid #CBD5E1',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            color: '#475569',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        {showCurrentPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCopyPassword}
                                        title="Copy Password"
                                        style={{
                                            padding: '4px 8px',
                                            background: copied ? '#DCFCE7' : '#FFFFFF',
                                            border: `1px solid ${copied ? '#16A34A' : '#CBD5E1'}`,
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            color: copied ? '#166534' : '#2563EB',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        {copied ? <Check size={12} /> : <Copy size={12} />}
                                        {copied ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Reset / Override Password Section */}
                        <fieldset style={{
                            border: '1.5px solid #3B82F6',
                            borderRadius: '4px',
                            padding: '8px 10px',
                            background: '#F0F7FF'
                        }}>
                            <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#1D4ED8', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Lock size={12} /> Reset / Override Password (No Old Password Needed)
                            </legend>
                            <p style={{ fontSize: '10.5px', color: '#1E3A8A', margin: '0 0 6px 0', lineHeight: '1.3' }}>
                                Type a new password below. It will immediately overwrite the Principal's Firebase login password:
                            </p>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type={showNewPassword ? "text" : "password"}
                                    placeholder="Enter new password (min 6 characters)"
                                    style={{
                                        ...inputStyle,
                                        paddingRight: '30px',
                                        borderColor: newPassword ? '#2563EB' : '#7F9DB9',
                                        backgroundColor: '#FFFFFF',
                                        fontWeight: newPassword ? 'bold' : 'normal'
                                    }}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '6px',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#64748B',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    {showNewPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                            </div>
                        </fieldset>

                        {/* Alternative: Self-Reset Email */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                            <span style={{ fontSize: '10.5px', color: '#64748B' }}>Or email self-reset link:</span>
                            <button
                                type="button"
                                onClick={handleSendResetEmail}
                                disabled={passwordLoading}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 8px',
                                    background: '#FFFFFF',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    color: '#003399',
                                    fontWeight: 'bold',
                                    cursor: passwordLoading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {passwordLoading ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                                Send Reset Link via Email
                            </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                            <button
                                type="button"
                                onClick={() => setPage(1)}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '11px',
                                    fontFamily: 'Tahoma, sans-serif',
                                    background: 'linear-gradient(180deg, #FFFFFF 0%, #ECE9D8 100%)',
                                    border: '1px solid #7F9DB9',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <ArrowLeft size={12} /> Back
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                style={{
                                    padding: '4px 16px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    fontFamily: 'Tahoma, sans-serif',
                                    background: 'linear-gradient(180deg, #16A34A 0%, #15803D 100%)',
                                    border: '1px solid #14532D',
                                    color: '#FFF',
                                    borderRadius: '3px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InlineEditSchool;
