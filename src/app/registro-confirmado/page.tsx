import { RegistrationConfirmationCard } from "@/components/auth/registration-confirmation-card";

type RegistrationConfirmationPageProps = {
  searchParams: Promise<{ estado?: string | string[] }>;
};

export default async function RegistrationConfirmationPage({ searchParams }: RegistrationConfirmationPageProps) {
  const { estado } = await searchParams;
  const status = estado === "exitoso" ? "success" : "error";

  return <RegistrationConfirmationCard status={status} />;
}
