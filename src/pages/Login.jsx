import React, { useState } from 'react';
import { Shield, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/');
        } catch (err) {
            console.error("Login failed", err);
            setError("Invalid email or password. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Ambience */}
            <div style={{
                position: 'absolute', top: '-10%', left: '-10%',
                width: '600px', height: '600px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)',
                borderRadius: '50%', filter: 'blur(80px)'
            }} />
            <div style={{
                position: 'absolute', bottom: '-10%', right: '-10%',
                width: '600px', height: '600px',
                background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(0,0,0,0) 70%)',
                borderRadius: '50%', filter: 'blur(80px)'
            }} />

            {/* Login Card */}
            <div className="card glass" style={{
                width: '100%', maxWidth: '440px',
                padding: '3rem',
                position: 'relative',
                zIndex: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}>
                {/* Logo Section */}
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{
                        width: '72px', height: '72px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        borderRadius: '20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        boxShadow: '0 10px 25px rgba(79, 70, 229, 0.4)'
                    }}>
                        <Shield color="white" size={36} strokeWidth={2.5} />
                    </div>
                    <h1 style={{
                        fontSize: '2rem', fontWeight: '800',
                        color: 'white', letterSpacing: '-0.02em',
                        marginBottom: '0.5rem'
                    }}>
                        MAI SMS
                    </h1>
                    <p style={{
                        color: '#94a3b8', fontSize: '0.95rem',
                        fontWeight: '500', textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                    }}>
                        Super Admin Portal
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ position: 'relative' }}>
                            <Mail size={20} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="email"
                                placeholder="Admin Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '1rem 1rem 1rem 3rem',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                className="login-input"
                                required
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ position: 'relative' }}>
                            <Lock size={20} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '1rem 1rem 1rem 3rem',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                className="login-input"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            padding: '0.75rem', borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#f87171', fontSize: '0.9rem',
                            marginBottom: '1.5rem', textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                            color: 'white',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                            transition: 'transform 0.1s'
                        }}
                        onMouseDown={(e) => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
                        onMouseUp={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
                        onMouseLeave={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                <span>Authenticating...</span>
                            </>
                        ) : (
                            <>
                                <span>Access Dashboard</span>
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Footer */}
            <div style={{
                position: 'absolute', bottom: '2rem',
                color: '#64748b', fontSize: '0.85rem'
            }}>
                &copy; {new Date().getFullYear()} MAI SMS System. Secure Environment.
            </div>

            <style>{`
                .login-input:focus {
                    border-color: #6366f1 !important;
                    background: rgba(15, 23, 42, 0.8) !important;
                }
            `}</style>
        </div>
    );
};

export default Login;
