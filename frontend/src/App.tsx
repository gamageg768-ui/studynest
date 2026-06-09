import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import NotebookView from "./pages/NotebookView";
import PageEditor from "./pages/PageEditor";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <span className="spinner" /> Loading...
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="notebooks/:id" element={<NotebookView />} />
        <Route path="notebooks/:id/pages/:pageId" element={<PageEditor />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
