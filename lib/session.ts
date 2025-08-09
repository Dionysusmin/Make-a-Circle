import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "student_session";

export async function setStudentSession(studentName: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, studentName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function getStudentSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

export async function clearStudentSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}