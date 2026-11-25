import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Menu,
  X,
  UserRound,
  ArrowUpRight,
  ChevronDown,
  CalendarDays,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { Home } from "./Home";
import { Auth, Catalog, Detail, Booking, Enquiry } from "./Public";
const Panel = React.lazy(() =>
  import("./Panel").then((m) => ({ default: m.Panel })),
);
import { AppCtx, api, Title, Btn } from "./shared";
import "./style.css";
const links = [
  ["/", "Home"],
  ["/about", "About us"],
  ["/services", "Detailing services"],
  ["/book-detailing", "Book detailing"],
  ["/buy-used-cars", "Buy cars"],
  ["/sell-your-car", "Sell your car"],
  ["/contact", "Contact"],
];
function App() {
  const [data, D] = useState<any>(null),
    [me, setMe] = useState<any>(null),
    [error, E] = useState(""),
    [toast, notify] = useState(""),
    [open, M] = useState(false),
    { pathname } = useLocation(),
    nav = useNavigate();
  async function refresh() {
    try {
      const [d, u] = await Promise.all([api("/catalog"), api("/me")]);
      D(d);
      setMe(u);
      E("");
    } catch (e: any) {
      E(e.message);
    }
  }
  async function logout() {
    await api("/auth/logout", {});
    setMe(null);
    nav("/");
  }
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    M(false);
    window.scrollTo(0, 0);
    const p = pathname.split("/").filter(Boolean).pop()?.replaceAll("-", " "),
      title = (p ? p[0].toUpperCase() + p.slice(1) + " | " : "") + "CARBAAZ";
    document.title = title;
    document
      .querySelector("link[rel=canonical]")
      ?.setAttribute("href", "https://carbaaz.in" + pathname);
    for (const [k, v] of Object.entries({
      "og:title": title,
      "og:url": "https://carbaaz.in" + pathname,
      "og:image": "https://carbaaz.in/media/hero.webp",
      "og:description":
        data?.settings.description ||
        "Premium car detailing and pre-owned vehicles at CARBAAZ.",
    })) {
      let el = document.querySelector('meta[property="' + k + '"]');
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", k);
        document.head.append(el);
      }
      el.setAttribute("content", v);
    }
  }, [pathname, data]);
  useEffect(() => {
    if (toast) {
      let t = setTimeout(() => notify(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!data) return;
    const c = data.cars.find(
      (x: any) => pathname === "/buy-used-cars/" + x.slug,
    );
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify(
      c
        ? {
            "@context": "https://schema.org",
            "@type": "Car",
            name: c.manufacturer + " " + c.model,
            model: c.model,
            image: c.images.map(
              (i: any) => new URL(i.url, "https://carbaaz.in").href,
            ),
            offers: {
              "@type": "Offer",
              price: c.price,
              priceCurrency: "INR",
              url: "https://carbaaz.in" + pathname,
            },
          }
        : {
            "@context": "https://schema.org",
            "@type": "AutomotiveBusiness",
            name: "CARBAAZ",
            url: "https://carbaaz.in",
            logo: "https://carbaaz.in/media/brand.webp",
            ...(data.settings.address
              ? { address: data.settings.address }
              : {}),
          },
    );
    document.head.append(el);
    document
      .querySelector("link[rel=icon]")
      ?.setAttribute("href", data.settings.favicon || "/media/brand.webp");
    if (data.settings.description)
      document
        .querySelector("meta[name=description]")
        ?.setAttribute("content", data.settings.description);
    return () => el.remove();
  }, [data, pathname]);
  let logo = data?.settings.logo || "/media/official-logo.png";
  return (
    <AppCtx.Provider value={{ data, me, setMe, refresh, notify, logout }}>
      <header>
        <div className="shell nav">
          <Link to="/" aria-label="CARBAAZ home">
            <img className="brand" src={logo} alt="CARBAAZ" />
          </Link>
          <nav className={open ? "open" : ""}>
            {links.map(([url, t]) => (
              <Link
                key={url}
                className={url === pathname ? "active" : ""}
                to={url}
              >
                {t}
              </Link>
            ))}
          </nav>
          <div className="navActions">
            <Link className="navBook" to="/book-detailing">
              <CalendarDays size={15} />
              Book Detailing
            </Link>
            <Link
              className="login"
              to={
                me
                  ? me.role === "Customer"
                    ? "/customer/dashboard"
                    : me.role === "Staff"
                      ? "/admin/bookings"
                      : "/admin/dashboard"
                  : "/login"
              }
            >
              <UserRound size={15} />
              {me ? "Account" : "Login"}
              <ArrowUpRight size={13} />
            </Link>
          </div>
          <button
            className="menu"
            aria-label="Toggle navigation"
            onClick={() => M(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {error ? (
        <main className="section shell">
          <h2>Unable to load CARBAAZ</h2>
          <p>{error}</p>
          <button onClick={refresh}>Retry</button>
        </main>
      ) : !data ? (
        <main className="section shell">Opening CARBAAZ…</main>
      ) : (
        <React.Suspense
          fallback={<main className="section shell">Loading workspace…</main>}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Catalog key="services" />} />
            <Route
              path="/buy-used-cars"
              element={<Catalog cars key="cars" />}
            />
            <Route path="/services/:slug" element={<Detail />} />
            <Route path="/buy-used-cars/:slug" element={<Detail car />} />
            <Route path="/book-detailing" element={<Booking />} />
            {[
              ["/car-enquiry", "Buy"],
              ["/sell-your-car", "Sell"],
              ["/track-enquiry", "Track"],
              ["/contact", "Contact"],
            ].map(([p, k]) => (
              <Route key={p} path={p} element={<Enquiry key={k} kind={k} />} />
            ))}
            {["login", "register", "forgot-password"].map((p) => (
              <Route key={p} path={p} element={<Auth key={p} />} />
            ))}
            <Route path="/admin/:module" element={<Panel admin />} />
            <Route path="/customer/:module" element={<Panel />} />
            <Route
              path="/about"
              element={
                <main className="section shell">
                  <Title
                    tag="INSIDE CARBAAZ"
                    title="Built around the drive."
                    desc="CARBAAZ brings detailing, workshop appointments and pre-owned vehicle enquiries into one place."
                  />
                  <img
                    className="wide"
                    src="/media/hero.webp"
                    alt="Porsche on the open road"
                  />
                  <div className="duo section">
                    <div>
                      <h2>Our mission.</h2>
                      <p>
                        Make professional car care easier to understand, book
                        and track.
                      </p>
                    </div>
                    <div>
                      <h2>Our vision.</h2>
                      <p>
                        A clearer journey from caring for your current car to
                        finding your next one.
                      </p>
                      <Btn to="/services">Explore the studio</Btn>
                    </div>
                  </div>
                  <div className="grid">
                    {[
                      [
                        "Our story",
                        data.settings.story ||
                          "The detailing studio and pre-owned marketplace share one CARBAAZ account.",
                      ],
                      [
                        "Our team",
                        data.settings.team ||
                          "Contact the workshop team to discuss your vehicle and the right treatment.",
                      ],
                      [
                        "Our workshop",
                        data.settings.workshop ||
                          "Choose a service, compare packages and reserve a visit through the booking calendar.",
                      ],
                    ].map(([t, d]) => (
                      <article className="panel" key={t}>
                        <h3>{t}</h3>
                        <p>{d}</p>
                      </article>
                    ))}
                  </div>
                  <section className="section">
                    <h2>Automotive expertise.</h2>
                    <p>
                      Explore {data.services.length} detailing services, from
                      interior care to paint protection.
                    </p>
                    <Link to="/contact">Speak to the workshop ↗</Link>
                  </section>
                  {data.testimonials.map((t: any) => (
                    <blockquote key={t.id}>
                      {t.value} — {t.name}
                    </blockquote>
                  ))}
                </main>
              }
            />
            <Route
              path="*"
              element={
                <main className="section shell">
                  <Title tag="404" title="Page not found." />
                  <Btn to="/">Return home</Btn>
                </main>
              }
            />
          </Routes>
        </React.Suspense>
      )}
      <footer>
        <div className="shell foot">
          <div>
            <img className="brand" src={logo} alt="CARBAAZ" />
            <p style={{ marginTop: 10 }}>
              Premium car care and trusted car deals across India.
            </p>
            <div className="socials">
              <a
                href={data?.settings.instagram || "https://instagram.com"}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </a>
              <a
                href={data?.settings.facebook || "https://facebook.com"}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
              <a
                href={data?.settings.youtube || "https://youtube.com"}
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                  <path d="m10 15 5-3-5-3v6z" />
                </svg>
              </a>
              <a
                href={data?.settings.linkedin || "https://linkedin.com"}
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect width="4" height="12" x="2" y="9" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            </div>
          </div>
          <div>
            <small>EXPLORE</small>
            {[
              ["/", "Home"],
              ["/about", "About us"],
              ["/services", "Detailing services"],
              ["/buy-used-cars", "Buy cars"],
            ].map(([p, t]) => (
              <Link key={p} to={p}>
                {t}
              </Link>
            ))}
          </div>
          <div>
            <small>CONCIERGE</small>
            {[
              ["/book-detailing", "Book detailing"],
              ["/sell-your-car", "Sell your car"],
              ["/track-enquiry", "Track enquiry"],
              ["/login", "Member access"],
            ].map(([p, t]) => (
              <Link key={p} to={p}>
                {t}
              </Link>
            ))}
          </div>
          <div>
            <small>CONTACT</small>
            <p style={{ fontSize: 13, marginTop: 8 }}>
              <Phone size={13} style={{ display: "inline", marginRight: 6 }} />
              {data?.settings.phone || "+91 98765 43210"}
            </p>
            <p style={{ fontSize: 13, marginTop: 6 }}>
              <Mail size={13} style={{ display: "inline", marginRight: 6 }} />
              {data?.settings.email || "support@carbaaz.in"}
            </p>
            <p style={{ fontSize: 13, marginTop: 6 }}>
              <MapPin size={13} style={{ display: "inline", marginRight: 6 }} />
              {data?.settings.address || "Gomti Nagar, Lucknow, UP"}
            </p>
            <Link to="/contact">Contact us →</Link>
          </div>
        </div>
        <div className="shell copyright">
          © {new Date().getFullYear()} CARBAAZ <span>CARBAAZ.IN</span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </AppCtx.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
