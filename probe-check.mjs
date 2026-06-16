import puppeteer from "puppeteer-core";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 820, deviceScaleFactor: 1 });
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
await page.goto("http://127.0.0.1:3000/explore", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));
const info = await page.evaluate(() => ({
  hasMap: !!window.__wgmap,
  wgPins: document.querySelectorAll(".wg-pin").length,
  mlMarkers: document.querySelectorAll(".maplibregl-marker").length,
  styleInjected: !!document.getElementById("wg-pin-styles"),
}));
console.log(JSON.stringify(info, null, 2));
console.log("ERRORS:", [...new Set(errs)].slice(0, 8));
await browser.close();
