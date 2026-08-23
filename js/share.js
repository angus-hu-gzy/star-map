/**
 * ============================================================
 *  点亮足迹 · 分享模块（Share）
 * ============================================================
 *  功能：
 *    - 把足迹列表编码进 URL（?share=adcode,adcode,...），生成分享链接
 *    - 解析分享链接，得到只读的足迹数据
 *    - 复制足迹文字版（朋友圈文案）
 *    - 导出地图截图 PNG（分享图片卡片）
 * ============================================================
 */
(function (global) {
  'use strict';

  const NS = (window.FootprintMap = window.FootprintMap || {});

  const PARAM = 'share';

  // ---------------- 编码 / 解码 ----------------
  function encodeAdcodes(list) {
    return list
      .map((fp) => fp.adcode)
      .filter((a, i, arr) => arr.indexOf(a) === i)
      .join(',');
  }

  function decodeAdcodes(str) {
    return String(str || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d{4,6}$/.test(s));
  }

  // ---------------- 文字版 ----------------
  function buildText(list, provinceStats) {
    if (!list.length) return '我还没有点亮任何城市 🌱';
    const names = list.map((fp) => fp.name);
    const provinceSet = new Set(
      list.map((fp) => {
        const pv = provinceStats[fp.adcode.slice(0, 2) + '0000'];
        return pv ? pv.name : '';
      })
    );
    const pCount = [...provinceSet].filter(Boolean).length;
    return `我的足迹：${names.join('、')}（共 ${list.length} 城，${pCount} 省）📍`;
  }

  // ---------------- 剪贴板 ----------------
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // 降级：兼容非 HTTPS / 老浏览器
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  // ---------------- 公开接口 ----------------
  NS.Share = {
    /** 从当前 URL 解析分享数据，返回 adcode 数组（无分享参数则返回空数组） */
    parseFromUrl() {
      try {
        const params = new URLSearchParams(window.location.search);
        return decodeAdcodes(params.get(PARAM));
      } catch (e) {
        return [];
      }
    },

    /** 生成分享链接（基于当前页面 URL，替换 share 参数） */
    buildLink(footprints) {
      const adcodes = encodeAdcodes(footprints);
      const url = new URL(window.location.href);
      if (adcodes) {
        url.searchParams.set(PARAM, adcodes);
      } else {
        url.searchParams.delete(PARAM);
      }
      return url.toString();
    },

    /** 复制足迹文字版，成功返回 true */
    async copySummary(footprints, provinceStats) {
      return copyText(buildText(footprints, provinceStats));
    },

    /** 复制分享链接，成功返回 true */
    async copyLink(footprints) {
      return copyText(this.buildLink(footprints));
    },

    /** 导出地图 PNG，触发下载；无足迹时返回 false */
    downloadImage() {
      const chart = NS.MapView && NS.MapView._chart();
      if (!chart) return false;
      const url = chart.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `点亮足迹_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    },

    /** 生成文字版（供面板预览） */
    summary(footprints, provinceStats) {
      return buildText(footprints, provinceStats);
    },
  };
})(window);
