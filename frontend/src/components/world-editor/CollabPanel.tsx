"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  addMember,
  fetchMembers,
  removeMember,
  type MemberRole,
  type WorldMember,
  type WorkSubmitMode,
} from "@/lib/worlds";
import {
  fetchPendingWorks,
  reviewWork,
  type Work,
} from "@/lib/works";
import styles from "./CollabPanel.module.css";

const MODE_OPTIONS: Array<{
  value: WorkSubmitMode;
  label: string;
  desc: string;
}> = [
  {
    value: "open",
    label: "开放投稿",
    desc: "任何人都可投稿，平台简单审核，直接发布",
  },
  {
    value: "review",
    label: "审核投稿",
    desc: "任何人都可投稿，需创建者或有审核能力的成员通过后才发布",
  },
  {
    value: "invite_only",
    label: "仅邀请",
    desc: "只有被邀请的成员可以创作，投稿经审核后发布",
  },
];

const ROLE_OPTIONS: Array<{ value: MemberRole; label: string }> = [
  { value: "editor", label: "编辑（可审核）" },
  { value: "contributor", label: "贡献者（可投稿）" },
  { value: "viewer", label: "浏览者（只读）" },
];

type Props = {
  worldId: string;
  currentMode: WorkSubmitMode;
  onModeChange: (mode: WorkSubmitMode) => void;
};

export default function CollabPanel({ worldId, currentMode, onModeChange }: Props) {
  const [members, setMembers] = useState<WorldMember[]>([]);
  const [pending, setPending] = useState<Work[]>([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("contributor");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [m, p] = await Promise.all([
          fetchMembers(worldId),
          fetchPendingWorks(worldId),
        ]);
        if (cancelled) return;
        setMembers(m);
        setPending(p);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载协作信息失败");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worldId]);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    const username = inviteName.trim();
    if (!username || busy) return;
    setBusy("invite");
    setError(null);
    try {
      const member = await addMember(worldId, username, inviteRole);
      setMembers((prev) => [
        ...prev.filter((m) => m.userId !== member.userId),
        member,
      ]);
      setInviteName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "邀请失败");
    } finally {
      setBusy(null);
    }
  }

  async function onRemoveMember(userId: string, username: string) {
    const ok = window.confirm(`确定移除成员 @${username}？`);
    if (!ok || busy) return;
    setBusy(`rm-${userId}`);
    setError(null);
    try {
      await removeMember(worldId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除失败");
    } finally {
      setBusy(null);
    }
  }

  async function onReview(work: Work, action: "approve" | "reject") {
    let reason: string | undefined;
    if (action === "reject") {
      reason = window.prompt("驳回原因（可选）", "") || undefined;
    }
    if (busy) return;
    setBusy(`rv-${work.id}`);
    setError(null);
    try {
      await reviewWork(work.id, action, reason);
      setPending((prev) => prev.filter((w) => w.id !== work.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "审核失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <h3>投稿模式</h3>
        <p className={styles.lead}>决定谁能向这个世界投稿作品。</p>
        <div className={styles.modes}>
          {MODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={
                currentMode === opt.value ? styles.modeOn : styles.mode
              }
            >
              <input
                type="radio"
                name="workSubmitMode"
                value={opt.value}
                checked={currentMode === opt.value}
                onChange={() => onModeChange(opt.value)}
              />
              <strong>{opt.label}</strong>
              <span>{opt.desc}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3>成员管理</h3>
        {members.length === 0 ? (
          <p className={styles.muted}>还没有成员。</p>
        ) : (
          <ul className={styles.memberList}>
            {members.map((m) => (
              <li key={m.userId} className={styles.member}>
                <div>
                  <strong>{m.displayName || m.username}</strong>
                  <span className={styles.memberName}>@{m.username}</span>
                  <span
                    className={
                      m.role === "creator"
                        ? styles.roleCreator
                        : styles.roleTag
                    }
                  >
                    {m.role}
                  </span>
                </div>
                {m.role !== "creator" ? (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    disabled={busy === `rm-${m.userId}`}
                    onClick={() => void onRemoveMember(m.userId, m.username)}
                  >
                    {busy === `rm-${m.userId}` ? "移除中…" : "移除"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <form className={styles.invite} onSubmit={onInvite}>
          <input
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="按用户名邀请（如 demo）"
            maxLength={32}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as MemberRole)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="submit" className={styles.primary} disabled={busy === "invite"}>
            {busy === "invite" ? "邀请中…" : "邀请"}
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <h3>待审核作品 · {pending.length}</h3>
        {pending.length === 0 ? (
          <p className={styles.muted}>没有待审核的作品。</p>
        ) : (
          <ul className={styles.pendingList}>
            {pending.map((w) => (
              <li key={w.id} className={styles.pending}>
                <div className={styles.pendingInfo}>
                  <strong>{w.title}</strong>
                  <span className={styles.muted}>
                    {w.type} · @{w.authorUsername}
                  </span>
                </div>
                <div className={styles.pendingActions}>
                  <button
                    type="button"
                    className={styles.approve}
                    disabled={busy === `rv-${w.id}`}
                    onClick={() => void onReview(w, "approve")}
                  >
                    通过
                  </button>
                  <button
                    type="button"
                    className={styles.reject}
                    disabled={busy === `rv-${w.id}`}
                    onClick={() => void onReview(w, "reject")}
                  >
                    驳回
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
