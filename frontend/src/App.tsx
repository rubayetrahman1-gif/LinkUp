import { Routes, Route } from "react-router-dom";
import EmployerDashboard from "./pages/employer/EmployerDashboard";
import Home from "./pages/home/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import JobList from "./pages/jobs/JobList";
import JobDetails from "./pages/jobs/JobDetails";
import CreateJob from "./pages/employer/CreateJob";
import EditJob from "./pages/employer/EditJob";
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/employer/dashboard" element={<EmployerDashboard />} />
      <Route path="/employer/create-job" element={<CreateJob />} />
      <Route path="/employer/edit-job/:id" element={<EditJob />} />
      <Route path="/jobs" element={<JobList />} />
      <Route path="/jobs/:id" element={<JobDetails />} />
    </Routes>
  );
}

export default App;