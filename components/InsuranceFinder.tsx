"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import RecommendationDisplay from "@/components/RecommendationDisplay";
import {
  CLIENT_ID_HEADER,
  getOrCreateClientId,
} from "@/lib/client-id";
import type { TokenUsage } from "@/lib/gemini/file-search";
import type { StructuredRecommendation } from "@/lib/recommendation-format";
import { QUIZ_QUESTIONS } from "@/lib/quiz";

type Step = "welcome" | "quiz" | "loading" | "result";

interface CatalogProductItem {
  id: string;
  provider: string;
  displayName: string;
  tagline: string;
}

interface RecommendResponse {
  ok: boolean;
  error?: string;
  recommendation?: string;
  structured?: StructuredRecommendation | null;
  model?: string;
  usage?: TokenUsage;
  citations?: {
    title?: string;
    text?: string;
    pageNumber?: number;
    productId?: string;
  }[];
  answersSummary?: { question: string; answer: string }[];
  rateLimit?: {
    limit: number;
    used: number;
    remaining: number;
    dateKey: string;
  };
  code?: string;
  used?: number;
  limit?: number;
}

export default function InsuranceFinder() {
  const [step, setStep] = useState<Step>("welcome");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState("");
  const [structuredResult, setStructuredResult] =
    useState<StructuredRecommendation | null>(null);
  const [citations, setCitations] = useState<RecommendResponse["citations"]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indexed, setIndexed] = useState<boolean | null>(null);
  const [products, setProducts] = useState<CatalogProductItem[]>([]);
  const [rateLimit, setRateLimit] = useState({
    limit: 10,
    used: 0,
    remaining: 10,
    dateKey: "",
  });

  const currentQuestion = QUIZ_QUESTIONS[questionIndex];
  const progress = useMemo(() => {
    try {
      return Math.round(
        ((questionIndex + (answers[currentQuestion?.id ?? ""] ? 1 : 0)) /
          QUIZ_QUESTIONS.length) *
          100,
      );
    } catch {
      return 0;
    }
  }, [questionIndex, answers, currentQuestion?.id]);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const productsRes = await fetch("/api/products");
        const productsData = await productsRes.json();
        if (active && productsData.ok) {
          setProducts(productsData.products ?? []);
          setIndexed(Boolean(productsData.indexed));
        }
      } catch (err) {
        console.error("[aians] loadInitialData products failed", err);
        if (active) setIndexed(false);
      }

      try {
        const clientId = getOrCreateClientId();
        const limitRes = await fetch("/api/rate-limit", {
          headers: { [CLIENT_ID_HEADER]: clientId },
        });
        const limitData = await limitRes.json();
        if (active && limitData.ok) {
          setRateLimit({
            limit: limitData.limit,
            used: limitData.used,
            remaining: limitData.remaining,
            dateKey: limitData.dateKey,
          });
        }
      } catch (err) {
        console.error("[aians] loadInitialData rate-limit failed", err);
      }
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  const handleSelectOption = (questionId: string, optionId: string) => {
    try {
      const nextAnswers = { ...answers, [questionId]: optionId };
      setAnswers(nextAnswers);

      if (questionIndex < QUIZ_QUESTIONS.length - 1) {
        setTimeout(() => setQuestionIndex((i) => i + 1), 280);
      }
    } catch (err) {
      console.error("[aians] handleSelectOption failed", err);
    }
  };

  const submitQuiz = async () => {
    try {
      setStep("loading");
      setError(null);

      const clientId = getOrCreateClientId();
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CLIENT_ID_HEADER]: clientId,
        },
        body: JSON.stringify({ answers }),
      });

      const data: RecommendResponse = await res.json();

      if (!data.ok) {
        if (data.code === "RATE_LIMIT") {
          setRateLimit({
            limit: data.rateLimit?.limit ?? data.limit ?? 10,
            used: data.used ?? 10,
            remaining: 0,
            dateKey: data.rateLimit?.dateKey ?? "",
          });
        }
        throw new Error(data.error ?? "ไม่สามารถรับคำแนะนำได้");
      }

      if (data.rateLimit) {
        setRateLimit(data.rateLimit);
      }

      setRecommendation(data.recommendation ?? "");
      setStructuredResult(data.structured ?? null);
      setCitations(data.citations ?? []);
      setTokenUsage(data.usage ?? null);
      setModelUsed(data.model ?? null);
      setStep("result");
    } catch (err) {
      console.error("[aians] submitQuiz failed", err);
      setError(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่",
      );
      setStep("quiz");
    }
  };

  const resetQuiz = () => {
    try {
      setStep("welcome");
      setQuestionIndex(0);
      setAnswers({});
      setRecommendation("");
      setStructuredResult(null);
      setCitations([]);
      setTokenUsage(null);
      setModelUsed(null);
      setError(null);
    } catch (err) {
      console.error("[aians] resetQuiz failed", err);
    }
  };

  const allAnswered = QUIZ_QUESTIONS.every((q) => answers[q.id]);

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-teal-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-teal-300/90">
              Powered by Gemini File Search
            </p>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              ค้นหาประกันกลุ่มที่เหมาะกับคุณ
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2 text-sm">
            <Link
              href="/admin"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-teal-400/50 hover:bg-white/5"
            >
              เข้าสู่ระบบ Admin
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-slate-400">
                {products.length} แผนประกัน · RAG
              </p>
              <p
                className={
                  rateLimit.remaining > 0
                    ? "font-medium text-teal-300"
                    : "font-medium text-rose-400"
                }
              >
                วันนี้เหลือ {rateLimit.remaining}/{rateLimit.limit} ครั้ง
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {indexed === false && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <p className="font-medium">ระบบยังไม่พร้อมให้บริการ</p>
            <p className="mt-1 text-amber-200/80">
              ยังไม่มีเอกสารประกันที่ index บน Google File Search — ผู้ดูแลต้องอัปโหลดที่หน้า Admin ก่อน
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {step === "welcome" && (
          <section className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-teal-900/20">
              <h2 className="text-3xl font-bold leading-tight text-white">
                ตอบคำถามสั้นๆ รับคำแนะนำประกันที่เหมาะกับคุณ
              </h2>
              <p className="mt-4 max-w-2xl text-slate-300 leading-relaxed">
                ตอบคำถามสั้นๆ แล้วให้{" "}
                <strong className="text-teal-300">Gemini File Search</strong>{" "}
                วิเคราะห์จากเอกสารประกันจริงว่าแผนไหนเหมาะกับคุณที่สุด
                พร้อมอ้างอิงแหล่งที่มา
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {products.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3"
                  >
                    <p className="font-medium text-teal-200">{p.provider}</p>
                    <p className="text-sm text-slate-300">{p.displayName}</p>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setStep("quiz")}
                disabled={indexed === false}
                className="mt-8 rounded-full bg-teal-400 px-8 py-3 text-base font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                เริ่มแบบสอบถาม
              </button>
            </div>
          </section>
        )}

        {step === "quiz" && currentQuestion && (
          <section className="space-y-6">
            <div>
              <div className="mb-2 flex justify-between text-sm text-slate-400">
                <span>
                  คำถาม {questionIndex + 1} / {QUIZ_QUESTIONS.length}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-teal-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <h2 className="text-2xl font-semibold text-white">
                {currentQuestion.title}
              </h2>
              {currentQuestion.subtitle && (
                <p className="mt-2 text-slate-400">{currentQuestion.subtitle}</p>
              )}

              <div className="mt-6 grid gap-3">
                {currentQuestion.options.map((option) => {
                  const selected = answers[currentQuestion.id] === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        handleSelectOption(currentQuestion.id, option.id)
                      }
                      className={`rounded-2xl border px-5 py-4 text-left text-base transition ${
                        selected
                          ? "border-teal-400 bg-teal-400/15 text-white"
                          : "border-white/10 bg-slate-900/40 text-slate-200 hover:border-teal-500/50"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={questionIndex === 0}
                  onClick={() => setQuestionIndex((i) => Math.max(0, i - 1))}
                  className="rounded-full border border-white/20 px-5 py-2 text-sm disabled:opacity-40"
                >
                  ย้อนกลับ
                </button>
                {questionIndex < QUIZ_QUESTIONS.length - 1 ? (
                  <button
                    type="button"
                    disabled={!answers[currentQuestion.id]}
                    onClick={() => setQuestionIndex((i) => i + 1)}
                    className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium disabled:opacity-40"
                  >
                    ถัดไป
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!allAnswered || rateLimit.remaining <= 0}
                    onClick={submitQuiz}
                    className="rounded-full bg-teal-400 px-6 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
                  >
                    {rateLimit.remaining <= 0
                      ? "ใช้โควต้าวันนี้ครบแล้ว"
                      : "ดูผลแนะนำจาก AI"}
                  </button>
                )}
              </div>
            </div>

            <p className="text-center text-xs text-slate-500">
              โควต้า {rateLimit.used}/{rateLimit.limit} ครั้งต่อวัน (รีเซ็ตเที่ยงคืน)
            </p>
          </section>
        )}

        {step === "loading" && (
          <section className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-12 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-400/30 border-t-teal-400" />
            <p className="mt-6 text-lg font-medium text-white">
              กำลังวิเคราะห์ด้วย Gemini File Search...
            </p>
            <p className="mt-2 text-sm text-slate-400">
              ค้นหาจากเอกสาร PDF ประกัน {products.length} แผน
            </p>
          </section>
        )}

        {step === "result" && (
          <section className="space-y-6">
            <div>
              <h2 className="mb-6 text-2xl font-bold text-white">
                ผลการแนะนำประกันสำหรับคุณ
              </h2>
              <RecommendationDisplay
                structured={structuredResult}
                fallbackText={recommendation}
                products={products}
              />
            </div>

            {tokenUsage && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  การใช้ Token (Gemini)
                </h3>
                {modelUsed && (
                  <p className="mt-1 text-xs text-slate-500">โมเดล: {modelUsed}</p>
                )}
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between rounded-lg bg-slate-950/50 px-3 py-2">
                    <dt className="text-slate-400">Prompt (ส่งเข้า)</dt>
                    <dd className="font-mono text-teal-300">
                      {tokenUsage.promptTokenCount.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between rounded-lg bg-slate-950/50 px-3 py-2">
                    <dt className="text-slate-400">Output (ตอบกลับ)</dt>
                    <dd className="font-mono text-teal-300">
                      {tokenUsage.candidatesTokenCount.toLocaleString()}
                    </dd>
                  </div>
                  {tokenUsage.toolUsePromptTokenCount != null &&
                    tokenUsage.toolUsePromptTokenCount > 0 && (
                      <div className="flex justify-between rounded-lg bg-slate-950/50 px-3 py-2">
                        <dt className="text-slate-400">File Search / Tools</dt>
                        <dd className="font-mono text-teal-300">
                          {tokenUsage.toolUsePromptTokenCount.toLocaleString()}
                        </dd>
                      </div>
                    )}
                  <div className="flex justify-between rounded-lg border border-teal-500/30 bg-teal-950/30 px-3 py-2 sm:col-span-2">
                    <dt className="font-medium text-teal-200">รวมทั้งหมด</dt>
                    <dd className="font-mono font-semibold text-teal-300">
                      {tokenUsage.totalTokenCount.toLocaleString()} tokens
                    </dd>
                  </div>
                  {tokenUsage.estimatedCostUsd != null &&
                    tokenUsage.estimatedCostThb != null && (
                      <>
                        <div className="flex justify-between rounded-lg bg-slate-950/50 px-3 py-2">
                          <dt className="text-slate-400">ประมาณ (USD)</dt>
                          <dd className="font-mono text-amber-200">
                            ${tokenUsage.estimatedCostUsd.toFixed(4)}
                          </dd>
                        </div>
                        <div className="flex justify-between rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 sm:col-span-2">
                          <dt className="font-medium text-amber-100">
                            ประมาณ (บาท)
                          </dt>
                          <dd className="font-mono text-lg font-semibold text-amber-300">
                            {tokenUsage.estimatedCostThb.toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            บาท
                          </dd>
                        </div>
                      </>
                    )}
                </dl>
                {tokenUsage.costRateUsdPer1M != null && (
                  <p className="mt-3 text-xs text-slate-500">
                    อัตราประมาณ: ${tokenUsage.costRateUsdPer1M} / 1M tokens
                    {tokenUsage.costRateThbPerUsd != null &&
                      ` · 1 USD ≈ ${tokenUsage.costRateThbPerUsd} บาท`}
                    {" "}
                    (ปรับได้ใน .env.local)
                  </p>
                )}
              </div>
            )}

            {citations && citations.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  อ้างอิงจากเอกสาร (Citations)
                </h3>
                <ul className="mt-4 space-y-4">
                  {citations.map((c, i) => (
                    <li
                      key={`${c.title}-${i}`}
                      className="rounded-xl border border-white/5 bg-slate-950/50 p-4 text-sm"
                    >
                      <p className="font-medium text-teal-200">
                        {c.title ?? "เอกสาร"}
                        {c.pageNumber != null && (
                          <span className="text-slate-500">
                            {" "}
                            · หน้า {c.pageNumber}
                          </span>
                        )}
                      </p>
                      {c.text && (
                        <p className="mt-2 text-slate-400 line-clamp-3">
                          {c.text}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={resetQuiz}
              className="rounded-full border border-white/20 px-6 py-2 text-sm hover:bg-white/5"
            >
              ทำแบบสอบถามใหม่
            </button>
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-4xl px-6 pb-10 text-center text-xs text-slate-500">
        ใช้{" "}
        <a
          href="https://ai.google.dev/gemini-api/docs/file-search"
          className="text-teal-400/80 underline"
          target="_blank"
          rel="noreferrer"
        >
          Gemini File Search
        </a>{" "}
        · ผู้ดูแลจัดการเอกสารที่หน้า Admin
      </footer>
    </div>
  );
}
