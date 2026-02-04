import React from 'react';
import { LayoutDashboard, School, Settings, LogOut, Shield, Users as UsersIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: School, label: 'Schools', path: '/schools' },
        { icon: UsersIcon, label: 'Users', path: '/users' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

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
                    <img
                        src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin"
                        alt="Admin"
                        className="user-avatar"
                    />
                    <div className="user-details">
                        <p className="user-name">Administrator</p>
                        <p className="user-email">admin@school.com</p>
                    </div>
                </div>
                <button className="logout-btn">
                    <LogOut size={20} />
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
