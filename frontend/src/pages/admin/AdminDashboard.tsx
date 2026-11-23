import { PublicLayout } from "../../components/SiteLayout";

function AdminDashboard() {
  return (
    <PublicLayout>
      <main className="form-page">
        <div className="page-shell">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            ADMIN WORKSPACE
          </span>
          <h1 className="page-title">Admin dashboard</h1>
          <p className="page-subtitle">
            You are signed in with administrator access.
          </p>
        </div>
      </main>
    </PublicLayout>
  );
}

export default AdminDashboard;
