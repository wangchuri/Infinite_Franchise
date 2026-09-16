"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AvatarEditor from "@/components/AvatarEditor";
import ImageUpload from "@/components/world-editor/ImageUpload";
import {
  fetchMe,
  getAccessToken,
  updateMe,
  type AuthUser,
} from "@/lib/auth";
import styles from "../me.module.css";

export default function EditProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((u) => {
        if (cancelled) return;
        setMe(u);
        setDisplayName(u.displayName);
        setBio(u.bio ?? "");
        setContactEmail(u.contactEmail ?? "");
        setLinkUrl(u.linkUrl ?? "");
        setAvatarUrl(u.avatarUrl);
        setCoverUrl(u.coverUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await updateMe({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        contactEmail: contactEmail.trim() || null,
        linkUrl: linkUrl.trim() || null,
        avatarUrl,
        coverUrl,
      });
      setMe(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  if (!me) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>{error ?? "加载中…"}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>个人</p>
          <h1 className={styles.title}>编辑资料</h1>
        </div>
        <Link href={`/u/${me.username}`} className={styles.viewLink}>
          查看我的主页 →
        </Link>
      </header>

      <section className={styles.card}>
        <div className={styles.field}>
          <span className={styles.label}>主页背景</span>
          <ImageUpload
            label="上传背景图"
            value={coverUrl}
            onChange={setCoverUrl}
            aspect="wide"
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>头像</span>
          <AvatarEditor
            value={avatarUrl}
            onChange={setAvatarUrl}
            fallback={(displayName || me.username || "?").slice(0, 1)}
          />
        </div>

        <label className={styles.field}>
          <span className={styles.label}>昵称</span>
          <input
            value={displayName}
            maxLength={64}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="展示给其他人的名字"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>介绍</span>
          <textarea
            value={bio}
            maxLength={500}
            rows={5}
            onChange={(e) => setBio(e.target.value)}
            placeholder="介绍一下自己、擅长的创作…"
          />
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>联系邮箱</span>
            <input
              value={contactEmail}
              maxLength={255}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="可公开的联系方式"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>个人链接</span>
            <input
              value={linkUrl}
              maxLength={500}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="主页 / 社交账号 链接"
            />
          </label>
        </div>

        <div className={styles.foot}>
          <button
            type="button"
            className={styles.save}
            disabled={busy || !displayName.trim()}
            onClick={() => void save()}
          >
            {busy ? "保存中…" : "保存"}
          </button>
          {saved ? <span className={styles.ok}>已保存</span> : null}
          {error ? <span className={styles.error}>{error}</span> : null}
        </div>
      </section>
    </div>
  );
}
