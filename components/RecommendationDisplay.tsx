"use client";

import { INSURANCE_PRODUCTS } from "@/lib/constants";
import type {
  PlanRecommendation,
  StructuredRecommendation,
} from "@/lib/recommendation-format";

function getProductAccent(productId: string): string {
  try {
    const accents: Record<string, string> = {
      mt_sme: "from-emerald-600/20 to-teal-900/40 border-emerald-500/40",
      aia_gpa: "from-red-600/15 to-slate-900/40 border-red-400/30",
      vir_se: "from-violet-600/20 to-slate-900/40 border-violet-400/30",
      chubb_smart: "from-sky-600/20 to-slate-900/40 border-sky-400/30",
    };
    return accents[productId] ?? "from-teal-600/20 to-slate-900/40 border-teal-500/30";
  } catch {
    return "from-teal-600/20 to-slate-900/40 border-teal-500/30";
  }
}

function PlanCard({
  plan,
  variant,
}: {
  plan: PlanRecommendation;
  variant: "primary" | "alternative";
}) {
  try {
    const isPrimary = variant === "primary";
    const product = INSURANCE_PRODUCTS.find((p) => p.id === plan.productId);

    return (
      <article
        className={`rounded-2xl border bg-gradient-to-br p-6 ${getProductAccent(
          String(plan.productId),
        )}`}
      >
        {isPrimary ? (
          <span className="inline-block rounded-full bg-teal-400 px-3 py-1 text-xs font-bold text-slate-950">
            แผนที่เหมาะกับคุณที่สุด
          </span>
        ) : (
          <span className="inline-block rounded-full border border-white/20 px-3 py-1 text-xs text-slate-300">
            ทางเลือกสำรอง
          </span>
        )}

        <header className="mt-4">
          <p className="text-sm text-slate-400">{plan.provider}</p>
          <h3
            className={`font-bold text-white ${isPrimary ? "text-2xl sm:text-3xl" : "text-xl"}`}
          >
            {plan.planName}
          </h3>
          {product?.tagline && (
            <p className="mt-1 text-sm text-slate-400">{product.tagline}</p>
          )}
        </header>

        <section className="mt-6 space-y-5">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-teal-300">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-400/20 text-xs">
                1
              </span>
              เหมาะกับประกันนี้
            </h4>
            <p className="mt-2 text-base leading-relaxed text-white">
              {isPrimary
                ? `แนะนำ ${plan.provider} ${plan.planName} เป็นหลัก`
                : `ทางเลือกถัดไป: ${plan.provider} ${plan.planName}`}
            </p>
          </div>

          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-teal-300">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-400/20 text-xs">
                2
              </span>
              ทำไมถึงเหมาะ
            </h4>
            {plan.whySuitable.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {plan.whySuitable.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-sm leading-relaxed text-slate-200"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">—</p>
            )}
          </div>

          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-teal-300">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-400/20 text-xs">
                3
              </span>
              ครอบคลุมอะไรบ้าง
            </h4>
            {plan.coverage.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {plan.coverage.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-white/5 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">—</p>
            )}
          </div>
        </section>
      </article>
    );
  } catch (error) {
    console.error("[aians] PlanCard render failed", error);
    return null;
  }
}

export default function RecommendationDisplay({
  structured,
  fallbackText,
}: {
  structured: StructuredRecommendation | null;
  fallbackText: string;
}) {
  try {
    if (!structured) {
      return (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-950/20 p-6">
          <p className="text-sm text-amber-200">
            ไม่สามารถจัดรูปแบบผลลัพธ์ได้ แสดงข้อความดิบจาก AI
          </p>
          <div className="prose prose-invert mt-4 max-w-none whitespace-pre-wrap text-sm text-slate-300">
            {fallbackText}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-teal-500/20 bg-teal-950/30 px-5 py-4">
          <p className="text-lg font-medium text-teal-100">
            {structured.summaryOneLine}
          </p>
        </div>

        <PlanCard plan={structured.primary} variant="primary" />

        {structured.alternative && (
          <PlanCard plan={structured.alternative} variant="alternative" />
        )}

        {structured.considerations && structured.considerations.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              ข้อควรพิจารณา
            </h4>
            <ul className="mt-3 space-y-2">
              {structured.considerations.map((item) => (
                <li
                  key={item}
                  className="text-sm leading-relaxed text-slate-300"
                >
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-xs text-slate-500">
          ข้อมูลจากเอกสารประกันตัวอย่าง · เป็นการแนะนำเบื้องต้น ไม่ใช่สัญญาหรือใบเสนอราคา
        </p>
      </div>
    );
  } catch (error) {
    console.error("[aians] RecommendationDisplay failed", error);
    return null;
  }
}
