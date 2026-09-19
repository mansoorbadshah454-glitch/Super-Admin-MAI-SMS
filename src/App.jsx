import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Schools from './pages/Schools';
import SchoolDetail from './pages/SchoolDetail';
import Admins from './pages/Admins';
import Settings from './pages/Settings';
import BillingSubscriptions from './pages/BillingSubscriptions';
import BoardBlueprints from './pages/BoardBlueprints';
import Login from './pages/Login';
import AuthGuard from './components/AuthGuard';
import { AdminAuthProvider } from './contexts/AdminAuthContext';

function App() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<AuthGuard />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="schools" element={<Schools />} />
            <Route path="schools/:id" element={<SchoolDetail />} />
            <Route path="board-blueprints" element={<BoardBlueprints />} />
            <Route path="billing-subscriptions" element={<BillingSubscriptions />} />
            <Route path="admins" element={<Admins />} />
            <Route path="users" element={<Navigate to="/admins" replace />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}

export default App;
