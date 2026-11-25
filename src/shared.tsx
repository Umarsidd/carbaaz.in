import React, { createContext, useContext, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Heart,
  Gauge,
  Fuel,
  Settings2,
} from "lucide-react";
export const AppCtx = createContext<any>(null),
  useApp = () => useContext(AppCtx);
export async function api(
  path: string,
  body?: any,
  method = body ? "POST" : "GET",
) {
  const form = body instanceof FormData,
    r = await fetch("/api" + path, {
      method,
      headers: body && !form ? { "Content-Type": "application/json" } : {},
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
    });
  const v = await r.json();
  if (!r.ok) throw Error(v.error || "Request failed.");
  return v;
}
export const money = (v: number) => "₹" + Number(v).toLocaleString("en-IN"),
  dateText = (v: string) =>
    new Date(v).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });
export function Tag({ children }: any) {
  return (
    <div className="tag">
      <i />
      {children}
    </div>
  );
}
export function Btn({ to, children, ghost = false }: any) {
  return (
    <Link className={"btn " + (ghost ? "ghost" : "")} to={to}>
      {children}
    </Link>
  );
}
export function Title({ tag, title, desc }: any) {
  return (
    <div className="pageTitle">
      <Tag>{tag}</Tag>
      <h1>{title}</h1>
      {desc && <p>{desc}</p>}
    </div>
  );
}
export function ServiceCard({ s, i }: any) {
  return (
    <article className="card">
      <Link to={"/services/" + s.slug} className="photo">
        <img loading="lazy" src={s.image} alt={s.name} />
        <span className="index">S / {String(i + 1).padStart(2, "0")}</span>
      </Link>
      <div className="cardBody">
        <small>DETAILING SERVICE</small>
        <h3>
          <Link to={"/services/" + s.slug}>{s.name}</Link>
        </h3>
        <p>{s.description}</p>
        <div className="cardFoot">
          <span>
            From{" "}
            <b>
              {s.packages.length ? money(s.packages[0].price) : "On request"}
            </b>
          </span>
          <Link
            aria-label={"Book " + s.name}
            to={"/book-detailing?service=" + s.slug}
          >
            Book <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function CarCard({ c }: any) {
  const { notify, me } = useApp();
  return (
    <article className="card">
      <div className="photo">
        <Link to={"/buy-used-cars/" + c.slug}>
          <img
            loading="lazy"
            src={c.images[0]?.url}
            alt={c.manufacturer + " " + c.model}
          />
        </Link>
        <button
          className="heart"
          aria-label="Update wishlist"
          onClick={() =>
            me
              ? api("/wishlist/" + c.id, {})
                  .then((x) => notify(x.message))
                  .catch((e) => notify(e.message))
              : notify("Please sign in to save a vehicle.")
          }
        >
          <Heart size={17} />
        </button>
      </div>
      <div className="cardBody">
        <small>
          {c.year} • {c.bodyType}
        </small>
        <h3>
          {c.manufacturer} {c.model}
        </h3>
        <p className="spec">
          <Gauge />
          {c.km.toLocaleString()} km <Fuel />
          {c.fuel} <Settings2 />
          {c.transmission}
        </p>
        <div className="cardFoot">
          <b>{money(c.price)}</b>
          <Link to={"/buy-used-cars/" + c.slug}>
            Details <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function Field({
  name,
  label,
  type = "text",
  options,
  required = true,
  ...props
}: any) {
  return (
    <label>
      {label || name}
      {options ? (
        <select name={name} required={required} {...props}>
          <option value="">Select {label || name}</option>
          {options.map((o: any) => (
            <option key={o.value ?? o} value={o.value ?? o}>
              {o.label ?? o}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea name={name} required={required} {...props} />
      ) : (
        <input name={name} type={type} required={required} {...props} />
      )}
    </label>
  );
}
export function Submit({ children = "Submit", busy = false }: any) {
  return (
    <button className="btn" disabled={busy}>
      {busy ? "Saving…" : children}
      <ArrowRight size={16} />
    </button>
  );
}
export function useAction() {
  const [busy, set] = useState(false),
    [msg, say] = useState("");
  async function run(fn: () => Promise<any>) {
    set(true);
    say("");
    try {
      const r = await fn();
      say(r?.reference ? "Received • " + r.reference : r?.message || "");
      return r;
    } catch (e: any) {
      say(e.message);
    } finally {
      set(false);
    }
  }
  return { busy, msg, run };
}
export const values = (f: HTMLFormElement) =>
  Object.fromEntries(new FormData(f)) as Record<string, string>;
