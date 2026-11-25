import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis } from "recharts";
import {
  useApp,
  api,
  API_BASE,
  Title,
  Field,
  Submit,
  useAction,
  values,
  dateText,
  money,
  CarCard,
} from "./shared";
const adminMods = [
    "dashboard",
    "bookings",
    "services",
    "packages",
    "cars",
    "buy-enquiries",
    "sell-requests",
    "customers",
    "staff",
    "payments",
    "sales",
    "gallery",
    "reviews",
    "testimonials",
    "notifications",
    "reports",
    "settings",
    "permissions",
    "activity",
  ],
  cust = [
    "dashboard",
    "profile",
    "bookings",
    "enquiries",
    "sell-requests",
    "wishlist",
    "notifications",
  ];
const fields: Record<string, string[]> = {
  services: [
    "name",
    "slug",
    "description",
    "image",
    "duration",
    "benefits",
    "introduction",
    "process",
    "beforeImage",
    "afterImage",
    "active",
  ],
  packages: ["name", "serviceId", "price"],
  cars: [
    "manufacturer",
    "model",
    "slug",
    "year",
    "price",
    "km",
    "fuel",
    "transmission",
    "ownership",
    "bodyType",
    "registration",
    "features",
    "description",
    "images",
    "featured",
    "sold",
  ],
  staff: ["name", "email", "role", "password"],
  payments: ["reference", "amount", "status", "bookingId"],
  sales: ["kind", "amount", "description"],
  reviews: ["name", "value", "serviceId"],
  testimonials: ["name", "value"],
  gallery: ["name", "value"],
  settings: ["name", "value"],
  "buy-enquiries": ["status", "remarks", "internalNotes", "staffId"],
  "sell-requests": ["status", "offer", "remarks", "internalNotes", "staffId"],
  bookings: ["status", "staffId"],
};
const opt: Record<string, string[]> = {
  bookings: [
    "Pending",
    "Confirmed",
    "Assigned",
    "In Progress",
    "Completed",
    "Cancelled",
  ],
  payments: ["Pending", "Paid", "Refunded"],
  "buy-enquiries": [
    "Submitted",
    "Under Review",
    "Contacted",
    "Offer Sent",
    "Approved",
    "Completed",
  ],
  "sell-requests": [
    "Submitted",
    "Under Review",
    "Inspection Scheduled",
    "Offer Generated",
    "Negotiation",
    "Approved",
    "Rejected",
    "Completed",
  ],
};
function RecordValue({ value }: { value: any }) {
  if (value == null || value === "") return <>—</>;
  if (Array.isArray(value))
    return value.length ? (
      <ul>
        {value.map((item, i) => (
          <li key={i}>
            <RecordValue value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <>None</>
    );
  if (typeof value === "object")
    return (
      <dl>
        {Object.entries(value)
          .filter(
            ([k]) => !/(?:^id$|Id$|deletedAt|updatedAt|createdAt)/.test(k),
          )
          .map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>
                <RecordValue value={v} />
              </dd>
            </React.Fragment>
          ))}
      </dl>
    );
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (
    typeof value === "string" &&
    (/^\/(media|uploads|api\/photos)\//.test(value) ||
      value.startsWith("https://res.cloudinary.com/"))
  )
    return (
      <img
        loading="lazy"
        style={{ maxWidth: 220 }}
        src={value}
        alt="Record photograph"
      />
    );
  return <>{String(value)}</>;
}
function Editor({ m, row, done }: any) {
  const { data } = useApp(),
    a = useAction(),
    [staff, T] = useState<any[]>([]),
    [svc, V] = useState<any[]>(data.services);
  useEffect(() => {
    if (fields[m]?.includes("staffId"))
      api("/admin/staff")
        .then(T)
        .catch(() => {});
    if (m === "packages")
      api("/admin/services")
        .then(V)
        .catch(() => {});
  }, [m]);
  return (
    <form
      className="panel editor"
      onSubmit={(e) => {
        e.preventDefault();
        let form = e.currentTarget,
          b: any = values(form);
        a.run(async () => {
          for (const k of fields[m]) {
            if (["active", "featured", "sold"].includes(k))
              b[k] = b[k] === "on";
            if (["benefits", "features", "images", "process"].includes(k))
              b[k] = (b[k] || "")
                .split("\n")
                .map((s: string) => s.trim())
                .filter(Boolean);
            if (
              !b[k] &&
              [
                "password",
                "bookingId",
                "staffId",
                "offer",
                "beforeImage",
                "afterImage",
                "serviceId",
              ].includes(k)
            )
              delete b[k];
          }
          delete b.upload;
          const files = (form.elements.namedItem("upload") as HTMLInputElement)
            ?.files;
          if (files?.length) {
            const urls = [];
            for (const file of Array.from(files)) {
              const fd = new FormData();
              fd.append("image", file);
              urls.push((await api("/upload", fd)).url);
            }
            if (m === "cars") b.images = urls;
            else b[m === "services" ? "image" : "value"] = urls[0];
          }
          await api(
            m === "bookings"
              ? "/bookings/" + row.id
              : "/admin/" + m + (row.id ? "/" + row.id : ""),
            b,
            m === "bookings" ? "PATCH" : "POST",
          );
          done();
        });
      }}
    >
      <h3>{row.id ? "Edit" : "Create"} record</h3>
      <div className="formgrid">
        {fields[m].map((k) => {
          let v = row[k] ?? row.user?.[k] ?? row.sell?.[k] ?? "",
            opts =
              k === "role"
                ? ["Manager", "Staff", "Admin"]
                : k === "status"
                  ? opt[m]
                  : k === "kind"
                    ? ["Sale", "Purchase", "Refund"]
                    : k === "serviceId"
                      ? svc.map((x) => ({ value: x.id, label: x.name }))
                      : k === "staffId"
                        ? staff.map((x) => ({
                            value: x.id,
                            label: x.user.name,
                          }))
                        : m === "settings" && k === "name"
                          ? [
                              "address",
                              "phone",
                              "email",
                              "hours",
                              "instagram",
                              "facebook",
                              "map",
                              "logo",
                              "favicon",
                              "banner",
                              "description",
                              "story",
                              "team",
                              "workshop",
                            ]
                          : undefined;
          if (k === "role") v = row.user?.role.name;
          if (["active", "featured", "sold"].includes(k))
            return (
              <label key={k} className="check">
                <input
                  name={k}
                  type="checkbox"
                  defaultChecked={row[k] ?? k === "active"}
                />
                {k}
              </label>
            );
          if (Array.isArray(v)) v = v.map((x) => x.url || x).join("\n");
          return (
            <Field
              key={k}
              name={k}
              label={
                k +
                (["images", "features", "benefits", "process"].includes(k)
                  ? " (one per line)"
                  : "")
              }
              defaultValue={v}
              options={opts}
              required={
                ![
                  "images",
                  "image",
                  "value",
                  "benefits",
                  "features",
                  "staffId",
                  "offer",
                  "remarks",
                  "internalNotes",
                  "introduction",
                  "beforeImage",
                  "afterImage",
                  "process",
                  "bookingId",
                  "registration",
                ].includes(k) && !(k === "password" && row.id)
              }
              type={
                [
                  "images",
                  "features",
                  "benefits",
                  "process",
                  "description",
                ].includes(k)
                  ? "textarea"
                  : [
                        "price",
                        "duration",
                        "year",
                        "km",
                        "amount",
                        "offer",
                      ].includes(k)
                    ? "number"
                    : k === "password"
                      ? "password"
                      : "text"
              }
            />
          );
        })}
      </div>
      {["services", "cars", "gallery"].includes(m) && (
        <Field
          type="file"
          accept="image/jpeg,image/png,image/webp"
          name="upload"
          label="Upload replacement images"
          multiple={m === "cars"}
          required={false}
        />
      )}
      <div className="actions">
        <Submit busy={a.busy}>Save</Submit>
        <button type="button" onClick={done}>
          Close
        </button>
      </div>
      <p role="status">{a.msg}</p>
    </form>
  );
}
function Reschedule({ r, done }: any) {
  const [slots, S] = useState<string[]>([]),
    a = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const b = values(e.currentTarget);
        a.run(async () => {
          await api("/bookings/" + r.id, { starts: b.starts }, "PATCH");
          done();
        });
      }}
    >
      <Field
        label="New date"
        type="date"
        onChange={(e: any) => {
          S([]);
          a.run(async () =>
            S(
              await api(
                "/slots?service=" +
                  r.items[0].package.serviceId +
                  "&date=" +
                  e.target.value +
                  "&exclude=" +
                  r.id,
              ),
            ),
          );
        }}
      />
      <Field
        name="starts"
        label="New time"
        options={slots.map((v) => ({ label: dateText(v), value: v }))}
      />
      <Submit busy={a.busy}>Reschedule</Submit>
      <p>{a.msg}</p>
    </form>
  );
}
export function Panel({ admin = false }: any) {
  const { module: m = "dashboard" } = useParams(),
    { me, refresh, logout } = useApp(),
    nav = useNavigate(),
    [r, R] = useState<any>(null),
    [error, E] = useState(""),
    [rev, U] = useState(0),
    [row, W] = useState<any>(null),
    [search, Q] = useState(""),
    [page, P] = useState(0),
    [days, D] = useState(365),
    [date, F] = useState(""),
    a = useAction();
  let mods = admin ? adminMods : cust;
  if (admin && me?.role === "Staff")
    mods = ["bookings", ...(me.permissions || [])];
  if (admin && me?.role === "Manager")
    mods = [
      "dashboard",
      "reports",
      "services",
      "cars",
      "packages",
      "customers",
      "bookings",
      "buy-enquiries",
      "sell-requests",
      "staff",
    ];
  const valid =
    me &&
    mods.includes(m) &&
    (admin ? me.role !== "Customer" : me.role === "Customer");
  useEffect(() => {
    let live = true;
    R(null);
    E("");
    W(null);
    Q("");
    P(0);
    if (valid)
      api(admin ? "/admin/" + m + "?days=" + days : "/customer")
        .then((x) => live && R(x))
        .catch((e) => live && E(e.message));
    return () => {
      live = false;
    };
  }, [valid, admin, m, rev, days]);
  function done() {
    W(null);
    U(rev + 1);
    refresh();
  }
  if (!valid)
    return (
      <main className="section narrow">
        <Title tag="ACCOUNT" title="Access restricted." />
        <Link to={me?.role === "Staff" ? "/admin/bookings" : "/login"}>
          Continue to {me?.role === "Staff" ? "assigned bookings" : "sign in"} →
        </Link>
      </main>
    );
  const stats =
    r &&
    (admin
      ? r
      : {
          bookings: r.bookings.length,
          pending: r.bookings.filter((b: any) => b.status === "Pending").length,
          completed: r.bookings.filter((b: any) => b.status === "Completed")
            .length,
          enquiries: r.enquiries.length,
        });
  const rows = !r
      ? []
      : admin
        ? Array.isArray(r)
          ? r
          : []
        : m === "sell-requests"
          ? r.enquiries.filter((e: any) => e.kind === "Sell")
          : r[m] || [],
    filtered = Array.isArray(rows)
      ? rows.filter(
          (x: any) =>
            JSON.stringify(x).toLowerCase().includes(search.toLowerCase()) &&
            (!date || m !== "bookings" || x.starts.slice(0, 10) === date),
        )
      : [];
  return (
    <main className="workspace">
      <aside>
        <img className="brand" src="/media/brand.webp" alt="CARBAAZ" />
        <small>{admin ? "OPERATIONS ERP" : "OWNER ACCOUNT"}</small>
        {mods.map((k) => (
          <Link
            className={k === m ? "selected" : ""}
            to={"/" + (admin ? "admin" : "customer") + "/" + k}
            key={k}
          >
            {k.replaceAll("-", " ")}
          </Link>
        ))}
        <Link to="/track-enquiry">Track enquiry</Link>
        <Link to="/forgot-password">Change password</Link>
        <button onClick={logout}>Logout</button>
      </aside>
      <section className="desk">
        <Title
          tag={admin ? "BUSINESS MANAGEMENT" : "CUSTOMER DASHBOARD"}
          title={m.replaceAll("-", " ") + "."}
        />
        {error && <p role="alert">{error}</p>}
        {!r && !error && "Loading records…"}
        {r && (m === "dashboard" || m === "reports") ? (
          <>
            {admin && (
              <Field
                label="Reporting period"
                options={[
                  { label: "Daily", value: 1 },
                  { label: "Weekly", value: 7 },
                  { label: "Monthly", value: 30 },
                  { label: "Annual", value: 365 },
                ]}
                value={days}
                onChange={(e: any) => D(+e.target.value || 365)}
              />
            )}
            <div className="grid stats">
              {Object.entries(stats)
                .filter(([, v]) => typeof v === "number")
                .map(([k, v]) => (
                  <div key={k} className="panel">
                    <small>{k}</small>
                    <h3>{k === "revenue" ? money(Number(v)) : String(v)}</h3>
                  </div>
                ))}
            </div>
            {admin && (
              <>
                <h3>Activity by month</h3>
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={r.months}>
                    <XAxis dataKey="month" />
                    <Tooltip />
                    {["bookings", "sales", "revenue", "customers"].map(
                      (k, i) => (
                        <Area
                          key={k}
                          dataKey={k}
                          stroke={["#edbc45", "#bbb", "#987b43", "#fff"][i]}
                          fillOpacity={0.1}
                        />
                      ),
                    )}
                  </AreaChart>
                </ResponsiveContainer>
                <div className="actions">
                  {["pdf", "xlsx"].map((k) => (
                    <a
                      key={k}
                      className="outline"
                      href={API_BASE + "/api/admin/reports?days=" + days + "&format=" + k}
                    >
                      Export {k.toUpperCase()}
                    </a>
                  ))}
                </div>
                <h3>Service performance</h3>
                {Object.entries(r.servicePerformance || {}).map(
                  ([name, count]) => (
                    <p key={name}>
                      {name} · {String(count)} appointments
                    </p>
                  ),
                )}
                <h3>Recent activity</h3>
                {r.activity.length
                  ? r.activity.map((x: any) => (
                      <p key={x.id}>
                        {x.action} • {dateText(x.createdAt)}
                      </p>
                    ))
                  : "No activity yet."}
              </>
            )}
          </>
        ) : r && m === "profile" ? (
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              const b = values(e.currentTarget);
              a.run(async () => {
                let v = await api(
                  "/profile",
                  { ...b, sms: b.sms === "on", whatsapp: b.whatsapp === "on" },
                  "PATCH",
                );
                await refresh();
                return v;
              });
            }}
          >
            <Field name="name" label="Full name" defaultValue={me.name} />
            <Field
              name="mobile"
              label="Mobile number"
              defaultValue={me.mobile}
            />
            {["sms", "whatsapp"].map((k) => (
              <label className="check" key={k}>
                <input type="checkbox" name={k} defaultChecked={me[k]} />
                Receive {k} status updates
              </label>
            ))}
            <Submit>Save profile</Submit>
          </form>
        ) : (
          r && (
            <>
              <div className="actions">
                <input
                  placeholder="Search records"
                  aria-label="Search records"
                  value={search}
                  onChange={(e) => {
                    Q(e.target.value);
                    P(0);
                  }}
                />
                {m === "bookings" && (
                  <input
                    aria-label="Filter booking date"
                    type="date"
                    value={date}
                    onChange={(e) => F(e.target.value)}
                  />
                )}
                {admin &&
                  ["Super Admin", "Admin"].includes(me.role) &&
                  fields[m] &&
                  !["bookings", "buy-enquiries", "sell-requests"].includes(
                    m,
                  ) && (
                    <button className="btn" onClick={() => W({})}>
                      Add record
                    </button>
                  )}
              </div>
              {row && (
                <Editor key={row.id || "new"} m={m} row={row} done={done} />
              )}
              {filtered.slice(page * 12, page * 12 + 12).map((x: any) =>
                m === "wishlist" ? (
                  <CarCard c={x.vehicle} key={x.id} />
                ) : (
                  <article className="panel record" key={x.id}>
                    <small>{x.status || m}</small>
                    <h3>
                      {x.reference ||
                        x.name ||
                        x.user?.name ||
                        x.model ||
                        x.message ||
                        x.action ||
                        x.description ||
                        m}
                    </h3>
                    <p>
                      {x.starts
                        ? dateText(x.starts)
                        : x.user?.email ||
                          x.value ||
                          x.email ||
                          dateText(x.createdAt)}
                    </p>
                    {m === "permissions" &&
                      x.name === "Staff" &&
                      me.role === "Super Admin" && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const permissions = new FormData(
                              e.currentTarget,
                            ).getAll("permission");
                            a.run(async () => {
                              await api("/admin/permissions/" + x.id, {
                                permissions,
                              });
                              done();
                            });
                          }}
                        >
                          {["services", "cars", "packages", "gallery"].map(
                            (k) => (
                              <label className="check" key={k}>
                                <input
                                  name="permission"
                                  value={k}
                                  type="checkbox"
                                  defaultChecked={x.permissions.some(
                                    (p: any) => p.key === k,
                                  )}
                                />
                                Read {k}
                              </label>
                            ),
                          )}
                          <Submit>Save staff permissions</Submit>
                        </form>
                      )}
                    <details>
                      <summary>Record details</summary>
                      <dl>
                        {Object.entries(x)
                          .filter(
                            ([k]) =>
                              ![
                                "id",
                                "userId",
                                "customerId",
                                "staffId",
                                "updatedAt",
                                "createdAt",
                              ].includes(k),
                          )
                          .map(([k, v]) => (
                            <React.Fragment key={k}>
                              <dt>{k}</dt>
                              <dd>
                                <RecordValue value={v} />
                              </dd>
                            </React.Fragment>
                          ))}
                      </dl>
                    </details>
                    <div className="actions">
                      {admin &&
                        ["Admin", "Super Admin"].includes(me.role) &&
                        fields[m] && (
                          <button onClick={() => W(x)}>Edit record</button>
                        )}
                      {admin &&
                        ["Admin", "Super Admin"].includes(me.role) &&
                        [
                          "services",
                          "cars",
                          "packages",
                          "gallery",
                          "reviews",
                          "testimonials",
                        ].includes(m) && (
                          <button
                            onClick={() => {
                              if (confirm("Remove this record?"))
                                a.run(async () => {
                                  await api(
                                    "/admin/" + m + "/" + x.id,
                                    undefined,
                                    "DELETE",
                                  );
                                  done();
                                });
                            }}
                          >
                            Remove
                          </button>
                        )}
                      {!admin &&
                        m === "bookings" &&
                        [
                          "Confirmed",
                          "Completed",
                          "In Progress",
                          "Assigned",
                        ].includes(x.status) && (
                          <button
                            onClick={() =>
                              a.run(async () => {
                                const result = await api(
                                  "/checkout/" + x.id,
                                  {},
                                );
                                location.assign(result.url);
                              })
                            }
                          >
                            Pay online
                          </button>
                        )}
                      {!admin &&
                        m === "bookings" &&
                        ["Pending", "Confirmed"].includes(x.status) && (
                          <button
                            onClick={() =>
                              a.run(async () => {
                                await api(
                                  "/bookings/" + x.id,
                                  { status: "Cancelled" },
                                  "PATCH",
                                );
                                done();
                              })
                            }
                          >
                            Cancel booking
                          </button>
                        )}
                    </div>
                    {m === "bookings" &&
                      ["Pending", "Confirmed"].includes(x.status) &&
                      (!admin ||
                        ["Admin", "Super Admin", "Manager"].includes(
                          me.role,
                        )) && (
                        <details>
                          <summary>Reschedule</summary>
                          <Reschedule r={x} done={done} />
                        </details>
                      )}
                  </article>
                ),
              )}
              {!filtered.length && <p className="empty">No records to show.</p>}
              <div className="pagination">
                <button disabled={!page} onClick={() => P(page - 1)}>
                  Previous
                </button>
                <button
                  disabled={(page + 1) * 12 >= filtered.length}
                  onClick={() => P(page + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )
        )}
        <p role="status">{a.msg}</p>
      </section>
    </main>
  );
}
