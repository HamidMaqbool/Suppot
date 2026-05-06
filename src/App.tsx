/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import UserDashboard from './components/user/UserDashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import TicketDetailView from './components/shared/TicketDetailView';
import LandingPage from './components/LandingPage';
import LoginView from './components/LoginView';
import { AuthProvider, useAuth } from './lib/AuthContext';

function ProtectedRoute({ children, role }: { children: React.ReactNode, role?: 'user' | 'admin' }) {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) return <Navigate to={`/login?role=${role || 'user'}`} replace />;
  if (role && user?.role !== role) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginView />} />
          
          {/* User Portal */}
          <Route path="/user" element={<ProtectedRoute role="user"><UserDashboard /></ProtectedRoute>} />
          <Route path="/user/ticket/:id" element={<ProtectedRoute role="user"><TicketDetailView portal="user" /></ProtectedRoute>} />
          
          {/* Admin Portal */}
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/ticket/:id" element={<ProtectedRoute role="admin"><TicketDetailView portal="admin" /></ProtectedRoute>} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
