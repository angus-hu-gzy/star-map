/**
 * 构建脚本：组装全国地级市粒度 GeoJSON → 输出 data/china_cities.js
 * 数据源：DataV.GeoAtlas (https://geo.datav.aliyun.com/areas_v3/bound/)
 *
 * 规则：
 *  - 直辖市/港澳/台湾：作为单一点亮单元，直接取省级边界
 *  - 其他省/自治区：取 {省adcode}_full.json 的地级市（含省直辖县级单位）
 *  - 每个 feature 补充 provinceAdcode / provinceName 用于省级统计
 *
 * 用法：node tools/build_cities.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'data', '_province_raw');
const CHINA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'china_full.json'), 'utf8'));

// 省级索引：adcode -> {name, geometry, center}
const provinceMap = {};
for (const f of CHINA.features) {
  const p = f.properties;
  if (!/^\d+$/.test(String(p.adcode))) continue; // 跳过南海诸岛等
  provinceMap[String(p.adcode)] = {
    name: p.name,
    geometry: f.geometry,
    center: p.center,
    level: p.level,
  };
}

// 若 data/_province_raw 缺失则自动下载（首次构建后建议删除 raw 以省空间）
async function ensureRaw(provAdcode) {
  const rawPath = path.join(RAW_DIR, `${provAdcode}.json`);
  if (fs.existsSync(rawPath)) return rawPath;
  const url = `https://geo.datav.aliyun.com/areas_v3/bound/${provAdcode}_full.json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(rawPath, JSON.stringify(await res.json()));
  console.log(`  ↻ 已下载 ${provAdcode}_full.json`);
  return rawPath;
}

// 直辖市 + 港澳台：整体作为一个点亮单元
const SINGLE_UNIT_PROVINCES = ['110000', '120000', '310000', '500000', '710000', '810000', '820000'];

// 省直辖县级单位的前缀（海南/河南/湖北/新疆等），保留为独立点亮单元
function provinceAdcodeOf(cityAdcode) {
  return String(cityAdcode).slice(0, 2) + '0000';
}

function computeBoundsCenter(geometry) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  (function walk(coords) {
    if (typeof coords[0] === 'number') {
      if (coords[0] < minX) minX = coords[0];
      if (coords[0] > maxX) maxX = coords[0];
      if (coords[1] < minY) minY = coords[1];
      if (coords[1] > maxY) maxY = coords[1];
    } else {
      coords.forEach(walk);
    }
  })(geometry.coordinates);
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

const outFeatures = [];
const seenAdcodes = new Set();

// 1) 单一点亮单元（直辖市/港澳/台湾）
for (const adcode of SINGLE_UNIT_PROVINCES) {
  const prov = provinceMap[adcode];
  if (!prov) { console.warn('缺少省级数据:', adcode); continue; }
  outFeatures.push({
    type: 'Feature',
    properties: {
      adcode,
      name: prov.name,
      level: 'province-unit',
      center: prov.center || computeBoundsCenter(prov.geometry),
      provinceAdcode: adcode,
      provinceName: prov.name,
    },
    geometry: prov.geometry,
  });
  seenAdcodes.add(adcode);
}

// 2) 普通省/自治区：地级市 + 省直辖县级单位
const RAW_PROVINCES = Object.keys(provinceMap).filter(
  (a) => !SINGLE_UNIT_PROVINCES.includes(a) && a !== '100000'
);

let total = 0;
for (const provAdcode of RAW_PROVINCES) {
  const rawPath = await ensureRaw(provAdcode);
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const provName = provinceMap[provAdcode].name;

  for (const f of raw.features) {
    const p = f.properties;
    const adcode = String(p.adcode);
    if (seenAdcodes.has(adcode)) continue;
    seenAdcodes.add(adcode);
    total++;

    // 海南省直辖县级单位（469xxx）保留为点亮单元；其余非 city 层级的也保留（省直辖县）
    outFeatures.push({
      type: 'Feature',
      properties: {
        adcode,
        name: p.name,
        level: p.level || 'city',
        center: p.center || computeBoundsCenter(f.geometry),
        provinceAdcode: provinceAdcodeOf(adcode),
        provinceName: provName,
      },
      geometry: f.geometry,
    });
  }
}

// 校验：provinceAdcode 必须在省级表里（台湾数据有区县，provinceAdcode=710000 已存在）
for (const f of outFeatures) {
  if (!provinceMap[f.properties.provinceAdcode]) {
    console.warn('未知省级归属:', f.properties.name, f.properties.provinceAdcode);
  }
}

const fc = { type: 'FeatureCollection', features: outFeatures };
const js = `/* 中国地级市粒度地图数据（DataV.GeoAtlas 生成） */\nwindow.CHINA_CITIES = ${JSON.stringify(fc)};\n`;
fs.writeFileSync(path.join(ROOT, 'data', 'china_cities.js'), js);

// 统计报告
const byProv = {};
outFeatures.forEach((f) => {
  const k = f.properties.provinceName;
  byProv[k] = (byProv[k] || 0) + 1;
});
console.log(`共 ${outFeatures.length} 个点亮单元（地级市 + 省直辖单位 + 直辖市港澳台）`);
console.log('各省单元数:', JSON.stringify(byProv, null, 0));
console.log('输出大小:', (js.length / 1024).toFixed(0) + ' KB');
