export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  plan: 'free' | 'pro';
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
}

export type ObjectStatus = 'lost' | 'found' | 'returned' | 'stolen';
export type ObjectCategory =
  | 'phone' | 'wallet' | 'keys' | 'bag' | 'pet' | 'bike'
  | 'document' | 'jewelry' | 'electronics' | 'clothing' | 'other';

export interface RegisteredObject {
  id: string;
  title: string;
  description: string;
  category: ObjectCategory;
  status: ObjectStatus;
  owner_id: string;
  photos: string[];
  qr_code_url?: string;
  unique_code: string;
  created_at: string;
  updated_at: string;
  location?: { lat: number; lng: number; address?: string };
  pet_species?: string;
  pet_breed?: string;
  pet_microchip?: string;
  pet_color?: string;
}

export interface Match {
  id: string;
  object_id: string;
  matched_object_id: string;
  confidence_score: number;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
}
