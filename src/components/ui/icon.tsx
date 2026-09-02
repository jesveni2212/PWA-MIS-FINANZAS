import type { ComponentProps, ReactNode } from "react";

export const iconNames = ["home", "wallet", "movement", "group", "user", "eye", "eye-off"] as const;

export type IconName = (typeof iconNames)[number];

type IconProps = Omit<ComponentProps<"svg">, "children"> & {
  name: IconName;
  title?: string;
};

const paths: Record<IconName, ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />,
  wallet: <><path d="M4 7h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12" /><path d="M16 14h5" /></>,
  movement: <><path d="M7 4 3 8l4 4" /><path d="M3 8h12a4 4 0 0 1 4 4v1" /><path d="m17 20 4-4-4-4" /><path d="M21 16H9a4 4 0 0 1-4-4v-1" /></>,
  group: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.6-3.4 2.6-5 6-5s5.4 1.6 6 5" /><path d="M17 4a3 3 0 0 1 0 6" /><path d="M18 15c1.8.7 2.8 2.3 3 5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4.3 3.4-6.5 8-6.5s7.2 2.2 8 6.5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.75" /></>,
  "eye-off": <><path d="m3 3 18 18" /><path d="M10.6 5.6A10.5 10.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a18.7 18.7 0 0 1-3 3.7" /><path d="M6.2 6.2A18 18 0 0 0 2.5 12S6 18.5 12 18.5c1.2 0 2.3-.3 3.3-.8" /><path d="M9.5 9.5a3.5 3.5 0 0 0 5 5" /></>,
};

export function Icon({ name, title, ...props }: IconProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}
