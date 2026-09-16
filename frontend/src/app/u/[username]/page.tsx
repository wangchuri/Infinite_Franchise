"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import WorkCover from "@/components/WorkCover";
import { getAccessToken } from "@/lib/auth";
import {
  fetchUserProfile,
  followUser,
  unfollowUser,
  type UserProfilePayload,
} from "@/lib/users";
import { workTypeLabel } from "@/lib/works";
import { coverGradientFor } from "@/lib/world-cover";
import { decodeParam } from "@/lib/url";
import { usePageLabel } from "@/lib/nav-trail";
import styles from "./profile.module.css";

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const username = decodeParam(params.username);

  const [data, setData] = useState<UserProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  usePageLabel(data?.profile.displayName || data?.profile.username || null);

  useEffect(() => {
    let cancelled = false;
    fetchUserProfile(username)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  async function toggleFollow() {
    if (!data) return;
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    setBusy(true);
    const next = !data.isFollowing;
    setData({ ...data, isFollowing: next });
    try {
      if (next) await followUser(data.profile.username);
      else await unfollowUser(data.profile.username);
    } catch {
      setData((cur) => (cur ? { ...cur, isFollowing: !next } : cur));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error}</p>
        <Link href="/discover">去发现世界 →</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>加载中…</p>
      </div>
    );
  }

  const { profile, works } = data;
  const initial = (profile.displayName || profile.username || "?").slice(0, 1);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div
          className={styles.cover}
          style={
            profile.coverUrl
              ? { backgroundImage: `url(${profile.coverUrl})` }
              : { background: coverGradientFor(profile.username) }
          }
        />

        <div className={styles.heroBody}>
          <span
            className={styles.avatar}
            style={
              profile.avatarUrl
                ? { backgroundImage: `url(${profile.avatarUrl})` }
                : undefined
            }
            aria-hidden="true"
          >
            {profile.avatarUrl ? "" : initial}
          </span>

          <div className={styles.heroMain}>
            <div className={styles.heroTop}>
              <div className={styles.identity}>
                <h1 className={styles.name}>{profile.displayName}</h1>
                <p className={styles.handle}>@{profile.username}</p>
              </div>

              <div className={styles.actions}>
                {data.isSelf ? (
                  <Link href="/me/edit" className={styles.edit}>
                    编辑资料
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={data.isFollowing ? styles.following : styles.follow}
                    disabled={busy}
                    onClick={() => void toggleFollow()}
                  >
                    {data.isFollowing ? "已关注" : "关注"}
                  </button>
                )}
              </div>
            </div>

            {profile.bio ? <p className={styles.bio}>{profile.bio}</p> : null}

            <div className={styles.metaRow}>
              <p className={styles.stats}>
                <span>
                  <strong>{profile.works}</strong> 作品
                </span>
                <span>
                  <strong>{profile.following}</strong> 关注
                </span>
                <span>
                  <strong>{profile.followers}</strong> 粉丝
                </span>
              </p>
              <p className={styles.contacts}>
                {profile.contactEmail ? (
                  <a href={`mailto:${profile.contactEmail}`}>
                    {profile.contactEmail}
                  </a>
                ) : null}
                {profile.linkUrl ? (
                  <a href={profile.linkUrl} target="_blank" rel="noreferrer">
                    {profile.linkUrl.replace(/^https?:\/\//, "")}
                  </a>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className={styles.works}>
        <h2 className={styles.sectionTitle}>作品 · {works.length}</h2>
        {works.length === 0 ? (
          <p className={styles.muted}>还没有公开作品。</p>
        ) : (
          <ul className={styles.grid}>
            {works.map((w) => (
              <li key={w.id} className={styles.card}>
                <Link
                  href={`/works/${w.id}`}
                  className={styles.cardHit}
                  aria-label={w.title}
                />
                <WorkCover work={w} />
                <span className={styles.cardTitle}>{w.title}</span>
                <span className={styles.cardMeta}>{workTypeLabel(w)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
