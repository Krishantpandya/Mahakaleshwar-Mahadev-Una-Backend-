import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { database } from "./database.js";
import { healthRoutes } from "./routes/health.routes.js";
import { photoRoutes } from "./routes/photos.routes.js";
import { adminPhotoRoutes } from "./routes/admin-photos.routes.js";
import { announcementRoutes } from "./routes/announcements.routes.js";
import { pushSubscriptionRoutes } from "./routes/push-subscriptions.routes.js";
import { adminAuthRoutes } from "./routes/admin-auth.routes.js";
export function buildApp(){
 const app=Fastify({logger:{level:env.nodeEnv==="production"?"info":"debug",redact:{paths:["req.headers.authorization","req.headers.cookie","res.headers.set-cookie"],censor:"[REDACTED]"}},trustProxy:false});
 app.register(helmet);app.register(cookie);app.register(cors,{origin:env.corsOrigins,credentials:true});app.register(rateLimit,{max:100,timeWindow:"1 minute"});
 app.register(healthRoutes,{prefix:"/api/v1"});app.register(photoRoutes,{prefix:"/api/v1"});app.register(adminPhotoRoutes,{prefix:"/api/v1/admin"});
 app.register(announcementRoutes,{prefix:"/api/v1"});app.register(pushSubscriptionRoutes,{prefix:"/api/v1"});app.register(adminAuthRoutes,{prefix:"/api/v1/admin/auth"});
 app.addHook("onClose",async()=>{await database?.end()});
 app.setErrorHandler((error,request,reply)=>{const e=error instanceof Error?error:new Error(String(error));const s=(e as Error&{statusCode?:number}).statusCode;request.log.error({err:e},"Request failed");const code=s&&s>=400&&s<500?s:500;return reply.status(code).send({error:code===500?"Internal Server Error":e.name,message:code===500?"An unexpected error occurred.":e.message})});
 return app;
}