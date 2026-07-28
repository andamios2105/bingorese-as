import { Milestone } from "@/types/database";

export const MILESTONE_AMOUNTS: Record<Milestone, number> = {
  10: 10_000,
  30: 30_000,
  50: 50_000,
  70: 70_000,
  100: 100_000,
};

/**
 * Réplica en cliente de public.normalize_google_handle() en SQL.
 * Solo para feedback instantáneo en el formulario — la validación real
 * y vinculante ocurre en la función de Postgres (submit_review), que es
 * la única con autoridad para insertar en la base de datos.
 */
export function normalizeGoogleHandle(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

const GOOGLE_MAPS_URL_PATTERN =
  /^https?:\/\/(www\.)?google\.[a-z.]+\/maps|goo\.gl|maps\.app\.goo\.gl/i;

export function isValidGoogleMapsUrl(url: string): boolean {
  return GOOGLE_MAPS_URL_PATTERN.test(url.trim());
}

export function sanitizeReviewUrl(url: string): string {
  return url.trim().toLowerCase().split("?")[0].replace(/\/+$/, "");
}

export function nextMilestone(verifiedCount: number): Milestone | null {
  const milestones: Milestone[] = [10, 30, 50, 70, 100];
  return milestones.find((m) => m > verifiedCount) ?? null;
}

export function isAtClaimableMilestone(verifiedCount: number): verifiedCount is Milestone {
  return [10, 30, 50, 70, 100].includes(verifiedCount);
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDrawDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}
