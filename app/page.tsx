"use client";
import { useState, useTransition } from "react";
import { loginAction } from "./login/actions";

export default function Home() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-4">登录</h1>
      <p className="text-sm text-black/70 dark:text-white/70 mb-4">用户名为学员姓名，密码为学员档案中的“密码”数字字段。</p>
      <form
        action={(fd) =>
          startTransition(async () => {
            setMsg(null);
            setOk(null);
            const res = await loginAction(fd);
            if (res.ok) {
              // 登录成功后跳转到学员档案页
              window.location.href = "/students";
            } else {
              setMsg(res.message);
            }
          })
        }
        className="space-y-3"
      >
        <div>
          <label className="block text-sm mb-1">用户名（学员姓名）</label>
          <input name="username" required className="w-full rounded border px-3 py-2 bg-transparent" placeholder="如：张三" />
        </div>
        <div>
          <label className="block text-sm mb-1">密码（数字）</label>
          <input name="password" required type="password" inputMode="numeric" pattern="[0-9]*" className="w-full rounded border px-3 py-2 bg-transparent" />
        </div>
        <button disabled={pending} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50 dark:bg-white dark:text-black">
           {pending ? "登录中..." : "登录并进入学员档案"}
         </button>
        {ok && <p className="text-green-600 text-sm">{ok}</p>}
        {msg && <p className="text-red-600 text-sm">{msg}</p>}
      </form>
    </div>
  );
}
