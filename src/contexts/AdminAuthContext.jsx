import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AdminAuthContext = createContext();

export const useAdminAuth = () => useContext(AdminAuthContext);

export const AdminAuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [adminProfile, setAdminProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const manual = localStorage.getItem('manual_admin_session');
        if (manual) {
            try {
                const parsed = JSON.parse(manual);
                setUser(parsed);
                setAdminProfile({
                    id: parsed.uid || 'admin_dev',
                    email: parsed.email || 'admin@mai.local',
                    name: parsed.displayName || 'Super Administrator',
                    role: 'super-admin',
                    permissions: {
                        manageSchools: true,
                        deleteSchool: true,
                        manageBilling: true,
                        systemControl: true,
                        manageAdmins: true
                    }
                });
                setLoading(false);
                return;
            } catch (e) {
                localStorage.removeItem('manual_admin_session');
            }
        }

        let unsubscribeDoc = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                const userDocRef = doc(db, 'global_users', currentUser.uid);
                unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setAdminProfile({ id: docSnap.id, ...docSnap.data() });
                    } else {
                        // Fallback profile if user doc is missing
                        setAdminProfile({
                            id: currentUser.uid,
                            email: currentUser.email,
                            name: currentUser.displayName || 'Administrator',
                            role: 'super-admin',
                            permissions: {
                                manageSchools: true,
                                deleteSchool: true,
                                manageBilling: true,
                                systemControl: true,
                                manageAdmins: true
                            }
                        });
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("Error fetching admin profile:", err);
                    setLoading(false);
                });
            } else {
                setAdminProfile(null);
                setLoading(false);
                if (unsubscribeDoc) unsubscribeDoc();
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeDoc) unsubscribeDoc();
        };
    }, []);

    // Check if admin has a specific permission
    const hasPermission = (permKey) => {
        if (!adminProfile) return false;
        
        // Master super admins or admins without restricted permissions object have full access
        if (adminProfile.role === 'super-admin' && (!adminProfile.permissions || Object.keys(adminProfile.permissions).length === 0)) {
            return true;
        }

        // If permissions object exists, check the specific key
        if (adminProfile.permissions && adminProfile.permissions[permKey] !== undefined) {
            return Boolean(adminProfile.permissions[permKey]);
        }

        // Default to true for super-admin role if unspecified
        return adminProfile.role === 'super-admin';
    };

    return (
        <AdminAuthContext.Provider value={{
            user,
            adminProfile,
            loading,
            hasPermission,
            isMasterAdmin: adminProfile?.role === 'super-admin' && (!adminProfile?.permissions || Object.keys(adminProfile?.permissions).length === 0)
        }}>
            {children}
        </AdminAuthContext.Provider>
    );
};
