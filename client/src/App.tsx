import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.js';
import LoginPage from './pages/LoginPage.js';
import { Layout } from './components/Layout.js';
import OverviewPage from './pages/OverviewPage.js';
import SchedulePage from './pages/SchedulePage.js';
import CoveragePage from './pages/CoveragePage.js';
import TeamPage from './pages/TeamPage.js';
import FairnessPage from './pages/FairnessPage.js';
import AuditPage from './pages/AuditPage.js';
import MySchedulePage from './pages/staff/MySchedulePage.js';
import OpenShiftsPage from './pages/staff/OpenShiftsPage.js';
import MySwapsPage from './pages/staff/MySwapsPage.js';
import AvailabilityPage from './pages/staff/AvailabilityPage.js';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <LoginPage />;

  return (
    <Layout>
      <Routes>
        {user.role === 'staff' ? (
          <>
            <Route path="/" element={<Navigate to="/my-schedule" replace />} />
            <Route path="/my-schedule" element={<MySchedulePage />} />
            <Route path="/open-shifts" element={<OpenShiftsPage />} />
            <Route path="/my-swaps" element={<MySwapsPage />} />
            <Route path="/availability" element={<AvailabilityPage />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/coverage" element={<CoveragePage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/fairness" element={<FairnessPage />} />
            <Route path="/audit" element={<AuditPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
