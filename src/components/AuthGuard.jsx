import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { Loader2 } from 'lucide-react';

const AuthGuard = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div style={{
                height: '100vh', width: '100vw',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#0f172a'
            }}>
                <Loader2 size={40} className="animate-spin" color="#6366f1" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default AuthGuard;
