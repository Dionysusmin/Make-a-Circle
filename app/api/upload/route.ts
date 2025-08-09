import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs"; // 需要 Node.js 运行时以写入本地文件系统
export const dynamic = "force-dynamic"; // 避免缓存，保证上传接口每次都执行

export async function POST(request: NextRequest) {
  try {
    // 创建 uploads 目录
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 获取 formData
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const uploadedFiles: string[] = [];

    for (const file of files) {
      if (file instanceof File) {
        // 生成唯一文件名
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const extension = path.extname(file.name);
        const filename = `${timestamp}_${randomString}${extension}`;
        
        // 保存文件
        const filepath = path.join(uploadsDir, filename);
        const bytes = await file.arrayBuffer();
        fs.writeFileSync(filepath, Buffer.from(bytes));
        
        // 返回可访问的 URL
        const fileUrl = `/uploads/${filename}`;
        uploadedFiles.push(fileUrl);
      }
    }

    return NextResponse.json({ 
      success: true, 
      files: uploadedFiles 
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" }, 
      { status: 500 }
    );
  }
}