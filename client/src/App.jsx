import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx"
import VerifyEmail from './pages/VerifyEmail';

// For things like the dashboard where only a specific user can access it
// the replace in the Navigate to tags is so that the browser history is replaced
// e.g. we try to accsess dashboard unauthorised, without replace the history would be ['/dasbhoard', '/login']
// replace makes it so that the history is just ['/login']
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
 return (
  <BrowserRouter>
    <Routes>
      {/* If we are logged in already, just head back into the dashboard, otherwise you go to the login page */}
      <Route 
          path="/" 
          element={
            localStorage.getItem('token') ? 
            <Navigate to="/dashboard" replace /> : 
            <Navigate to="/login" replace />
          } 
        />

      {/* PUBLIC ROUTES*/}
      <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
      
      <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } 
        />

      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* PROTECTED ROUTES*/}
      <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
    </Routes>
  </BrowserRouter>
 )
}

export default App;