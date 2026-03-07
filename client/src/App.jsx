import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, use } from 'react';
import Dashboard from "./pages/Dashboard.jsx";
import Quiz from "./pages/Quiz.jsx"
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx"
import VerifyEmail from './pages/VerifyEmail';
import OAuthSuccess from './pages/OAuthSuccess.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Navbar from "./components/Navbar.jsx";
import {AuthProvider, useAuth} from './contexts/AuthContext.jsx';
import { QuizProvider } from './contexts/QuizContext.jsx';
import QuizCompleted from './pages/QuizCompleted.jsx';
import Analytics from './pages/Analytics.jsx';
import OnboardingPage from './pages/Onboarding.jsx';


// For things like the dashboard where only a specific user can access it
// the replace in the Navigate to tags is so that the browser history is replaced
// e.g. we try to accsess dashboard unauthorised, without replace the history would be ['/dasbhoard', '/login']
// replace makes it so that the history is just ['/login']
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

// Onboarding route: must be logged in, but redirects away if already onboarded.
// Reads from AuthContext (not raw localStorage) so stale storage values don't
// cause an instant redirect before the wizard even mounts.
function OnboardingRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  const { isOnboarded, loading } = useAuth();
  // Wait for AuthContext to hydrate before deciding — prevents flash redirect
  if (loading) return null;
  if (isOnboarded) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? <Navigate to="/dashboard" replace /> : children;
}

// Component to conditionally show Navbar only on protected routes
function Layout({ children, showNavbar = true }) {
  return (
    <div className="app">
      {showNavbar && <Navbar />}
      <main>{children}</main>
    </div>
  );
}

function App() {

  const [hasToken, setHasToken] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    document.title = "Maths Sloth";
    setHasToken(!!localStorage.getItem('token'));
  }, []);

  return (
    <AuthProvider>
      <QuizProvider>
      <BrowserRouter>
        <Routes>
          {/* If we are logged in already, just head back into the dashboard, otherwise you go to the login page */}
          <Route 
              path="/" 
              element={
                hasToken ? 
                <Navigate to="/dashboard" replace /> : 
                <Navigate to="/login" replace />
              } 
            />

          {/* PUBLIC ROUTES - No Navbar */}
          <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Layout showNavbar={false}>
                    <Login />
                  </Layout>
                </PublicRoute>
              } 
            />
          
          <Route
              path="/register"
              element={
                <PublicRoute>
                  <Layout showNavbar={false}>
                    <Register />
                  </Layout>
                </PublicRoute>
              } 
            />

          
          <Route 
              path="/forgot-password" 
              element={
                <PublicRoute>
                  <Layout showNavbar={false}>
                    <ForgotPassword />
                  </Layout>
                </PublicRoute>
              }
            />

          {/* Make it so that you can only get to this page if you click the verification link, you cannot get to it via dashboard or anywhere else*/}
          
          <Route 
              path="/verify-email" 
              element={
                <Layout showNavbar={false}>
                  <VerifyEmail />
                </Layout>
              } 
            />

          {/* ONBOARDING - logged in but wizard not yet complete, no Navbar */}
          <Route
              path="/onboarding"
              element={
                <OnboardingRoute>
                  <Layout showNavbar={false}>
                    <OnboardingPage />
                  </Layout>
                </OnboardingRoute>
              }
            />

          {/* PROTECTED ROUTES - With Navbar */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Layout showNavbar={true}>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/analytics" 
              element={
                <ProtectedRoute>
                  <Layout showNavbar={true}>
                    <Analytics />
                  </Layout>
                </ProtectedRoute>
              } 
            />
          
          <Route 
              path="/quiz" 
              element={
                <ProtectedRoute>
                  <Layout showNavbar={true}>
                      <Quiz />
                  </Layout>
                </ProtectedRoute>
              } 
            />

          <Route 
              path="/quiz-completed" 
              element={
                <ProtectedRoute>
                  <Layout showNavbar={true}>
                      <QuizCompleted />
                  </Layout>
                </ProtectedRoute>
              } 
            />
          
          {/* OAuth and Reset Password can be flexible */}
          <Route 
              path="/oauth-success" 
              element={
                <Layout showNavbar={false}>
                  <OAuthSuccess />
                </Layout>
              } 
            />

          <Route
              path="/reset-password"
              element={
                <Layout showNavbar={false}>
                  <ResetPassword />
                </Layout>
              }
            />

        </Routes>
        </BrowserRouter>
      </QuizProvider>
    </AuthProvider>
  )
}

export default App;