import { getRecentCheckins } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const items = await getRecentCheckins(100);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">进度管理</h1>
      <p className="text-sm text-black/60 dark:text-white/60">最近打卡（来自 Notion）。练习内容来自学员库的“近期目标”。</p>

      <div className="space-y-3">
        {items.map((c) => (
          <div key={c.id} className="rounded-xl border border-black/10 dark:border-white/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="font-medium">{c.studentName}</div>
              <div className="text-xs text-black/60 dark:text-white/60">{new Date(c.date || "").toLocaleString()}</div>
            </div>
            {c.files && c.files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {c.files.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noreferrer" className="inline-block">
                    {/(png|jpg|jpeg|gif|webp)$/i.test(url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="媒体" className="w-24 h-24 object-cover rounded" />
                    ) : (
                      <span className="px-2 py-1 rounded bg-black/5 dark:bg-white/10">查看视频</span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}