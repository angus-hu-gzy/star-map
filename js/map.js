/**
 * ============================================================
 *  点亮足迹 · 地图核心（MapView）
 * ============================================================
 *  负责：ECharts 地图注册、点亮渲染、点击/悬浮交互、定位缩放
 *
 *  数据约定：
 *    - footprint: { adcode, name }
 *    - 已点亮城市 value = 2（橙红高亮）
 *    - 未点亮城市 value = 0（灰色）
 * ============================================================
 */
(function (global) {
  'use strict';

  const NS = (window.FootprintMap = window.FootprintMap || {});

  let chart = null;
  let cityIndex = {};        // adcode -> {name, center, provinceName, provinceAdcode}
  let provinceStats = {};    // provinceAdcode -> { name, total, lit }
  let footprintMap = new Map(); // adcode -> footprint

  const MAP_NAME = 'china_cities';
  // 星空主题：已点亮 = 夜空里的金星（带发光），未点亮 = 深蓝大陆剪影
  const COLORS = {
    lit: '#ffc94d',          // 已点亮：金星
    litBorder: '#fff3d6',
    none: '#1c2547',         // 未点亮：深空蓝灰（大陆剪影）
    border: '#3d4d7d',       // 边界：暗星光蓝
    labelNormal: '#8ea1c9',
    labelLit: '#fff8e6',
  };

  // ---------------- 内部 ----------------
  function buildIndex() {
    cityIndex = {};
    provinceStats = {};
    for (const f of window.CHINA_CITIES.features) {
      const p = f.properties;
      cityIndex[p.adcode] = p;
      if (!provinceStats[p.provinceAdcode]) {
        provinceStats[p.provinceAdcode] = { name: p.provinceName };
      }
    }
  }

  function buildSeriesData() {
    const data = [];
    for (const f of window.CHINA_CITIES.features) {
      const p = f.properties;
      const fp = footprintMap.get(p.adcode);

      const item = {
        name: p.name,
        adcode: p.adcode,
        value: fp ? 2 : 0,
      };
      if (fp) {
        item.itemStyle = {
          areaColor: COLORS.lit,
          borderColor: COLORS.litBorder,
          borderWidth: 1.2,
          shadowBlur: 18,
          shadowColor: 'rgba(255, 201, 77, 0.55)',
        };
        item.label = {
          show: true,
          color: COLORS.labelLit,
          fontSize: 10,
          fontWeight: 'bold',
          textShadowBlur: 4,
          textShadowColor: 'rgba(0, 0, 0, 0.6)',
        };
      }
      data.push(item);
    }
    return data;
  }

  function buildOption() {
    return {
      tooltip: {
        trigger: 'item',
        confine: true,
        hideDelay: 150,
        backgroundColor: 'rgba(13, 19, 44, 0.94)',
        borderColor: 'rgba(255, 255, 255, 0.14)',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: '#e8edf7', fontSize: 13 },
        extraCssText: 'box-shadow: 0 10px 28px rgba(0,0,0,0.55); border-radius: 10px; backdrop-filter: blur(8px);',
        formatter(params) {
          const fp = footprintMap.get(params.data && params.data.adcode);
          const pv = provinceStats[params.data && params.data.adcode && params.data.adcode.slice(0, 2) + '0000'];
          const lines = [`<b>${params.name}</b>`];
          if (pv) lines.push(`<span style="color:#6d7fa6">${pv.name}</span>`);
          if (fp) {
            lines.push(
              `<div style="margin-top:6px;color:#ffc94d;font-weight:600;text-shadow:0 0 8px rgba(255,201,77,0.6)">★ 已点亮</div>`,
              `<div style="color:#6d7fa6;font-size:12px">点击可取消点亮</div>`
            );
          } else {
            lines.push(`<div style="margin-top:6px;color:#6d7fa6">未点亮 · 点击点亮一颗星</div>`);
          }
          return lines.join('<br/>');
        },
      },
      visualMap: {
        type: 'piecewise',
        min: 0,
        max: 2,
        left: 18,
        bottom: 18,
        orient: 'vertical',
        itemWidth: 16,
        itemHeight: 10,
        textStyle: { color: '#a3b1d6', fontSize: 12 },
        pieces: [
          { min: 2, max: 2, label: '已点亮', color: COLORS.lit },
          { min: 0, max: 0, label: '未点亮', color: COLORS.none },
        ],
      },
      series: [
        {
          name: '足迹',
          type: 'map',
          map: MAP_NAME,
          roam: true,
          scaleLimit: { min: 1, max: 12 },
          center: [104.2, 35.6],
          zoom: 1.05,
          label: {
            show: true,        // 始终显示城市名，便于辨认与记录足迹
            color: COLORS.labelNormal,
            fontSize: 9,
            fontFamily: '"Microsoft YaHei", sans-serif',
          },
          labelLayout: { hideOverlap: true },
          itemStyle: {
            areaColor: COLORS.none,
            borderColor: COLORS.border,
            borderWidth: 0.8,
          },
          emphasis: {
            label: { show: true, color: '#fff8e6', fontSize: 13, fontWeight: 'bold' },
            itemStyle: {
              areaColor: '#ffe08a',
              borderColor: '#ffffff',
              borderWidth: 1.6,
              shadowBlur: 26,
              shadowColor: 'rgba(255, 224, 138, 0.8)',
            },
          },
          select: {
            disabled: true,
          },
          data: buildSeriesData(),
        },
      ],
    };
  }

  // ---------------- 公开接口 ----------------
  NS.MapView = {
    /** 初始化地图（页面加载后调用一次） */
    init(container) {
      buildIndex();
      echarts.registerMap(MAP_NAME, window.CHINA_CITIES);
      // 限制渲染分辨率：高清屏 3x 缩到 2x，大幅降低 canvas 重绘成本
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      chart = echarts.init(container, null, { renderer: 'canvas', devicePixelRatio: dpr });
      chart.setOption(buildOption());

      chart.on('click', (params) => {
        if (!params.data || !params.data.adcode) return;
        const p = cityIndex[params.data.adcode];
        if (!p) return;
        NS.onCityClick && NS.onCityClick({ adcode: p.adcode, name: p.name, center: p.center });
      });

      // 窗口大小 / 方向变化时强制 ECharts 重算（移动端横竖屏切换等场景）
      const handleResize = () => chart && chart.resize();
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));
      return this;
    },

    /**
     * 用最新足迹数据刷新地图
     * 只更新 series.data（最小更新），保留用户当前的缩放/平移视图，不会收缩回初始视角
     */
    render(footprints) {
      footprintMap = new Map(footprints.map((fp) => [fp.adcode, fp]));
      chart.setOption({ series: [{ data: buildSeriesData() }] });
      return this;
    },

    /** 定位并放大到某城市 */
    zoomTo(adcode, zoom = 6.5) {
      const p = cityIndex[adcode];
      if (!p) return;
      chart.setOption({
        series: [{ id: undefined, center: p.center, zoom }],
      });
      return this;
    },

    /** 查询某城市信息 */
    city(adcode) {
      return cityIndex[adcode] || null;
    },

    /** 省份统计（供统计面板使用） */
    provinceStats() {
      return provinceStats;
    },

    /** 暴露 ECharts 实例（供分享图片导出等使用） */
    _chart() {
      return chart;
    },
  };
})(window);
