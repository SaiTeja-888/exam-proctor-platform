import { Activity, LayoutDashboard, LogIn, Monitor, ShieldCheck, UserRound } from "lucide-react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import CandidateLogin from "./pages/CandidateLogin";
import ExamBuilder from "./pages/ExamBuilder";
import ExamPage from "./pages/ExamPage";
import ExamResult from "./pages/ExamResult";
import FaceRegistration from "./pages/FaceRegistration";
import IncidentReport from "./pages/IncidentReport";
import InviteManager from "./pages/InviteManager";
import LiveMonitor from "./pages/LiveMonitor";

function App() {
  return (
    <div className="app-shell">
      <TopNav />
      <main className="mx-auto mt-5 max-w-7xl">
        <Routes>
          <Route path="/" element={<Navigate to="/candidate" replace />} />
          <Route path="/candidate" element={<CandidateLogin />} />
          <Route path="/face-registration" element={<FaceRegistration />} />
          <Route path="/exam" element={<ExamPage />} />
          <Route path="/result/:candidateId" element={<ExamResult />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/exams/new" element={<ExamBuilder />} />
          <Route path="/admin/exams/:examId/builder" element={<ExamBuilder />} />
          <Route path="/admin/exams/:examId/invites" element={<InviteManager />} />
          <Route path="/admin/live" element={<LiveMonitor />} />
          <Route path="/admin/incidents/:candidateId" element={<IncidentReport />} />
        </Routes>
      </main>
    </div>
  );
}

function TopNav() {
  const location = useLocation();
  const nav = [
    { to: "/candidate", label: "Candidate", icon: UserRound },
    { to: "/admin", label: "Admin", icon: LayoutDashboard },
    { to: "/admin/live", label: "Live", icon: Monitor },
  ];
  return (
    <header className="mx-auto flex max-w-7xl flex-col gap-4 rounded-lg border border-line bg-panel/70 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-between">
      <Link to="/" className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-mint text-ink">
          <ShieldCheck size={22} />
        </span>
        <span>
          <span className="block text-lg font-bold leading-tight">Sentinel Proctor</span>
          <span className="text-xs text-slate-400">AI exam operations console</span>
        </span>
      </Link>
      <nav className="flex flex-wrap items-center gap-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to || (item.to !== "/candidate" && location.pathname.startsWith(item.to));
          return (
            <Link key={item.to} to={item.to} className={active ? "tab-button tab-button-active" : "tab-button"}>
              <span className="inline-flex items-center gap-2">
                <Icon size={16} />
                {item.label}
              </span>
            </Link>
          );
        })}
        <Link to="/admin/login" className="icon-btn" title="Admin login">
          <LogIn size={18} />
        </Link>
        <span className="status-pill border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
          <Activity size={13} />
          Online
        </span>
      </nav>
    </header>
  );
}

export default App;
