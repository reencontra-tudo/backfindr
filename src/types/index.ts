export interface User { id:string; name:string; email:string; phone?:string; avatar_url?:string; plan:'free'|'pro'|'business'; created_at:string; }
export interface AuthTokens { access_token:string; refresh_token:string; token_type:string; }
export type ObjectStatus = 'lost'|'found'|'returned'|'stolen';
export type ObjectCategory = 'phone'|'wallet'|'keys'|'bag'|'pet'|'bike'|'document'|'jewelry'|'electronics'|'clothing'|'other';
export interface ObjectLocation { lat:number; lng:number; address?:string; }
export interface RegisteredObject { id:string; title:string; description:string; category:ObjectCategory; status:ObjectStatus; owner_id:string; unique_code:string; photos:string[]; location?:ObjectLocation; pet_species?:string; pet_breed?:string; pet_color?:string; pet_microchip?:string; created_at:string; updated_at:string; }
export interface Match { id:string; object_id:string; matched_object_id:string; confidence_score:number; status:'pending'|'confirmed'|'rejected'; created_at:string; }
export interface Notification { id:string; type:string; title:string; body:string; url?:string; read:boolean; created_at:string; }
export interface PaginatedResponse<T> { items:T[]; total:number; page?:number; size?:number; pages?:number; }
