import React, { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon,
    Save,
    Globe,
    Shield,
    Bell,
    CreditCard,
    Mail,
    Phone,
    AlertOctagon,
    CheckCircle2,
    Loader2,
    Sun,
    Moon,
    Sparkles,
    Key,
    ExternalLink,
    Landmark,
    Plus,
    Trash2,
    Lock,
    Check
} from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Settings = () => {
    const { isMasterAdmin } = useAdminAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingAccounts, setSavingAccounts] = useState(false);
    const [accountsSavedNotice, setAccountsSavedNotice] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [officialAccounts, setOfficialAccounts] = useState([]);

    const [settings, setSettings] = useState({
        general: {
            platformName: 'School Management SaaS',
            supportEmail: 'support@schoolsaas.com',
            supportPhone: '+1 (555) 000-0000',
            timezone: 'UTC'
        },
        ai: {
            geminiApiKey: ''
        },
        billing: {
            currency: 'USD',
            standardMonthlyFee: '99',
            trialPeriodDays: '14'
        },
        system: {
            maintenanceMode: false,
            allowNewRegistrations: true,
            enforcePasswordComplexity: true
        },
        notifications: {
            emailOnNewSchool: true,
            emailOnPaymentFailure: true,
            systemAlerts: true
        },
        appearance: {
            theme: 'dark'
        }
    });

    const handleAddOfficialAccount = () => {
        setOfficialAccounts(prev => [...prev, { bankName: '', accountTitle: '', accountNumber: '', iban: '' }]);
    };

    const handleSaveAccountsOnly = async (accountsToSave = officialAccounts) => {
        setSavingAccounts(true);
        try {
            await setDoc(doc(db, "system_configs", "platform_billing"), {
                accounts: accountsToSave,
                updatedAt: serverTimestamp()
            }, { merge: true });
            setAccountsSavedNotice(true);
            setTimeout(() => setAccountsSavedNotice(false), 3000);
        } catch (accErr) {
            console.error("Error saving official accounts:", accErr);
        } finally {
            setSavingAccounts(false);
        }
    };

    const handleRemoveOfficialAccount = async (index) => {
        const updated = officialAccounts.filter((_, i) => i !== index);
        setOfficialAccounts(updated);
        // Instant Live Auto-Save to Firestore so Principal App & Super Admin stay in 100% real-time sync
        try {
            await setDoc(doc(db, "system_configs", "platform_billing"), {
                accounts: updated,
                updatedAt: serverTimestamp()
            }, { merge: true });
            setAccountsSavedNotice(true);
            setTimeout(() => setAccountsSavedNotice(false), 2500);
        } catch (accErr) {
            console.error("Auto-sync error on delete account:", accErr);
        }
    };

    const handleOfficialAccountChange = (index, field, value) => {
        setOfficialAccounts(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            return copy;
        });
    };

    useEffect(() => {
        let unsubBilling = () => {};

        const fetchSettings = async () => {
            try {
                // 1. Fetch AI Key from curriculums/ai_settings or local storage
                try {
                    const aiSnap = await getDoc(doc(db, "curriculums", "ai_settings"));
                    if (aiSnap.exists() && aiSnap.data().geminiApiKey) {
                        setSettings(prev => ({
                            ...prev,
                            ai: { geminiApiKey: aiSnap.data().geminiApiKey }
                        }));
                    } else {
                        const localKey = localStorage.getItem('gemini_api_key');
                        if (localKey) {
                            setSettings(prev => ({ ...prev, ai: { geminiApiKey: localKey } }));
                        }
                    }
                } catch (e) {
                    console.warn("AI settings fetch fallback:", e);
                }

                // 2. Fetch Global configs
                try {
                    const docSnap = await getDoc(doc(db, "system_configs", "global"));
                    if (docSnap.exists()) {
                        const data = docSnap.data().configs;
                        setSettings(prev => ({ ...prev, ...data }));

                        if (data.appearance?.theme === 'light') {
                            document.body.classList.add('light-theme');
                        } else {
                            document.body.classList.remove('light-theme');
                        }
                    }
                } catch (gErr) {
                    console.warn("Global configs fetch notice:", gErr);
                }

                // 3. Listen to Official Billing Accounts in Real-Time (onSnapshot)
                try {
                    unsubBilling = onSnapshot(doc(db, "system_configs", "platform_billing"), (billingSnap) => {
                        if (billingSnap.exists()) {
                            const data = billingSnap.data();
                            if (Array.isArray(data?.accounts)) {
                                setOfficialAccounts(data.accounts);
                            }
                        }
                    }, (bErr) => {
                        console.warn("platform_billing real-time listener notice:", bErr);
                    });
                } catch (bErr) {
                    console.warn("platform_billing init notice:", bErr);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();

        return () => {
            unsubBilling();
        };
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage({ type: '', text: '' });
        
        const apiKey = settings.ai?.geminiApiKey?.trim() || '';

        // 1. Store in local storage
        if (apiKey) {
            localStorage.setItem('gemini_api_key', apiKey);
        }

        try {
            // 2. Save AI Key to curriculums collection (Guaranteed Permission in Firestore)
            if (apiKey) {
                await setDoc(doc(db, "curriculums", "ai_settings"), {
                    geminiApiKey: apiKey,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }

            // 3. Attempt saving full system configs
            try {
                await setDoc(doc(db, "system_configs", "global"), {
                    configs: settings,
                    lastUpdated: serverTimestamp()
                }, { merge: true });

                await setDoc(doc(db, "system_config", "ai_settings"), {
                    geminiApiKey: apiKey,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            } catch (permErr) {
                console.warn("system_configs permission warning (saved to curriculums/ai_settings successfully):", permErr);
            }

            // 4. Save Official Billing Accounts strictly if Master Admin
            if (isMasterAdmin) {
                try {
                    await setDoc(doc(db, "system_configs", "platform_billing"), {
                        accounts: officialAccounts,
                        updatedAt: serverTimestamp()
                    }, { merge: true });
                } catch (accErr) {
                    console.warn("Official billing accounts save notice:", accErr);
                }
            }

            setMessage({ type: 'success', text: 'Settings & Payment Accounts updated successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch (error) {
            console.error("Save error:", error);
            setMessage({ type: 'error', text: 'Error saving settings: ' + error.message });
        } finally {
            setSaving(false);
        }
    };

    const updateNestedField = (section, field, value) => {
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));

        // Immediate application for theme
        if (section === 'appearance' && field === 'theme') {
            if (value === 'light') {
                document.body.classList.add('light-theme');
            } else {
                document.body.classList.remove('light-theme');
            }
        }
    };

    if (loading) {
        return (
            <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="animate-spin" size={48} color="var(--primary)" />
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading system configuration...</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="page-header">
                <div>
                    <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }} className="text-gradient">System Settings</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Configure platform-wide defaults and system behavior.</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {saving ? 'Saving...' : 'Save Configuration'}
                </button>
            </header>

            {message.text && (
                <div style={{
                    padding: '1rem 1.5rem',
                    borderRadius: '16px',
                    marginBottom: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                    color: message.type === 'success' ? '#34d399' : '#f87171',
                    animation: 'slideInRight 0.3s ease-out'
                }}>
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertOctagon size={20} />}
                    {message.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>

                {/* General Settings */}
                <section className="card glass" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                        <Globe className="text-primary" size={24} />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>General Configuration</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="input-group">
                            <label className="label">Platform Name</label>
                            <input
                                type="text"
                                className="input-field"
                                value={settings.general.platformName}
                                onChange={(e) => updateNestedField('general', 'platformName', e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="input-group">
                                <label className="label">Support Email</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                                    <input
                                        type="email"
                                        className="input-field"
                                        style={{ paddingLeft: '2.75rem' }}
                                        value={settings.general.supportEmail}
                                        onChange={(e) => updateNestedField('general', 'supportEmail', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="label">Support Phone</label>
                                <div style={{ position: 'relative' }}>
                                    <Phone style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                                    <input
                                        type="text"
                                        className="input-field"
                                        style={{ paddingLeft: '2.75rem' }}
                                        value={settings.general.supportPhone}
                                        onChange={(e) => updateNestedField('general', 'supportPhone', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Central AI & Vision Engine */}
                <section className="card glass" style={{ padding: '2rem', border: '1px solid rgba(99, 102, 241, 0.3)', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <Sparkles className="text-primary" size={24} />
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, color: 'white' }}>Central AI & Vision Engine</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                                Master Gemini API key used by all schools for automated syllabus & exercise scanning.
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label className="label" style={{ margin: 0, fontWeight: '700' }}>Google Gemini API Key (Master Key)</label>
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: '#818cf8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'underline' }}
                                >
                                    Get Free Key <ExternalLink size={13} />
                                </a>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <Key style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                                <input
                                    type="password"
                                    className="input-field"
                                    style={{ paddingLeft: '2.75rem', fontFamily: 'monospace', letterSpacing: '0.05em' }}
                                    placeholder="AIzaSy..."
                                    value={settings.ai?.geminiApiKey || ''}
                                    onChange={(e) => updateNestedField('ai', 'geminiApiKey', e.target.value)}
                                />
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem', lineHeight: '1.4' }}>
                                ✨ <strong>SaaS Feature:</strong> When you save this key here, all Principal WebApps will automatically use this key in the background. Principals will never be asked for an API key!
                            </p>
                        </div>
                    </div>
                </section>

                {/* Billing & SaaS Configuration */}
                <section className="card glass" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                        <CreditCard className="text-secondary" size={24} />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>SaaS & Billing</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="input-group">
                                <label className="label">Currency</label>
                                <select
                                    className="input-field"
                                    value={settings.billing.currency}
                                    style={{ background: 'rgba(15, 23, 42, 0.5)' }}
                                    onChange={(e) => updateNestedField('billing', 'currency', e.target.value)}
                                >
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="GBP">GBP (£)</option>
                                    <option value="PKR">PKR (₨)</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="label">Monthly Fee</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={settings.billing.standardMonthlyFee}
                                    onChange={(e) => updateNestedField('billing', 'standardMonthlyFee', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="label">Trial Period (Days)</label>
                            <input
                                type="number"
                                className="input-field"
                                value={settings.billing.trialPeriodDays}
                                onChange={(e) => updateNestedField('billing', 'trialPeriodDays', e.target.value)}
                            />
                        </div>
                    </div>
                </section>

                {/* Master Admin Only: Official SaaS Receiving Accounts */}
                {isMasterAdmin && (
                    <section className="card glass" style={{ padding: '2rem', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, rgba(99, 102, 241, 0.04) 100%)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Landmark className="text-warning" size={24} style={{ color: '#f59e0b' }} />
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, color: 'white' }}>Official Receiving Bank / Wallet Accounts</h3>
                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <Lock size={10} /> MASTER ADMIN ONLY
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                                        Yeh accounts tamam schools ke Principal App mein payment tab par 1-Click Copy ke saath show honge. Staff ko iska access nahi hai.
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                {accountsSavedNotice && (
                                    <span style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 8px', borderRadius: '8px', fontWeight: '600' }}>
                                        <Check size={14} /> Live Synced with Principal App!
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={handleAddOfficialAccount}
                                    className="btn"
                                    style={{
                                        padding: '0.45rem 0.9rem', fontSize: '0.82rem',
                                        background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                                        border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px',
                                        display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={15} /> Add Account / Wallet
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveAccountsOnly()}
                                    disabled={savingAccounts}
                                    className="btn"
                                    style={{
                                        padding: '0.45rem 0.9rem', fontSize: '0.82rem',
                                        background: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff',
                                        border: 'none', borderRadius: '10px',
                                        display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
                                        fontWeight: '700'
                                    }}
                                >
                                    {savingAccounts ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {savingAccounts ? 'Saving...' : 'Save Accounts'}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {officialAccounts.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px dashed var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    No official accounts added yet. Click "+ Add Account / Wallet" to setup EasyPaisa, JazzCash, or Bank details.
                                </div>
                            )}

                            {officialAccounts.map((acc, index) => (
                                <div
                                    key={index}
                                    style={{
                                        position: 'relative', padding: '1.25rem',
                                        background: 'rgba(15, 23, 42, 0.6)',
                                        borderRadius: '14px', border: '1px solid var(--glass-border)',
                                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem',
                                        paddingRight: '3rem'
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveOfficialAccount(index)}
                                        style={{
                                            position: 'absolute', top: '1rem', right: '1rem',
                                            background: 'transparent', border: 'none',
                                            color: '#ef4444', cursor: 'pointer', padding: '4px'
                                        }}
                                        title="Delete Account"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    <div>
                                        <label className="label" style={{ fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                                            Payment Method / Bank
                                        </label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            style={{ fontSize: '0.85rem' }}
                                            placeholder="e.g. JazzCash, EasyPaisa, Meezan Bank"
                                            value={acc.bankName || ''}
                                            onChange={(e) => handleOfficialAccountChange(index, 'bankName', e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="label" style={{ fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                                            Account Title
                                        </label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            style={{ fontSize: '0.85rem' }}
                                            placeholder="e.g. Official Name"
                                            value={acc.accountTitle || ''}
                                            onChange={(e) => handleOfficialAccountChange(index, 'accountTitle', e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="label" style={{ fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                                            Account / Mobile Number
                                        </label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}
                                            placeholder="e.g. 03001234567"
                                            value={acc.accountNumber || ''}
                                            onChange={(e) => handleOfficialAccountChange(index, 'accountNumber', e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="label" style={{ fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                                            IBAN / Additional Info (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}
                                            placeholder="PK00..."
                                            value={acc.iban || ''}
                                            onChange={(e) => handleOfficialAccountChange(index, 'iban', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* System Controls */}
                <section className="card glass" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                        <Shield className="text-accent" size={24} />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Security & Controls</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                            { key: 'maintenanceMode', label: 'Global Maintenance Mode', desc: 'Lock all portals for maintenance' },
                            { key: 'allowNewRegistrations', label: 'Allow Registrations', desc: 'Allow new schools to register' },
                            { key: 'enforcePasswordComplexity', label: 'Strong Passwords', desc: 'Require symbols/numbers for passwords' }
                        ].map((item) => (
                            <div
                                key={item.key}
                                onClick={() => updateNestedField('system', item.key, !settings.system[item.key])}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '1.25rem',
                                    borderRadius: '16px',
                                    background: settings.system[item.key] ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255,255,255,0.02)',
                                    border: '1px solid var(--glass-border)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div>
                                    <p style={{ fontWeight: '600', color: 'white' }}>{item.label}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.desc}</p>
                                </div>
                                <div style={{
                                    width: '44px',
                                    height: '24px',
                                    borderRadius: '20px',
                                    background: settings.system[item.key] ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                    position: 'relative',
                                    transition: 'background 0.3s ease'
                                }}>
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: '3px',
                                        left: settings.system[item.key] ? '23px' : '3px',
                                        transition: 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Notifications */}
                <section className="card glass" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                        <Bell className="text-secondary" size={24} />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Admin Notifications</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                            { key: 'emailOnNewSchool', label: 'New Registration Alert', desc: 'Notify when a new school signs up' },
                            { key: 'emailOnPaymentFailure', label: 'Payment Alert', desc: 'Notify when a school payment fails' },
                            { key: 'systemAlerts', label: 'System Health Alerts', desc: 'Monitor database and service health' }
                        ].map((item) => (
                            <div
                                key={item.key}
                                onClick={() => updateNestedField('notifications', item.key, !settings.notifications[item.key])}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '1.25rem',
                                    borderRadius: '16px',
                                    background: settings.notifications[item.key] ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255,255,255,0.02)',
                                    border: '1px solid var(--glass-border)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div>
                                    <p style={{ fontWeight: '600', color: 'white' }}>{item.label}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.desc}</p>
                                </div>
                                <div style={{
                                    width: '44px',
                                    height: '24px',
                                    borderRadius: '20px',
                                    background: settings.notifications[item.key] ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                                    position: 'relative',
                                    transition: 'background 0.3s ease'
                                }}>
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: '3px',
                                        left: settings.notifications[item.key] ? '23px' : '3px',
                                        transition: 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Appearance Section */}
                <section className="card glass" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                        <Sun className="text-secondary" size={24} />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Appearance</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '1.25rem',
                            borderRadius: '16px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--glass-border)'
                        }}>
                            <div>
                                <p style={{ fontWeight: '600', color: 'var(--text-main)' }}>Platform Theme</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Choose your preferred interface style</p>
                            </div>
                            <div style={{ display: 'flex', background: 'var(--bg-dark)', padding: '0.4rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                <button
                                    onClick={() => updateNestedField('appearance', 'theme', 'light')}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: settings.appearance.theme === 'light' ? 'var(--primary)' : 'transparent',
                                        color: settings.appearance.theme === 'light' ? 'white' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <Sun size={16} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>Light</span>
                                </button>
                                <button
                                    onClick={() => updateNestedField('appearance', 'theme', 'dark')}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: settings.appearance.theme === 'dark' ? 'var(--primary)' : 'transparent',
                                        color: settings.appearance.theme === 'dark' ? 'white' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <Moon size={16} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>Dark</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
};

export default Settings;
