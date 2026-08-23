/**
 * ============================================================
 *  点亮足迹 · 城市搜索索引（Search）
 * ============================================================
 *  提供：城市名（汉字子串）匹配、全量城市列表
 *  注意：城市名统一去除"市/区/县/旗/盟/自治州/地区"等后缀做宽松匹配，
 *        例如搜"深圳"能命中"深圳市"，搜"大理"能命中"大理白族自治州"。
 * ============================================================
 */
(function (global) {
  'use strict';

  const NS = (window.FootprintMap = window.FootprintMap || {});

  // 后缀：匹配时移除，展示时保留
  const SUFFIXES = ['市', '区', '县', '旗', '盟', '自治州', '自治县', '自治旗', '林区', '地区', '特别行政区', '特别市', '新区', '省', '壮族', '回族', '维吾尔', '土家族', '苗族', '侗族', '布依族', '彝族', '白族', '哈萨克', '蒙古族', '朝鲜族', '傈僳族', '纳西族', '哈尼族', '傣族', '景颇族', '藏族', '畲族', '黎族', '仡佬族', '瑶族', '羌族', '满族', '土族', '裕固族', '撒拉族', '东乡族', '保安族', '毛南族', '仫佬族', '水族', '拉祜族', '佤族', '怒族', '普米族', '独龙族', '基诺族', '德昂族', '阿昌族', '京族', '塔吉克族', '柯尔克孜族', '乌孜别克族', '俄罗斯族', '锡伯族', '塔塔尔族', '鄂温克族', '鄂伦春族', '达斡尔族', '赫哲族', '高山族', '门巴族', '珞巴族'];

  let index = []; // [{adcode, name, short, provinceName, center}]

  function stripSuffix(name) {
    let s = name;
    for (const suf of SUFFIXES) {
      if (s.endsWith(suf) && s.length - suf.length >= 2) {
        s = s.slice(0, -suf.length);
        break;
      }
    }
    return s;
  }

  NS.Search = {
    /** 构建城市索引（页面加载后调用一次） */
    index() {
      index = window.CHINA_CITIES.features.map((f) => {
        const p = f.properties;
        return {
          adcode: p.adcode,
          name: p.name,
          short: stripSuffix(p.name),
          provinceName: p.provinceName,
          center: p.center,
        };
      });
      return index;
    },

    /**
     * 关键词匹配：关键词命中 短名/全名/省份 均可
     * @returns {Array} 匹配的城市（最多 limit 条）
     */
    suggest(keyword, limit = 10) {
      const kw = String(keyword || '').trim();
      if (!kw) return [];
      const hits = index.filter((c) => c.short.includes(kw) || c.name.includes(kw) || c.provinceName.includes(kw));
      // 短名精确命中排最前
      hits.sort((a, b) => {
        const sa = a.short === kw ? 0 : 1;
        const sb = b.short === kw ? 0 : 1;
        return sa - sb || a.short.length - b.short.length;
      });
      return hits.slice(0, limit);
    },

    /** 全部城市列表（按省份分组，供列表展示） */
    all() {
      return index;
    },
  };
})(window);
