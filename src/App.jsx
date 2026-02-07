import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Schools from './pages/Schools';
import SchoolDetail from './pages/SchoolDetail';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Login from './pages/Login';
import AuthGuard from './components/AuthGuard';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<AuthGuard />}>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="schools" element={<Schools />} />
          <Route path="schools/:id" element={<SchoolDetail />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
