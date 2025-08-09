import { Client } from "@notionhq/client";

if (!process.env.NOTION_TOKEN) {
  // eslint-disable-next-line no-console
  console.warn("[Notion] 缺少 NOTION_TOKEN 环境变量，Notion API 将不可用。");
}

export const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 简单内存缓存：缓存页面正文媒体，减少重复扫描
const PAGE_MEDIA_CACHE = new Map<string, { urls: string[]; ts: number }>();
const PAGE_MEDIA_CACHE_TTL_MS = 3 * 60 * 1000; // 3 分钟

export type Student = {
  id: string;
  name: string;
  level?: string;
  recentGoal?: string; // 近期目标，来自学员库
  password?: number; // 来自 Notion 数字属性（Password 或 密码）
};

export type Checkin = {
  id: string;
  studentName: string;
  files?: string[]; // 视频/图片 文件列表
  date?: string;
  teacherComment?: string; // 老师评语
  typeName?: string; // 作品与素材库中的“类型”
};

const STUDENTS_DB = process.env.NOTION_STUDENTS_DB_ID;
const CHECKINS_DB = process.env.NOTION_CHECKINS_DB_ID;

// 动态获取"作品与素材库"(Checkins) 数据库中指向学员库(Students)的 Relation 属性名
async function getCheckinsStudentRelationPropName(): Promise<string | null> {
  if (!CHECKINS_DB || !STUDENTS_DB) {
    // eslint-disable-next-line no-console
    console.log(`[Notion] getCheckinsStudentRelationPropName: DB缺失 CHECKINS_DB=${!!CHECKINS_DB} STUDENTS_DB=${!!STUDENTS_DB}`);
    return null;
  }
  try {
    const db = await notion.databases.retrieve({ database_id: CHECKINS_DB });
    const props = (db as any).properties || {};

    // 优先识别固定命名的 Relation 属性："学员"
    const fixed = (props as any)["学员"];
    if (fixed?.type === "relation" && fixed?.relation?.database_id === STUDENTS_DB) {
      // eslint-disable-next-line no-console
      console.log(`[Notion] getCheckinsStudentRelationPropName: 找到固定属性"学员" -> 指向 ${fixed.relation.database_id}`);
      return "学员";
    }

    // 兜底：动态遍历 relation 属性
    const relationProps: string[] = [];
    for (const [name, prop] of Object.entries(props)) {
      const p: any = prop;
      if (p?.type === "relation") {
        relationProps.push(`${name}:${p.relation?.database_id}`);
        if (p?.relation?.database_id === STUDENTS_DB) {
          // eslint-disable-next-line no-console
          console.log(`[Notion] getCheckinsStudentRelationPropName: 找到动态属性"${name}" -> 指向 ${p.relation.database_id}`);
          return name; // 找到与学员库关联的 relation 属性名
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[Notion] getCheckinsStudentRelationPropName: 未找到指向学员库的属性，所有关系属性: [${relationProps.join(', ')}]`);
    return null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[Notion] getCheckinsStudentRelationPropName: 异常", e);
    return null;
  }
}

// 新增：从 Notion 页面正文（Blocks）中提取媒体 URL（image/video/file/embed）
async function fetchPageMediaFromBlocks(pageId: string, maxDepth = 2, maxItems = 20): Promise<string[]> {
  // 读取缓存
  const cached = PAGE_MEDIA_CACHE.get(pageId);
  const now = Date.now();
  if (cached && now - cached.ts < PAGE_MEDIA_CACHE_TTL_MS) {
    // eslint-disable-next-line no-console
    console.log(`[Notion] 命中缓存: page ${pageId}, urls=${cached.urls.length}`);
    return cached.urls.slice(0, maxItems);
  }

  const urls: string[] = [];
  let totalBlocks = 0;
  let mediaBlocks = 0;
  
  async function listChildren(blockId: string, startCursor?: string) {
    try {
      const res = await notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        start_cursor: startCursor,
      } as any);
      return res;
    } catch (err) {
      // 避免网络错误或权限问题导致页面崩溃
      // eslint-disable-next-line no-console
      console.warn("[Notion] blocks.children.list failed", err);
      return { results: [], next_cursor: null } as any;
    }
  }
  function pushUrl(u?: string, blockType?: string) {
    if (!u || urls.length >= maxItems) return;
    urls.push(u);
    mediaBlocks++;
    // eslint-disable-next-line no-console
    console.log(`[Notion] 找到媒体 ${blockType}: ${u}`);
  }
  async function walk(blockId: string, depth: number) {
    if (depth > maxDepth || urls.length >= maxItems) return;
    let cursor: string | undefined = undefined;
    do {
      const res = await listChildren(blockId, cursor);
      for (const b of res.results as any[]) {
        totalBlocks++;
        const t = b.type;
        
        // 标准媒体块类型
        if (t === "image") {
          const img = b.image;
          pushUrl(img?.external?.url || img?.file?.url, "image");
        } else if (t === "video") {
          const vid = b.video;
          pushUrl(vid?.external?.url || vid?.file?.url, "video");
        } else if (t === "file") {
          const f = b.file;
          pushUrl(f?.external?.url || f?.file?.url, "file");
        } else if (t === "embed") {
          const e = b.embed;
          pushUrl(e?.url, "embed");
        } else if (t === "bookmark") {
          const bk = b.bookmark;
          pushUrl(bk?.url, "bookmark");
        } else if (t === "link_preview") {
          const lp = b.link_preview;
          pushUrl(lp?.url, "link_preview");
        } else if (t === "audio") {
          const au = b.audio;
          pushUrl(au?.external?.url || au?.file?.url, "audio");
        } else if (t === "pdf") {
          const pdf = b.pdf;
          pushUrl(pdf?.external?.url || pdf?.file?.url, "pdf");
        } 
        // 处理 unsupported 类型的块（包含视频等文件）
        else if (t === "unsupported") {
          // unsupported 块可能包含 file 信息
          const unsupported = b.unsupported;
          if (unsupported?.file?.url) {
            pushUrl(unsupported.file.url, "unsupported-file");
          } else if (unsupported?.external?.url) {
            pushUrl(unsupported.external.url, "unsupported-external");
          }
        }
        // 通用 file 属性兜底（某些块类型可能直接在根级包含 file）
        else if (b.file?.url || b.file?.external?.url) {
          pushUrl(b.file.url || b.file.external.url, `${t}-file`);
        }
        
        if (b.has_children && urls.length < maxItems) {
          await walk(b.id, depth + 1);
        }
        if (urls.length >= maxItems) break;
      }
      cursor = (res as any).next_cursor || undefined;
    } while (cursor && urls.length < maxItems);
  }
  try {
    await walk(pageId, 0);
    // eslint-disable-next-line no-console
    console.log(`[Notion] 页面 ${pageId} 扫描完成: ${totalBlocks} 个块, ${mediaBlocks} 个媒体块, ${urls.length} 个URL`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Notion] walk blocks failed", err);
  }
  // 写入缓存
  PAGE_MEDIA_CACHE.set(pageId, { urls: [...urls], ts: now });
  return urls;
}

export async function queryStudents(): Promise<Student[]> {
  if (!STUDENTS_DB) return [];
  const res = await notion.databases.query({ database_id: STUDENTS_DB });
  return res.results.map((p: any) => {
    const props = p.properties || {};
    // 兼容自定义标题属性名（例如"姓名"），优先使用 Name，其次自动查找第一个 title 类型属性
    const titleKey = props?.Name?.type === "title"
      ? "Name"
      : (Object.entries(props).find(([, v]: any) => v?.type === "title")?.[0] as string | undefined);
    const titleArr = (titleKey ? (props as any)[titleKey]?.title : undefined) as any[] | undefined;
    const name = (titleArr && titleArr.length > 0
      ? titleArr.map((t: any) => t?.plain_text || "").join("")
      : undefined) || "未命名学员";

    const level = (props.Level?.select?.name as string) || undefined;
    const recentGoal = (props["近期目标"]?.rich_text?.[0]?.plain_text as string) || undefined;
    // 密码字段兼容两种命名：Password 或 中文"密码"，均取数字类型
    const password = (typeof props.Password?.number === "number"
      ? (props.Password.number as number)
      : typeof props["密码"]?.number === "number"
      ? (props["密码"].number as number)
      : undefined);
    return { id: p.id, name, level, recentGoal, password };
  });
}

export async function createCheckin(data: {
  studentName: string;
  files?: string[]; // 文件URL数组
  date?: string; // ISO
}) {
  if (!CHECKINS_DB) throw new Error("未配置 NOTION_CHECKINS_DB_ID");
  
  // 查找学员以设置 Relation
  const students = await queryStudents();
  const student = students.find(s => s.name.trim().toLowerCase() === data.studentName.trim().toLowerCase());
  
  const properties: any = {
    StudentName: { title: [{ type: "text", text: { content: data.studentName } }] },
  };
  
  // 设置 Relation 关联到学员库（动态解析属性名）
  if (student) {
    const relName = await getCheckinsStudentRelationPropName();
    if (relName) {
      properties[relName] = {
        relation: [{ id: student.id }]
      };
    } else {
      // eslint-disable-next-line no-console
      console.warn("[Notion] 未在作品与素材库中找到指向学员库的 Relation 属性，已跳过关联。");
    }
  }
  
  // 视频/图片字段：支持多个文件URL
  if (data.files && data.files.length > 0) {
    properties["视频/图片"] = { 
      files: data.files.map(url => ({ 
        type: "external", 
        name: url.split('/').pop() || "文件", 
        external: { url } 
      }))
    };
  }
  
  if (data.date) properties.Date = { date: { start: data.date } };

  const page = await notion.pages.create({
    parent: { database_id: CHECKINS_DB },
    properties,
  });
  return page;
}

export async function getRecentCheckins(limit = 50): Promise<Checkin[]> {
  if (!CHECKINS_DB) return [];
  const res = await notion.databases.query({
    database_id: CHECKINS_DB,
    page_size: Math.min(100, limit),
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  } as any);

  const items = await Promise.all(
    res.results.map(async (p: any) => {
      const props = p.properties || {};
      const studentName = (props.StudentName?.title?.[0]?.plain_text as string) || "未知学员";

      // 先取“视频/图片”属性
      const files: string[] = [];
      if (props["视频/图片"]?.files) {
        for (const file of props["视频/图片"].files) {
          if (file.type === "external" && file.external?.url) {
            files.push(file.external.url);
          } else if (file.type === "file" && file.file?.url) {
            files.push(file.file.url);
          }
        }
      }

      // 如果没有属性文件，则回退到页面正文 Blocks
      if (files.length === 0) {
        const blockFiles = await fetchPageMediaFromBlocks(p.id);
        files.push(...blockFiles);
      }

      const teacherComment = (props["老师评语"]?.rich_text?.[0]?.plain_text as string) || undefined;
      const date = (props.Date?.date?.start as string) || p.created_time;
      const typeName = (props["类型"]?.select?.name as string)
        || (props.Type?.select?.name as string)
        || (props["类型"]?.multi_select?.[0]?.name as string)
        || (props.Type?.multi_select?.[0]?.name as string)
        || undefined;
      return {
        id: p.id,
        studentName,
        files: files.length > 0 ? files : undefined,
        date,
        teacherComment,
        typeName,
      } as Checkin;
    })
  );

  return items;
}

// 新增：根据学员 ID 查询关联的作品与素材
export async function getCheckinsByStudent(studentId: string): Promise<Checkin[]> {
  if (!CHECKINS_DB) return [];

  const relName = await getCheckinsStudentRelationPropName();

  const baseQuery: any = {
    database_id: CHECKINS_DB,
    page_size: 100,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  };

  if (relName) {
    baseQuery.filter = {
      property: relName,
      relation: { contains: studentId },
    };
  }

  const res = await notion.databases.query(baseQuery);
  // eslint-disable-next-line no-console
  console.log(`[Notion] getCheckinsByStudent: relName=${relName || 'N/A'} studentId=${studentId} rawCount=${res.results.length}`);

  // 如果存在 Relation 属性，但没有任何记录通过 Relation 关联到该学员，则回退到按学员姓名匹配
  if (relName && res.results.length === 0) {
    // 获取学员姓名并规范化
    const students = await queryStudents();
    const stu = students.find((s) => s.id === studentId);
    const targetStudentName = (stu?.name || "").trim().toLowerCase();

    const fallbackRes = await notion.databases.query({
      database_id: CHECKINS_DB,
      page_size: 100,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    } as any);

    const fallbackList = await Promise.all(
      fallbackRes.results.map(async (p: any) => {
        const props = p.properties || {};
        const studentName = (props.StudentName?.title?.[0]?.plain_text as string) || "未知学员";

        // 先取“视频/图片”属性
        const files: string[] = [];
        if (props["视频/图片"]?.files) {
          for (const file of props["视频/图片"].files) {
            if (file.type === "external" && file.external?.url) {
              files.push(file.external.url);
            } else if (file.type === "file" && file.file?.url) {
              files.push(file.file.url);
            }
          }
        }

        // 如果没有属性文件，则回退到页面正文 Blocks
        if (files.length === 0) {
          const blockFiles = await fetchPageMediaFromBlocks(p.id);
          files.push(...blockFiles);
        }

        const teacherComment = (props["老师评语"]?.rich_text?.[0]?.plain_text as string) || undefined;
        const date = (props.Date?.date?.start as string) || p.created_time;
        const typeName = (props["类型"]?.select?.name as string)
          || (props.Type?.select?.name as string)
          || (props["类型"]?.multi_select?.[0]?.name as string)
          || (props.Type?.multi_select?.[0]?.name as string)
          || undefined;
        return {
          id: p.id,
          studentName,
          files: files.length > 0 ? files : undefined,
          date,
          teacherComment,
          typeName,
        } as Checkin;
      })
    );

    const normalize = (s: string) => (s || "").trim().toLowerCase();
    const filtered = fallbackList.filter((item) => normalize(item.studentName) === targetStudentName);
    // eslint-disable-next-line no-console
    console.log(`[Notion] getCheckinsByStudent fallback: target=${targetStudentName} total=${fallbackList.length} matched=${filtered.length}`);
    return filtered;
  }

  let targetStudentName: string | undefined;
  let relationMatchedIds: Set<string> | undefined;
  if (!relName) {
    const students = await queryStudents();
    const stu = students.find((s) => s.id === studentId);
    targetStudentName = stu?.name?.trim().toLowerCase();

    // 预扫描：找出所有含有任意 relation 属性且包含当前 studentId 的打卡记录ID
    relationMatchedIds = new Set<string>();
    for (const p of res.results as any[]) {
      const props = p.properties || {};
      for (const [, prop] of Object.entries(props)) {
        const pr: any = prop;
        if (pr?.type === "relation" && Array.isArray(pr?.relation)) {
          if (pr.relation.some((r: any) => r?.id === studentId)) {
            relationMatchedIds.add(p.id);
            break;
          }
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[Notion] getCheckinsByStudent no-relation: relationMatchedIds=${relationMatchedIds.size} targetName=${targetStudentName}`);
  }

  const list = await Promise.all(
    res.results.map(async (p: any) => {
      const props = p.properties || {};
      const studentName = (props.StudentName?.title?.[0]?.plain_text as string) || "未知学员";

      // 先取“视频/图片”属性
      const files: string[] = [];
      if (props["视频/图片"]?.files) {
        for (const file of props["视频/图片"].files) {
          if (file.type === "external" && file.external?.url) {
            files.push(file.external.url);
          } else if (file.type === "file" && file.file?.url) {
            files.push(file.file.url);
          }
        }
      }

      // 如果没有属性文件，则回退到页面正文 Blocks
      if (files.length === 0) {
        const blockFiles = await fetchPageMediaFromBlocks(p.id);
        files.push(...blockFiles);
      }

      const teacherComment = (props["老师评语"]?.rich_text?.[0]?.plain_text as string) || undefined;
      const date = (props.Date?.date?.start as string) || p.created_time;
      const typeName = (props["类型"]?.select?.name as string)
        || (props.Type?.select?.name as string)
        || (props["类型"]?.multi_select?.[0]?.name as string)
        || (props.Type?.multi_select?.[0]?.name as string)
        || undefined;
      return {
        id: p.id,
        studentName,
        files: files.length > 0 ? files : undefined,
        date,
        teacherComment,
        typeName,
      } as Checkin;
    })
  );

  if (!relName) {
    const normalize = (s: string) => (s || "").trim().toLowerCase();
    const filtered = list.filter((item) => {
      const byRelation = relationMatchedIds?.has(item.id) ?? false;
      const byName = targetStudentName ? normalize(item.studentName) === targetStudentName : false;
      return byRelation || byName;
    });
    // eslint-disable-next-line no-console
    console.log(`[Notion] getCheckinsByStudent no-relation filter: raw=${list.length} byRelation=${relationMatchedIds?.size || 0} final=${filtered.length}`);
    return filtered;
  }

  // eslint-disable-next-line no-console
  console.log(`[Notion] getCheckinsByStudent result: count=${list.length} filesDist=[${list.map(i => i.files?.length || 0).join(',')}]`);
  return list;
}

export async function getDatabaseSchema(databaseId: string): Promise<{ name: string; type: string; id: string }[]> {
  const db = await notion.databases.retrieve({ database_id: databaseId as string });
  const entries = Object.entries((db as any).properties || {}) as [string, any][];
  return entries.map(([name, prop]) => ({ name, type: prop?.type as string, id: prop?.id as string }));
}

export async function getStudentsDbSchema() {
  if (!STUDENTS_DB) throw new Error("未配置 NOTION_STUDENTS_DB_ID");
  return getDatabaseSchema(STUDENTS_DB);
}

export async function getCheckinsDbSchema() {
  if (!CHECKINS_DB) throw new Error("未配置 NOTION_CHECKINS_DB_ID");
  return getDatabaseSchema(CHECKINS_DB);
}