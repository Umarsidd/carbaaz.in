import { useForm } from "react-hook-form";
import React, { useEffect, useState } from "react";
import {
  Link,
  useParams,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  Search,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  Users,
  BadgeIndianRupee,
} from "lucide-react";
import {
  useApp,
  api,
  Title,
  Tag,
  Field,
  Submit,
  useAction,
  Btn,
  values,
  ServiceCard,
  CarCard,
  money,
  dateText,
} from "./shared";
export function Catalog({ cars = false }: any) {
  const { data } = useApp(),
    [filters, set] = useState<Record<string, string>>({}),
    [page, P] = useState(0);
  function change(k: string, v: string) {
    set({ ...filters, [k]: v });
    P(0);
  }
  const rows = (cars ? data.cars : data.services).filter((x: any) =>
    Object.entries(filters).every(
      ([k, v]) =>
        !v ||
        (k === "q"
          ? JSON.stringify(cars ? [x.manufacturer, x.model] : x.name)
              .toLowerCase()
              .includes(v.toLowerCase())
          : k === "max"
            ? x.price <= Number(v)
            : k === "min"
              ? x.price >= Number(v)
              : k === "distance"
                ? x.km <= Number(v)
                : String(x[k]) === v),
    ),
  );
  return (
    <main className="shell section">
      <Title
        tag={cars ? "THE MARKETPLACE" : "THE DETAILING STUDIO"}
        title={cars ? "Pre-owned cars." : "Detailing services."}
        desc={
          cars
            ? "Find a car that fits your next chapter."
            : "Explore specialist treatments and transparent package pricing."
        }
      />
      <div className="filters">
        {cars ? (
          <>
            <div className="filter-row">
              {[
                ["manufacturer", "Make"],
                ["model", "Model"],
                ["year", "Year"],
                ["fuel", "Fuel Type"],
              ].map(([k, lbl]) => (
                <Field
                  label={lbl}
                  key={k}
                  value={filters[k] || ""}
                  options={Array.from(
                    new Set(data.cars.map((c: any) => c[k]).filter(Boolean)),
                  )}
                  onChange={(e: any) => change(k, e.target.value)}
                />
              ))}
              <Field
                label="Search"
                placeholder="Keyword…"
                value={filters.q || ""}
                onChange={(e: any) => change("q", e.target.value)}
              />
            </div>
            <details>
              <summary>More vehicle filters</summary>
              <div className="formgrid">
                {["transmission", "ownership", "bodyType"].map((k) => (
                  <Field
                    label={k}
                    key={k}
                    options={Array.from(new Set(data.cars.map((c: any) => c[k])))}
                    onChange={(e: any) => change(k, e.target.value)}
                  />
                ))}
                {["min", "max", "distance"].map((k, i) => (
                  <Field
                    key={k}
                    label={
                      ["Minimum price", "Maximum price", "Maximum kilometres"][i]
                    }
                    type="number"
                    onChange={(e: any) => change(k, e.target.value)}
                  />
                ))}
              </div>
            </details>
          </>
        ) : (
          <Field
            label="Search"
            placeholder="Search treatments"
            onChange={(e: any) => change("q", e.target.value)}
          />
        )}
      </div>
      {cars && <h2 style={{ marginBottom: 20 }}>Popular Cars</h2>}
      <div className="grid">
        {rows
          .slice(page * 9, page * 9 + 9)
          .map((x: any, i: number) =>
            cars ? (
              <CarCard c={x} key={x.id} />
            ) : (
              <ServiceCard s={x} i={page * 9 + i} key={x.id} />
            ),
          )}
      </div>
      {!rows.length && <p>No matches. Try a different search.</p>}
      <div className="pagination">
        <button disabled={!page} onClick={() => P(page - 1)}>
          Previous
        </button>
        {page + 1} / {Math.max(1, Math.ceil(rows.length / 9))}
        <button
          disabled={(page + 1) * 9 >= rows.length}
          onClick={() => P(page + 1)}
        >
          Next
        </button>
      </div>
    </main>
  );
}
export function Detail({ car = false }: any) {
  const { slug } = useParams(),
    { data } = useApp(),
    x = (car ? data.cars : data.services).find((r: any) => r.slug === slug);
  if (!x) return <Title tag="CATALOG" title="Listing unavailable" />;
  return (
    <main className="section shell">
      <Tag>{car ? "VEHICLE DOSSIER" : "SERVICE DOSSIER"}</Tag>
      <div className="duo">
        <div>
          <h1>{car ? x.manufacturer + " " + x.model : x.name}</h1>
          <p>{x.description}</p>
          <h3>{car ? money(x.price) : x.duration + " minutes"}</h3>
          <Btn
            to={
              car
                ? "/car-enquiry?car=" + x.id
                : "/book-detailing?service=" + x.slug
            }
          >
            {car ? "Enquire now" : "Book this service"} <ArrowRight size={16} />
          </Btn>
        </div>
        <img
          className="banner"
          src={car ? x.images[0]?.url : x.image}
          alt={car ? x.model : x.name}
        />
      </div>
      <div className="duo section">
        <div className="panel">
          <h3>{car ? "Vehicle specifications" : "Available packages"}</h3>
          {car
            ? [
                "year",
                "km",
                "fuel",
                "transmission",
                "ownership",
                "bodyType",
                "registration",
              ].map((k) => (
                <p key={k}>
                  {k}: {x[k] || "On request"}
                </p>
              ))
            : x.packages.map((p: any) => (
                <p key={p.id}>
                  {p.name} · {money(p.price)}
                </p>
              ))}
        </div>
        <div className="panel">
          <h3>{car ? "Features" : "Benefits & process"}</h3>
          {(car ? x.features : x.benefits).map((s: string) => (
            <p key={s}>{s}</p>
          ))}
          {!car && (
            <>
              <p>{x.introduction}</p>
              <p>
                {(x.process?.length
                  ? x.process
                  : ["Vehicle inspection", "Treatment", "Finish inspection"]
                ).join(" → ")}
              </p>
              <Link to={"/contact?service=" + x.name}>
                Enquire about this service ↗
              </Link>
            </>
          )}
        </div>
      </div>
      {!car && (
        <section className="section">
          <h2>Inside the treatment.</h2>
          {x.beforeImage && x.afterImage && (
            <div className="duo">
              {[x.beforeImage, x.afterImage].map((url, i) => (
                <figure key={i}>
                  <img
                    className="banner"
                    src={url}
                    alt={i ? "After treatment" : "Before treatment"}
                  />
                  <figcaption>{i ? "After" : "Before"}</figcaption>
                </figure>
              ))}
            </div>
          )}
          <details>
            <summary>How long is my appointment?</summary>
            <p>Allow {x.duration} minutes for this service.</p>
          </details>
          <details>
            <summary>How do I compare packages?</summary>
            <p>
              Review the available packages above before choosing your workshop
              slot.
            </p>
          </details>
          <h3>Customer reviews</h3>
          {data.reviews.filter((r: any) => r.serviceId === x.id).length ? (
            data.reviews
              .filter((r: any) => r.serviceId === x.id)
              .map((r: any) => (
                <blockquote key={r.id}>
                  {r.value} — {r.name}
                </blockquote>
              ))
          ) : (
            <p>No published reviews yet.</p>
          )}
        </section>
      )}
      {car && (
        <>
          <div className="grid">
            {x.images.slice(1).map((i: any) => (
              <img key={i.id} src={i.url} alt={x.model} />
            ))}
          </div>
          <h2>More vehicles</h2>
          <div className="grid">
            {data.cars
              .filter((c: any) => c.id !== x.id)
              .slice(0, 3)
              .map((c: any) => (
                <CarCard key={c.id} c={c} />
              ))}
          </div>
        </>
      )}
    </main>
  );
}
export function Auth() {
  const { register, handleSubmit } = useForm<Record<string, string>>();
  const { pathname } = useLocation(),
    [q] = useSearchParams(),
    { setMe } = useApp(),
    nav = useNavigate(),
    a = useAction(),
    reg = pathname === "/register",
    forgot = pathname === "/forgot-password",
    token = q.get("token");
  return (
    <main className="section narrow">
      <img className="brand" src="/media/brand.webp" alt="CARBAAZ" />
      <Title
        tag="MEMBER ACCESS"
        title={
          reg
            ? "Create an account."
            : forgot
              ? token
                ? "Update your account."
                : "Recover access."
              : "Welcome back."
        }
      />
      <form
        className="panel"
        onSubmit={handleSubmit((b) => {
          a.run(async () => {
            if (forgot)
              return api(token ? "/auth/token" : "/auth/recover", {
                ...b,
                token,
                purpose: q.get("purpose"),
              });
            if (reg) return api("/auth/register", b);
            const u = await api("/auth/login", {
              ...b,
              remember: Boolean(b.remember),
            });
            setMe(u);
            nav(
              q.get("next") === "/book-detailing"
                ? "/book-detailing"
                : u.role === "Customer"
                  ? "/customer/dashboard"
                  : u.role === "Staff"
                    ? "/admin/bookings"
                    : "/admin/dashboard",
            );
          });
        })}
      >
        {reg && <Field {...register("name")} label="Full name" />}
        {!token && (
          <Field {...register("email")} type="email" label="Email address" />
        )}
        {(!forgot || (token && q.get("purpose") === "reset")) && (
          <Field
            {...register("password")}
            type="password"
            minLength={reg || forgot ? 10 : 1}
            label="Password"
          />
        )}
        {!reg && !forgot && (
          <label className="check">
            <input type="checkbox" {...register("remember")} />
            Remember me
          </label>
        )}
        <Submit busy={a.busy}>
          {forgot ? "Continue" : reg ? "Create account" : "Sign in"}
        </Submit>
        <p role="status">{a.msg}</p>
        <div className="actions">
          <Link to={reg || forgot ? "/login" : "/register"}>
            {reg || forgot ? "Sign in" : "Create account"}
          </Link>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
      </form>
    </main>
  );
}
export function Booking() {
  const { data, me } = useApp(),
    [q] = useSearchParams(),
    [step, S] = useState(0),
    [b, B] = useState<any>({
      service:
        data.services.find((x: any) => x.slug === q.get("service"))?.id || "",
      name: me?.name || "",
      email: me?.email || "",
      mobile: me?.mobile || "",
    }),
    [slots, U] = useState<string[]>([]),
    [err, E] = useState(""),
    a = useAction(),
    s = data.services.find((x: any) => x.id === b.service);
  const set = (k: string, v: string) =>
    B({
      ...b,
      [k]: v,
      ...(k === "service"
        ? { packageId: "", starts: "" }
        : k === "date"
          ? { starts: "" }
          : {}),
    });
  useEffect(() => {
    let live = true;
    U([]);
    E("");
    if (b.date && s)
      api("/slots?date=" + b.date + "&service=" + s.id)
        .then((r) => live && U(r))
        .catch((e) => live && E(e.message));
    return () => {
      live = false;
    };
  }, [b.date, s?.id]);
  const f = (k: string, label: string, extras: any = {}) => (
    <Field
      key={k}
      name={k}
      label={label}
      value={b[k] || ""}
      onChange={(e: any) => set(k, e.target.value)}
      {...extras}
    />
  );
  if (!me)
    return (
      <main className="narrow section">
        <Title
          tag="WORKSHOP APPOINTMENTS"
          title="Book detailing."
          desc="Sign in to reserve a workshop slot and manage your appointment."
        />
        <Btn to="/login?next=/book-detailing">Sign in to book</Btn>{" "}
        <Link to="/register">Create account</Link>
      </main>
    );
  const steps = [
    "Service",
    "Vehicle",
    "Package",
    "Schedule",
    "Contact",
    "Review",
  ];
  return (
    <main className="narrow section">
      <Title tag="WORKSHOP APPOINTMENTS" title="Book detailing." />
      <div className="progress">
        {steps.map((t, i) => (
          <i key={t} className={i <= step ? "on" : ""} />
        ))}
      </div>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 5) S(step + 1);
          else
            a.run(() =>
              api("/bookings", {
                packageId: b.packageId,
                starts: b.starts,
                vehicle: {
                  manufacturer: b.manufacturer,
                  model: b.model,
                  registration: b.registration,
                  type: b.type,
                },
                contact: {
                  name: b.name,
                  email: b.email,
                  mobile: b.mobile,
                  instructions: b.instructions,
                },
              }),
            );
        }}
      >
        <small>STEP 0{step + 1} / 06</small>
        <h3>{steps[step]}</h3>
        {step === 0 &&
          f("service", "Select service", {
            options: data.services.map((x: any) => ({
              value: x.id,
              label: x.name,
            })),
          })}
        {step === 1 &&
          ["manufacturer", "model", "registration", "type"].map((k) => f(k, k))}
        {step === 2 &&
          f("packageId", "Select package", {
            options:
              s?.packages.map((p: any) => ({
                value: p.id,
                label: p.name + " · " + money(p.price),
              })) || [],
          })}
        {step === 3 && (
          <>
            {f("date", "Workshop date", {
              type: "date",
              min: new Date().toISOString().slice(0, 10),
            })}
            {f("starts", "Available time (IST)", {
              options: slots.map((v) => ({ value: v, label: dateText(v) })),
            })}
            {err ||
              (b.date && !slots.length && "No slots available on this date.")}
          </>
        )}
        {step === 4 && (
          <>
            {f("name", "Full name")}
            {f("email", "Email", { type: "email" })}
            {f("mobile", "Mobile number", { pattern: "[+]?[0-9]{10,15}" })}
            {f("instructions", "Additional instructions", {
              type: "textarea",
              required: false,
            })}
          </>
        )}
        {step === 5 && (
          <p>
            {s?.name} ·{" "}
            {s?.packages.find((p: any) => p.id === b.packageId)?.name}
            <br />
            {dateText(b.starts)} · {b.manufacturer} {b.model}
            <br />
            {b.name} · {b.email}
          </p>
        )}
        <div className="actions">
          {step > 0 && (
            <button type="button" onClick={() => S(step - 1)}>
              Back
            </button>
          )}
          {!a.msg.startsWith("Received") && (
            <Submit busy={a.busy}>
              {step < 5 ? "Continue" : "Confirm booking"}
            </Submit>
          )}
        </div>
        <p role="status">{a.msg}</p>
        {a.msg.startsWith("Received") && (
          <Link to="/customer/bookings">View my bookings →</Link>
        )}
      </form>
    </main>
  );
}
export function Enquiry({ kind }: any) {
  const { me, data } = useApp(),
    a = useAction(),
    [q] = useSearchParams(),
    [record, R] = useState<any>(null),
    track = kind === "Track",
    sell = kind === "Sell";
  return (
    <main className="section shell">
      {sell ? (
        <>
          <div className="duo" style={{ marginBottom: 48 }}>
            <div>
              <Tag>CARBAAZ CONCIERGE</Tag>
              <h1>
                Sell Your Car with <em>Confidence.</em>
              </h1>
              <p>
                Get an honest valuation, complimentary studio inspection and a
                smooth transfer handled by CARBAAZ.
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
              <a className="btn" href="#sell-form">
                Start Selling Now <ArrowRight size={16} />
              </a>
            </div>
            <img
              className="banner"
              src="/media/bmw.webp"
              alt="Sell your car with CARBAAZ"
            />
          </div>
          <section style={{ marginBottom: 48 }}>
            <Tag>HOW IT WORKS</Tag>
            <h2>4 Simple Steps</h2>
            <div className="steps-grid four">
              {[
                [ClipboardList, "1. Submit Details", "Share your car specs and photos online."],
                [ShieldCheck, "2. Get Evaluation", "Our team inspects and quotes a fair offer."],
                [Users, "3. Meet Buyer", "Verified buyer handoff managed by us."],
                [BadgeIndianRupee, "4. Complete Sale", "Instant payout and RC paperwork."],
              ].map(([Icon, title, desc]: any, idx) => (
                <div className="step-card" key={title}>
                  <div className="step-icon">
                    <Icon size={20} />
                  </div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                  {idx < 3 && (
                    <span className="step-arrow" aria-hidden="true">
                      <ArrowRight size={14} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <Title
          tag={track ? "REQUEST STATUS" : "CARBAAZ CONCIERGE"}
          title={
            track
              ? "Track your enquiry."
              : kind === "Buy"
                ? "Enquire about a car."
                : "Contact us."
          }
        />
      )}
      <div className="duo" id="sell-form">
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            let f = e.currentTarget,
              b = values(f);
            a.run(async () => {
              if (track) {
                R(null);
                R(await api("/track", b));
                return;
              }
              let images = [];
              for (const file of Array.from(
                (f.elements.namedItem("images") as HTMLInputElement)?.files ||
                  [],
              )) {
                let body = new FormData();
                body.append("image", file);
                images.push((await api("/upload?scope=sell", body)).url);
              }
              return api("/enquiries", {
                ...b,
                kind: q.get("service") ? "Service" : kind,
                message: [b.subject, b.message].filter(Boolean).join(": "),
                images,
                details: sell ? b : undefined,
              });
            });
          }}
        >
          {track ? (
            <Field name="reference" label="Enquiry ID" />
          ) : (
            <Field name="name" label="Full name" defaultValue={me?.name} />
          )}
          <Field
            name="mobile"
            label="Registered mobile number"
            pattern="[+]?[0-9]{10,15}"
            defaultValue={me?.mobile}
          />
          {!track && (
            <>
              <Field
                name="email"
                label="Email address"
                type="email"
                defaultValue={me?.email}
              />
              {kind === "Buy" && (
                <Field
                  name="vehicleId"
                  label="Selected car"
                  defaultValue={q.get("car") || ""}
                  options={data.cars.map((x: any) => ({
                    label: x.manufacturer + " " + x.model,
                    value: x.id,
                  }))}
                />
              )}
              {kind === "Contact" && (
                <Field
                  name="subject"
                  label="Subject"
                  defaultValue={q.get("service") || ""}
                />
              )}
              {sell && (
                <>
                  <div className="formgrid">
                    {[
                      "manufacturer",
                      "model",
                      "year",
                      "registration",
                      "km",
                      "fuel",
                      "transmission",
                      "ownership",
                      "price",
                      "description",
                    ].map((k, i) => (
                      <Field
                        key={k}
                        name={k}
                        label={
                          [
                            "Manufacturer",
                            "Model",
                            "Manufacturing year",
                            "Registration number",
                            "Kilometres driven",
                            "Fuel type",
                            "Transmission",
                            "Ownership",
                            "Expected price (₹)",
                            "Vehicle description",
                          ][i]
                        }
                        type={
                          ["year", "km", "price"].includes(k)
                            ? "number"
                            : "text"
                        }
                      />
                    ))}
                  </div>
                  {me ? (
                    <Field
                      type="file"
                      name="images"
                      label="Vehicle photos"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      required={false}
                    />
                  ) : (
                    <Link to="/login">Sign in to attach vehicle photos.</Link>
                  )}
                </>
              )}
              <Field
                name="message"
                label="Message"
                type="textarea"
                required={!sell}
              />
            </>
          )}
          <Submit busy={a.busy}>
            {track ? "Find request" : "Send request"}
          </Submit>
          <p role="status">{a.msg}</p>
          {record && (
            <div>
              <h3>{record.status}</h3>
              <p>
                {record.kind} • {record.reference}
              </p>
              {record.history.map((s: any, i: number) => (
                <p key={i}>
                  {dateText(s.at)} — {s.status}
                </p>
              ))}
              <p>{record.remarks}</p>
            </div>
          )}
        </form>
        <aside>
          <img
            className="banner"
            src={"/media/" + (sell ? "bmw" : "hero") + ".webp"}
            alt="Luxury automotive collection"
          />
          <h3>
            {track
              ? "Private tracking"
              : sell
                ? "From inspection to offer"
                : "The CARBAAZ team"}
          </h3>
          <p>
            {track
              ? "Enter both details from your submission to view progress."
              : sell
                ? "Share your vehicle details and track the evaluation using your request ID."
                : "Send a message to the workshop or marketplace team."}
          </p>
          {kind === "Contact" &&
            ["address", "phone", "email", "hours"].map(
              (k) => data.settings[k] && <p key={k}>{data.settings[k]}</p>,
            )}
          {kind === "Contact" &&
            data.settings.map?.startsWith(
              "https://www.google.com/maps/embed",
            ) && (
              <iframe
                title="Workshop location"
                loading="lazy"
                src={data.settings.map}
              />
            )}
          {kind === "Contact" &&
            ["instagram", "facebook"].map(
              (k) =>
                data.settings[k]?.startsWith("https://") && (
                  <a className="outline" key={k} href={data.settings[k]}>
                    {k}
                  </a>
                ),
            )}
        </aside>
      </div>
    </main>
  );
}
