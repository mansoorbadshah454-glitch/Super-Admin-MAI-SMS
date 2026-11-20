import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import BdoDashboard from './pages/BdoDashboard';
import BdoManagement from './pages/BdoManagement';
import BdoDetail from './pages/BdoDetail';
import Schools from './pages/Schools';
import SchoolDetail from './pages/SchoolDetail';
import Admins from './pages/Admins';
import Settings from './pages/Settings';
import BillingSubscriptions from './pages/BillingSubscriptions';
import Login from './pages/Login';
import AuthGuard from './components/AuthGuard';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';

const RoleAwareDashboard = () => {
  const { isBdo } = useAdminAuth();
  return isBdo ? <BdoDashboard /> : <Dashboard />;
};

const NonBdoRoute = ({ children }) => {
  const { isBdo } = useAdminAuth();
  if (isBdo) return <Navigate to="/" replace />;
  return children;
};

const BdoManageRoute = ({ children }) => {
  const { isBdo, isMasterAdmin, hasPermission } = useAdminAuth();
  if (isBdo || (!isMasterAdmin && !hasPermission('manageBdos'))) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<AuthGuard />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<RoleAwareDashboard />} />
            <Route path="schools" element={<Schools />} />
            <Route path="schools/:id" element={<SchoolDetail />} />
            <Route path="bdo" element={<BdoManageRoute><BdoManagement /></BdoManageRoute>} />
            <Route path="bdo/:bdoId" element={<BdoManageRoute><BdoDetail /></BdoManageRoute>} />
            <Route path="billing-subscriptions" element={<NonBdoRoute><BillingSubscriptions /></NonBdoRoute>} />
            <Route path="admins" element={<NonBdoRoute><Admins /></NonBdoRoute>} />
            <Route path="users" element={<Navigate to="/admins" replace />} />
            <Route path="settings" element={<NonBdoRoute><Settings /></NonBdoRoute>} />
          </Route>
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}

export default App;
