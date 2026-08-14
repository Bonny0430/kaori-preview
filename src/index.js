/**
 * kaori-preview — 服务端
 *
 * 文件预览数据服务：通过 DSH RPC 通道向 Web 客户端暴露
 *   目录列举（listDir）、文本读取（readText）、文件信息（stat）、
 *   图片读取（readImageBase64）。
 *
 * 设计原则（吸取 dsh-side-panel 教训）：
 *   - 只做"读"（预览），不做编辑/Git/终端，绝不动会话容器的布局；
 *   - 每个请求都做路径规范化 + 工作区边界校验，防止越权读任意文件；
 *   - 大文件截断读取（maxReadBytes）。
 */

import { promises as fsp } from 'node:fs';
import path from 'node:path';
import z from '@deepseek-ai/schemastery';

export const name = 'kaori-preview';

export const inject = ['connection', 'sessions'];

export const Config = z.object({
  maxReadBytes: z.natural().min(1).default(262144),
  ignoreDirs: z.array(z.string()).default(['.git', 'node_modules', '.dsh', '.cache', '.claude', '.codex', '.cursor', '.vscode', 'backup']),
  imageExts: z.array(z.string()).default(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']),
  textExts: z.array(z.string()).default(['.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.css', '.html', '.htm', '.xml', '.yaml', '.yml', '.toml', '.ini', '.sh', '.ps1', '.bat', '.cmd', '.sql', '.log', '.csv', '.tsv', '.env', '.gitignore', '.dockerignore', '.editorconfig', '.npmrc', '.gitattributes']),
  // 面板打开时隐藏的 DOM 选择器（适配各种主题的装饰层，如侧边立绘/顶部台词）。
  // 默认主题无装饰，无需配置；其他主题按需添加，如：['.kaori-companions', '.kaori-top-decor']
  hideOnOpen: z.array(z.string()).default([])
});

const CHANNEL = '/kaori-preview';

function normalizeSafe(cwd, rel) {
  if (typeof rel !== 'string') {
    throw new Error('invalid path: empty');
  }
  // 空 rel 表示根目录（listOneDir 以 '' 列 cwd 本身），直接返回 cwd
  if (rel.length === 0) return cwd;
  // 仅允许相对路径（不含盘符/绝对路径/..）
  if (path.isAbsolute(rel) || rel.includes('..')) {
    throw new Error('invalid path: only relative paths inside the workspace are allowed');
  }
  if (/^[A-Za-z]:/.test(rel)) {
    throw new Error('invalid path: drive letters are not allowed');
  }
  const abs = path.resolve(cwd, rel);
  if (abs !== cwd && !abs.startsWith(cwd + path.sep)) {
    throw new Error('invalid path: escapes workspace');
  }
  return abs;
}

function isImage(name, cfg) {
  const ext = path.extname(name).toLowerCase();
  return cfg.imageExts.includes(ext);
}

function isText(name, cfg) {
  const ext = path.extname(name).toLowerCase();
  return cfg.textExts.includes(ext) || ext === '';
}

/**
 * 列出单个目录的直接子项（懒加载：客户端展开某个文件夹时才调用）。
 * 不再递归遍历——展开哪个目录就列哪个目录，天然没有深度/条目数上限问题。
 */
async function listOneDir(cwd, rel, cfg) {
  const abs = normalizeSafe(cwd, rel);
  let dirents;
  try {
    dirents = await fsp.readdir(abs, { withFileTypes: true });
  } catch (e) {
    throw new Error(`cannot read directory: ${e?.code ?? e?.message ?? String(e)}`);
  }
  const out = [];
  for (const d of dirents) {
    if (d.name.startsWith('.')) continue; // 隐藏文件/目录默认不显示
    if (d.isDirectory() && cfg.ignoreDirs.includes(d.name)) continue;
    out.push({
      name: d.name,
      path: rel ? `${rel}/${d.name}` : d.name,
      isDir: d.isDirectory(),
      isFile: d.isFile()
    });
  }
  out.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

async function readTextFile(abs, maxBytes) {
  const info = await fsp.stat(abs);
  const size = info.size;
  let content;
  let truncated = false;
  if (size > maxBytes) {
    const handle = await fsp.open(abs, 'r');
    try {
      const buf = Buffer.alloc(maxBytes);
      const { bytesRead } = await handle.read(buf, 0, maxBytes, 0);
      content = buf.subarray(0, bytesRead).toString('utf8');
      truncated = true;
    } finally {
      await handle.close();
    }
  } else {
    content = await fsp.readFile(abs, 'utf8');
  }
  return { content, size, truncated };
}

async function readImageBase64(abs, maxBytes) {
  const info = await fsp.stat(abs);
  if (info.size > maxBytes) {
    throw new Error(`file too large: ${info.size} bytes > ${maxBytes} limit`);
  }
  const buf = await fsp.readFile(abs);
  const ext = path.extname(abs).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return {
    dataUrl: `data:image/${mime};base64,${buf.toString('base64')}`,
    size: info.size
  };
}

export function apply(ctx, config) {
  const resolved = Config(config ?? {});

  const getCwd = async (payload) => {
    // 优先：客户端直接传 cwd（SessionSummary.cwd，最可靠）
    if (typeof payload?.cwd === 'string' && payload.cwd.length > 0) {
      return payload.cwd;
    }
    // 回退：通过 sessionId 从 session store 取 header.cwd
    if (typeof payload?.sessionId === 'string' && payload.sessionId.length > 0) {
      try {
        const session = await ctx.sessions.get(payload.sessionId);
        return session?.header?.cwd;
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  const removeRpc = ctx.connection.rpc.handle(CHANNEL, async (endpoint, rawPayload, signal) => {
    try {
      if (signal?.aborted) throw new Error('request cancelled');
      const payload = rawPayload ?? {};
      // getConfig 不需要会话工作区：客户端启动时获取主题适配配置
      if (endpoint === 'getConfig') {
        return { ok: true, value: { hideOnOpen: resolved.hideOnOpen } };
      }
      const cwd = await getCwd(payload);
      if (!cwd) throw new Error('session has no workspace directory');
      switch (endpoint) {
        case 'listDir': {
          const rel = typeof payload.path === 'string' ? payload.path : '';
          const entries = await listOneDir(cwd, rel, resolved);
          return { ok: true, value: { entries, cwd, path: rel } };
        }
        case 'stat': {
          const abs = normalizeSafe(cwd, payload.path);
          const info = await fsp.stat(abs);
          return {
            ok: true,
            value: {
              name: path.basename(abs),
              path: payload.path,
              isDir: info.isDirectory(),
              size: info.size,
              isImage: !info.isDirectory() && isImage(payload.path, resolved),
              isText: !info.isDirectory() && isText(payload.path, resolved)
            }
          };
        }
        case 'readText': {
          const abs = normalizeSafe(cwd, payload.path);
          if (!isText(payload.path, resolved)) {
            throw new Error('unsupported file type for text preview');
          }
          const { content, size, truncated } = await readTextFile(abs, resolved.maxReadBytes);
          return { ok: true, value: { content, size, truncated, name: path.basename(abs) } };
        }
        case 'readImage': {
          const abs = normalizeSafe(cwd, payload.path);
          if (!isImage(payload.path, resolved)) {
            throw new Error('unsupported file type for image preview');
          }
          const { dataUrl, size } = await readImageBase64(abs, resolved.maxReadBytes);
          return { ok: true, value: { dataUrl, size, name: path.basename(abs) } };
        }
        default:
          // 错误 envelope 必须符合 DSH rpcErrorSchema（code/message/details 齐全），
          // 否则客户端 serverResponseSchema 校验会直接失败，把错误变成一堆 JSON
          return { ok: false, error: { code: 'bad-request', message: `unknown endpoint: ${endpoint}`, details: { issues: [] } } };
      }
    } catch (e) {
      return { ok: false, error: { code: 'internal', message: e?.message ?? String(e), details: {} } };
    }
  }, { authority: 'loopback' });

  ctx.effect(() => removeRpc, 'kaori-preview: rpc');
}
