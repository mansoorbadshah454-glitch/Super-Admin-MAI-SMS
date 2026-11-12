import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldAlert, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

const DeleteSchoolModal = ({ school, onClose, onSuccess }) => {
    const [step, setStep] = useState(1); // 1: Initial Warning, 2: ID Confirmation
    const [confirmId, setConfirmId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const schoolTitle = school?.name || school?.schoolName || school?.id || 'School';

    const handleDelete = async () => {
        if (confirmId !== `DELETE ${school.id}`) {
            setError(`Please type "DELETE ${school.id}" exactly.`);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const deleteSchoolFn = httpsCallable(functions, 'deleteSchool');
            await deleteSchoolFn({ schoolId: school.id });

            alert(`Deleted! All data for ${schoolTitle} has been removed.`);
            onSuccess();
        } catch (err) {
            console.error("Deletion error:", err);
            setError("Failed to delete all data: " + err.message);
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
                maxWidth: '520px',
                background: '#ECE9D8',
                border: '2px solid #0055EA',
                borderRadius: '8px 8px 4px 4px',
                boxShadow: '0 20px 45px rgba(0,0,0,0.5)',
                fontFamily: 'Tahoma, "Segoe UI", sans-serif',
                overflow: 'hidden'
            }}>
                {/* Windows XP / 7 Style Titlebar */}
                <div style={{
                    background: 'linear-gradient(180deg, #c53030 0%, #9b2c2c 100%)',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#fff',
                    borderBottom: '1px solid #742a2a'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldAlert size={16} color="#fff" />
                        <span style={{ fontSize: '12px', fontWeight: 'bold', textShadow: '1px 1px 1px rgba(0,0,0,0.5)' }}>
                            System Warning: Confirm School Purge
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
                <div style={{ padding: '16px' }}>
                    {error && (
                        <div style={{
                            background: '#FEE2E2',
                            border: '1px solid #EF4444',
                            borderRadius: '4px',
                            padding: '8px 12px',
                            marginBottom: '12px',
                            color: '#991B1B',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 1 ? (
                        <fieldset style={{
                            border: '1px solid #D0D0BF',
                            borderRadius: '4px',
                            padding: '14px',
                            margin: 0,
                            background: '#FFFFFF'
                        }}>
                            <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#991B1B', padding: '0 6px' }}>
                                ⚠ Irreversible Database Action
                            </legend>

                            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                <div style={{
                                    width: '46px',
                                    height: '46px',
                                    borderRadius: '50%',
                                    background: '#FEE2E2',
                                    border: '1px solid #FCA5A5',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <AlertTriangle size={26} color="#DC2626" />
                                </div>
                                <div style={{ fontSize: '12px', color: '#333', lineHeight: '1.5' }}>
                                    <p style={{ margin: '0 0 8px 0' }}>
                                        You are about to completely purge the school instance:
                                    </p>
                                    <div style={{
                                        background: '#F8FAFC',
                                        border: '1px solid #CBD5E1',
                                        padding: '6px 10px',
                                        borderRadius: '3px',
                                        fontWeight: 'bold',
                                        color: '#0F172A',
                                        marginBottom: '10px'
                                    }}>
                                        {schoolTitle} (ID: {school.id})
                                    </div>
                                    <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#64748B' }}>
                                        Executing this deletion will irrevocably erase:
                                    </p>
                                    <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '11px', color: '#475569' }}>
                                        <li>All student profiles, enrollments, and academic transcripts</li>
                                        <li>All staff profiles, teacher accounts, and credentials</li>
                                        <li>Fee voucher ledgers and financial history</li>
                                    </ul>
                                </div>
                            </div>
                        </fieldset>
                    ) : (
                        <fieldset style={{
                            border: '1px solid #D0D0BF',
                            borderRadius: '4px',
                            padding: '14px',
                            margin: 0,
                            background: '#FFFFFF'
                        }}>
                            <legend style={{ fontSize: '11px', fontWeight: 'bold', color: '#003399', padding: '0 6px' }}>
                                Security Clearance: Enter Target School ID
                            </legend>

                            <p style={{ fontSize: '12px', color: '#333', margin: '0 0 10px 0' }}>
                                To prevent accidental deletion, please type <strong style={{ color: '#DC2626', fontFamily: 'monospace' }}>DELETE {school.id}</strong> into the field below:
                            </p>

                            <input
                                type="text"
                                value={confirmId}
                                onChange={(e) => setConfirmId(e.target.value)}
                                placeholder={`DELETE ${school.id}`}
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    fontSize: '13px',
                                    fontFamily: 'monospace',
                                    background: '#fff',
                                    border: confirmId === `DELETE ${school.id}` ? '2px solid #16A34A' : '2px solid #EF4444',
                                    borderRadius: '3px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </fieldset>
                    )}
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

                    {step === 1 ? (
                        <button
                            type="button"
                            onClick={() => setStep(2)}
                            style={{
                                padding: '5px 18px',
                                fontSize: '12px',
                                fontFamily: 'Tahoma, sans-serif',
                                fontWeight: 'bold',
                                background: 'linear-gradient(180deg, #DC2626 0%, #B91C1C 100%)',
                                border: '1px solid #991B1B',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                color: '#FFF',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            I Understand, Proceed <ArrowRight size={14} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={loading || confirmId !== `DELETE ${school.id}`}
                            style={{
                                padding: '5px 18px',
                                fontSize: '12px',
                                fontFamily: 'Tahoma, sans-serif',
                                fontWeight: 'bold',
                                background: confirmId === `DELETE ${school.id}`
                                    ? 'linear-gradient(180deg, #DC2626 0%, #B91C1C 100%)'
                                    : 'linear-gradient(180deg, #E2E8F0 0%, #CBD5E1 100%)',
                                border: confirmId === `DELETE ${school.id}` ? '1px solid #991B1B' : '1px solid #94A3B8',
                                borderRadius: '3px',
                                cursor: confirmId === `DELETE ${school.id}` && !loading ? 'pointer' : 'not-allowed',
                                color: confirmId === `DELETE ${school.id}` ? '#FFF' : '#64748B',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                            PERMANENTLY PURGE SCHOOL
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default DeleteSchoolModal;
