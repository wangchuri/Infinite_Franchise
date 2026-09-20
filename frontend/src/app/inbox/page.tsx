"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import {
  fetchInbox,
  inviteText,
  markNotificationsRead,
  notificationHref,
  notificationText,
  respondToInvite,
  type InboxPayload,
} from "@/lib/inbox";
import styles from "./inbox.module.css";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function InboxPage() {
  const router = useRouter();
  const [data, setData] = useState<InboxPayload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const payload = await fetchInbox(60);
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onRespond(inviteId: string, accept: boolean) {
    if (busy) return;
    setBusy(inviteId);
    try {
      await respondToInvite(inviteId, accept);
      setData((prev) =>
        prev
          ? { ...prev, invites: prev.invites.filter((i) => i.id !== inviteId) }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  async function onReadAll() {
    try {
      await markNotificationsRead();
      setData((prev) =>
        prev
          ? {
              ...prev,
              unread: prev.invites.length,
              notifications: prev.notifications.map((n) => ({
                ...n,
                readAt: n.readAt ?? new Date().toISOString(),
              })),
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  function onOpenNotification(id: string) {
    void markNotificationsRead([id]);
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) =>
              n.id === id && !n.readAt
                ? { ...n, readAt: new Date().toISOString() }
                : n,
            ),
          }
        : prev,
    );
  }

  if (!data) {
    return <p className={styles.loading}>{error ?? "加载中…"}</p>;
  }

  const { invites, notifications, unread } = data;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>信箱</h1>
        <p className={styles.lead}>
          {unread > 0 ? `${unread} 条待处理` : "没有新的消息"}
        </p>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.section}>
        <h2>邀请与申请 · {invites.length}</h2>
        {invites.length === 0 ? (
          <p className={styles.empty}>没有待处理的邀请。</p>
        ) : (
          <ul className={styles.list}>
            {invites.map((inv) => (
              <li key={inv.id} className={styles.invite}>
                <div className={styles.info}>
                  <p className={styles.text}>{inviteText(inv)}</p>
                  <span className={styles.time}>{formatTime(inv.createdAt)}</span>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.accept}
                    disabled={busy === inv.id}
                    onClick={() => void onRespond(inv.id, true)}
                  >
                    接受
                  </button>
                  <button
                    type="button"
                    className={styles.decline}
                    disabled={busy === inv.id}
                    onClick={() => void onRespond(inv.id, false)}
                  >
                    拒绝
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>通知 · {notifications.length}</h2>
          {notifications.some((n) => !n.readAt) ? (
            <button type="button" className={styles.readAll} onClick={() => void onReadAll()}>
              全部标为已读
            </button>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className={styles.empty}>还没有通知。</p>
        ) : (
          <ul className={styles.list}>
            {notifications.map((n) => {
              const href = notificationHref(n);
              const inner = (
                <>
                  <p className={styles.text}>{notificationText(n)}</p>
                  <span className={styles.time}>{formatTime(n.createdAt)}</span>
                </>
              );
              return (
                <li
                  key={n.id}
                  className={n.readAt ? styles.note : styles.noteUnread}
                >
                  {href ? (
                    <Link
                      href={href}
                      className={styles.noteLink}
                      onClick={() => onOpenNotification(n.id)}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className={styles.noteLink}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
