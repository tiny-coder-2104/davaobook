export interface Operator {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string;
  email: string;
  created_at: string;
}

export interface PackageTier {
  min_pax: number;
  max_pax: number;
  price_per_pax: number;
}

export interface Package {
  id: string;
  operator_id: string;
  name: string;
  slug: string;
  description: string;
  photo_url: string | null;
  tiers: PackageTier[];
  days_of_week: number[];
  capacity_per_day: number;
  downpayment_pct: number;
  cutoff_hours: number;
  dp_refundable: boolean;
  active: boolean;
  created_at: string;
}

export interface Block {
  id: string;
  operator_id: string;
  package_id: string | null;
  date: string;
  reason: string | null;
}
