import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Shield, School, Mail, Lock, Sparkles, Crown, Bus, Tv, Check, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { db, auth, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

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

    const validateStep1 = () => {
        if (!formData.schoolName.trim()) return "Please enter the School Name.";
        if (!formData.state.trim()) return "Please select a State / Province.";
        if (!formData.district.trim()) return "Please enter the District.";
        if (!formData.city.trim()) return "Please enter the City.";
        if (!formData.address.trim()) return "Please enter the Full Physical Address.";
        if (!formData.schoolContact.trim()) return "Please enter the School Contact Number.";
        return null;
    };

    const validateStep3 = () => {
        if (!formData.principalName.trim()) return "Please enter the Principal's Name.";
        if (!formData.principalEmail.trim()) return "Please enter a valid Principal Email.";
        if (!formData.principalPassword || formData.principalPassword.length < 6) return "Password must be at least 6 characters.";
        if (!formData.principalContact.trim()) return "Please enter the Principal's Mobile Contact.";
        return null;
    };

    const handleNext = () => {
        setError(null);
        if (step === 1) {
            const err = validateStep1();
            if (err) {
                setError(err);
                return;
            }
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        }
    };

    const handleBack = () => {
        setError(null);
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const err1 = validateStep1();
        if (err1) {
            setError(err1);
            setStep(1);
            return;
        }

        const err3 = validateStep3();
        if (err3) {
            setError(err3);
            setStep(3);
            return;
        }

        setLoading(true);

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

    const xpFont = "'Segoe UI', Tahoma, Verdana, sans-serif";

    // Use createPortal to mount directly on document.body, escaping ANY parent layout, container or animation transforms
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
                zIndex: 9999999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(5px)',
                padding: '20px',
                boxSizing: 'border-box',
                fontFamily: xpFont,
                overflowY: 'auto'
            }}
        >
            {/* Windows XP Dialog Frame - positioned with comfortable center balance */}
            <div
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside dialog
                style={{
                    width: '100%',
                    maxWidth: '750px',
                    backgroundColor: '#ECE9D8',
                    border: '3px solid #0055ea',
                    borderRadius: '8px 8px 4px 4px',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(0,0,0,0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    margin: 'auto',
                    marginTop: '40px', // Shifted slightly down so it never hits the top
                    marginBottom: '40px',
                    animation: 'xpDialogAppear 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                <style>{`
                    @keyframes xpDialogAppear {
                        from { opacity: 0; transform: scale(0.96) translateY(12px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    .xp-btn {
                        font-family: 'Segoe UI', Tahoma, Verdana, sans-serif;
                        font-size: 13px;
                        font-weight: 600;
                        padding: 6px 18px;
                        border-radius: 3px;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 7px;
                        border: 1px solid #707070;
                        background: linear-gradient(180deg, #FFFFFF 0%, #ECE9D8 50%, #D8D2BD 100%);
                        color: #111827;
                        box-shadow: inset 1px 1px 0px #FFFFFF, 1px 1px 2px rgba(0,0,0,0.25);
                        transition: all 0.1s ease;
                        user-select: none;
                    }
                    .xp-btn:hover {
                        border-color: #3C7FB1;
                        background: linear-gradient(180deg, #FFFFFF 0%, #E3EFFF 50%, #BED8F6 100%);
                    }
                    .xp-btn:active {
                        box-shadow: inset 1px 1px 4px rgba(0,0,0,0.35);
                        background: linear-gradient(180deg, #BED8F6 0%, #E3EFFF 100%);
                    }
                    .xp-btn-primary {
                        border: 1px solid #003c74;
                        background: linear-gradient(180deg, #3884ff 0%, #175fd8 50%, #0c4cb8 100%);
                        color: #FFFFFF;
                        box-shadow: inset 1px 1px 0px rgba(255,255,255,0.4), 1px 1px 3px rgba(0,0,0,0.3);
                    }
                    .xp-btn-primary:hover {
                        border-color: #002d5a;
                        background: linear-gradient(180deg, #4d92ff 0%, #206bee 50%, #1059cf 100%);
                    }
                    .xp-input {
                        width: 100%;
                        box-sizing: border-box;
                        background: #FFFFFF;
                        border: 1px solid #7F9DB9;
                        border-radius: 2px;
                        padding: 8px 11px;
                        font-size: 13.5px;
                        color: #111827;
                        outline: none;
                        font-family: inherit;
                        transition: border-color 0.15s, box-shadow 0.15s;
                    }
                    .xp-input:focus {
                        border-color: #185ABD;
                        box-shadow: 0 0 0 2px rgba(24, 90, 189, 0.25);
                    }
                    .xp-fieldset {
                        border: 1px solid #C5C0B8;
                        border-radius: 4px;
                        padding: 14px 16px 16px 16px;
                        margin-bottom: 14px;
                        background: #F4F2E8;
                    }
                    .xp-legend {
                        font-size: 12px;
                        font-weight: 700;
                        color: #003399;
                        padding: 0 8px;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                    }
                    .xp-tab {
                        padding: 7px 16px;
                        font-size: 12.5px;
                        font-weight: 700;
                        border-radius: 4px 4px 0 0;
                        cursor: pointer;
                        user-select: none;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        border-top: 2px solid transparent;
                        border-left: 1px solid transparent;
                        border-right: 1px solid transparent;
                    }
                    .xp-tab-active {
                        background: #ECE9D8;
                        border-top: 2px solid #E68B2C;
                        border-left: 1px solid #999;
                        border-right: 1px solid #999;
                        border-bottom: 1px solid #ECE9D8;
                        color: #003399;
                        margin-bottom: -1px;
                        z-index: 2;
                    }
                    .xp-tab-inactive {
                        background: #D8D4C4;
                        border: 1px solid #B0ABA0;
                        border-bottom: 1px solid #999;
                        color: #555555;
                    }
                `}</style>

                {/* 1. Classic Windows XP Luna Blue Title Bar */}
                <div
                    style={{
                        height: '34px',
                        background: 'linear-gradient(180deg, #2b70f0 0%, #1e56cb 12%, #0042b3 88%, #0036a1 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 8px 0 12px',
                        userSelect: 'none',
                        borderBottom: '1px solid #002d9c'
                    }}
                >
                    {/* Window Icon & Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                            style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '3px',
                                background: 'linear-gradient(135deg, #FFB703, #FB8500)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                            }}
                        >
                            <School size={13} color="#FFFFFF" />
                        </div>
                        <span
                            style={{
                                color: '#FFFFFF',
                                fontSize: '13.5px',
                                fontWeight: '700',
                                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.65)',
                                letterSpacing: '0.01em'
                            }}
                        >
                            Register New School — Windows Setup
                        </span>
                    </div>

                    {/* Window Control Buttons (_ □ ✕) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <button
                            type="button"
                            title="Minimize"
                            style={{
                                width: '21px',
                                height: '21px',
                                borderRadius: '3px',
                                border: '1px solid #002878',
                                background: 'linear-gradient(180deg, #387BEE 0%, #1B58C7 50%, #003EB0 100%)',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'default',
                                paddingBottom: '4px'
                            }}
                        >
                            _
                        </button>
                        <button
                            type="button"
                            title="Maximize"
                            style={{
                                width: '21px',
                                height: '21px',
                                borderRadius: '3px',
                                border: '1px solid #002878',
                                background: 'linear-gradient(180deg, #387BEE 0%, #1B58C7 50%, #003EB0 100%)',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                cursor: 'default'
                            }}
                        >
                            □
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            title="Close"
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
                                cursor: 'pointer',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)'
                            }}
                        >
                            <X size={13} strokeWidth={3} />
                        </button>
                    </div>
                </div>

                {/* 2. Classic XP Dialog Tabs */}
                <div
                    style={{
                        padding: '10px 14px 0 14px',
                        display: 'flex',
                        gap: '4px',
                        borderBottom: '1px solid #999',
                        backgroundColor: '#ECE9D8'
                    }}
                >
                    <div
                        onClick={() => setStep(1)}
                        className={`xp-tab ${step === 1 ? 'xp-tab-active' : 'xp-tab-inactive'}`}
                    >
                        <School size={14} /> 1. School Profile
                    </div>
                    <div
                        onClick={() => {
                            const err = validateStep1();
                            if (!err) setStep(2);
                            else setError(err);
                        }}
                        className={`xp-tab ${step === 2 ? 'xp-tab-active' : 'xp-tab-inactive'}`}
                    >
                        <Crown size={14} /> 2. Packages & Add-ons
                    </div>
                    <div
                        onClick={() => {
                            const err = validateStep1();
                            if (!err) setStep(3);
                            else setError(err);
                        }}
                        className={`xp-tab ${step === 3 ? 'xp-tab-active' : 'xp-tab-inactive'}`}
                    >
                        <Shield size={14} /> 3. Principal Admin
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div
                        style={{
                            margin: '10px 16px 0 16px',
                            padding: '8px 12px',
                            backgroundColor: '#FEF2F2',
                            border: '1px solid #F87171',
                            borderRadius: '3px',
                            color: '#991B1B',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <AlertCircle size={16} color="#DC2626" />
                        <span>{error}</span>
                    </div>
                )}

                {/* 3. Dialog Content Area */}
                <form onSubmit={handleSubmit} style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                    <div
                        style={{
                            padding: '16px',
                            maxHeight: '58vh',
                            overflowY: 'auto',
                            backgroundColor: '#ECE9D8'
                        }}
                    >
                        {/* TAB 1: School Profile */}
                        {step === 1 && (
                            <div>
                                <fieldset className="xp-fieldset">
                                    <legend className="xp-legend">Institutional Profile</legend>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                                                School / Campus Name <span style={{ color: '#DC2626' }}>*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="schoolName"
                                                className="xp-input"
                                                placeholder="e.g. Springfield Academy"
                                                value={formData.schoolName}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                                                Official Contact Phone <span style={{ color: '#DC2626' }}>*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="schoolContact"
                                                className="xp-input"
                                                placeholder="e.g. 051-1234567 / 0300-1234567"
                                                value={formData.schoolContact}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                </fieldset>

                                <fieldset className="xp-fieldset">
                                    <legend className="xp-legend">Location & Campus Address</legend>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                                                    Province / State <span style={{ color: '#DC2626' }}>*</span>
                                                </label>
                                                <select
                                                    name="state"
                                                    className="xp-input"
                                                    value={formData.state}
                                                    onChange={handleChange}
                                                    required
                                                    style={{ cursor: 'pointer' }}
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

                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                                                    District <span style={{ color: '#DC2626' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="district"
                                                    className="xp-input"
                                                    placeholder="e.g. Rawalpindi, Lahore"
                                                    value={formData.district}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                                                    City / Tehsil <span style={{ color: '#DC2626' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="city"
                                                    className="xp-input"
                                                    placeholder="e.g. Taxila, Gujar Khan"
                                                    value={formData.city}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                                                Physical Campus Address <span style={{ color: '#DC2626' }}>*</span>
                                            </label>
                                            <textarea
                                                name="address"
                                                className="xp-input"
                                                rows={2}
                                                placeholder="Street address, building name, landmark..."
                                                value={formData.address}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                </fieldset>
                            </div>
                        )}

                        {/* TAB 2: Packages & Modules */}
                        {step === 2 && (
                            <div>
                                <fieldset className="xp-fieldset">
                                    <legend className="xp-legend">Deployment Tier</legend>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {/* Standard Package */}
                                        <div
                                            onClick={() => handlePackageChange('standard')}
                                            style={{
                                                border: formData.package === 'standard' ? '2px solid #0055EA' : '1px solid #B0ABA0',
                                                backgroundColor: formData.package === 'standard' ? '#E1ECFA' : '#E8E5D5',
                                                borderRadius: '4px',
                                                padding: '12px 14px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '800', color: '#003399' }}>Standard Tier</span>
                                                <Sparkles size={16} color="#0055EA" />
                                            </div>
                                            <p style={{ margin: 0, fontSize: '11.5px', color: '#4B5563', lineHeight: 1.4 }}>
                                                Student LMS, Fees, Attendance, Exams, Report Cards & Staff Notices.
                                            </p>
                                        </div>

                                        {/* Premium Package */}
                                        <div
                                            onClick={() => handlePackageChange('premium')}
                                            style={{
                                                border: formData.package === 'premium' ? '2px solid #D97706' : '1px solid #B0ABA0',
                                                backgroundColor: formData.package === 'premium' ? '#FDF5E6' : '#E8E5D5',
                                                borderRadius: '4px',
                                                padding: '12px 14px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '800', color: '#92400E' }}>Premium Pro ⭐</span>
                                                <Crown size={16} color="#D97706" />
                                            </div>
                                            <p style={{ margin: 0, fontSize: '11.5px', color: '#4B5563', lineHeight: 1.4 }}>
                                                All Core Features + Live Transport GPS Hub + Multi-camera CCTV Streams.
                                            </p>
                                        </div>
                                    </div>
                                </fieldset>

                                <fieldset className="xp-fieldset">
                                    <legend className="xp-legend">Hardware & IoT Modules</legend>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Transport Toggle */}
                                        <div
                                            onClick={() => handleModuleToggle('transport')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '9px 12px',
                                                backgroundColor: formData.modules.transport ? '#E6F4EA' : '#EAE7D8',
                                                border: formData.modules.transport ? '1px solid #34A853' : '1px solid #B8B3A8',
                                                borderRadius: '3px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ padding: '6px', borderRadius: '4px', background: '#FEEFC3', color: '#B06000' }}>
                                                    <Bus size={16} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1F2937' }}>Transport & Van Fleet GPS</div>
                                                    <div style={{ fontSize: '11px', color: '#6B7280' }}>Real-time GPS bus tracking and parent route notifications</div>
                                                </div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={!!formData.modules.transport}
                                                onChange={() => {}}
                                                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#16A34A' }}
                                            />
                                        </div>

                                        {/* CCTV Toggle */}
                                        <div
                                            onClick={() => handleModuleToggle('surveillance')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '9px 12px',
                                                backgroundColor: formData.modules.surveillance ? '#E6F4EA' : '#EAE7D8',
                                                border: formData.modules.surveillance ? '1px solid #34A853' : '1px solid #B8B3A8',
                                                borderRadius: '3px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ padding: '6px', borderRadius: '4px', background: '#E8EAED', color: '#1A73E8' }}>
                                                    <Tv size={16} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1F2937' }}>Live CCTV Campus Surveillance</div>
                                                    <div style={{ fontSize: '11px', color: '#6B7280' }}>Multi-camera live classroom & gate streams</div>
                                                </div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={!!formData.modules.surveillance}
                                                onChange={() => {}}
                                                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#16A34A' }}
                                            />
                                        </div>
                                    </div>
                                </fieldset>
                            </div>
                        )}

                        {/* TAB 3: Principal Account */}
                        {step === 3 && (
                            <div>
                                <fieldset className="xp-fieldset">
                                    <legend className="xp-legend">Administrator Credentials</legend>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                                                    Principal Full Name <span style={{ color: '#DC2626' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="principalName"
                                                    className="xp-input"
                                                    placeholder="e.g. Prof. Muhammad Tariq"
                                                    value={formData.principalName}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                                                    Principal Contact <span style={{ color: '#DC2626' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="principalContact"
                                                    className="xp-input"
                                                    placeholder="e.g. 0300-9876543"
                                                    value={formData.principalContact}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                                                    Principal Email <span style={{ color: '#DC2626' }}>*</span>
                                                </label>
                                                <input
                                                    type="email"
                                                    name="principalEmail"
                                                    className="xp-input"
                                                    placeholder="principal@school.edu.pk"
                                                    value={formData.principalEmail}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                                                    Login Password <span style={{ color: '#DC2626' }}>*</span>
                                                </label>
                                                <input
                                                    type="password"
                                                    name="principalPassword"
                                                    className="xp-input"
                                                    placeholder="Min. 6 characters"
                                                    value={formData.principalPassword}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>

                                <div
                                    style={{
                                        backgroundColor: '#E1ECFA',
                                        border: '1px solid #7F9DB9',
                                        borderRadius: '3px',
                                        padding: '10px 14px',
                                        fontSize: '11.5px',
                                        color: '#003399',
                                        lineHeight: 1.5
                                    }}
                                >
                                    <strong>Ready to Register:</strong> <strong>{formData.schoolName || 'School'}</strong> ({formData.city || 'City'}, {formData.state}) will be created under <strong>{formData.package === 'premium' ? 'Premium Pro Tier' : 'Standard Tier'}</strong> with instant admin portal access.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. Classic XP Sunken Action Footer */}
                    <div
                        style={{
                            backgroundColor: '#ECE9D8',
                            borderTop: '1px solid #999',
                            boxShadow: 'inset 0 1px 0 #FFFFFF',
                            padding: '10px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        <div style={{ fontSize: '11.5px', color: '#555555', fontWeight: '600' }}>
                            Step {step} of 3
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                className="xp-btn"
                                disabled={loading}
                            >
                                Cancel
                            </button>

                            {step > 1 && (
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="xp-btn"
                                    disabled={loading}
                                >
                                    <ChevronLeft size={14} /> Back
                                </button>
                            )}

                            {step < 3 ? (
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="xp-btn xp-btn-primary"
                                >
                                    Next <ChevronRight size={14} />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className="xp-btn xp-btn-primary"
                                    disabled={loading}
                                    style={{
                                        background: loading ? '#888' : 'linear-gradient(180deg, #16A34A 0%, #15803D 50%, #166534 100%)',
                                        borderColor: '#14532D'
                                    }}
                                >
                                    {loading ? 'Creating...' : (
                                        <>
                                            <Check size={14} strokeWidth={3} /> Finish & Register
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default CreateSchoolModal;
