/**
 * 几何简化脚本：用 Douglas-Peucker 算法压缩 china_cities.js 的多边形顶点，
 * 大幅降低地图渲染/重绘开销（鼠标移动卡顿的根因之一）。
 * 视觉几乎无损：地级市边界本来就该平滑，简化后经纬度误差 < 0.01 度（约 1km）。
 *
 * 用法：node tools/simplify_geo.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'china_cities.js');
const TOLERANCE = 0.025; // 度；约 2.7km（纬度方向）。越小越精细

// ---------- Douglas-Peucker ----------
function sqDist(p1, p2) {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return dx * dx + dy * dy;
}

function sqSegDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return sqDist(p, a);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  if (t < 0) return sqDist(p, a);
  if (t > 1) return sqDist(p, b);
  const px = a[0] + t * dx - p[0];
  const py = a[1] + t * dy - p[1];
  return px * px + py * py;
}

function simplifyDp(points, sqTol) {
  if (points.length <= 3) return points;
  let maxSq = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = sqSegDist(points[i], first, last);
    if (d > maxSq) {
      maxSq = d;
      index = i;
    }
  }
  if (maxSq > sqTol) {
    const left = simplifyDp(points.slice(0, index + 1), sqTol);
    const right = simplifyDp(points.slice(index), sqTol);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

// ring 是闭合环（首尾相同）。DP 简化后保证闭合。
function simplifyRing(ring, tol) {
  if (ring.length < 20) return ring; // 小区域（如澳门、小岛）不简化，保护形状
  const sqTol = tol * tol;
  const inner = simplifyDp(ring, sqTol);
  // 重新闭合
  if (inner.length < 2) return ring;
  const out = inner.slice();
  if (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1]) {
    out.push(out[0]);
  }
  return out;
}

function simplifyGeometry(geom, tol) {
  if (!geom) return geom;
  if (geom.type === 'Polygon') {
    geom.coordinates = geom.coordinates.map((ring) => simplifyRing(ring, tol));
  } else if (geom.type === 'MultiPolygon') {
    geom.coordinates = geom.coordinates.map((poly) =>
      poly.map((ring) => simplifyRing(ring, tol))
    );
  }
  return geom;
}

// ---------- 主流程 ----------
function countPoints(features) {
  let n = 0;
  for (const f of features) {
    const g = f.geometry;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates) n += ring.length;
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) for (const ring of poly) n += ring.length;
    }
  }
  return n;
}

function loadGeoJSON() {
  const src = fs.readFileSync(SRC, 'utf8');
  const match = src.match(/window\.CHINA_CITIES = ([\s\S]*?);\s*$/);
  if (!match) throw new Error('无法解析 china_cities.js');
  return JSON.parse(match[1]);
}

function main() {
  const fc = loadGeoJSON();
  const before = countPoints(fc.features);
  for (const f of fc.features) simplifyGeometry(f.geometry, TOLERANCE);
  const after = countPoints(fc.features);
  const ratio = ((1 - after / before) * 100).toFixed(1);
  const js = `/* 中国地级市粒度地图数据（已几何简化 tolerance=${TOLERANCE}，原始顶点 ${before.toLocaleString()} → ${after.toLocaleString()}） */\nwindow.CHINA_CITIES = ${JSON.stringify(fc)};\n`;
  fs.writeFileSync(SRC, js);
  console.log(`简化完成：${before.toLocaleString()} 顶点 → ${after.toLocaleString()}（减少 ${ratio}%）`);
  console.log(`文件大小：${(fs.statSync(SRC).size / 1024).toFixed(0)} KB`);
}

main();
