import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Sparkles,
  BadgeIndianRupee,
  Headphones,
  Star,
  CarFront,
  CheckCircle2,
  MapPin,
  Users,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  useApp,
  Tag,
  Btn,
  ServiceCard,
  CarCard,
  api,
  Submit,
  useAction,
} from "./shared";
const trust = [
  [Sparkles, "Expert detailing", "Precision in every detail"],
  [ShieldCheck, "Pre-owned cars", "Explore our inventory"],
  [BadgeIndianRupee, "Transparent pricing", "Know what you pay"],
  [Headphones, "Personal support", "Here for your journey"],
] as const;

const stats = [
  [Sparkles, "2,500+", "Cars Detailed"],
  [CarFront, "500+", "Pre-Owned Cars"],
  [Users, "50,000+", "Happy Customers"],
  [MapPin, "5+", "Cities Served"],
] as const;

const studios = [
  {
    city: "Lucknow",
    area: "Gomti Nagar Studio",
    desc: "Flagship detailing bay, ceramic coating lab & certified pre-owned lounge.",
    img: "/media/hero.webp",
  },
  {
    city: "Delhi",
    area: "South Delhi Hub",
    desc: "Paint correction specialists, PPF installation & concierge car deals.",
    img: "/media/paint.webp",
  },
  {
    city: "Mumbai",
    area: "Bandra West Studio",
    desc: "Luxury car care, graphene coating & curated pre-owned collection.",
    img: "/media/interior.webp",
  },
];

const galleryTabs = ["All", "Detailing", "PPF", "Ceramic Coating", "Events"];

const defaultGallery = [
  { id: "g1", name: "Ceramic Coating", value: "/media/paint.webp", cat: "Ceramic Coating" },
  { id: "g2", name: "Interior Detailing", value: "/media/interior.webp", cat: "Detailing" },
  { id: "g3", name: "Signature Foam Wash", value: "/media/wash.webp", cat: "Detailing" },
  { id: "g4", name: "PPF Protection Studio", value: "/media/hero.webp", cat: "PPF" },
  { id: "g5", name: "BMW M-Series Showcase", value: "/media/bmw.webp", cat: "Events" },
  { id: "g6", name: "Audi Pre-Owned Event", value: "/media/audi.webp", cat: "Events" },
];

export function Home() {
  const { data } = useApp(),
    [slide, set] = useState(0),
    [start, shift] = useState(0),
    [gTab, setGTab] = useState("All"),
    [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null),
    a = useAction();
  const shots = [
    ["hero", "Porsche Panamera"],
    ["bmw", "BMW collection"],
    ["audi", "Audi collection"],
  ];

  const galleryItems =
    data.gallery.length > 0
      ? data.gallery.map((g: any) => ({
          ...g,
          cat:
            galleryTabs.find(
              (t) => t !== "All" && g.name?.toLowerCase().includes(t.toLowerCase().split(" ")[0]),
            ) || "Detailing",
        }))
      : defaultGallery;

  const visibleGallery =
    gTab === "All"
      ? galleryItems
      : galleryItems.filter((g: any) => g.cat === gTab);
  return (
    <>
      <section className="hero">
        <div
          className="heroPic"
          key={slide}
          style={{
            backgroundImage:
              "url(" +
              (slide === 0 && data.settings.banner
                ? data.settings.banner
                : "/media/" + shots[slide][0] + ".webp") +
              ")",
          }}
        />
        <div className="heroShade" />
        <div className="shell heroInner">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Tag>THE CARBAAZ EXPERIENCE</Tag>
            <h1>
              Your Car.
              <br />
              Our Passion.
              <br />
              <em>Premium Care.</em>
            </h1>
            <p>
              Experience professional car detailing, premium car care
              <br className="desktop" /> and trusted pre-owned car deals with
              CARBAAZ.
            </p>
            <div className="actions">
              <Btn to="/book-detailing">
                <CalendarDays size={17} /> Book detailing{" "}
                <ArrowUpRight size={16} />
              </Btn>
              <Btn ghost to="/buy-used-cars">
                Browse used cars <ArrowRight size={17} />
              </Btn>
            </div>
          </motion.div>
          <div className="heroBottom">
            <Link to="/services">
              <span>↓</span> EXPLORE SERVICES
            </Link>
            <div className="slider">
              <b>0{slide + 1}</b>
              <i />
              03{" "}
              <button
                aria-label="Previous photograph"
                onClick={() => set((slide + 2) % 3)}
              >
                <ChevronLeft />
              </button>
              <button
                aria-label="Next photograph"
                onClick={() => set((slide + 1) % 3)}
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        </div>
      </section>
      <section className="trust">
        <div className="shell trustGrid">
          {trust.map(([I, t, d]) => (
            <div key={t}>
              <I />
              <div>
                <strong>{t}</strong>
                <small>{d}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="stats-bar">
        <div className="shell stats-grid">
          {stats.map(([Icon, num, label]) => (
            <div className="stat-item" key={label}>
              <Icon size={28} />
              <div>
                <div className="stat-number">{num}</div>
                <div className="stat-label">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="section shell">
        <Tag>THE DETAILING STUDIO</Tag>
        <div className="heading">
          <div>
            <h2>
              Our signature <em>services.</em>
            </h2>
            <p>Specialist treatments for every surface, inside and out.</p>
          </div>
          <Link className="outline" to="/services">
            View all services <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="grid">
          {data.services.slice(start, start + 3).map((s: any, i: number) => (
            <ServiceCard key={s.id} s={s} i={i + start} />
          ))}
        </div>
        <div className="pagination">
          <button
            onClick={() => shift(Math.max(0, start - 3))}
            disabled={!start}
          >
            ←
          </button>
          <small>
            {start + 1} – {Math.min(start + 3, data.services.length)} /{" "}
            {data.services.length}
          </small>
          <button
            onClick={() => shift(start + 3)}
            disabled={start + 3 >= data.services.length}
          >
            →
          </button>
        </div>
      </section>
      <section className="band">
        <div className="section shell">
          <Tag>THE MARKETPLACE</Tag>
          <div className="heading">
            <h2>
              Featured <em>vehicles.</em>
            </h2>
            <Link className="outline" to="/buy-used-cars">
              Browse inventory <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="grid">
            {data.cars
              .filter((c: any) => c.featured)
              .slice(0, 3)
              .map((c: any) => (
                <CarCard c={c} key={c.id} />
              ))}
          </div>
          {!data.cars.length && (
            <p>New vehicles will appear here when listed.</p>
          )}
        </div>
      </section>
      <section className="section shell">
        <Tag>HOW IT WORKS</Tag>
        <h2>
          Your workshop <em>visit.</em>
        </h2>
        <div className="steps-grid">
          {[
            [
              Sparkles,
              "Choose your treatment",
              "Explore services and compare transparent package prices.",
            ],
            [
              CalendarDays,
              "Reserve a time",
              "Pick a workshop slot and confirm your vehicle details.",
            ],
            [
              CheckCircle2,
              "Bring your car",
              "Track confirmation and live progress in your account.",
            ],
          ].map(([Icon, n, desc]: any, i) => (
            <div className="step-card" key={n}>
              <div className="step-icon">
                <Icon size={22} />
              </div>
              <small>STEP 0{i + 1}</small>
              <h3>{n}</h3>
              <p>{desc}</p>
              {i < 2 && (
                <span className="step-arrow" aria-hidden="true">
                  <ArrowRight size={14} />
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="band">
        <div className="section shell duo">
          <div>
            <Tag>SELL YOUR CAR</Tag>
            <h2>
              Sell your car with <em>confidence.</em>
            </h2>
            <p>
              Skip the guesswork. Get an expert evaluation and transparent offer
              from CARBAAZ.
            </p>
            <div className="benefit-list">
              {[
                "Get Best Market Price",
                "Free Inspection",
                "Quick & Hassle-Free Process",
              ].map((b) => (
                <div className="benefit-item" key={b}>
                  <CheckCircle2 size={18} />
                  <span>{b}</span>
                </div>
              ))}
            </div>
            <Btn to="/sell-your-car">
              Start Selling Now <ArrowRight size={16} />
            </Btn>
          </div>
          <img
            className="banner"
            src="/media/bmw.webp"
            alt="Sell your car with CARBAAZ"
          />
        </div>
      </section>
      <section className="section shell">
        <Tag>OUR STUDIOS</Tag>
        <div className="heading">
          <div>
            <h2>
              Visit our premium <em>studios.</em>
            </h2>
            <p>State-of-the-art detailing bays and pre-owned lounges.</p>
          </div>
          <Link className="outline" to="/contact">
            Find a studio <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="grid">
          {studios.map((st) => (
            <article className="location-card" key={st.city}>
              <div className="location-photo">
                <img loading="lazy" src={st.img} alt={st.city} />
                <span className="location-city">{st.city}</span>
              </div>
              <div className="location-body">
                <h3>{st.area}</h3>
                <p>{st.desc}</p>
                <div className="cardFoot">
                  <span>CARBAAZ Studio</span>
                  <Link to="/contact">
                    Book visit <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="section shell duo">
        <div>
          <Tag>OWNER’S GUIDE</Tag>
          <h2>Good to know.</h2>
          {[
            "Can I reschedule my booking?",
            "How do I sell my car?",
            "Where can I track my enquiry?",
          ].map((q, i) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>
                {
                  [
                    "Open My bookings in your customer dashboard and choose an available slot.",
                    "Submit vehicle details in Sell your car. Our team can review the request and record an offer.",
                    "Use your request ID and registered mobile number on Track enquiry.",
                  ][i]
                }
              </p>
            </details>
          ))}
        </div>
        <div className="panel">
          <Tag>CARBAAZ DISPATCH</Tag>
          <h3>Stay in the loop.</h3>
          <p>Receive workshop news and vehicle updates.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              a.run(() =>
                api("/newsletter", {
                  email: new FormData(e.currentTarget).get("email"),
                }),
              );
            }}
          >
            <input
              name="email"
              type="email"
              placeholder="Your email address"
              required
              aria-label="Newsletter email"
            />
            <Submit busy={a.busy}>Subscribe</Submit>
          </form>
          <p role="status">{a.msg}</p>
        </div>
      </section>
      <section className="shell section">
        <Tag>WORKSHOP GALLERY</Tag>
        <div className="heading">
          <div>
            <h2>
              Our work speaks <em>louder.</em>
            </h2>
            <p>Explore our detailing craft, PPF, ceramic coatings and events.</p>
          </div>
        </div>
        <div className="gallery-tabs" role="tablist" aria-label="Gallery categories">
          {galleryTabs.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={gTab === t}
              className={"gallery-tab " + (gTab === t ? "active" : "")}
              onClick={() => setGTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid">
          {visibleGallery.map((g: any) => (
            <div
              key={g.id}
              className="gallery-card"
              onClick={() => setLightbox({ src: g.value, alt: g.name })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" && setLightbox({ src: g.value, alt: g.name })
              }
            >
              <img loading="lazy" src={g.value} alt={g.name} />
              <div className="gallery-caption">{g.name}</div>
            </div>
          ))}
        </div>
        {!visibleGallery.length && (
          <p>No photos in this category yet. Select All to view the full gallery.</p>
        )}
      </section>
      {lightbox && (
        <div
          className="lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
        >
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button
              className="lightbox-close"
              aria-label="Close image"
              onClick={() => setLightbox(null)}
            >
              <X size={18} />
            </button>
            <img src={lightbox.src} alt={lightbox.alt} />
          </div>
        </div>
      )}
      {data.testimonials.length > 0 && (
        <section className="section shell">
          <Tag>OWNER STORIES</Tag>
          {data.testimonials.map((r: any) => (
            <blockquote key={r.id}>
              {r.value} — {r.name}
            </blockquote>
          ))}
        </section>
      )}
      <div className="shell heading section">
        <h2>Let’s talk cars.</h2>
        <Btn to="/contact">
          Contact CARBAAZ <ArrowRight size={16} />
        </Btn>
      </div>
    </>
  );
}
