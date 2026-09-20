"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchInbox,
  fetchUnreadCount,
  inviteText,
  markNotificationsRead,
  notificationHref,
  notificationText,
  respondToInvite,
  type InboxPayload,
} from "@/lib/inbox";
import styles from "./InboxBell.module.css";

export default function InboxBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<InboxPayload | null>(null);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await fetchUnreadCount());
    } catch {
      /* signed out / offline: leave the badge as-is */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const n = await fetchUnreadCount();
        if (!cancelled) setUnread(n);
      } catch {
        /* signed out / offline: leave the badge as-is */
      }
    })();
    const id = window.setInterval(() => void refreshCount(), 45000);
    const onFocus = () => void refreshCount();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onToggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    try {
      const payload = await fetchInbox(12);
      setData(payload);
      setUnread(payload.invites.length + payload.notifications.filter((n) => !n.readAt).length);
      const unreadIds = payload.notifications.filter((n) => !n.readAt).map((n) => n.id);
      if (unreadIds.length > 0) {
        void markNotificationsRead(unreadIds).then(() => void refreshCount());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  async function onRespond(inviteId: string, accept: boolean) {
    if (busy) return;
    setBusy(inviteId);
    setError(null);
    try {
      await respondToInvite(inviteId, accept);
      setData((prev) =>
        prev
          ? { ...prev, invites: prev.invites.filter((i) => i.id !== inviteId) }
          : prev,
      );
      void refreshCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  const invites = data?.invites ?? [];
  const notifications = data?.notifications ?? [];
  const shown = notifications.slice(0, 5);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bell}
        aria-label={unread > 0 ? `信箱，${unread} 条未读` : "信箱"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => void onToggle()}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <path d="M13.7 20a1.9 1.9 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span>
        ) : null}
      </button>

      {open ? (
        <div className={styles.panel} role="menu">
          <div className={styles.panelHead}>
            <strong>信箱</strong>
            <Link href="/inbox" className={styles.allLink} onClick={() => setOpen(false)}>
              查看全部
            </Link>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          {!data ? (
            <p className={styles.empty}>加载中…</p>
          ) : invites.length === 0 && notifications.length === 0 ? (
            <p className={styles.empty}>还没有新消息。</p>
          ) : (
            <div className={styles.list}>
              {invites.map((inv) => (
                <div key={inv.id} className={styles.invite}>
                  <p className={styles.text}>{inviteText(inv)}</p>
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
                </div>
              ))}

              {shown.map((n) => {
                const href = notificationHref(n);
                const body = <span className={styles.text}>{notificationText(n)}</span>;
                return (
                  <div
                    key={n.id}
                    className={n.readAt ? styles.note : styles.noteUnread}
                  >
                    {href ? (
                      <Link
                        href={href}
                        className={styles.noteLink}
                        onClick={() => setOpen(false)}
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
