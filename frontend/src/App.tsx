import heroImage from './assets/hero.png'
import './App.css'

const pathways = [
  {
    number: '01',
    title: 'Find your next move',
    description:
      'Explore opportunities that match your skills, goals, and the way you want to work.',
    label: 'For job seekers',
    href: '#opportunities',
  },
  {
    number: '02',
    title: 'Meet the right people',
    description:
      'Bring thoughtful employers and talented people together in one welcoming place.',
    label: 'For employers',
    href: '#employers',
  },
  {
    number: '03',
    title: 'Make room to grow',
    description:
      'Take the next step with a clearer view of where your career can go.',
    label: 'For your future',
    href: '#about',
  },
]

function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      viewBox="0 0 36 36"
      fill="none"
    >
      <rect x="3" y="3" width="30" height="30" rx="10" fill="currentColor" />
      <path
        d="M12 18h12M18 12v12"
        stroke="white"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path
        d="M4.5 10h11m-4.5-4.5L15.5 10 11 14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function App() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="LinkUp home">
          <BrandMark />
          <span>link<span className="brand-accent">up</span></span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#opportunities">Find a job</a>
          <a href="#about">How it works</a>
          <a href="#employers">For employers</a>
        </nav>

        <div className="header-actions">
          <a className="login-link" href="#get-started">Log in</a>
          <a className="button button-small" href="#get-started">
            Get started
            <ArrowIcon />
          </a>
        </div>
      </header>

      <main>
        <section className="hero-section" id="home">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              A better way to find work
            </p>
            <h1>
              Find work that
              <br />
              <span>moves you forward.</span>
            </h1>
            <p className="hero-description">
              Your next opportunity is out there. LinkUp helps you find the
              right people, the right role, and a place to grow.
            </p>
            <div className="hero-actions">
              <a className="button" href="#opportunities">
                Explore opportunities
                <ArrowIcon />
              </a>
              <a className="text-link" href="#employers">
                I&apos;m hiring
                <ArrowIcon />
              </a>
            </div>
            <div className="hero-note">
              <span className="note-avatars" aria-hidden="true">
                <span>J</span>
                <span>M</span>
                <span>A</span>
              </span>
              <p>
                <strong>People first.</strong> Opportunities that feel right.
              </p>
            </div>
          </div>

          <div
            className="hero-visual"
            role="img"
            aria-label="A fresh start, made simple"
          >
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <img className="hero-art" src={heroImage} alt="" />
            <div className="visual-card visual-card-top">
              <span className="visual-card-icon">✳</span>
              <span>
                <strong>Your next chapter</strong>
                <small>starts here</small>
              </span>
            </div>
            <div className="visual-card visual-card-bottom">
              <span className="availability-dot" />
              <span>
                <strong>Good things ahead</strong>
                <small>Make your next move</small>
              </span>
              <ArrowIcon />
            </div>
            <span className="visual-sparkle sparkle-one">✳</span>
            <span className="visual-sparkle sparkle-two">✦</span>
          </div>
        </section>

        <section className="pathways-section" id="opportunities">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Make your next move</p>
              <h2>Good work starts with a good connection.</h2>
            </div>
            <p className="section-intro">
              Whether you&apos;re looking for your next role or your next great
              hire, you&apos;re in the right place.
            </p>
          </div>

          <div className="pathway-grid">
            {pathways.map((pathway) => (
              <a
                className="pathway-card"
                href={pathway.href}
                key={pathway.number}
                id={pathway.number === '02' ? 'employers' : undefined}
              >
                <span className="pathway-number">{pathway.number}</span>
                <span className="pathway-label">{pathway.label}</span>
                <h3>{pathway.title}</h3>
                <p>{pathway.description}</p>
                <span className="pathway-arrow">
                  <ArrowIcon />
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="closing-section" id="get-started">
          <div>
            <p className="eyebrow">Your next step starts here</p>
            <h2>Ready to see what&apos;s possible?</h2>
          </div>
          <a className="button button-light" href="#get-started">
            Join LinkUp
            <ArrowIcon />
          </a>
        </section>
      </main>

      <footer className="site-footer" id="about">
        <a className="brand footer-brand" href="#home">
          <BrandMark />
          <span>link<span className="brand-accent">up</span></span>
        </a>
        <p>Bringing good people and good opportunities together.</p>
        <span className="footer-copyright">© 2026 LinkUp</span>
      </footer>
    </div>
  )
}

export default App
