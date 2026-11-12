import React from 'react';
import { LayoutDashboard, School, Settings, LogOut, Shield, ShieldCheck, Sun, Moon, CreditCard, Laptop } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Sidebar = () => {
    const location = useLocation();
    const { theme, toggleTheme } = useTheme();
    const { adminProfile, hasPermission, isMasterAdmin } = useAdminAuth();

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: School, label: 'Schools', path: '/schools' },
        { icon: CreditCard, label: 'Billing & Subscriptions', path: '/billing-subscriptions', permission: 'manageBilling' },
        { icon: ShieldCheck, label: 'Admins', path: '/admins', permission: 'manageAdmins' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    const handleLogout = async () => {
        try {
            await signOut(auth);
            window.location.reload();
        } catch (error) {
            console.error("Logout Error:", error);
            alert("Logout failed. See console.");
        }
    };

    const fontFamily = "'Segoe UI', Tahoma, Verdana, sans-serif";

    return (
        <aside
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                width: '260px',
                height: '100vh',
                backgroundColor: '#F8FAFC',
                borderRight: '1px solid #CBD5E1',
                boxShadow: '2px 0 6px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 100,
                fontFamily: fontFamily,
                userSelect: 'none'
            }}
        >
            {/* 1. Header (Windows Explorer / Console Banner) */}
            <div
                style={{
                    padding: '16px 18px',
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%)',
                    borderBottom: '1px solid #CBD5E1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}
            >
                <div
                    style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)',
                        flexShrink: 0
                    }}
                >
                    <Shield size={20} color="#FFFFFF" />
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A', lineHeight: 1.2 }}>
                        Admin<span style={{ color: '#2563EB' }}>Console</span>
                    </h1>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                        Super Admin Suite
                    </span>
                </div>
            </div>

            {/* 2. Navigation Pane (Windows Explorer Style) */}
            <div style={{ padding: '12px 14px 4px 14px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                System Navigation
            </div>

            <nav style={{ flex: 1, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto' }}>
                {menuItems.filter(item => !item.permission || isMasterAdmin || hasPermission(item.permission)).map((item) => {
                    const isActive = location.pathname === item.path;
                    const IconComponent = item.icon;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                textDecoration: 'none',
                                fontSize: '13px',
                                fontWeight: isActive ? '700' : '600',
                                backgroundColor: isActive ? '#EFF6FF' : 'transparent',
                                border: isActive ? '1px solid #93C5FD' : '1px solid transparent',
                                color: isActive ? '#1D4ED8' : '#334155',
                                transition: 'all 0.12s ease'
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.backgroundColor = '#F1F5F9';
                                    e.currentTarget.style.borderColor = '#E2E8F0';
                                    e.currentTarget.style.color = '#0F172A';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderColor = 'transparent';
                                    e.currentTarget.style.color = '#334155';
                                }
                            }}
                        >
                            <IconComponent size={17} style={{ color: isActive ? '#2563EB' : '#64748B', flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{item.label}</span>
                            {isActive && (
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* 3. Footer (Windows 7 Start Menu User Card) */}
            <div
                style={{
                    margin: '10px',
                    padding: '12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}
            >
                {/* User Info Tile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                        style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '4px',
                            background: 'linear-gradient(135deg, #475569, #1E293B)',
                            border: '1px solid #94A3B8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '800',
                            color: '#FFFFFF',
                            fontSize: '14px',
                            flexShrink: 0
                        }}
                    >
                        {(adminProfile?.name || 'A')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div
                            style={{
                                fontSize: '12.5px',
                                fontWeight: '700',
                                color: '#0F172A',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                            title={adminProfile?.name || 'Administrator'}
                        >
                            {adminProfile?.name || 'Administrator'}
                        </div>
                        <div
                            style={{
                                fontSize: '11px',
                                color: '#64748B',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                            title={adminProfile?.email || auth.currentUser?.email || 'admin@school.com'}
                        >
                            {adminProfile?.email || auth.currentUser?.email || 'admin@school.com'}
                        </div>
                    </div>
                </div>

                {/* Footer Push Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            padding: '5px 8px',
                            borderRadius: '3px',
                            border: '1px solid #CBD5E1',
                            background: '#F8FAFC',
                            color: '#475569',
                            fontSize: '11.5px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontFamily: 'inherit'
                        }}
                    >
                        {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                        <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                    </button>

                    <button
                        onClick={handleLogout}
                        title="Logout"
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            padding: '5px 8px',
                            borderRadius: '3px',
                            border: '1px solid #FECACA',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            fontSize: '11.5px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontFamily: 'inherit'
                        }}
                    >
                        <LogOut size={13} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
