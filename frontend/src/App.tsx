import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import { ConfirmationProvider } from './components/ConfirmationModal';
import BackgroundScanManager from './components/BackgroundScanManager';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Agents from './pages/Agents';
import SecurityChecklist from './pages/SecurityChecklist';
import Scans from './pages/Scans';
import ScanDetail from './pages/ScanDetail';
import Scanner from './pages/Scanner';
import Settings from './pages/Settings';
import Recommendations from './pages/Recommendations';
import ThreatIntelligence from './pages/ThreatIntelligence';
import AdminPortal from './pages/AdminPortal';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmationProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                {/* Dashboard is accessible without authentication for demo purposes */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route
                  path="/inventory"
                  element={
                    <ProtectedRoute>
                      <Inventory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agents"
                  element={
                    <ProtectedRoute>
                      <Agents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/checklist"
                  element={
                    <ProtectedRoute>
                      <SecurityChecklist />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/scans"
                  element={
                    <ProtectedRoute>
                      <Scans />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/scans/:id"
                  element={
                    <ProtectedRoute>
                      <ScanDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/scanner"
                  element={
                    <ProtectedRoute>
                      <Scanner />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recommendations"
                  element={
                    <ProtectedRoute>
                      <Recommendations />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/threat-intelligence"
                  element={
                    <ProtectedRoute>
                      <ThreatIntelligence />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminPortal />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              
              {/* Background Scan Manager - Always visible when there are active scans */}
              <BackgroundScanManager />
            </BrowserRouter>
          </AuthProvider>
        </ConfirmationProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;

