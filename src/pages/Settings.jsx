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
                // 1. Fetch AI Key
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
                    }
                } catch (gErr) {
                    console.warn("Global configs fetch notice:", gErr);
                }

                // 3. Listen to official accounts
                const billRef = doc(db, "system_configs", "platform_billing");
                unsubBilling = onSnapshot(billRef, (billSnap) => {
                    if (billSnap.exists() && billSnap.data()?.accounts) {
                        setOfficialAccounts(billSnap.data().accounts);
                    }
                }, (bErr) => {
                    console.warn("Billing listener notice:", bErr);
                });

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

        try {
            // Save global settings
            await setDoc(doc(db, "system_configs", "global"), {
                configs: settings,
                updatedAt: serverTimestamp()
            });

            // Save AI Key
            if (settings.ai?.geminiApiKey) {
                localStorage.setItem('gemini_api_key', settings.ai.geminiApiKey);
                try {
                    await setDoc(doc(db, "curriculums", "ai_settings"), {
                        geminiApiKey: settings.ai.geminiApiKey,
                        updatedAt: serverTimestamp()
                    }, { merge: true });
                } catch (aiErr) {
                    console.warn("AI remote settings notice:", aiErr);
                }
            }

            // Save official accounts
            await setDoc(doc(db, "system_configs", "platform_billing"), {
                accounts: officialAccounts,
                updatedAt: serverTimestamp()
            }, { merge: true });

            setMessage({ type: 'success', text: 'Settings saved successfully!' });
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
    };

    const fontFamily = "'Segoe UI', Tahoma, Verdana, sans-serif";

    if (loading) {
        return (
            <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Loader2 className="animate-spin" size={36} color="#2563EB" />
                <span style={{ fontSize: '13px', color: '#64748B' }}>Loading system configuration...</span>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-300" style={{ fontFamily: fontFamily }}>
            <style>{`
                .win-btn {
                    font-family: inherit;
                    font-size: 12.5px;
                    font-weight: 600;
                    padding: 6px 14px;
                    border-radius: 4px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    border: 1px solid #CBD5E1;
                    background: #FFFFFF;
                    color: #334155;
                    transition: all 0.15s ease;
                }
                .win-btn:hover {
                    background: #F1F5F9;
                    border-color: #94A3B8;
                }
                .win-btn-primary {
                    border: 1px solid #1D4ED8;
                    background: linear-gradient(180deg, #3B82F6 0%, #2563EB 50%, #1D4ED8 100%);
                    color: #FFFFFF;
                    box-shadow: 0 1px 2px rgba(37, 99, 235, 0.3);
                }
                .win-btn-primary:hover {
                    background: linear-gradient(180deg, #60A5FA 0%, #3B82F6 50%, #2563EB 100%);
                }
                .win-fieldset {
                    border: 1px solid #CBD5E1;
                    border-radius: 6px;
                    padding: 16px 18px;
                    margin-bottom: 16px;
                    background: #FFFFFF;
                }
                .win-legend {
                    font-size: 12px;
                    font-weight: 700;
                    color: #1E40AF;
                    padding: 0 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .win-input {
                    width: 100%;
                    box-sizing: border-box;
                    background: #FFFFFF;
                    border: 1px solid #94A3B8;
                    border-radius: 3px;
                    padding: 7px 10px;
                    font-size: 13px;
                    color: #1E293B;
                    outline: none;
                    font-family: inherit;
                }
                .win-input:focus {
                    border-color: #2563EB;
                    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
                }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                        System Settings & Control Panel
                    </h2>
                    <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '2px 0 0 0' }}>
                        Configure platform defaults, official payment methods, and operational policies.
                    </p>
                </div>

                <button
                    className="win-btn win-btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ padding: '7px 18px' }}
                >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
                </button>
            </div>

            {/* Notice Message Banner */}
            {message.text && (
                <div style={{
                    padding: '10px 14px',
                    borderRadius: '4px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: message.type === 'success' ? '#DEF7EC' : '#FEF2F2',
                    border: `1px solid ${message.type === 'success' ? '#84E1BC' : '#FCA5A5'}`,
                    color: message.type === 'success' ? '#03543F' : '#991B1B',
                    fontSize: '13px',
                    fontWeight: '600'
                }}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertOctagon size={16} />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Settings Sections Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
                {/* 1. General Configuration */}
                <fieldset className="win-fieldset">
                    <legend className="win-legend">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Globe size={14} /> General Platform Settings
                        </span>
                    </legend>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                Platform / Application Name
                            </label>
                            <input
                                type="text"
                                className="win-input"
                                value={settings.general.platformName}
                                onChange={(e) => updateNestedField('general', 'platformName', e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                    Support Email Address
                                </label>
                                <input
                                    type="email"
                                    className="win-input"
                                    value={settings.general.supportEmail}
                                    onChange={(e) => updateNestedField('general', 'supportEmail', e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                    Official Support Phone
                                </label>
                                <input
                                    type="text"
                                    className="win-input"
                                    value={settings.general.supportPhone}
                                    onChange={(e) => updateNestedField('general', 'supportPhone', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </fieldset>

                {/* 2. AI Intelligence (Gemini Key) */}
                <fieldset className="win-fieldset">
                    <legend className="win-legend">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkles size={14} color="#7C3AED" /> AI Engine Configuration
                        </span>
                    </legend>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                                Google Gemini API Key
                            </label>
                            <input
                                type="password"
                                className="win-input"
                                placeholder="AIzaSy..."
                                value={settings.ai?.geminiApiKey || ''}
                                onChange={(e) => updateNestedField('ai', 'geminiApiKey', e.target.value)}
                            />
                        </div>
                        <p style={{ margin: 0, fontSize: '11.5px', color: '#64748B' }}>
                            Used by Paper Generator and Automated School Insights across school portals.
                        </p>
                    </div>
                </fieldset>

                {/* 3. Security & System Policies */}
                <fieldset className="win-fieldset">
                    <legend className="win-legend">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Shield size={14} color="#16A34A" /> System & Security Policies
                        </span>
                    </legend>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                            <div>
                                <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1F2937' }}>System Maintenance Mode</div>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>Temporarily locks all client school portals for database upgrades</div>
                            </div>
                            <input
                                type="checkbox"
                                checked={!!settings.system.maintenanceMode}
                                onChange={(e) => updateNestedField('system', 'maintenanceMode', e.target.checked)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563EB' }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                            <div>
                                <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1F2937' }}>Allow New School Registrations</div>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>Permit office admins to onboard and initialize new campuses</div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.system.allowNewRegistrations !== false}
                                onChange={(e) => updateNestedField('system', 'allowNewRegistrations', e.target.checked)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563EB' }}
                            />
                        </div>
                    </div>
                </fieldset>

                {/* 4. Company Fee Collection Accounts */}
                <fieldset className="win-fieldset" style={{ gridColumn: '1 / -1' }}>
                    <legend className="win-legend">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Landmark size={14} color="#D97706" /> Company Accounts (EasyPaisa, JazzCash, Bank)
                        </span>
                    </legend>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                            These accounts are displayed inside the Principal WebApp when principals click "Pay Subscription Dues".
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={handleAddOfficialAccount}
                                className="win-btn"
                            >
                                <Plus size={14} /> Add Account
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSaveAccountsOnly(officialAccounts)}
                                disabled={savingAccounts}
                                className="win-btn"
                                style={{ backgroundColor: '#2563EB', color: '#FFFFFF', borderColor: '#1D4ED8' }}
                            >
                                {savingAccounts ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                <span>{accountsSavedNotice ? 'Saved!' : 'Save Accounts'}</span>
                            </button>
                        </div>
                    </div>

                    {officialAccounts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed #CBD5E1', borderRadius: '4px', color: '#64748B', fontSize: '12.5px' }}>
                            No company bank accounts configured. Click "+ Add Account" to configure receiving accounts.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {officialAccounts.map((acc, index) => (
                                <div
                                    key={index}
                                    style={{
                                        backgroundColor: '#F8FAFC',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '4px',
                                        padding: '10px 14px',
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) 40px',
                                        gap: '10px',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                                            Method / Bank Name
                                        </label>
                                        <input
                                            type="text"
                                            className="win-input"
                                            value={acc.bankName || ''}
                                            onChange={(e) => handleOfficialAccountChange(index, 'bankName', e.target.value)}
                                            placeholder="e.g. EasyPaisa, Meezan Bank"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                                            Account Title
                                        </label>
                                        <input
                                            type="text"
                                            className="win-input"
                                            value={acc.accountTitle || ''}
                                            onChange={(e) => handleOfficialAccountChange(index, 'accountTitle', e.target.value)}
                                            placeholder="e.g. Education Systems Ltd"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                                            Account Number / Phone
                                        </label>
                                        <input
                                            type="text"
                                            className="win-input"
                                            value={acc.accountNumber || ''}
                                            onChange={(e) => handleOfficialAccountChange(index, 'accountNumber', e.target.value)}
                                            placeholder="03001234567"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                                            IBAN (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            className="win-input"
                                            value={acc.iban || ''}
                                            onChange={(e) => handleOfficialAccountChange(index, 'iban', e.target.value)}
                                            placeholder="PK00..."
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveOfficialAccount(index)}
                                            title="Delete Account"
                                            style={{
                                                padding: '6px',
                                                borderRadius: '3px',
                                                border: '1px solid #FECACA',
                                                backgroundColor: '#FEF2F2',
                                                color: '#DC2626',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </fieldset>
            </div>
        </div>
    );
};

export default Settings;
