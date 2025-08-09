"use client";
import { useState, useTransition, useRef } from "react";
import { submitCheckin } from "./actions";

export default function CheckinClient({ studentName }: { studentName: string }) {
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  async function handleUpload(): Promise<string[]> {
    if (!selectedFiles.length) return [];
    setUploading(true);
    try {
      const fd = new FormData();
      selectedFiles.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("上传失败");
      const data = await res.json();
      return data.files as string[];
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setOk(null);
        setErr(null);
        try {
          const uploadedUrls = await handleUpload();
          const fd = new FormData();
          fd.append("studentName", studentName);
          fd.append("date", date);
          if (uploadedUrls.length) {
            fd.append("files", uploadedUrls.join(","));
          }
          await submitCheckin(fd);
          setOk("已提交！可前往 Notion 查看记录。");
          setSelectedFiles([]);
        } catch (e: any) {
          setErr(e?.message || "提交失败，请稍后重试");
        }
      }}
      className="space-y-3 max-w-xl"
    >
      <div>
        <label className="block text-sm mb-1">学员姓名</label>
        <input value={studentName} disabled className="w-full rounded border px-3 py-2 bg-black/5 dark:bg-white/10" />
      </div>

      <div>
        <label className="block text-sm mb-1">视频/图片（可上传多个）</label>
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
          className="block w-full text-sm"
        />
        <div className="text-xs text-black/60 dark:text-white/60 mt-1">选择后点击“提交打卡”将自动上传并写入 Notion。</div>
      </div>

      <div>
        <label className="block text-sm mb-1">日期</label>
        <div className="flex items-center gap-2">
          <input
            ref={dateInputRef}
            name="date"
            type="date"
            value={date}
            readOnly
            onKeyDown={(e) => e.preventDefault()}
            onChange={(e) => setDate(e.target.value)}
            className="w-48 rounded border px-3 py-2 bg-transparent cursor-pointer"
          />
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.()}
            className="px-3 py-2 rounded border bg-black/5 dark:bg-white/10 text-sm"
            aria-label="选择日期"
            title="选择日期"
          >
            选择日期
          </button>
        </div>
        <div className="text-xs text-black/60 dark:text-white/60 mt-1">该日期输入框禁止键入，请点击右侧按钮直接选择日期。</div>
      </div>

      <button
        disabled={pending || uploading}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50 dark:bg-white dark:text-black"
        type="submit"
      >
        {uploading ? "上传中..." : pending ? "提交中..." : "提交打卡"}
      </button>
      {ok && <p className="text-green-600 text-sm">{ok}</p>}
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </form>
  );
}