export const MIN_REVIEWS_TO_CLAIM = 10;

/**
 * Tarifa progresiva por reseña — réplica en cliente de
 * public.payout_rate_for_count() en SQL. Cuantas más reseñas acumuladas,
 * más alta la tarifa que se paga por TODAS (no solo las nuevas).
 */
export function payoutRateForCount(count: number): number {
  if (count >= 100) return 1500;
  if (count >= 50) return 1300;
  if (count >= 30) return 1100;
  return 800;
}

export function canClaimPayout(verifiedCount: number): boolean {
  return verifiedCount >= MIN_REVIEWS_TO_CLAIM;
}

export function currentPayoutAmount(verifiedCount: number): number {
  return verifiedCount * payoutRateForCount(verifiedCount);
}

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

/**
 * Réplica en cliente de initcap() en SQL — misma normalización que aplican
 * las funciones de Postgres al guardar, solo para feedback instantáneo.
 */
export function toTitleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(" ")
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

const GOOGLE_MAPS_URL_PATTERN =
  /^https?:\/\/(www\.)?google\.[a-z.]+\/maps|goo\.gl|maps\.app\.goo\.gl/i;

export function isValidGoogleMapsUrl(url: string): boolean {
  return GOOGLE_MAPS_URL_PATTERN.test(url.trim());
}

export function sanitizeReviewUrl(url: string): string {
  return url.trim().toLowerCase().split("?")[0].replace(/\/+$/, "");
}

// Convierte una fecha calendario "YYYY-MM-DD" a un instante UTC a medianoche,
// para poder restar días sin que la zona horaria del servidor (Netlify corre
// en UTC) desfase el resultado respecto a la hora de Colombia.
function dateOnlyToUtcMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const todayInBogota = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const diffMs = dateOnlyToUtcMs(dateStr) - dateOnlyToUtcMs(todayInBogota);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDrawDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("es-CO", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function timeSinceLabel(dateStr: string | null): string {
  if (!dateStr) return "Nunca ha entrado";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0) return "Ahora mismo";
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (totalHours < 1) return "Hace menos de 1 hora";
  if (days === 0) return `Hace ${hours}h`;
  return `Hace ${days}d ${hours}h`;
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
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
