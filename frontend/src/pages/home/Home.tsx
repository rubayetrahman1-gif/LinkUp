import { Link } from "react-router-dom";

function Home() {
  return (
    <div>
      <nav>
        <h2>LinkUp</h2>

        <div>
          <Link to="/">Home</Link>
          {" | "}
          <Link to="/jobs">Jobs</Link>
          {" | "}
          <Link to="/login">Login</Link>
          {" | "}
          <Link to="/register">Register</Link>
        </div>
      </nav>

      <main>
        <section>
          <h1>Find Your Next Opportunity</h1>

          <p>
            Connect with employers and discover job opportunities
            that match your skills and interests.
          </p>

          <Link to="/jobs">
            Explore Jobs
          </Link>
        </section>

        <section>
          <h2>Start Your Career Journey with LinkUp</h2>
          <p>
            Browse available jobs, apply for opportunities,
            and take the next step in your career.
          </p>
        </section>
      </main>
    </div>
  );
}

export default Home;