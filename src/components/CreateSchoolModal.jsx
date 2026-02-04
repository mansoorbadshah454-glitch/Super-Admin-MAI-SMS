import React, { useState } from 'react';
import { X, Save, Shield, School, Mail, Lock } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const CreateSchoolModal = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        schoolName: '',
        address: '',
        schoolContact: '', // Added school contact
        principalName: '',
        principalEmail: '',
        principalPassword: '',
        principalContact: '' // Added principal contact
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            console.log("Starting account creation...", formData.principalEmail);
            const userCredential = await createUserWithEmailAndPassword(auth, formData.principalEmail, formData.principalPassword);
            const user = userCredential.user;

            // Generate a School ID like SCHOOL_001
            const schoolCode = `SCHOOL_${Math.floor(Math.random() * 900 + 100)}`;

            console.log("Saving school metadata...");
            const schoolRef = doc(db, "schools", schoolCode);
            await setDoc(schoolRef, {
                id: schoolCode,
                name: formData.schoolName,
                address: formData.address,
                contact: formData.schoolContact, // Added contact
                createdAt: serverTimestamp(),
                status: 'active',
                paymentStatus: 'unpaid', // Default to unpaid
                principalId: user.uid
            });

            console.log("Saving principal info to school subcollection...");
            await setDoc(doc(db, `schools/${schoolCode}/users`, user.uid), {
                uid: user.uid,
                name: formData.principalName,
                email: formData.principalEmail,
                contact: formData.principalContact, // Added contact
                role: 'principal',
                schoolId: schoolCode,
                createdAt: serverTimestamp()
            });

            console.log("Updating global user registry...");
            await setDoc(doc(db, "global_users", user.uid), {
                uid: user.uid,
                name: formData.principalName, // Added name for global registry
                email: formData.principalEmail,
                contact: formData.principalContact, // Added contact
                schoolId: schoolCode,
                role: 'principal'
            });

            alert(`Success! ${formData.schoolName} created with ID: ${schoolCode}`);
            onSuccess();
            onClose();
        } catch (err) {
            console.error("SaaS CREATION ERROR:", err);
            setError(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="card glass w-full max-w-lg relative animate-in fade-in zoom-in duration-300">
                <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-white">
                    <X size={24} />
                </button>

                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                            {step === 1 ? <School size={24} /> : <Shield size={24} />}
                        </div>
                        {step === 1 ? 'School Details' : 'Principal Account'}
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Step {step} of 2: {step === 1 ? 'Register the new school' : 'Create admin credentials'}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {step === 1 ? (
                        <div className="space-y-4">
                            <div className="input-group">
                                <label className="input-label">School Name</label>
                                <input
                                    type="text"
                                    name="schoolName"
                                    required
                                    className="input-field"
                                    placeholder="e.g. Springfield High School"
                                    value={formData.schoolName}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Address</label>
                                <textarea
                                    name="address"
                                    required
                                    className="input-field"
                                    rows="3"
                                    placeholder="Full physical address..."
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">School Contact Number</label>
                                <input
                                    type="text"
                                    name="schoolContact"
                                    required
                                    className="input-field"
                                    placeholder="e.g. +92 300 1234567"
                                    value={formData.schoolContact}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="flex justify-end pt-4">
                                <button type="button" onClick={() => setStep(2)} className="btn btn-primary">
                                    Next Step
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="input-group">
                                <label className="input-label">Principal Name</label>
                                <input
                                    type="text"
                                    name="principalName"
                                    required
                                    className="input-field"
                                    placeholder="Full Name"
                                    value={formData.principalName}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-slate-500" size={18} />
                                    <input
                                        type="email"
                                        name="principalEmail"
                                        required
                                        className="input-field pl-10"
                                        placeholder="principal@school.com"
                                        value={formData.principalEmail}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                                    <input
                                        type="password"
                                        name="principalPassword"
                                        required
                                        className="input-field pl-10"
                                        placeholder="••••••••"
                                        value={formData.principalPassword}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Principal Contact Number</label>
                                <input
                                    type="text"
                                    name="principalContact"
                                    required
                                    className="input-field"
                                    placeholder="Personal mobile number..."
                                    value={formData.principalContact}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="flex justify-between pt-6">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="btn text-slate-400 hover:text-white"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Creating...' : (
                                        <>
                                            <Save size={18} />
                                            Create School
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default CreateSchoolModal;
