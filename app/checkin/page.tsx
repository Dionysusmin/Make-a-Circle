import { getStudentSession } from "@/lib/session";
import { redirect } from "next/navigation";
import CheckinClient from "./Client";

export default async function CheckinPage() {
  const student = await getStudentSession();
  if (!student) redirect("/");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">打卡上传</h1>
      <p className="text-sm text-black/60 dark:text-white/60">提交后会创建一条 Notion 数据库记录。练习内容显示为学员库中的“近期目标”。</p>
      <CheckinClient studentName={student} />
    </div>
  );
}