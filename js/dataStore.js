/**
 * ============================================================
 *  点亮足迹 · 数据层（DataStore）
 * ============================================================
 *  职责：足迹记录的全部读写入口。上层代码只依赖本模块的
 *        load() / save() 两个接口，不关心数据存在哪里。
 *
 *  ▸ 当前实现：localStorage（本地浏览器存储）
 *  ▸ 预留后端：未来接服务器时，只需把本文件内部实现换成
 *    fetch 调用，接口契约不变：
 *      GET {BASE_URL}/api/footprints   → 返回足迹数组
 *      PUT {BASE_URL}/api/footprints   → 全量覆盖保存
 * ============================================================
 */
(function (global) {
  'use strict';

  const NS = (window.FootprintMap = window.FootprintMap || {});

  // ---------------- 配置 ----------------
  const STORAGE_KEY = 'footprintMap.v1'; // 本地存储键名
  const BACKEND = {
    enabled: false, // 未来接后端时改为 true
    baseUrl: '',    // 未来填服务器地址，如 'https://api.example.com'
  };

  // ---------------- 内部：本地读写 ----------------
  function readLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('[DataStore] 读取本地数据失败，返回空记录', e);
      return [];
    }
  }

  function writeLocal(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      console.error('[DataStore] 写入本地数据失败', e);
      return false;
    }
  }

  // ---------------- 内部：后端读写（预留，暂不启用） ----------------
  async function readRemote() {
    const res = await fetch(`${BACKEND.baseUrl}/api/footprints`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function writeRemote(list) {
    const res = await fetch(`${BACKEND.baseUrl}/api/footprints`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  // ---------------- 数据规范化 ----------------
  // 单条记录: { adcode, name }
  function normalize(list) {
    const seen = new Set();
    const out = [];
    for (const item of Array.isArray(list) ? list : []) {
      const adcode = String(item.adcode || '');
      const name = String(item.name || '');
      if (!adcode || !name || seen.has(adcode)) continue;
      seen.add(adcode);
      out.push({ adcode, name });
    }
    return out;
  }

  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // ---------------- 公开接口 ----------------
  NS.DataStore = {
    /**
     * 加载全部足迹记录
     * @returns {Promise<Array>} [{adcode, name}]
     */
    async load() {
      let list;
      if (BACKEND.enabled) {
        list = await readRemote();
      } else {
        list = readLocal();
      }
      return normalize(list);
    },

    /**
     * 全量保存足迹记录（覆盖式）
     * @param {Array} list
     * @returns {Promise<boolean>}
     */
    async save(list) {
      const clean = normalize(list);
      if (BACKEND.enabled) {
        await writeRemote(clean);
        return true;
      }
      return writeLocal(clean);
    },

    /**
     * 点亮一个城市（幂等：已点亮则不做任何修改）
     * @returns {Promise<Array>} 更新后的完整列表
     */
    async markVisited(adcode, name) {
      const list = await this.load();
      const hit = list.find((x) => x.adcode === adcode);
      if (!hit) {
        list.push({ adcode: String(adcode), name: String(name) });
      }
      await this.save(list);
      return list;
    },

    /**
     * 取消点亮（删除该城市记录）
     * @returns {Promise<Array>} 更新后的完整列表
     */
    async removeVisit(adcode) {
      const list = await this.load();
      const next = list.filter((x) => x.adcode !== adcode);
      await this.save(next);
      return next;
    },

    /** 导出 JSON 字符串（用于备份 / 迁移） */
    async exportJSON() {
      const list = await this.load();
      return JSON.stringify(
        {
          app: 'footprint-map',
          version: 1,
          exportedAt: todayStr(),
          items: list,
        },
        null,
        2
      );
    },

    /**
     * 导入 JSON 字符串（备份恢复），成功返回 true
     * @param {string} text
     */
    async importJSON(text) {
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : data && data.items;
      if (!Array.isArray(items)) throw new Error('不是有效的足迹备份文件');
      await this.save(items);
      return true;
    },

    /** 当前日期（工具方法） */
    today() {
      return todayStr();
    },
  };
})(window);
