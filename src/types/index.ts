export type UserRole = 'super_admin' | 'admin' | 'b2b_admin' | 'user';
export interface User { id:string; name:string; email:string; phone?:string; avatar_url?:string; plan:'free'|'pro'|'business'; role?:UserRole; b2b_partner_id?:string|null; created_at:string; }
export interface AuthTokens { access_token:string; refresh_token:string; token_type:string; }
// Lista consolidada em 25/08/2026 — antes desta data, 3 lugares divergiam
// sobre os valores válidos: este tipo (sem 'archived'), o allow-list do
// admin em api/v1/admin/objects/[id]/route.ts (sem 'protected'), e a rota
// PATCH do dono (api/v1/objects/[id]/route.ts, sem validação nenhuma).
// 'archived' é setado só pela moderação (api/v1/admin/moderacao/route.ts)
// quando um objeto é denunciado/oculto — não é um status que o dono escolhe
// (ver OWNER_SETTABLE_STATUSES em api/v1/objects/[id]/route.ts).
export type ObjectStatus = 'lost'|'found'|'returned'|'stolen'|'protected'|'archived';
export type ObjectCategory = 'phone'|'wallet'|'keys'|'bag'|'pet'|'bike'|'vehicle'|'document'|'jewelry'|'electronics'|'clothing'|'other';
export interface ObjectLocation { lat:number; lng:number; address?:string; }
export interface RegisteredObject { id:string; title:string; description:string; category:ObjectCategory; status:ObjectStatus; owner_id:string; unique_code:string; qr_code?:string; photos:string[]; location?:ObjectLocation; pet_species?:string; pet_breed?:string; pet_color?:string; pet_microchip?:string; reward_amount?:number|null; reward_description?:string|null; category_fields?:Record<string,unknown>; is_boosted?:boolean; boost_expires_at?:string|null; created_at:string; updated_at:string; source?:string; is_legacy?:boolean; }
export interface Match { id:string; lost_object_id:string; found_object_id:string; score:number; confidence_score?:number; status:'pending'|'confirmed'|'rejected'; created_at:string; updated_at?:string; lost_title?:string; found_title?:string; lost_description?:string; found_description?:string; }
export interface Notification { id:string; type:string; title:string; message:string; body?:string; url?:string; read:boolean; created_at:string; }
export interface PaginatedResponse<T> { items:T[]; total:number; page?:number; size?:number; pages?:number; }
