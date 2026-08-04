"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { register, setTokens } from "@/lib/auth";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await register({
        username: username.trim(),
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
      setTokens(res.accessToken, res.refreshToken);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.panel}>
      <p className={styles.eyebrow}>Create account</p>
      <h1 className={styles.title}>注册</h1>
      <p className={styles.lead}>
        先用本地账号开通。邮箱仅作登录标识，暂不发送验证码；手机号注册后续再接。
      </p>
      <form className={styles.form} onSubmit={onSubmit}>
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.field}>
          <label htmlFor="username">用户名</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            pattern="[A-Za-z0-9_]{3,32}"
            title="3-32 位字母、数字或下划线"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="email">邮箱</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="displayName">展示名（可选）</label>
          <input
            id="displayName"
            name="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={64}
            placeholder="默认与用户名相同"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">密码</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "创建中…" : "注册并登录"}
        </button>
      </form>
      <p className={styles.footer}>
        已有账号？<Link href="/login">去登录</Link>
      </p>
    </div>
  );
}
