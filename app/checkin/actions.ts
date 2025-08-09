"use server";
import { createCheckin } from "@/lib/notion";

export async function submitCheckin(formData: FormData) {
  const studentName = (formData.get("studentName") as string)?.trim();
  if (!studentName) throw new Error("请填写学员姓名");

  // 支持多文件URL（以换行或逗号分隔）
  const filesRaw = (formData.get("files") as string) || "";
  const files = filesRaw
    .split(/\n|,/) 
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => {
      // 如果是本地上传的文件，转换为完整 URL
      if (url.startsWith("/uploads/")) {
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : "http://localhost:3001";
        return `${baseUrl}${url}`;
      }
      return url;
    });
  
  const date = (formData.get("date") as string) || undefined;
  await createCheckin({ studentName, files: files.length ? files : undefined, date });
}