import { queryStudents, getStudentsDbSchema, getCheckinsDbSchema, getCheckinsByStudent, type Checkin } from "@/lib/notion";
import { getStudentSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic"; // Notion数据不缓存

export default async function StudentsPage() {
  const current = await getStudentSession();
  if (!current) redirect("/");

  const [students, studentsSchema, checkinsSchema] = await Promise.all([
    queryStudents(),
    getStudentsDbSchema().catch(() => []),
    getCheckinsDbSchema().catch(() => []),
  ]);

  // 归一化函数，与登录时保持一致
  const normalize = (s: string) =>
    (s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[·•・．.。·\-—_]/g, "");

  const me = students.find((s) => normalize(s.name) === normalize(current));
  if (!me) {
    // 若找不到，清空并返回首页
    redirect("/");
  }

  // 使用 Relation 直接读取与学员关联的作品与素材
  const myList: Checkin[] = await getCheckinsByStudent(me!.id);
  console.log(`[Students] 当前用户: ${current} -> ${me.name} (ID: ${me.id})`);
  console.log(`[Students] 查询结果: ${myList.length} 条打卡记录`);
  console.log(`[Students] 文件分布: [${myList.map(c => c.files?.length || 0).join(',')}]`);

  // 仅保留每条打卡的第一个文件作为封面
  const listWithCover = myList.map(c => ({
    ...c,
    cover: (c.files && c.files.length > 0) ? c.files[0] : undefined,
  }));

  // 统计与媒体整理（全量，用于“作品与素材”计数）
  const media = myList.flatMap((c) => (c.files || []).map((url) => ({ url, date: c.date, comment: c.teacherComment })));
  const stripQuery = (u: string) => u.split('?')[0];
  const isImage = (url: string) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(stripQuery(url));
  const isVideo = (url: string) => /\.(mp4|mov|webm|m4v|avi)$/i.test(stripQuery(url));
  
  // 放宽文件过滤，包含更多文件类型
  const allMediaFiles = media.filter(m => {
    const url = m.url;
    const base = stripQuery(url);
    // 支持图片、视频、音频、PDF等文件
    return /\.(png|jpg|jpeg|gif|webp|svg|mp4|mov|webm|m4v|avi|mp3|wav|pdf|doc|docx|ppt|pptx)$/i.test(base) 
           || url.includes('amazonaws.com') // AWS S3文件
           || url.includes('notion') // Notion文件
           || url.startsWith('https://');
  });
  
  const images = allMediaFiles.filter((m) => isImage(m.url));
  const videos = allMediaFiles.filter((m) => isVideo(m.url));
  const totalMedia = allMediaFiles.length;

  // 近期打卡：只统计“类型”为“打卡练习”的记录
  const isCheckinPractice = (t?: string) => (t || '').trim() === '打卡练习';
  const recentCheckinList = listWithCover.filter(c => isCheckinPractice(c.typeName));
  const totalCheckins = recentCheckinList.length;

  console.log(`[Students] 媒体过滤: 原始=${media.length} 过滤后=${allMediaFiles.length} 图片=${images.length} 视频=${videos.length}`);

  return (
    <div className="space-y-6">
      {/* 顶部个人卡片 */}
      <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/10 to-cyan-500/10 p-6">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-center gap-4">
            {/* 头像占位（姓名首字母） */}
            <div className="size-14 rounded-xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-cyan-500 text-white grid place-items-center text-xl font-bold shadow-sm">
              {me!.name.slice(0, 1)}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{me!.name} 的档案</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 px-2 py-0.5 bg-black/5 dark:bg-white/10">
                  <span className="opacity-70">水平</span>
                  <span className="font-medium">{me!.level || "未设置"}</span>
                </span>
                {me!.recentGoal && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 px-2 py-0.5">
                    <span className="opacity-70">近期目标</span>
                    <span className="font-medium truncate max-w-[50ch]">{me!.recentGoal}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur p-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-black/60 dark:text-white/60">打卡次数（打卡练习）</div>
              <div className="text-xl font-semibold">{totalCheckins}</div>
            </div>
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur p-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-black/60 dark:text-white/60">作品与素材</div>
              <div className="text-xl font-semibold">{totalMedia}</div>
            </div>
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur p-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-black/60 dark:text-white/60">图片</div>
              <div className="text-xl font-semibold">{images.length}</div>
            </div>
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur p-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-black/60 dark:text-white/60">视频</div>
              <div className="text-xl font-semibold">{videos.length}</div>
            </div>
          </div>
        </div>

        {/* 背景装饰 */}
        <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      {/* 作品与素材展示（仅封面图/首个文件） */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">作品与素材</h2>
          {totalMedia > 0 && (
            <div className="text-xs text-black/60 dark:text-white/60">共 {totalMedia} 个文件</div>
          )}
        </div>
        {listWithCover.some(c => !!c.cover) ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {listWithCover.map((c) => (
              <a
                key={c.id}
                href={c.cover || '#'}
                target="_blank"
                rel="noreferrer"
                className="group relative block overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5"
                title={new Date(c.date || '').toLocaleString()}
              >
                {c.cover && isImage(c.cover) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover} alt="封面" className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="h-32 w-full grid place-items-center text-xs text-black/70 dark:text-white/70">
                    <div className="flex flex-col items-center gap-2">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="opacity-80">
                        <path d="M8 5v14l11-7L8 5z" fill="currentColor"/>
                      </svg>
                      <span>查看文件</span>
                    </div>
                  </div>
                )}
                {c.teacherComment && (
                  <div className="absolute inset-x-0 bottom-0 p-2 text-[11px] leading-snug text-white bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-90">
                    <span className="line-clamp-2">{c.teacherComment}</span>
                  </div>
                )}
              </a>
            ))}
          </div>
        ) : (
          <div className="text-sm text-black/60 dark:text-white/60">暂无作品或素材</div>
        )}
      </section>

      {/* 近期打卡（仅类型=打卡练习） */}
      <section>
        <h2 className="text-lg font-semibold mb-3">近期打卡</h2>
        {recentCheckinList.length > 0 ? (
          <ul className="space-y-3">
            {recentCheckinList.slice(0, 10).map((c) => (
              <li key={c.id} className="rounded-xl border border-black/10 dark:border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{new Date(c.date || "").toLocaleString()}</div>
                  <div className="text-xs text-black/60 dark:text-white/60">{(c.files?.length || 0)} 个附件</div>
                </div>
                {c.teacherComment && (
                  <div className="mt-1 text-xs text-black/70 dark:text-white/70">老师评语：{c.teacherComment}</div>
                )}
                {c.files && c.files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.files.slice(0, 6).map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noreferrer" className="inline-block">
                        {/(png|jpg|jpeg|gif|webp)$/i.test(url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt="媒体" className="w-20 h-20 object-cover rounded" />
                        ) : (
                          <span className="px-2 py-1 rounded bg-black/5 dark:bg-white/10 text-xs">查看文件</span>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-black/60 dark:text-white/60">暂无打卡记录</div>
        )}
      </section>

      {/* 调试信息（保留） */}
      <details className="rounded-lg border border-black/10 dark:border-white/10 p-3">
        <summary className="text-sm cursor-pointer">调试：显示 Notion 数据库属性（仅在本地可见）</summary>
        <div className="mt-2 grid sm:grid-cols-2 gap-3 text-xs text-black/70 dark:text-white/70">
          <div>
            <div className="font-medium mb-1">学员库属性</div>
            <ul className="list-disc list-inside space-y-0.5">
              {(studentsSchema as any[]).map((p) => (
                <li key={p.id}>{p.name} <span className="opacity-60">({p.type})</span></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-medium mb-1">作品与素材库属性</div>
            <ul className="list-disc list-inside space-y-0.5">
              {(checkinsSchema as any[]).map((p) => (
                <li key={p.id}>{p.name} <span className="opacity-60">({p.type})</span></li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}