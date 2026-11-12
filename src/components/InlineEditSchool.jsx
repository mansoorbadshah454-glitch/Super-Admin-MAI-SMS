import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Loader2, ArrowRight, ArrowLeft, Mail } from 'lucide-react';
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                            <label style={labelStyle}>Principal Login Email</label>
                            <input
                                type="email"
                                style={inputStyle}
                                value={formData.principalEmail}
                                onChange={(e) => setFormData({ ...formData, principalEmail: e.target.value })}
                            />
                        </div>

                        <fieldset style={{
                            border: '1px solid #D0D0BF',
                            borderRadius: '3px',
                            padding: '8px 10px',
                            background: '#FFFFFF'
                        }}>
                            <legend style={{ fontSize: '10px', fontWeight: 'bold', color: '#003399', padding: '0 4px' }}>
                                Principal Privacy & Password Control
                            </legend>
                            <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                                Principals manage their own private passwords. Super Admins cannot overwrite passwords in plain text.
                            </p>
                            <button
                                type="button"
                                onClick={handleSendResetEmail}
                                disabled={passwordLoading}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    padding: '5px 10px',
                                    background: 'linear-gradient(180deg, #FFFFFF 0%, #ECE9D8 100%)',
                                    border: '1px solid #7F9DB9',
                                    borderRadius: '3px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    color: '#003399',
                                    cursor: passwordLoading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {passwordLoading ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                                Send Password Reset Link to Principal
                            </button>
                        </fieldset>

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
