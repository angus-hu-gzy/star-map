/**
 * ============================================================
 *  点亮足迹 · 主逻辑（main.js）
 * ============================================================
 *  职责：装配数据层 + 地图 + 搜索 + UI 面板，串起全部交互
 * ============================================================
 */
(function () {
  'use strict';

  const NS = (window.FootprintMap = window.FootprintMap || {});

  // ---------------- DOM ----------------
  const $ = (id) => document.getElementById(id);
  const el = {
    map: $('map'),
    searchInput: $('searchInput'),
    suggestList: $('suggestList'),
    statCities: $('statCities'),
    statProvinces: $('statProvinces'),
    cityList: $('cityList'),
    listCount: $('listCount'),
    detailPanel: $('detailPanel'),
    dName: $('dName'),
    dProvince: $('dProvince'),
    toast: $('toast'),
    shareBtn: $('shareBtn'),
    sharePanel: $('sharePanel'),
    shareMask: $('shareMask'),
    shareClose: $('shareClose'),
    shareText: $('shareText'),
    shareLink: $('shareLink'),
    shareCopyLink: $('shareCopyLink'),
    shareCopyText: $('shareCopyText'),
    shareImage: $('shareImage'),
    shareBanner: $('shareBanner'),
    shareBannerClose: $('shareBannerClose'),
    dRemove: $('dRemove'),
  };

  // ---------------- 工具 ----------------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
  }

  // ---------------- 状态 ----------------
  let footprints = [];       // 最新足迹列表
  let currentDetail = null;  // 详情面板当前城市 {adcode,name,center}
  let isShareMode = false;   // 通过 ?share= 链接进入的只读分享视图

  // ---------------- 数据刷新 ----------------
  async function refreshAll(next) {
    footprints = next || (await NS.DataStore.load());
    NS.MapView.render(footprints);
    renderStats();
    renderList();
  }

  function renderStats() {
    const provinceSet = new Set();
    for (const fp of footprints) {
      provinceSet.add(fp.adcode.slice(0, 2) + '0000');
    }
    el.statCities.textContent = footprints.length;
    el.statProvinces.textContent = provinceSet.size;
  }

  function renderList() {
    el.listCount.textContent = footprints.length ? `（${footprints.length}）` : '';
    if (!footprints.length) {
      el.cityList.innerHTML = '<div class="empty">还没有足迹<br/>点击地图上的城市，点亮第一站 ✨</div>';
      return;
    }
    el.cityList.innerHTML = footprints
      .map((fp) => {
        const city = NS.MapView.city(fp.adcode);
        const prov = city ? city.provinceName : '';
        return `
      <div class="city-item" data-adcode="${esc(fp.adcode)}">
        <div class="city-name">${esc(fp.name)}</div>
        <div class="city-meta">${esc(prov)}</div>
      </div>`;
      })
      .join('');
  }

  // ---------------- 地图点击 / 城市选中 ----------------
  async function onCityPick(city) {
    if (isShareMode) {
      toast('这是分享的地图（只读），不能修改');
      return;
    }
    const hit = footprints.find((fp) => fp.adcode === city.adcode);
    if (hit) {
      openDetail(hit);
    } else {
      await NS.DataStore.markVisited(city.adcode, city.name);
      await refreshAll();
      toast(`🎉 已点亮 ${city.name}`);
    }
  }

  // ---------------- 详情面板 ----------------
  function openDetail(fp) {
    currentDetail = fp;
    el.dName.textContent = fp.name;
    const pv = NS.MapView.provinceStats()[fp.adcode.slice(0, 2) + '0000'];
    el.dProvince.textContent = pv ? pv.name : '';
    el.dRemove.style.display = isShareMode ? 'none' : '';
    el.detailPanel.classList.add('show');
  }

  function closeDetail() {
    el.detailPanel.classList.remove('show');
    currentDetail = null;
  }

  // ---------------- 搜索 ----------------
  let suggestTimer = null;
  function onSearchInput() {
    clearTimeout(suggestTimer);
    const kw = el.searchInput.value.trim();
    if (!kw) {
      el.suggestList.classList.remove('show');
      return;
    }
    suggestTimer = setTimeout(() => {
      const hits = NS.Search.suggest(kw);
      if (!hits.length) {
        el.suggestList.innerHTML = '<div class="suggest-empty">未找到匹配城市</div>';
      } else {
        el.suggestList.innerHTML = hits
          .map(
            (c) => `
        <div class="suggest-item" data-adcode="${esc(c.adcode)}">
          <span class="s-name">${esc(c.name)}</span>
          <span class="s-prov">${esc(c.provinceName)}</span>
        </div>`
          )
          .join('');
      }
      el.suggestList.classList.add('show');
    }, 120);
  }

  async function onSuggestPick(adcode) {
    el.suggestList.classList.remove('show');
    el.searchInput.value = '';
    const city = NS.MapView.city(adcode);
    if (!city) return;
    NS.MapView.zoomTo(adcode);
    await onCityPick({ adcode, name: city.name, center: city.center });
  }

  // ---------------- 导出 / 导入 ----------------
  async function exportBackup() {
    const json = await NS.DataStore.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `足迹备份_${NS.DataStore.today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('已导出备份文件');
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await NS.DataStore.importJSON(String(reader.result));
        await refreshAll();
        toast('✅ 备份导入成功');
      } catch (e) {
        toast('❌ 导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
  }

  // ---------------- 分享 ----------------
  function openSharePanel() {
    el.shareText.textContent = NS.Share.summary(footprints, NS.MapView.provinceStats());
    el.shareLink.value = NS.Share.buildLink(footprints);
    el.sharePanel.classList.add('show');
  }

  function closeSharePanel() {
    el.sharePanel.classList.remove('show');
  }

  // ---------------- 事件绑定 ----------------
  function bindEvents() {
    // 地图点击：已点亮 → 详情；未点亮 → 直接点亮
    NS.onCityClick = (city) => onCityPick(city);

    // 搜索
    el.searchInput.addEventListener('input', onSearchInput);
    el.searchInput.addEventListener('blur', () => setTimeout(() => el.suggestList.classList.remove('show'), 150));
    el.suggestList.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.suggest-item');
      if (item) onSuggestPick(item.dataset.adcode);
    });

    // 城市列表（事件委托）
    el.cityList.addEventListener('click', (e) => {
      const item = e.target.closest('.city-item');
      if (!item) return;
      const fp = footprints.find((x) => x.adcode === item.dataset.adcode);
      if (fp) {
        NS.MapView.zoomTo(fp.adcode);
        openDetail(fp);
      }
    });

    // 详情面板
    $('detailClose').addEventListener('click', closeDetail);
    $('dLocate').addEventListener('click', () => {
      if (currentDetail) NS.MapView.zoomTo(currentDetail.adcode);
    });
    $('dRemove').addEventListener('click', async () => {
      if (!currentDetail) return;
      const name = currentDetail.name;
      await NS.DataStore.removeVisit(currentDetail.adcode);
      await refreshAll();
      closeDetail();
      toast(`${name} 已取消点亮`);
    });

    // 导出 / 导入
    $('exportBtn').addEventListener('click', exportBackup);
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', (e) => {
      if (e.target.files.length) importBackup(e.target.files[0]);
      e.target.value = '';
    });

    // 分享
    el.shareBtn.addEventListener('click', openSharePanel);
    el.shareClose.addEventListener('click', closeSharePanel);
    el.shareMask.addEventListener('click', closeSharePanel);
    el.shareCopyLink.addEventListener('click', async () => {
      const ok = await NS.Share.copyLink(footprints);
      toast(ok ? '✅ 链接已复制，发给朋友吧' : '复制失败，请手动选择链接');
    });
    el.shareCopyText.addEventListener('click', async () => {
      const ok = await NS.Share.copySummary(footprints, NS.MapView.provinceStats());
      toast(ok ? '✅ 文字版已复制' : '复制失败，请手动复制预览文字');
    });
    el.shareImage.addEventListener('click', () => {
      const ok = NS.Share.downloadImage();
      toast(ok ? '🖼️ 图片已开始下载' : '暂无地图可导出');
    });
    el.shareBannerClose.addEventListener('click', () => el.shareBanner.classList.add('hidden'));
  }

  // ---------------- 启动 ----------------
  async function init() {
    try {
      NS.Search.index();
      NS.MapView.init(el.map);
      bindEvents();

      // 检测分享链接（?share=adcode,adcode,...）
      const shared = NS.Share.parseFromUrl();
      if (shared.length) {
        isShareMode = true;
        el.shareBanner.classList.remove('hidden');
        $('exportBtn').style.display = 'none';
        $('importBtn').style.display = 'none';
        const list = shared
          .map((adcode) => {
            const c = NS.MapView.city(adcode);
            return c ? { adcode, name: c.name } : null;
          })
          .filter(Boolean);
        await refreshAll(list);
      } else {
        await refreshAll();
      }
    } catch (e) {
      console.error('[点亮足迹] 初始化失败', e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
