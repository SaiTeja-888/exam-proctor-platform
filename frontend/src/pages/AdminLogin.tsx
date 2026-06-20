import { FormEvent, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import AlertBanner from "../components/AlertBanner";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/admin/login", { username, password });
      localStorage.setItem("admin_token", data.access_token);
      navigate("/admin");
    } catch {
      setError("Invalid admin credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid min-h-[72vh] place-items-center">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-mint text-ink">
            <ShieldCheck size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Admin Login</h1>
            <p className="text-sm text-slate-400">Exam builder and live monitoring</p>
          </div>
        </div>
        {error ? <AlertBanner tone="danger" message={error} /> : null}
        <div className="mt-5 space-y-4">
          <label className="block space-y-2">
            <span className="label">Username</span>
            <input className="field" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="block space-y-2">
            <span className="label">Password</span>
            <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="btn-primary w-full" disabled={loading}>
            <Lock size={18} />
            {loading ? "Signing in" : "Sign In"}
          </button>
        </div>
      </form>
    </section>
  );
}
