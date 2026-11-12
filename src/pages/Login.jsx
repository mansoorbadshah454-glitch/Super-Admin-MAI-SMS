import React, { useState } from 'react';
import { Shield, Mail, Lock, Loader2, ArrowRight, KeyRound, UserCheck } from 'lucide-react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resetMessage, setResetMessage] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');
        setResetMessage('');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/');
        } catch (err) {
            console.error("Login failed", err);
            setError("Invalid email or password. Please try again.");
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError("Please enter your email address to reset password.");
            return;
        }
        setLoading(true);
        setError('');
        setResetMessage('');

        try {
            await sendPasswordResetEmail(auth, email);
            setResetMessage("Password reset email sent! Check your inbox.");
        } catch (err) {
            console.error("Password reset failed", err);
            setError(err.message || "Failed to send reset email. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleQuickLogin = () => {
        localStorage.setItem('manual_admin_session', JSON.stringify({
            uid: 'super-admin-root',
            email: 'admin@system.local',
            displayName: 'Super Administrator'
        }));
        window.location.href = '/';
    };

    return (
        <div style={{
            minHeight: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(ellipse at center, #1E5799 0%, #174880 50%, #0D2644 100%)',
            fontFamily: 'Tahoma, "Segoe UI", sans-serif',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Windows 7 Logon Soft Light Flare */}
            <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                height: '40%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)',
                pointerEvents: 'none'
            }} />

            {/* Main Windows 7 / XP Logon Box */}
            <div style={{
                width: '100%',
                maxWidth: '460px',
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
                padding: '36px 32px',
                zIndex: 10,
                color: '#fff',
                textAlign: 'center'
            }}>
                {/* User Tile Frame */}
                <div style={{
                    width: '84px',
                    height: '84px',
                    margin: '0 auto 16px auto',
                    borderRadius: '8px',
                    background: 'linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%)',
                    border: '3px solid #FFFFFF',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Shield size={44} color="#FFFFFF" strokeWidth={2.2} />
                </div>

                {/* Account Headings */}
                <h1 style={{
                    fontSize: '22px',
                    fontWeight: 'bold',
                    margin: '0 0 4px 0',
                    color: '#FFFFFF',
                    textShadow: '0 2px 4px rgba(0,0,0,0.6)'
                }}>
                    Super Administrator
                </h1>
                <div style={{
                    fontSize: '12px',
                    color: '#CBD5E1',
                    marginBottom: '24px',
                    letterSpacing: '0.05em'
                }}>
                    MAI SCHOOL MANAGEMENT SYSTEM • ROOT DOMAIN
                </div>

                {/* Notification / Error Badges */}
                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.25)',
                        border: '1px solid #EF4444',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        marginBottom: '16px',
                        fontSize: '12px',
                        color: '#FEE2E2',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {resetMessage && (
                    <div style={{
                        background: 'rgba(34, 197, 94, 0.25)',
                        border: '1px solid #22C55E',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        marginBottom: '16px',
                        fontSize: '12px',
                        color: '#DCFCE7',
                        textAlign: 'center'
                    }}>
                        {resetMessage}
                    </div>
                )}

                {/* Credentials Form */}
                <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
                    {/* Admin Email Field */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '11px', color: '#E2E8F0', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                            Administrator Account Email
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@domain.com"
                                required
                                style={{
                                    width: '100%',
                                    padding: '8px 10px 8px 34px',
                                    fontSize: '13px',
                                    fontFamily: 'Tahoma, sans-serif',
                                    background: '#FFFFFF',
                                    border: '1px solid #7F9DB9',
                                    borderRadius: '3px',
                                    outline: 'none',
                                    color: '#000',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    {/* Password Field + Submit Button */}
                    <div style={{ marginBottom: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#E2E8F0', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                            Secure Password
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Lock size={16} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your security password"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px 8px 34px',
                                        fontSize: '13px',
                                        fontFamily: 'Tahoma, sans-serif',
                                        background: '#FFFFFF',
                                        border: '1px solid #7F9DB9',
                                        borderRadius: '3px',
                                        outline: 'none',
                                        color: '#000',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* Windows 7 Circular Arrow Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '38px',
                                    height: '34px',
                                    borderRadius: '3px',
                                    background: 'linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%)',
                                    border: '1px solid #1E40AF',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    color: '#FFFFFF'
                                }}
                                title="Log on"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={18} strokeWidth={2.5} />}
                            </button>
                        </div>
                    </div>

                    {/* Forgot Password Link */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                        <button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={loading}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#93C5FD',
                                fontSize: '11px',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: 0
                            }}
                        >
                            Reset Password via Email
                        </button>
                    </div>

                    {/* 1-Click Quick Admin Access (Windows XP/7 Smartcard / Emergency Bypass) */}
                    <button
                        type="button"
                        onClick={handleQuickLogin}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: 'rgba(255, 255, 255, 0.15)',
                            border: '1px solid rgba(255, 255, 255, 0.35)',
                            borderRadius: '4px',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <UserCheck size={16} />
                        1-Click Instant Super Admin Session
                    </button>
                </form>
            </div>

            {/* Bottom Windows System Bar */}
            <div style={{
                position: 'absolute',
                bottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: 'rgba(255, 255, 255, 0.65)',
                fontSize: '11px'
            }}>
                <span>Windows Console Shell • Super Administrator Environment</span>
                <span>•</span>
                <span>&copy; {new Date().getFullYear()} MAI SMS Cloud</span>
            </div>
        </div>
    );
};

export default Login;
