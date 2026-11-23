import { Routes, Route } from "react-router-dom";
import EmployerDashboard from "./pages/employer/EmployerDashboard";
import Home from "./pages/home/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import JobList from "./pages/jobs/JobList";
import JobDetails from "./pages/jobs/JobDetails";
import CreateJob from "./pages/employer/CreateJob";
import EditJob from "./pages/employer/EditJob";
import ApplicationHistory from "./pages/jobs/ApplicationHistory";
import ProfileSettings from "./pages/settings/ProfileSettings";
import EmployerApplications from "./pages/employer/EmployerApplications";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetails from "./pages/admin/AdminUserDetails";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/register" element={<Register />} />
        <Route
          path="/employer/dashboard"
          element={
            <ProtectedRoute allowedRoles={["employer"]}>
              <EmployerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/create-job"
          element={
            <ProtectedRoute allowedRoles={["employer"]}>
              <CreateJob />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/edit-job/:id"
          element={
            <ProtectedRoute allowedRoles={["employer"]}>
              <EditJob />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/applications"
          element={
            <ProtectedRoute allowedRoles={["employer"]}>
              <EmployerApplications />
            </ProtectedRoute>
          }
        />
        <Route path="/jobs" element={<JobList />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route
          path="/applications"
          element={
            <ProtectedRoute allowedRoles={["job_seeker"]}>
              <ApplicationHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/:id"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminUserDetails />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;