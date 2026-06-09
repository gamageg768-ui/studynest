import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../api/client";

export default function Login() {
  const { user, login, loginAsGuest } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
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
      navigate("/");
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
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <div className="auth-divider">or</div>
        <button
          className="btn btn-secondary"
          style={{ width: "100%" }}
          onClick={handleGuest}
          disabled={guestLoading}
        >
          {guestLoading ? "Starting..." : "Continue as Guest"}
        </button>
        <div className="auth-footer">
          New to StudyNest? <Link to="/register">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
