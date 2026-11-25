/// <reference types="vite/client" />
declare module "lucide-react" {
  import type { ComponentType, SVGProps } from "react";
  const Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>;
  export const ArrowRight: typeof Icon;
  export const ArrowUpRight: typeof Icon;
  export const BadgeIndianRupee: typeof Icon;
  export const CalendarDays: typeof Icon;
  export const CarFront: typeof Icon;
  export const CheckCircle2: typeof Icon;
  export const ChevronDown: typeof Icon;
  export const ChevronLeft: typeof Icon;
  export const ChevronRight: typeof Icon;
  export const ClipboardList: typeof Icon;
  export const Fuel: typeof Icon;
  export const Gauge: typeof Icon;
  export const Headphones: typeof Icon;
  export const Heart: typeof Icon;
  export const Mail: typeof Icon;
  export const MapPin: typeof Icon;
  export const Menu: typeof Icon;
  export const Phone: typeof Icon;
  export const Search: typeof Icon;
  export const Settings2: typeof Icon;
  export const ShieldCheck: typeof Icon;
  export const Sparkles: typeof Icon;
  export const Star: typeof Icon;
  export const UserRound: typeof Icon;
  export const Users: typeof Icon;
  export const X: typeof Icon;
}
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
