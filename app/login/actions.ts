"use server";
import { queryStudents } from "@/lib/notion";
import { setStudentSession } from "@/lib/session";

export type LoginResult =
  | { ok: true; studentName: string }
  | { ok: false; message: string };

// 归一化：去除空格和常见分隔符，转小写
const normalize = (s: string) =>
  (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·•・．.。·\-—_]/g, "");

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const username = (formData.get("username") as string) || "";
  const passwordRaw = formData.get("password") as string;

  if (!username || !passwordRaw) {
    return { ok: false, message: "请填写用户名与密码" };
  }

  const passwordNum = Number(passwordRaw);
  if (!Number.isFinite(passwordNum)) {
    return { ok: false, message: "密码需为数字" };
  }

  const students = await queryStudents();
  console.log("[调试] 找到学员数量:", students.length);
  console.log("[调试] 学员列表:", students.map(s => ({ name: s.name, hasPassword: typeof s.password === "number" })));
  console.log("[调试] 查找学员:", normalize(username));
  
  const target = students.find((s) => normalize(s.name) === normalize(username));
  if (!target) {
    return { ok: false, message: `未找到该学员。可用学员: ${students.map(s => s.name).join(", ")}` };
  }
  if (typeof target.password !== "number") {
    return { ok: false, message: "该学员未设置密码" };
  }
  if (target.password !== passwordNum) {
    return { ok: false, message: "密码错误" };
  }

  // 登录通过，写入 cookie 会话
  await setStudentSession(target.name);
  return { ok: true, studentName: target.name };
}