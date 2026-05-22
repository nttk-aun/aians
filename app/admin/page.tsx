import AdminPanel from "@/components/AdminPanel";

export const metadata = {
  title: "Admin — จัดการเอกสารประกัน | AIANS",
  description: "อัปโหลดและ index เอกสารประกันไปยัง Gemini File Search",
};

export default function AdminPage() {
  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-10 text-slate-100">
      <AdminPanel />
    </div>
  );
}
