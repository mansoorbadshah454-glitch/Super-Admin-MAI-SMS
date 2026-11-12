import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const DashboardLayout = () => {
    return (
        <div style={{ minHeight: '100vh', position: 'relative', backgroundColor: '#F1F5F9' }}>
            <Sidebar />
            <main
                style={{
                    marginLeft: '260px',
                    padding: '1.75rem',
                    minHeight: '100vh',
                    boxSizing: 'border-box'
                }}
            >
                <Outlet />
            </main>
        </div>
    );
};

export default DashboardLayout;
