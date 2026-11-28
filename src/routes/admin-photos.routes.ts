import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { database } from "../database.js";
import { requireAdmin } from "./admin-auth.routes.js";

const idSchema=z.string().uuid();
export const adminPhotoRoutes:FastifyPluginAsync=async(app)=>{
 app.addHook("preHandler",requireAdmin);
 app.get("/photos",async(request,reply)=>{
  if(!database)return reply.code(503).send({error:"Database is not configured"});
  const q=z.object({status:z.enum(["all","published","unpublished"]).default("all"),from:z.string().date().optional(),to:z.string().date().optional(),limit:z.coerce.number().int().min(1).max(100).default(25),offset:z.coerce.number().int().min(0).default(0)}).refine(v=>!v.from||!v.to||v.from<=v.to).safeParse(request.query);
  if(!q.success)return reply.code(400).send({error:"Invalid query parameters",details:q.error.flatten()});
  const {status,from,to,limit,offset}=q.data;const values:unknown[]=[];const filters:string[]=[];
  if(status==="published")filters.push("published_at IS NOT NULL");if(status==="unpublished")filters.push("published_at IS NULL");
  if(from){values.push(from);filters.push("photo_date >= $"+values.length+"::date");}if(to){values.push(to);filters.push("photo_date <= $"+values.length+"::date");}
  const where=filters.length?" WHERE "+filters.join(" AND "):"";
  const count=await database.query("SELECT COUNT(*)::int AS total FROM photos"+where,values);
  values.push(limit,offset);
  const rows=await database.query("SELECT id,storage_key,media_url,mime_type,file_size_bytes,original_filename,caption,photo_date,uploaded_at,published_at,created_by_admin_id FROM photos"+where+" ORDER BY uploaded_at DESC,id DESC LIMIT $"+(values.length-1)+" OFFSET $"+values.length,values);
  return {data:rows.rows,pagination:{total:count.rows[0]?.total??0,limit,offset}};
 });
 for(const action of ["publish","unpublish"] as const){
  app.post<{Params:{photoId:string}}>("/photos/:photoId/"+action,async(request,reply)=>{
   if(!database)return reply.code(503).send({error:"Database is not configured"});
   const id=idSchema.safeParse(request.params.photoId);if(!id.success)return reply.code(400).send({error:"Invalid photo ID"});
   const sql=action==="publish"?"UPDATE photos SET published_at=COALESCE(published_at,NOW()),updated_at=NOW() WHERE id=$1 RETURNING id,photo_date,uploaded_at,published_at":"UPDATE photos SET published_at=NULL,updated_at=NOW() WHERE id=$1 RETURNING id,photo_date,uploaded_at,published_at";
   const result=await database.query(sql,[id.data]);if(!result.rows[0])return reply.code(404).send({error:"Photo not found"});
   return {data:result.rows[0]};
  });
 }
};