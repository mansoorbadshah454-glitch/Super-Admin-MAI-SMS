import { LayoutDashboard, School, Settings, LogOut, Shield, ShieldCheck, Sun, Moon, BookOpen } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Sidebar = () => {
    const location = useLocation();
    const { theme, toggleTheme } = useTheme();
    const { adminProfile } = useAdminAuth();

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: School, label: 'Schools', path: '/schools' },
        { icon: BookOpen, label: 'Board Blueprints', path: '/board-blueprints' },
        { icon: ShieldCheck, label: 'Admins', path: '/admins' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    const handleLogout = async () => {
        try {
            await signOut(auth);
            window.location.reload(); // Refresh to trigger auth state change/redirect
        } catch (error) {
            console.error("Logout Error:", error);
            alert("Logout failed. See console.");
        }
    };

    return (
        <div className="sidebar glass">
            {/* Logo */}
            <div className="sidebar-header">
                <div className="logo-icon">
                    <Shield color="white" size={24} />
                </div>
                <div>
                    <h1 className="logo-text">Admin<span>Panel</span></h1>
                    <p className="logo-sub">Super Admin Access</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                        >
                            <item.icon size={20} className="nav-icon" />
                            <span className="nav-label">{item.label}</span>
                            {isActive && <div className="active-dot" />}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="sidebar-footer">
                <div className="user-info">
                    <div className="user-avatar-badge">
                        {(adminProfile?.name || 'A')[0].toUpperCase()}
                    </div>
                    <div className="user-details">
                        <p className="user-name" title={adminProfile?.name || 'Administrator'}>
                            {adminProfile?.name || 'Administrator'}
                        </p>
                        <p className="user-email" title={adminProfile?.email || auth.currentUser?.email || 'admin@school.com'}>
                            {adminProfile?.email || auth.currentUser?.email || 'admin@school.com'}
                        </p>
                    </div>
                </div>
                <div className="sidebar-footer-actions">
                    <button
                        className="footer-action-btn"
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                    >
                        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                        <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                    </button>
                    <button
                        className="footer-action-btn logout-btn"
                        onClick={handleLogout}
                        title="Logout"
                    >
                        <LogOut size={15} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
