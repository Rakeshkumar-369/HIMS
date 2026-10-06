import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/authCtx';
import AppShell from './components/AppShell';
import { PageLoader } from './components/ui';
import { homeFor } from './lib/routes';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const Today = lazy(() => import('./pages/Today'));
const NewCase = lazy(() => import('./pages/NewCase'));
const Consult = lazy(() => import('./pages/Consult'));
const Patients = lazy(() => import('./pages/Patients'));
const PatientFile = lazy(() => import('./pages/PatientFile'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Clinics = lazy(() => import('./pages/Clinics'));
const Settings = lazy(() => import('./pages/Settings'));
const PrintVisit = lazy(() => import('./pages/PrintVisit'));
const PrintPatient = lazy(() => import('./pages/PrintPatient'));
const PortalLogin = lazy(() => import('./pages/portal/PortalLogin'));
const Portal = lazy(() => import('./pages/portal/Portal'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminHome = lazy(() => import('./pages/admin/AdminHome'));
const AdminDoctors = lazy(() => import('./pages/admin/AdminDoctors'));
const AdminDoctorNew = lazy(() => import('./pages/admin/AdminDoctorNew'));
const AdminDoctor = lazy(() => import('./pages/admin/AdminDoctor'));
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit'));

/** Clinic staff (doctors & nurses) only. */
function Staff({ doctor, children }) {
  const { user, loading, clinics, logout } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password || user.role === 'admin') return <Navigate to={homeFor(user)} replace />;
  if (doctor && user.role !== 'doctor') return <Navigate to="/app/today" replace />;
  if (!clinics.length) {
    if (user.role === 'doctor') return pathname.startsWith('/app/clinics') ? children : <Navigate to="/app/clinics" replace />;
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="card max-w-sm p-8">
          <p className="text-lg font-bold">You’re not linked to a clinic yet</p>
          <p className="mt-2 text-sm text-muted">Ask your doctor to add your email under Clinics → Team.</p>
          <button className="btn-soft mt-6" onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }
  return children;
}

/** Platform administrators (the CareNest team) only. */
function Admin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' || user.must_change_password) return <Navigate to={homeFor(user)} replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={loading ? <PageLoader /> : <Navigate to={user ? homeFor(user) : '/login'} replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/portal/login" element={<PortalLogin />} />
        <Route path="/portal" element={<Portal />} />
        <Route path="/print/visit/:id" element={<Staff><PrintVisit /></Staff>} />
        <Route path="/print/patient/:id" element={<Staff><PrintPatient /></Staff>} />
        <Route path="/app" element={<Staff><AppShell /></Staff>}>
          <Route index element={<Navigate to="today" replace />} />
          <Route path="today" element={<Today />} />
          <Route path="register" element={<NewCase />} />
          <Route path="consult" element={<Staff doctor><Consult /></Staff>} />
          <Route path="consult/:visitId" element={<Staff doctor><Consult /></Staff>} />
          <Route path="patients" element={<Patients />} />
          <Route path="patients/:id" element={<PatientFile />} />
          <Route path="dashboard" element={<Staff doctor><Dashboard /></Staff>} />
          <Route path="accounts" element={<Staff doctor><Accounts /></Staff>} />
          <Route path="clinics" element={<Staff doctor><Clinics /></Staff>} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/admin" element={<Admin><AdminLayout /></Admin>}>
          <Route index element={<AdminHome />} />
          <Route path="doctors" element={<AdminDoctors />} />
          <Route path="doctors/new" element={<AdminDoctorNew />} />
          <Route path="doctors/:id" element={<AdminDoctor />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
