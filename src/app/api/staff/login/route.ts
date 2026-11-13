import { createStaffSession, throttle, verifyPassword } from "@/lib/auth";
import { store } from "@/lib/store";

export async function POST(req: Request) {
  const t = throttle(req, "staff");
  if (t.blocked) return Response.json({ error: "محاولات كثيرة. حاول بعد بضع دقائق." }, { status: 429 });
  const { employee_no, password } = (await req.json().catch(() => ({}))) as { employee_no?: string; password?: string };
  const no = String(employee_no ?? "").replace(/\s+/g, "");
  const e = (await store().list("employees")).find((x) => x.active && x.employee_no === no);
  if (!e || !password || !verifyPassword(String(password), e.password_hash)) {
    t.fail();
    return Response.json({ error: "الرقم الوظيفي أو كلمة المرور غير صحيحة" }, { status: 401 });
  }
  t.ok();
  await createStaffSession(e.id);
  return Response.json({ name: e.name, no: e.employee_no });
}
