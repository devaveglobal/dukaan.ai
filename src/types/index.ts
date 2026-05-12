export type UserRole = "seller" | "admin";
export type PaymentStatus = "paid" | "pending" | "partial";
export type IncompleteSaleStatus = "pending_admin_review" | "resolved" | "dismissed";

export interface IncompleteSaleReview {
  id: string;
  seller_id: string;
  raw_message: string;
  extracted_data: Record<string, unknown>;
  status: IncompleteSaleStatus;
  admin_comment?: string | null;
  resolved_quantity?: number | null;
  resolved_price?: number | null;
  resolved_item_id?: string | null;
  resolved_sale_id?: string | null;
  created_at: string;
  seller?: { full_name: string; email: string; branch?: string };
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch?: string;
  currency?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  description?: string | null;
  unit: string;
  quantity: number;
  cost_price?: number | null;
  price: number;
  low_stock_threshold?: number | null;
  barcode_number?: string | null;
  barcode_image_url?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  item_id?: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  matched: boolean;
}

export interface Sale {
  id: string;
  seller_id: string;
  customer_name?: string | null;
  payment_status: PaymentStatus;
  total_amount: number;
  notes?: string | null;
  raw_message?: string | null;
  ai_confidence: number;
  created_at: string;
  updated_at: string;
  seller?: Profile;
  sale_items?: SaleItem[];
}

export interface PendingPayment {
  id: string;
  sale_id?: string | null;
  seller_id: string;
  customer_name?: string | null;
  amount: number;
  status: PaymentStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  seller?: Profile;
}

export interface IncompleteSale {
  id: string;
  seller_id: string;
  raw_message: string;
  extracted_data: Record<string, unknown>;
  status: IncompleteSaleStatus;
  resolved_sale_id?: string | null;
  created_at: string;
  seller?: Profile;
}

// What the AI extracts from a seller message
export interface ExtractedSaleData {
  intent: "log_sale" | "credit_sale" | "query" | "unknown";
  items: Array<{
    raw_name: string;
    matched_item_id?: string | null;
    matched_item_name?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    total_price?: number | null;
    confidence: number;
  }>;
  customer_name?: string | null;
  payment_status: PaymentStatus;
  total_amount?: number | null;
  confidence: number; // overall confidence 0-1
  is_complete: boolean;
  missing_fields: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Receipt {
  id: string;
  seller_id: string;
  items: ReceiptItem[];
  total_amount: number;
  customer_name?: string;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  seller?: Profile;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}
