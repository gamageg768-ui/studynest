"use client";
import { useState } from "react";
import { api, getErrorMessage } from "@/lib/client";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saveProfile = async () => {
    setProfileLoading(true);
    setProfileMsg(null);
    try {
      const res = await api.patch<{ user: { id: number; username: string; display_name: string } }>("/auth/profile", { display_name: displayName });
      updateUser(res.data.user as any);
      setProfileMsg({ ok: true, text: "Display name updated!" });
    } catch (e) {
      setProfileMsg({ ok: false, text: getErrorMessage(e) });
    } finally {
      setProfileLoading(false);
    }
  };

  const changePassword = async () => {
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: "New passwords do not match" });
      return;
    }
    setPwLoading(true);
    setPwMsg(null);
    try {
      await api.patch("/auth/password", { current_password: currentPw, new_password: newPw });
      setPwMsg({ ok: true, text: "Password updated successfully!" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      setPwMsg({ ok: false, text: getErrorMessage(e) });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 560 }}>
      <h1 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 700 }}>Settings</h1>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Profile</h2>
        <div style={{ marginBottom: 14 }}>
          <label>Username</label>
          <input className="input" value={`@${user?.username}`} disabled style={{ opacity: 0.6 }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label>Display name</label>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveProfile()}
          />
        </div>
        {profileMsg && (
          <div style={{ marginBottom: 10, fontSize: 13, color: profileMsg.ok ? "var(--success)" : "var(--danger)" }}>
            {profileMsg.text}
          </div>
        )}
        <button className="btn btn-primary" onClick={saveProfile} disabled={profileLoading || !displayName.trim()}>
          {profileLoading ? "Saving…" : "Save"}
        </button>
      </div>

      {!user?.is_guest && (
        <div className="card">
          <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Change Password</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <div>
              <label>Current password</label>
              <input className="input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            </div>
            <div>
              <label>New password</label>
              <input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div>
              <label>Confirm new password</label>
              <input className="input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
          </div>
          {pwMsg && (
            <div style={{ marginBottom: 10, fontSize: 13, color: pwMsg.ok ? "var(--success)" : "var(--danger)" }}>
              {pwMsg.text}
            </div>
          )}
          <button className="btn btn-primary" onClick={changePassword} disabled={pwLoading || !currentPw || !newPw || !confirmPw}>
            {pwLoading ? "Updating…" : "Update Password"}
          </button>
        </div>
      )}
    </div>
  );
}
