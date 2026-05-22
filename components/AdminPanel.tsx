"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface CatalogProduct {
  id: string;
  provider: string;
  displayName: string;
  tagline: string;
  indexedAt?: string;
  createdAt: string;
}

export default function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<CatalogProduct[]>([]);
  const [indexStatus, setIndexStatus] = useState({
    indexed: false,
    documentCount: 0,
    storeName: null as string | null,
  });

  const [provider, setProvider] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const loadSession = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/session");
      const data = await res.json();
      setAuthenticated(Boolean(data.authenticated));
      if (data.authenticated) {
        setIndexStatus({
          indexed: Boolean(data.indexed),
          documentCount: data.documentCount ?? 0,
          storeName: data.storeName ?? null,
        });
        await loadDocuments();
      }
    } catch (err) {
      console.error("[aians] loadSession failed", err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const res = await fetch("/api/admin/documents");
      const data = await res.json();
      if (data.ok) {
        setDocuments(data.products ?? []);
        setIndexStatus({
          indexed: Boolean(data.indexed),
          documentCount: data.documentCount ?? 0,
          storeName: data.storeName ?? null,
        });
      }
    } catch (err) {
      console.error("[aians] loadDocuments failed", err);
    }
  };

  useEffect(() => {
    void loadSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      setError(null);
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
      }
      setAuthenticated(true);
      await loadDocuments();
    } catch (err) {
      console.error("[aians] handleLogin failed", err);
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      setAuthenticated(false);
      setDocuments([]);
    } catch (err) {
      console.error("[aians] handleLogout failed", err);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      if (!file) {
        setError("กรุณาเลือกไฟล์ PDF");
        return;
      }

      setUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append("provider", provider);
      formData.append("displayName", displayName);
      formData.append("tagline", tagline);
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error ?? "อัปโหลดไม่สำเร็จ");
      }

      setSuccess(data.message ?? "อัปโหลดและ index สำเร็จ");
      setProvider("");
      setDisplayName("");
      setTagline("");
      setFile(null);
      await loadDocuments();
    } catch (err) {
      console.error("[aians] handleUpload failed", err);
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const handleBulkIndex = async () => {
    try {
      setUploading(true);
      setError(null);
      const res = await fetch("/api/setup", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Index ไม่สำเร็จ");
      setSuccess(data.message ?? "Index สำเร็จ");
      await loadDocuments();
    } catch (err) {
      console.error("[aians] handleBulkIndex failed", err);
      setError(err instanceof Error ? err.message : "Index ไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        กำลังโหลด...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-slate-400 transition hover:text-teal-300"
        >
          ← กลับหน้าหลัก
        </Link>
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-white">Admin — จัดการเอกสารประกัน</h1>
          <p className="mt-2 text-sm text-slate-400">
            อัปโหลด PDF แล้วระบบจะ index ไปยัง Google Gemini File Search ทันที
          </p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="text-sm text-slate-400">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                autoComplete="username"
                placeholder=""
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                autoComplete="current-password"
                placeholder=""
              />
            </div>
            {error && (
              <p className="text-sm text-rose-400">{error}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-full bg-teal-400 py-3 font-semibold text-slate-950 hover:bg-teal-300"
            >
              เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">จัดการเอกสารประกัน</h1>
          <p className="mt-1 text-sm text-slate-400">
            เอกสารเก็บ index บน Google File Search — ไม่เก็บ PDF ถาวรบนเซิร์ฟเวอร์ production
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
        >
          ออกจากระบบ
        </button>
      </div>

      <div className="rounded-2xl border border-teal-500/30 bg-teal-950/30 p-4 text-sm">
        <p className="text-teal-100">
          File Search Store: {indexStatus.storeName ?? "ยังไม่สร้าง"}
        </p>
        <p className="mt-1 text-slate-300">
          เอกสารที่ index แล้ว: {indexStatus.documentCount} แผน
          {indexStatus.indexed ? " · พร้อมให้ผู้ใช้ทำแบบสอบถาม" : " · ยังไม่พร้อม"}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      )}

      <form
        onSubmit={handleUpload}
        className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6"
      >
        <h2 className="text-lg font-semibold text-white">เพิ่มแผนประกันใหม่</h2>
        <p className="text-sm text-slate-400">
          อัปโหลดแล้ว index ทันที — ผู้ใช้ไม่ต้องกด index เอง
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-slate-400">บริษัทประกัน (provider)</label>
            <input
              required
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-white"
              placeholder="เช่น AIA"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400">ชื่อแผน (displayName)</label>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-white"
              placeholder="เช่น GPA Continental"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-400">คำอธิบายสั้น (tagline)</label>
          <input
            required
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-white"
            placeholder="เหมาะกับกลุ่มเป้าหมายใด"
          />
        </div>

        <div>
          <label className="text-sm text-slate-400">ไฟล์ PDF</label>
          <input
            required
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm text-slate-300"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="rounded-full bg-teal-400 px-6 py-2.5 font-semibold text-slate-950 disabled:opacity-50"
        >
          {uploading ? "กำลังอัปโหลดและ index..." : "อัปโหลด + Index ไป Google"}
        </button>
      </form>

      <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">เอกสารในระบบ</h2>
          <button
            type="button"
            disabled={uploading}
            onClick={handleBulkIndex}
            className="text-sm text-teal-300 underline disabled:opacity-50"
          >
            Index แผนที่ยังค้าง (จาก catalog)
          </button>
        </div>
        <ul className="mt-4 space-y-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="rounded-xl border border-white/5 bg-slate-950/50 px-4 py-3"
            >
              <p className="font-medium text-teal-200">
                {doc.provider} — {doc.displayName}
              </p>
              <p className="mt-1 text-sm text-slate-400">{doc.tagline}</p>
              <p className="mt-2 text-xs text-slate-500">
                {doc.indexedAt
                  ? `Indexed: ${new Date(doc.indexedAt).toLocaleString("th-TH")}`
                  : "ยังไม่ index"}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-xs text-slate-500">
        <a href="/" className="text-teal-400/80 underline">
          กลับหน้าผู้ใช้
        </a>
      </p>
    </div>
  );
}
