import type {FastifyPluginAsync} from "fastify";
import {z} from "zod";
import {database} from "../database.js";
const listQuerySchema=z.object({from:z.string().date().optional(),to:z.string().date().optional(),limit:z.coerce.number().int().min(1).max(50).default(20),offset:z.coerce.number().int().min(0).default(0)}).refine(v=>!v.from||!v.to||v.from<=v.to,{message:"'from' must be earlier than or equal to 'to'"});
const uuidSchema=z.string().uuid();
export const photoRoutes:FastifyPluginAsync=async(app)=>{
 app.get("/photos",async(request,reply)=>{
  if(!database)return reply.code(503).send({error:"Database is not configured"});
  const parsed=listQuerySchema.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:"Invalid query parameters",details:parsed.error.flatten()});
  const {from,to,limit,offset}=parsed.data;const values:unknown[]=[];const filters=["published_at IS NOT NULL"];
  if(from){values.push(from);filters.push("photo_date >= $"+values.length+"::date");}if(to){values.push(to);filters.push("photo_date <= $"+values.length+"::date");}
  values.push(limit,offset);const sql="SELECT id,media_url,mime_type,file_size_bytes,caption,photo_date,taken_at,uploaded_at,published_at FROM photos WHERE "+filters.join(" AND ")+" ORDER BY photo_date DESC,published_at DESC,id DESC LIMIT $"+(values.length-1)+" OFFSET $"+values.length;
  const result=await database.query(sql,values);return {data:result.rows,pagination:{limit,offset,returned:result.rowCount??0}};
 });
 app.post<{Params:{photoId:string}}>("/photos/:photoId/likes",async(request,reply)=>{
  if(!database)return reply.code(503).send({error:"Database is not configured"});
  const photoId=uuidSchema.safeParse(request.params.photoId);const body=z.object({visitorId:uuidSchema}).safeParse(request.body);
  if(!photoId.success||!body.success)return reply.code(400).send({error:"A valid photoId and visitorId UUID are required"});
  const photo=await database.query("SELECT id FROM photos WHERE id=$1 AND published_at IS NOT NULL",[photoId.data]);if(photo.rowCount===0)return reply.code(404).send({error:"Photo not found"});
  await database.query("INSERT INTO photo_likes(photo_id,visitor_id) VALUES($1,$2) ON CONFLICT(photo_id,visitor_id) DO NOTHING",[photoId.data,body.data.visitorId]);
  const count=await database.query("SELECT COUNT(*)::int AS count FROM photo_likes WHERE photo_id=$1",[photoId.data]);return reply.code(200).send({liked:true,likeCount:count.rows[0]?.count??0});
 });
};