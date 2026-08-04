"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login, setTokens } from "@/lib/auth";
import styles from "../auth.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({ login: loginId.trim(), password });
      setTokens(res.accessToken, res.refreshToken);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.panel}>
      <p className={styles.eyebrow}>Sign in</p>
      <h1 className={styles.title}>登录</h1>
      <p className={styles.lead}>使用用户名或邮箱登录。当前为本地密码认证，无需邮箱验证。</p>
      <form className={styles.form} onSubmit={onSubmit}>
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.field}>
          <label htmlFor="login">用户名或邮箱</label>
          <input
            id="login"
            name="login"
            autoComplete="username"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">密码</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
      <p className={styles.footer}>
        还没有账号？<Link href="/register">去注册</Link>
      </p>
      <p className={styles.hint}>开发可用：demo / demo12345</p>
    </div>
  );
}
