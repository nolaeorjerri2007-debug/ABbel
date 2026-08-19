import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@clerk/clerk-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('缺少环境变量：VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

// 单例 Supabase 客户端。用 global.fetch 在每次请求时现取 Clerk 的「supabase」模板令牌，
// 直接注入 Authorization 头（官方推荐做法，规避 setSession 挂令牌不生效的问题）。
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: async (url, options = {}) => {
      const token = await window.Clerk?.session?.getToken({ template: 'supabase' })
      if (!token) {
        throw new Error('Supabase 鉴权令牌缺失：Clerk 未就绪或用户未登录')
      }
      const headers = new Headers(options?.headers)
      headers.set('Authorization', `Bearer ${token}`)
      return fetch(url, { ...options, headers })
    },
  },
})

// 页面调用：拿到 ready 标记，等 Clerk 就绪且已登录后再读写。
export function useAuthedSupabase() {
  const { userId, isLoaded } = useAuth()
  return { supabase, ready: isLoaded && !!userId }
}
