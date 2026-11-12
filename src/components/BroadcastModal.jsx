import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Bell, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
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

    const modalContent = (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '620px',
                background: '#ECE9D8',
                border: '2px solid #0055EA',
                borderRadius: '8px 8px 4px 4px',
                boxShadow: '0 20px 45px rgba(0,0,0,0.5)',
                fontFamily: 'Tahoma, "Segoe UI", sans-serif',
                overflow: 'hidden'
            }}>
                {/* Windows XP / 7 Style Titlebar */}
                <div style={{
                    background: 'linear-gradient(180deg, #0A246A 0%, #A6CAF0 100%)',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#fff',
                    borderBottom: '1px solid #001040'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bell size={16} color="#fff" />
                        <span style={{ fontSize: '12px', fontWeight: 'bold', textShadow: '1px 1px 1px rgba(0,0,0,0.5)' }}>
                            System Broadcast Service - Global Announcement Dispatcher
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                width: '22px',
                                height: '20px',
                                background: '#c53030',
                                border: '1px solid #fff',
                                borderRadius: '3px',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body Area */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {status.text && (
                        <div style={{
                            background: status.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                            border: `1px solid ${status.type === 'success' ? '#16A34A' : '#EF4444'}`,
                            borderRadius: '4px',
                            padding: '8px 12px',
                            color: status.type === 'success' ? '#166534' : '#991B1B',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            {status.type === 'success' ? <Sparkles size={16} /> : <AlertTriangle size={16} />}
                            <span>{status.text}</span>
                        </div>
                    )}

                    {/* Template Picker */}
                    <fieldset style={{
                        border: '1px solid #D0D0BF',
                        borderRadius: '4px',
                        padding: '10px 12px',
                        background: '#FFFFFF'
                    }}>
                        <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#003399', padding: '0 6px' }}>
                            Preset Notice Templates
                        </legend>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                            {templates.map((tpl, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => { setMessage(tpl.text); setType(tpl.type); }}
                                    style={{
                                        padding: '6px 10px',
                                        background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2F6 100%)',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '3px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        lineHeight: '1.4'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', color: tpl.type === 'warning' ? '#B45309' : tpl.type === 'success' ? '#15803D' : '#0055EA', marginBottom: '2px' }}>
                                        ● {tpl.label}
                                    </div>
                                    <div style={{ color: '#64748B', fontSize: '10px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                        {tpl.text}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    {/* Broadcast Level / Type */}
                    <fieldset style={{
                        border: '1px solid #D0D0BF',
                        borderRadius: '4px',
                        padding: '10px 12px',
                        background: '#FFFFFF'
                    }}>
                        <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#003399', padding: '0 6px' }}>
                            Announcement Severity & Color
                        </legend>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {[
                                { key: 'info', label: 'ℹ General Info (Blue)' },
                                { key: 'warning', label: '⚠ Warning Notice (Amber)' },
                                { key: 'success', label: '✓ Good News / Update (Green)' }
                            ].map((item) => (
                                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#1E293B' }}>
                                    <input
                                        type="radio"
                                        name="broadcast_type"
                                        checked={type === item.key}
                                        onChange={() => setType(item.key)}
                                    />
                                    {item.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    {/* Custom Message Area */}
                    <fieldset style={{
                        border: '1px solid #D0D0BF',
                        borderRadius: '4px',
                        padding: '10px 12px',
                        background: '#FFFFFF'
                    }}>
                        <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#003399', padding: '0 6px' }}>
                            Broadcast Message Text
                        </legend>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type notice to display across all active school principal dashboards..."
                            rows={4}
                            style={{
                                width: '100%',
                                padding: '8px',
                                fontSize: '12px',
                                fontFamily: 'Tahoma, sans-serif',
                                background: '#FFFFFF',
                                border: '1px solid #7F9DB9',
                                borderRadius: '3px',
                                outline: 'none',
                                boxSizing: 'border-box',
                                resize: 'vertical'
                            }}
                        />
                    </fieldset>
                </div>

                {/* Footer Bar with Classic Push Buttons */}
                <div style={{
                    background: '#F0F0F0',
                    borderTop: '1px solid #D0D0D0',
                    padding: '10px 16px',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            padding: '5px 16px',
                            fontSize: '12px',
                            fontFamily: 'Tahoma, sans-serif',
                            background: 'linear-gradient(180deg, #FFFFFF 0%, #ECE9D8 100%)',
                            border: '1px solid #7F9DB9',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            color: '#000'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={loading || !message.trim()}
                        style={{
                            padding: '5px 18px',
                            fontSize: '12px',
                            fontFamily: 'Tahoma, sans-serif',
                            fontWeight: 'bold',
                            background: message.trim()
                                ? 'linear-gradient(180deg, #0055EA 0%, #003399 100%)'
                                : 'linear-gradient(180deg, #E2E8F0 0%, #CBD5E1 100%)',
                            border: message.trim() ? '1px solid #002266' : '1px solid #94A3B8',
                            borderRadius: '3px',
                            cursor: message.trim() && !loading ? 'pointer' : 'not-allowed',
                            color: message.trim() ? '#FFF' : '#64748B',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Dispatch to All Schools
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default BroadcastModal;
