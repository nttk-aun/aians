import path from "path";

export type ProductId = "mt_sme" | "aia_gpa" | "vir_se" | "chubb_smart";

export interface InsuranceProduct {
  id: ProductId;
  filename: string;
  /** ASCII-only name for Gemini upload (HTTP headers require Latin-1) */
  uploadFilename: string;
  /** ASCII label shown in File Search store */
  storeLabel: string;
  displayName: string;
  provider: string;
  tagline: string;
}

export const INSURANCE_PRODUCTS: InsuranceProduct[] = [
  {
    id: "mt_sme",
    filename: "เมืองไทยประกันชีวิต_SMESmile.pdf",
    uploadFilename: "mti-smesmile.pdf",
    storeLabel: "MTI SMESmile",
    displayName: "SMESmile",
    provider: "เมืองไทยประกันชีวิต",
    tagline: "ประกันกลุ่มสำหรับ SME และธุรกิจขนาดเล็ก",
  },
  {
    id: "aia_gpa",
    filename: "[AIA]GPAContinental_w_wo_AME.pdf",
    uploadFilename: "aia-gpa-continental.pdf",
    storeLabel: "AIA GPA Continental",
    displayName: "GPA Continental",
    provider: "AIA",
    tagline: "ประกันอุบัติเหตุกลุ่ม ครอบคลุมในและต่างประเทศ",
  },
  {
    id: "vir_se",
    filename: "[VIR]_SE.pdf",
    uploadFilename: "vir-se.pdf",
    storeLabel: "VIR SE",
    displayName: "VIR SE",
    provider: "VIR",
    tagline: "แผนความคุ้มครองกลุ่มแบบยืดหยุ่น",
  },
  {
    id: "chubb_smart",
    filename: "[Chubb]_GroupSmart.pdf",
    uploadFilename: "chubb-group-smart.pdf",
    storeLabel: "Chubb Group Smart",
    displayName: "Group Smart",
    provider: "Chubb",
    tagline: "ประกันกลุ่มอัจฉริยะสำหรับองค์กร",
  },
];

export function getPublicPdfPath(filename: string): string {
  try {
    return path.join(process.cwd(), "public", filename);
  } catch (error) {
    throw error;
  }
}

export const STORE_STATE_PATH = path.join(
  process.cwd(),
  ".data",
  "file-search-store.json",
);

export const DEFAULT_GEMINI_MODEL =
  process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export const DEFAULT_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL ?? "models/gemini-embedding-001";
