import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, Sparkles, HelpCircle } from 'lucide-react';

const AlertContext = createContext(null);

export const AlertProvider = ({ children }) => {
    const [alertState, setAlertState] = useState({
        isOpen: false,
        isConfirm: false,
        title: '',
        message: '',
        type: 'success', // 'success' | 'error' | 'warning' | 'info' | 'confirm'
        confirmText: 'OK',
        cancelText: 'Cancel',
        onConfirm: null,
        onCancel: null
    });

    const showAlert = useCallback((messageOrOptions, typeOverride = 'info') => {
        if (typeof messageOrOptions === 'string') {
            const isSuccess = typeOverride === 'success' || messageOrOptions.toLowerCase().includes('success') || messageOrOptions.toLowerCase().includes('deleted');
            const isError = typeOverride === 'error' || messageOrOptions.toLowerCase().includes('error') || messageOrOptions.toLowerCase().includes('fail') || messageOrOptions.toLowerCase().includes('denied');
            const isWarning = typeOverride === 'warning';

            const detectedType = isSuccess ? 'success' : isError ? 'error' : isWarning ? 'warning' : typeOverride;
            const defaultTitle = detectedType === 'success' ? 'Success' : detectedType === 'error' ? 'Action Failed' : detectedType === 'warning' ? 'Attention' : 'Notification';

            setAlertState({
                isOpen: true,
                isConfirm: false,
                title: defaultTitle,
                message: messageOrOptions,
                type: detectedType,
                confirmText: 'OK',
                cancelText: 'Cancel',
                onConfirm: null,
                onCancel: null
            });
        } else if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
            setAlertState({
                isOpen: true,
                isConfirm: false,
                title: messageOrOptions.title || (messageOrOptions.type === 'error' ? 'Action Failed' : messageOrOptions.type === 'success' ? 'Success' : 'Notification'),
                message: messageOrOptions.message || '',
                type: messageOrOptions.type || 'info',
                confirmText: messageOrOptions.confirmText || 'OK',
                cancelText: 'Cancel',
                onConfirm: messageOrOptions.onConfirm || null,
                onCancel: null
            });
        }
    }, []);

    const showConfirm = useCallback((options) => {
        if (typeof options === 'string') {
            options = { message: options };
        }
        setAlertState({
            isOpen: true,
            isConfirm: true,
            title: options.title || 'Please Confirm',
            message: options.message || '',
            type: options.type || 'warning',
            confirmText: options.confirmText || 'Confirm',
            cancelText: options.cancelText || 'Cancel',
            onConfirm: options.onConfirm || null,
            onCancel: options.onCancel || null
        });
    }, []);

    const handleConfirm = useCallback(() => {
        const callback = alertState.onConfirm;
        setAlertState(prev => ({ ...prev, isOpen: false }));
        if (callback && typeof callback === 'function') {
            try {
                callback();
            } catch (err) {
                console.error("Alert onConfirm error:", err);
            }
        }
    }, [alertState]);

    const handleCancel = useCallback(() => {
        const callback = alertState.onCancel;
        setAlertState(prev => ({ ...prev, isOpen: false }));
        if (callback && typeof callback === 'function') {
            try {
                callback();
            } catch (err) {
                console.error("Alert onCancel error:", err);
            }
        }
    }, [alertState]);

    const closeAlert = useCallback(() => {
        if (alertState.isConfirm) {
            handleCancel();
        } else {
            handleConfirm();
        }
    }, [alertState.isConfirm, handleCancel, handleConfirm]);

    // Handle Keyboard Enter or Escape to dismiss
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!alertState.isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        };

        if (alertState.isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [alertState.isOpen, handleCancel, handleConfirm]);

    // Expose global window helper for maximum cross-compatibility across all pages
    useEffect(() => {
        window.showAdminAlert = showAlert;
        window.showAdminConfirm = showConfirm;
        const originalAlert = window.alert;
        window.alert = (msg) => {
            showAlert(msg);
        };
        return () => {
            window.alert = originalAlert;
        };
    }, [showAlert, showConfirm]);

    const getIconAndColors = () => {
        switch (alertState.type) {
            case 'success':
                return {
                    icon: <CheckCircle2 size={36} color="#ffffff" strokeWidth={2.5} />,
                    iconBadgeBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    iconGlow: 'rgba(16, 185, 129, 0.4)',
                    accentColor: '#10b981'
                };
            case 'error':
                return {
                    icon: <AlertCircle size={36} color="#ffffff" strokeWidth={2.5} />,
                    iconBadgeBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    iconGlow: 'rgba(239, 68, 68, 0.4)',
                    accentColor: '#ef4444'
                };
            case 'warning':
                return {
                    icon: <AlertTriangle size={36} color="#ffffff" strokeWidth={2.5} />,
                    iconBadgeBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    iconGlow: 'rgba(245, 158, 11, 0.4)',
                    accentColor: '#f59e0b'
                };
            case 'confirm':
                return {
                    icon: <HelpCircle size={36} color="#ffffff" strokeWidth={2.5} />,
                    iconBadgeBg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    iconGlow: 'rgba(99, 102, 241, 0.4)',
                    accentColor: '#6366f1'
                };
            case 'info':
            default:
                return {
                    icon: <Sparkles size={36} color="#ffffff" strokeWidth={2.5} />,
                    iconBadgeBg: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                    iconGlow: 'rgba(79, 70, 229, 0.4)',
                    accentColor: '#4f46e5'
                };
        }
    };

    const { icon, iconBadgeBg, iconGlow } = getIconAndColors();

    return (
        <AlertContext.Provider value={{ showAlert, showConfirm, closeAlert }}>
            {children}

            {alertState.isOpen && (
                <div
                    onClick={closeAlert}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 99999,
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1.5rem',
                        animation: 'customAlertFadeIn 0.2s ease-out'
                    }}
                >
                    <style>{`
                        @keyframes customAlertFadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes customAlertScaleIn {
                            from { opacity: 0; transform: scale(0.95) translateY(10px); }
                            to { opacity: 1; transform: scale(1) translateY(0); }
                        }
                    `}</style>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '440px',
                            background: 'linear-gradient(145deg, #1e1b4b 0%, #312e81 40%, #1e293b 100%)',
                            borderRadius: '24px',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 35px rgba(79, 70, 229, 0.3)',
                            padding: '2.2rem 2rem 1.8rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            animation: 'customAlertScaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        {/* Background subtle radial glow */}
                        <div style={{
                            position: 'absolute',
                            top: '-50px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '200px',
                            height: '150px',
                            background: iconGlow,
                            borderRadius: '50%',
                            filter: 'blur(50px)',
                            pointerEvents: 'none',
                            opacity: 0.8
                        }} />

                        {/* Close 'X' button in top right */}
                        <button
                            onClick={closeAlert}
                            style={{
                                position: 'absolute',
                                top: '1.2rem',
                                right: '1.2rem',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'rgba(255, 255, 255, 0.8)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                        >
                            <X size={18} />
                        </button>

                        {/* Glowing Icon Badge */}
                        <div
                            style={{
                                width: '76px',
                                height: '76px',
                                borderRadius: '50%',
                                background: iconBadgeBg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.4rem',
                                boxShadow: `0 10px 25px -5px ${iconGlow}, inset 0 2px 4px rgba(255, 255, 255, 0.3)`,
                                border: '3px solid rgba(255, 255, 255, 0.25)',
                                position: 'relative',
                                zIndex: 1
                            }}
                        >
                            {icon}
                        </div>

                        {/* Title */}
                        <h3 style={{
                            fontSize: '1.35rem',
                            fontWeight: '800',
                            color: '#ffffff',
                            marginBottom: '0.6rem',
                            letterSpacing: '-0.02em',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            {alertState.title}
                        </h3>

                        {/* Message Content */}
                        <p style={{
                            fontSize: '0.95rem',
                            color: '#e2e8f0',
                            lineHeight: '1.5',
                            marginBottom: '1.8rem',
                            maxWidth: '360px',
                            wordBreak: 'break-word',
                            fontWeight: '400',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            {alertState.message}
                        </p>

                        {/* Action Buttons */}
                        <div style={{
                            display: 'flex',
                            gap: '0.75rem',
                            width: '100%',
                            justifyContent: 'center',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            {alertState.isConfirm && (
                                <button
                                    onClick={handleCancel}
                                    style={{
                                        flex: 1,
                                        maxWidth: '140px',
                                        padding: '0.85rem 1.25rem',
                                        borderRadius: '14px',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        color: '#ffffff',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        fontWeight: '600',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                >
                                    <span>{alertState.cancelText}</span>
                                </button>
                            )}

                            <button
                                onClick={handleConfirm}
                                autoFocus
                                style={{
                                    flex: alertState.isConfirm ? 1 : 'none',
                                    width: alertState.isConfirm ? 'auto' : '100%',
                                    maxWidth: alertState.isConfirm ? '150px' : '240px',
                                    padding: '0.85rem 1.75rem',
                                    borderRadius: '14px',
                                    background: alertState.type === 'error' || (alertState.isConfirm && alertState.type === 'warning')
                                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                        : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                    color: alertState.type === 'error' || (alertState.isConfirm && alertState.type === 'warning')
                                        ? '#ffffff'
                                        : '#1e1b4b',
                                    border: 'none',
                                    fontWeight: '800',
                                    fontSize: '1rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.3), 0 0 15px rgba(255, 255, 255, 0.2)',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    letterSpacing: '0.02em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                                    e.currentTarget.style.boxShadow = '0 14px 24px -5px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 255, 255, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                    e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(0, 0, 0, 0.3), 0 0 15px rgba(255, 255, 255, 0.2)';
                                }}
                            >
                                <span>{alertState.confirmText}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AlertContext.Provider>
    );
};

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        return {
            showAlert: (msg, type) => {
                if (typeof window !== 'undefined' && window.showAdminAlert) {
                    window.showAdminAlert(msg, type);
                } else {
                    console.log(`[Admin Alert (${type})]:`, msg);
                }
            },
            showConfirm: (opts) => {
                if (typeof window !== 'undefined' && window.showAdminConfirm) {
                    window.showAdminConfirm(opts);
                }
            },
            closeAlert: () => {}
        };
    }
    return context;
};
