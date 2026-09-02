import type { IconName } from "@/components/ui/icon";

export const site = {
  name: "Mis Finanzas",
  description: "Tus finanzas personales y compartidas, claras y bajo control.",
  navigation: [
    { label: "Inicio", href: "/", icon: "home" },
    { label: "Cuentas", href: "/cuentas", icon: "wallet" },
    { label: "Movimientos", href: "/movimientos", icon: "movement" },
    { label: "Grupos", href: "/grupos", icon: "group" },
    { label: "Perfil", href: "/perfil", icon: "user" },
  ],
} as const satisfies {
  name: string;
  description: string;
  navigation: readonly { label: string; href: string; icon: IconName }[];
};
