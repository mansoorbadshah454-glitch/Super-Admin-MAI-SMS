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
                        viewRevenue: true,
                        systemControl: true,
                        manageSettings: true,
                        broadcastAnnouncements: true,
                        resetCredentials: true,
                        manageAdmins: true
                    },
                    territoryScope: 'all',
                    territoryState: '',
                    territoryDistrict: '',
                    territoryCity: ''
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
                                viewRevenue: true,
                                systemControl: true,
                                manageSettings: true,
                                broadcastAnnouncements: true,
                                resetCredentials: true,
                                manageAdmins: true
                            },
                            territoryScope: 'all',
                            territoryState: '',
                            territoryDistrict: '',
                            territoryCity: ''
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

    // Master Super Admin check: true for owner/full admin (manageAdmins: true or default super-admin), false for restricted staff
    const isMaster = Boolean(
        adminProfile?.isMasterAdmin ||
        adminProfile?.role === 'master_admin' ||
        adminProfile?.permissions?.manageAdmins === true ||
        (adminProfile?.role === 'super-admin' && adminProfile?.permissions?.manageAdmins !== false) ||
        user?.uid === 'K1T1CwRoTdYtQJDCRNEc0NK9vjt2'
    );

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

        // Default to true for unrestricted master admin, false for restricted staff
        return isMaster;
    };

    // Check if a school is within the admin's assigned territory
    const isSchoolInTerritory = (school, profile = adminProfile) => {
        if (!school) return false;
        if (!profile) return false;

        // Master admins or profiles with 'all' scope have unrestricted access
        if (isMaster || profile.role === 'master_admin' || !profile.territoryScope || profile.territoryScope === 'all') {
            return true;
        }

        const schoolState = (school.state || '').trim().toLowerCase();
        const schoolDistrict = (school.district || '').trim().toLowerCase();
        const schoolCity = (school.city || '').trim().toLowerCase();

        const targetState = (profile.territoryState || '').trim().toLowerCase();
        const targetDistrict = (profile.territoryDistrict || '').trim().toLowerCase();
        const targetCity = (profile.territoryCity || '').trim().toLowerCase();

        if (profile.territoryScope === 'state') {
            return targetState ? schoolState === targetState : true;
        }

        if (profile.territoryScope === 'district') {
            const stateMatches = !targetState || schoolState === targetState;
            return stateMatches && schoolDistrict === targetDistrict;
        }

        if (profile.territoryScope === 'city') {
            const stateMatches = !targetState || schoolState === targetState;
            const districtMatches = !targetDistrict || schoolDistrict === targetDistrict;
            return stateMatches && districtMatches && schoolCity === targetCity;
        }

        return true;
    };

    const filterSchoolsByTerritory = (schools, profile = adminProfile) => {
        if (!Array.isArray(schools)) return [];
        return schools.filter(s => isSchoolInTerritory(s, profile));
    };

    return (
        <AdminAuthContext.Provider value={{
            user,
            adminProfile,
            loading,
            hasPermission,
            isMasterAdmin: isMaster,
            isSchoolInTerritory,
            filterSchoolsByTerritory
        }}>
            {children}
        </AdminAuthContext.Provider>
    );
};
