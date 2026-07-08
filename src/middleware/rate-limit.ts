import { Context, Next } from "hono"

export const rateLimit = (limit: number, windowMs: number) => {
  return async (c: Context, next: Next) => {
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown"
    const key = `rl:ip:${ip}`
    
    // Fallback if CACHE is not bound
    if (!c.env?.CACHE) return await next()
    
    const currentStr = await c.env.CACHE.get(key)
    let current = 0
    if (currentStr) {
      current = parseInt(currentStr, 10)
    }
    
    if (current >= limit) {
      return c.json({ 
        supported: false,
        error: "Too many requests. Please try again later.",
        next_action: "Wait and retry, or use the paid endpoint."
      }, 429, {
        "Retry-After": Math.ceil(windowMs / 1000).toString(),
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": "0"
      })
    }
    
    await c.env.CACHE.put(key, (current + 1).toString(), { expirationTtl: Math.max(60, Math.ceil(windowMs / 1000)) })
    
    c.res.headers.set("X-RateLimit-Limit", limit.toString())
    c.res.headers.set("X-RateLimit-Remaining", Math.max(0, limit - current - 1).toString())
    
    await next()
  }
}
