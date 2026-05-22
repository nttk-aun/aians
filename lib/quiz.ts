export interface QuizOption {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  title: string;
  subtitle?: string;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "target",
    title: "คุณต้องการหาประกันให้ใคร?",
    subtitle: "เลือกกลุ่มเป้าหมายหลัก",
    options: [
      { id: "sme", label: "ธุรกิจ SME / สตาร์ทอัพ" },
      { id: "org", label: "องค์กร / พนักงานกลุ่ม" },
      { id: "mixed", label: "ทั้ง SME และพนักงานกลุ่ม" },
    ],
  },
  {
    id: "headcount",
    title: "จำนวนสมาชิกที่ต้องการคุ้มครองโดยประมาณ?",
    options: [
      { id: "small", label: "น้อยกว่า 10 คน" },
      { id: "medium", label: "10 – 50 คน" },
      { id: "large", label: "มากกว่า 50 คน" },
    ],
  },
  {
    id: "coverage",
    title: "ความต้องการความคุ้มครองหลักคืออะไร?",
    options: [
      { id: "accident", label: "อุบัติเหตุ / สุขภาพกลุ่ม" },
      { id: "travel", label: "เดินทาง / ทำงานต่างประเทศ" },
      { id: "sme_pack", label: "แพ็กเกจ SME ครบวงจร" },
      { id: "flex_group", label: "แผนกลุ่มยืดหยุ่น ปรับแผนได้" },
    ],
  },
  {
    id: "budget",
    title: "งบประมาณต่อคนต่อปีโดยประมาณ?",
    options: [
      { id: "low", label: "ประหยัด / เริ่มต้น" },
      { id: "mid", label: "ปานกลาง สมดุลราคา–ผลประโยชน์" },
      { id: "high", label: "ครอบคลุมสูง ไม่จำกัดงบมาก" },
    ],
  },
  {
    id: "travel_freq",
    title: "พนักงานเดินทางต่างประเทศบ่อยแค่ไหน?",
    options: [
      { id: "often", label: "บ่อย หรือทุกเดือน" },
      { id: "sometimes", label: "เป็นครั้งคราว" },
      { id: "rare", label: "แทบไม่มี" },
    ],
  },
  {
    id: "priority",
    title: "สิ่งที่สำคัญที่สุดสำหรับคุณคือ?",
    options: [
      { id: "simple", label: "ตั้งค่าง่าย เริ่มใช้ได้เร็ว" },
      { id: "comprehensive", label: "ความคุ้มครองครบ หลายความเสี่ยง" },
      { id: "custom", label: "ปรับแผนตามโครงสร้างองค์กร" },
    ],
  },
];

export function buildAnswersSummary(
  answers: Record<string, string>,
): { question: string; answer: string }[] {
  try {
    return QUIZ_QUESTIONS.map((q) => {
      const optionId = answers[q.id];
      const option = q.options.find((o) => o.id === optionId);
      return {
        question: q.title,
        answer: option?.label ?? "-",
      };
    });
  } catch (error) {
    throw error;
  }
}

export function formatAnswersForPrompt(
  answersSummary: { question: string; answer: string }[],
): string {
  try {
    return answersSummary
      .map((a) => `- ${a.question} → ${a.answer}`)
      .join("\n");
  } catch (error) {
    throw error;
  }
}
