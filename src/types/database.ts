export type UserRole = "promoter" | "admin";
export type ReviewStatus = "pending" | "verified" | "rejected";
export type PayoutStatus = "pending" | "approved" | "rejected";
export type TableStatus = "active" | "paused" | "full" | "archived";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  payment_method: "nequi" | "daviplata" | "bancolombia" | "otro" | null;
  payment_number: string | null;
  role: UserRole;
  is_suspended: boolean;
  suspended_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface FineLog {
  id: string;
  promoter_id: string;
  days: number;
  reason: string;
  applied_by: string;
  applied_at: string;
  expires_at: string;
}

export interface BingoTable {
  id: string;
  name: string;
  status: TableStatus;
  prize: string | null;
  lottery_name: string | null;
  draw_date: string | null;
  business_name: string | null;
  google_maps_url: string | null;
  keyword: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type TableAccessStatus = "requested" | "approved";

export interface TableAccess {
  table_id: string;
  promoter_id: string;
  status: TableAccessStatus;
  requested_at: string;
  approved_at: string | null;
}

export interface PromoterProgress {
  promoter_id: string;
  verified_count: number;
  cycle_number: number;
  updated_at: string;
}

export interface ReviewLog {
  id: string;
  table_id: string;
  cell_number: number;
  promoter_id: string;
  google_handle: string | null;
  google_profile_name_raw: string;
  reviewer_phone: string | null;
  screenshot_url: string | null;
  status: ReviewStatus;
  assigned_by_admin: boolean;
  rejection_reason: string | null;
  submitted_at: string;
  verified_at: string | null;
  rejected_at: string | null;
  reviewed_by: string | null;
  counted_in_cycle: number | null;
}

export interface TableGridCell {
  table_id: string;
  cell_number: number;
  status: "pending" | "verified";
  promoter_id: string;
  promoter_name: string;
  submitted_at: string;
  verified_at: string | null;
}

export interface PayoutRequest {
  id: string;
  promoter_id: string;
  cycle_number: number;
  reviews_count: number;
  rate_applied: number;
  amount: number;
  payment_method: string;
  payment_number: string;
  status: PayoutStatus;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  payment_proof_url: string | null;
}

export interface AdminPayoutRequestView extends PayoutRequest {
  full_name: string;
  email: string;
  verified_reviews_in_cycle: number;
}

export interface AppSettings {
  id: true;
  google_business_reviews_url: string | null;
  updated_at: string;
}

/** Umbrales donde sube la tarifa progresiva (ver payoutRateForCount en lib/validation.ts) */
export const PAYOUT_TIER_MARKERS = [10, 30, 50, 100] as const;
