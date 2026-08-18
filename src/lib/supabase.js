import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@clerk/clerk-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('缺少环境变量：VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

// 单例 Supabase 客户端。会话由 Clerk 管理，故关闭 Supabase 自身的会话持久化。
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

// 在组件内调用：把 Clerk 的「supabase」模板令牌灌入 Supabase 客户端。
// 令牌携带 role=authenticated + sub=Clerk 用户 ID，RLS 据此放行并隔离。
// 返回 ready 标记，页面应等 ready 为 true 后再读写，避免令牌未就绪。
export function useAuthedSupabase() {
  const { userId, getToken, isLoaded } = useAuth()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isLoaded || !userId) {
      setReady(false)
      return
    }
    getToken({ template: 'supabase' }).then((token) => {
      supabase.auth
        .setSession({ access_token: token, refresh_token: '' })
        .then(() => setReady(true))
    })
  }, [isLoaded, userId, getToken])

  return { supabase, ready }
}
