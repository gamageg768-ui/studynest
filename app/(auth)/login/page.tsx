"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/client";

export default function LoginPage() {
  const { user, login, loginAsGuest } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError("");
    setGuestLoading(true);
    try {
      await loginAsGuest();
      router.replace("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">📒</div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Log in to your StudyNest</p>
        {error && <div className="error-banner">{error}</div>}
        <form className="auth-form" onSubmit={submit}>
          <div>
            <label>Username</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <div className="auth-divider">or</div>
        <button className="btn btn-secondary" style={{ width: "100%" }} onClick={handleGuest} disabled={guestLoading}>
          {guestLoading ? "Starting..." : "Continue as Guest"}
        </button>
        <div className="auth-footer">
          New to StudyNest? <Link href="/register">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
