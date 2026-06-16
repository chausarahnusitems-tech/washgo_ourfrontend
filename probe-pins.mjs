import puppeteer from "puppeteer-core";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--force-device-scale-factor=1.25"] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 820, deviceScaleFactor: 1.25 });
await page.goto("http://127.0.0.1:3000/explore", { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForFunction(() => window.__wgmap && document.querySelector(".wg-pin"), { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));

// pan the first pin off-center so drift would be obvious, then measure tip vs project
const probe = await page.evaluate(async () => {
  const map = window.__wgmap, cont = map.getContainer();
  const cb = () => cont.getBoundingClientRect();
  const pin = document.querySelector(".wg-pin");
  // recover lngLat from current transform translate
  const m = pin.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
  const ll = map.unproject([+m[1], +m[2]]);
  const lngLat = [ll.lng, ll.lat];
  const W = map.transform.width, H = map.transform.height;
  const cur = map.project(lngLat);
  map.panBy([cur.x - W * 0.25, cur.y - H * 0.25], { duration: 0 });
  await new Promise((r) => setTimeout(r, 350));

  function tipDelta() {
    const b = pin.getBoundingClientRect(), c = cb();
    const tip = { x: (b.left + b.right) / 2 - c.left, y: b.bottom - c.top }; // box bottom-center = pointer tip
    const p = map.project(lngLat);
    return { dx: +(tip.x - p.x).toFixed(1), dy: +(tip.y - p.y).toFixed(1), z: +map.getZoom().toFixed(2) };
  }
  const out = { hasPrice: /[0-9]/.test(pin.innerText), priceText: pin.innerText.trim(), samples: [] };
  out.samples.push({ tag: "off-center z14", ...tipDelta() });
  map.setZoom(map.getZoom() + 3); await new Promise((r) => setTimeout(r, 450));
  out.samples.push({ tag: "zoom +3", ...tipDelta() });
  map.setZoom(map.getZoom() - 6); await new Promise((r) => setTimeout(r, 450));
  out.samples.push({ tag: "zoom -6 (far out)", ...tipDelta() });
  return out;
});
console.log("pin text:", JSON.stringify(probe.priceText), " hasPrice:", probe.hasPrice);
probe.samples.forEach((s) => console.log(`  ${s.tag.padEnd(18)} z=${s.z}  tip-vs-project delta=(${s.dx}, ${s.dy})`));
const maxd = Math.max(...probe.samples.map((s) => Math.hypot(s.dx, s.dy)));
console.log("max tip delta:", maxd.toFixed(1), "px  (≈0 => pointer tip anchored, no drift)");

// reset view & screenshot a couple shops, then select one to show active state
await page.evaluate(() => { const m = window.__wgmap; m.setZoom(14.5); });
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: "pins-normal.png" });
// click the first pin to select (active)
await page.evaluate(() => document.querySelector(".wg-pin").click());
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: "pins-active.png" });
await browser.close();
