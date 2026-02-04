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
    Moon
} from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const Settings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [settings, setSettings] = useState({
        general: {
            platformName: 'School Management SaaS',
            supportEmail: 'support@schoolsaas.com',
            supportPhone: '+1 (555) 000-0000',
            timezone: 'UTC'
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

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, "system_configs", "global"));
                if (docSnap.exists()) {
                    const data = docSnap.data().configs;
                    setSettings(prev => ({ ...prev, ...data }));

                    // Apply theme from settings
                    if (data.appearance?.theme === 'light') {
                        document.body.classList.add('light-theme');
                    } else {
                        document.body.classList.remove('light-theme');
                    }
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            await setDoc(doc(db, "system_configs", "global"), {
                configs: settings,
                lastUpdated: serverTimestamp()
            }, { merge: true });

            setMessage({ type: 'success', text: 'Settings updated successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
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
