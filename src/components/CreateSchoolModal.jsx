import React, { useState } from 'react';
import { X, Save, Shield, School, Mail, Lock, Sparkles, Crown, Bus, Tv } from 'lucide-react';
import { db, auth, functions } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const CreateSchoolModal = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        schoolName: '',
        state: 'Punjab',
        district: '',
        city: '',
        address: '',
        schoolContact: '',
        package: 'standard',
        modules: {
            transport: false,
            surveillance: false,
            paperGenerator: false,
            store: false
        },
        principalName: '',
        principalEmail: '',
        principalPassword: '',
        principalContact: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePackageChange = (pkg) => {
        setFormData({
            ...formData,
            package: pkg,
            modules: pkg === 'premium' ? {
                transport: true,
                surveillance: true,
                paperGenerator: true,
                store: true
            } : {
                transport: false,
                surveillance: false,
                paperGenerator: false,
                store: false
            }
        });
    };

    const handleModuleToggle = (moduleKey) => {
        setFormData({
            ...formData,
            modules: {
                ...formData.modules,
                [moduleKey]: !formData.modules[moduleKey]
            }
        });
    };

    const handleNextStep = () => {
        if (!formData.schoolName || !formData.state || !formData.district || !formData.city || !formData.address || !formData.schoolContact) {
            setError("Please fill in all required fields (School Name, State, District, City, Address, and Contact).");
            return;
        }
        setError(null);
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            console.log("Starting account creation via Cloud Function...", formData.principalEmail);

            const createSchool = httpsCallable(functions, 'createSchool');
            const result = await createSchool({
                schoolName: formData.schoolName,
                state: formData.state,
                district: formData.district,
                city: formData.city,
                address: formData.address,
                contact: formData.schoolContact,
                package: formData.package,
                modules: formData.modules,
                principalName: formData.principalName,
                principalEmail: formData.principalEmail,
                principalPassword: formData.principalPassword,
                principalContact: formData.principalContact
            });

            console.log("School Created:", result.data);

            const schoolCode = result.data?.schoolId || result.data?.id || "Unknown";
            console.log(`Success! ${formData.schoolName} created with ID: ${schoolCode}`);
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
            <div className="card glass w-full max-w-lg relative animate-in fade-in zoom-in duration-300" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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
                                <label className="input-label">School Name *</label>
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
                                <label className="input-label">State / Province *</label>
                                <select
                                    name="state"
                                    required
                                    className="input-field"
                                    value={formData.state}
                                    onChange={handleChange}
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
                                <div className="input-group">
                                    <label className="input-label">District *</label>
                                    <input
                                        type="text"
                                        name="district"
                                        required
                                        className="input-field"
                                        placeholder="e.g. Rawalpindi, Lahore..."
                                        value={formData.district}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">City *</label>
                                    <input
                                        type="text"
                                        name="city"
                                        required
                                        className="input-field"
                                        placeholder="e.g. Taxila, Gujar Khan..."
                                        value={formData.city}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Full Physical Address *</label>
                                <textarea
                                    name="address"
                                    required
                                    className="input-field"
                                    rows="2"
                                    placeholder="Street address, building, postal code..."
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">School Contact Number *</label>
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

                            {/* SaaS Subscription Package Selector */}
                            <div style={{
                                marginTop: '1.25rem',
                                padding: '1.25rem',
                                borderRadius: '18px',
                                background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
                                    <label style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                        <Crown size={18} color="#fbbf24" />
                                        Subscription Tier & Access
                                    </label>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: '800',
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '9999px',
                                        background: formData.package === 'premium' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(99, 102, 241, 0.25)',
                                        color: formData.package === 'premium' ? '#fde047' : '#c7d2fe',
                                        border: formData.package === 'premium' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(99, 102, 241, 0.5)'
                                    }}>
                                        {formData.package === 'premium' ? '⭐ Premium Pro' : 'Standard Tier'}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                                    {/* Standard Button */}
                                    <button
                                        type="button"
                                        onClick={() => handlePackageChange('standard')}
                                        style={{
                                            padding: '1rem 0.9rem',
                                            borderRadius: '14px',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                            background: formData.package === 'standard'
                                                ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)'
                                                : 'rgba(30, 41, 59, 0.85)',
                                            border: formData.package === 'standard'
                                                ? '2px solid #818cf8'
                                                : '1px solid rgba(255, 255, 255, 0.1)',
                                            boxShadow: formData.package === 'standard'
                                                ? '0 8px 20px -3px rgba(79, 70, 229, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                                                : 'none',
                                            transform: formData.package === 'standard' ? 'translateY(-2px)' : 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                            <span style={{ fontWeight: '800', fontSize: '1rem', color: '#ffffff' }}>Standard</span>
                                            <Sparkles size={18} color={formData.package === 'standard' ? '#ffffff' : '#94a3b8'} />
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: formData.package === 'standard' ? '#e0e7ff' : '#94a3b8', margin: 0, lineHeight: 1.35, fontWeight: '500' }}>
                                            Core ERP, LMS, Fees, Exams & Notices
                                        </p>
                                    </button>

                                    {/* Premium Button */}
                                    <button
                                        type="button"
                                        onClick={() => handlePackageChange('premium')}
                                        style={{
                                            padding: '1rem 0.9rem',
                                            borderRadius: '14px',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                            background: formData.package === 'premium'
                                                ? 'linear-gradient(135deg, #d97706 0%, #92400e 100%)'
                                                : 'rgba(30, 41, 59, 0.85)',
                                            border: formData.package === 'premium'
                                                ? '2px solid #fbbf24'
                                                : '1px solid rgba(255, 255, 255, 0.1)',
                                            boxShadow: formData.package === 'premium'
                                                ? '0 8px 20px -3px rgba(217, 119, 6, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                                                : 'none',
                                            transform: formData.package === 'premium' ? 'translateY(-2px)' : 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                            <span style={{ fontWeight: '800', fontSize: '1rem', color: '#ffffff' }}>Premium Pro</span>
                                            <Crown size={18} color={formData.package === 'premium' ? '#fde047' : '#94a3b8'} />
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: formData.package === 'premium' ? '#fef3c7' : '#94a3b8', margin: 0, lineHeight: 1.35, fontWeight: '500' }}>
                                            All Features + Fleet Hub & CCTV
                                        </p>
                                    </button>
                                </div>

                                {/* Granular Add-on Switches with Modern Toggle Pills */}
                                <div style={{
                                    background: 'rgba(15, 23, 42, 0.7)',
                                    borderRadius: '14px',
                                    padding: '0.9rem',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.65rem'
                                }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.06em' }}>
                                        Active Add-on Modules:
                                    </div>

                                    {/* Transport Switch */}
                                    <div
                                        onClick={() => handleModuleToggle('transport')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.6rem 0.75rem',
                                            borderRadius: '10px',
                                            background: formData.modules.transport ? 'rgba(245, 158, 11, 0.12)' : 'rgba(30, 41, 59, 0.5)',
                                            border: formData.modules.transport ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '8px',
                                                background: 'rgba(245, 158, 11, 0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Bus size={18} color="#fbbf24" />
                                            </div>
                                            <div>
                                                <div style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: '700' }}>Transport & Van Fleet Hub</div>
                                                <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Live GPS bus map & driver tracking</div>
                                            </div>
                                        </div>
                                        {/* Custom Modern Switch */}
                                        <div style={{
                                            width: '44px',
                                            height: '24px',
                                            borderRadius: '9999px',
                                            background: formData.modules.transport ? '#10b981' : '#334155',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: formData.modules.transport ? 'flex-end' : 'flex-start',
                                            transition: 'all 0.25s ease',
                                            boxShadow: formData.modules.transport ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none'
                                        }}>
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                background: '#ffffff',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                            }} />
                                        </div>
                                    </div>

                                    {/* Surveillance Switch */}
                                    <div
                                        onClick={() => handleModuleToggle('surveillance')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.6rem 0.75rem',
                                            borderRadius: '10px',
                                            background: formData.modules.surveillance ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                                            border: formData.modules.surveillance ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(255, 255, 255, 0.05)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '8px',
                                                background: 'rgba(99, 102, 241, 0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Tv size={18} color="#818cf8" />
                                            </div>
                                            <div>
                                                <div style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: '700' }}>Live CCTV Surveillance</div>
                                                <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Multi-camera live campus streams</div>
                                            </div>
                                        </div>
                                        {/* Custom Modern Switch */}
                                        <div style={{
                                            width: '44px',
                                            height: '24px',
                                            borderRadius: '9999px',
                                            background: formData.modules.surveillance ? '#10b981' : '#334155',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: formData.modules.surveillance ? 'flex-end' : 'flex-start',
                                            transition: 'all 0.25s ease',
                                            boxShadow: formData.modules.surveillance ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none'
                                        }}>
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                background: '#ffffff',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button type="button" onClick={handleNextStep} className="btn btn-primary">
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
