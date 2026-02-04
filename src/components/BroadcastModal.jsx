import React, { useState } from 'react';
import { X, Send, Bell, MessageSquare, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';

const BroadcastModal = ({ onClose }) => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [type, setType] = useState('info'); // info, warning, success
    const [status, setStatus] = useState({ type: '', text: '' });

    const templates = [
        {
            label: "Payment Due Reminder",
            text: "Notice: Your monthly subscription payment is due soon. Please ensure your account balance is sufficient to avoid any system interruptions.",
            type: "warning"
        },
        {
            label: "Maintenance Alert",
            text: "System Update: We will be performing scheduled maintenance tonight at 11:00 PM UTC. Portals may be temporarily unavailable for 15 minutes.",
            type: "info"
        },
        {
            label: "Support Contact Update",
            text: "Update: Our support phone lines have been updated. You can now reach us at our new primary support number for faster assistance.",
            type: "success"
        },
        {
            label: "New Feature Announcement",
            text: "Exciting News! We have just released a new update with improved student performance reporting features. Check your dashboard for details.",
            type: "info"
        }
    ];

    const handleSend = async () => {
        if (!message.trim()) return;
        setLoading(true);
        setStatus({ type: '', text: '' });

        try {
            const schoolsSnapshot = await getDocs(collection(db, "schools"));
            const batch = writeBatch(db);

            schoolsSnapshot.forEach((schoolDoc) => {
                const announcementRef = doc(db, `schools/${schoolDoc.id}/announcements`, 'global_broadcast');
                batch.set(announcementRef, {
                    message,
                    type,
                    sentAt: serverTimestamp(),
                    active: true,
                    dismissedBy: []
                });
            });

            await batch.commit();
            setStatus({ type: 'success', text: `Broadcast sent to ${schoolsSnapshot.size} schools successfully!` });
            setTimeout(onClose, 2000);
        } catch (error) {
            console.error("Broadcast error:", error);
            setStatus({ type: 'error', text: 'Failed to send broadcast: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem'
        }}>
            <div className="card glass animate-in zoom-in duration-300" style={{
                width: '100%',
                maxWidth: '600px',
                padding: '2.5rem',
                position: 'relative',
                background: 'var(--bg-card)',
                border: '1px solid var(--glass-border)'
            }}>
                <button onClick={onClose} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={24} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)' }}>
                        <Bell color="white" size={28} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>System Broadcast</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Send an alert bar to all school dashboards.</p>
                    </div>
                </div>

                {status.text && (
                    <div style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        marginBottom: '1.5rem',
                        background: status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${status.type === 'success' ? '#10b981' : '#ef4444'}`,
                        color: status.type === 'success' ? '#34d399' : '#f87171',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        {status.type === 'success' ? <Sparkles size={18} /> : <AlertTriangle size={18} />}
                        {status.text}
                    </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                    <label className="label" style={{ marginBottom: '0.75rem', display: 'block' }}>Professional Templates</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                        {templates.map((tpl, i) => (
                            <button
                                key={i}
                                onClick={() => { setMessage(tpl.text); setType(tpl.type); }}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    height: '100%'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                            >
                                <span style={{ color: tpl.type === 'warning' ? '#fbbf24' : tpl.type === 'success' ? '#34d399' : 'var(--primary)', marginBottom: '0.25rem', display: 'block' }}>● {tpl.label}</span>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                    {tpl.text}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="input-group">
                    <label className="label">Message Type</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {['info', 'warning', 'success'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setType(t)}
                                style={{
                                    flex: 1,
                                    padding: '0.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--glass-border)',
                                    background: type === t ? (t === 'warning' ? 'rgba(245, 158, 11, 0.1)' : t === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)') : 'transparent',
                                    color: type === t ? (t === 'warning' ? '#fbbf24' : t === 'success' ? '#34d399' : 'var(--primary)') : 'var(--text-muted)',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    cursor: 'pointer'
                                }}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="input-group">
                    <label className="label">Custom Message Content</label>
                    <textarea
                        className="input-field"
                        style={{ width: '100%', minHeight: '120px', resize: 'none', paddingTop: '1rem' }}
                        placeholder="Type your announcement here..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                </div>

                <button
                    onClick={handleSend}
                    disabled={loading || !message.trim()}
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '1rem', justifyContent: 'center', height: '55px' }}
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : (
                        <>
                            <Send size={20} />
                            Dispatch Broadcast to All Schools
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default BroadcastModal;
