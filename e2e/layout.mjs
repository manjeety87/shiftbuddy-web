// Every page and panel at every screen shape, from a small phone to an ultrawide monitor.
//   node e2e/layout.mjs            (expects the site on http://localhost:3210)
// It does not judge looks. It catches what makes a screen feel broken: a page that
// scrolls sideways, something hanging off the edge, content cut off by its own box,
// a panel taller than the window with its buttons out of reach.
// Each page is opened once and the window is then resized through every shape — the
// way a person drags a window — which also keeps the run under the sign-in rate limit.
// One @test.local account, deleted after. SHOTS=<folder> also saves a picture of each.
import { chromium } from "playwright";
import { inspect } from "./inspect.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const SHOTS = process.env.SHOTS;
const ONLY = process.env.ONLY; // e.g. ONLY=login to look at one page
const email = `web-l-${Date.now()}@test.local`;
const HOUR = 3600000;
const at = (hoursFromNow) => new Date(Date.now() + hoursFromNow * HOUR).toISOString();

const SIZES = [
  [320, 568], // the smallest phone still in use
  [360, 740],
  [375, 667],
  [390, 844],
  [430, 932],
  [667, 375], // phones on their side
  [844, 390],
  [768, 1024], // tablets, both ways
  [820, 1180],
  [1024, 768],
  [1024, 600], // a small laptop with the browser's bars open
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440], // ultrawide
];
const SIGNED_OUT = ["login", "register", "forgot-password"];
// The last one is no page at all: the "not found" screen (signed out, the route guard sends it to log in)
const SIGNED_IN = ["home", "shifts", "calendar", "jobs", "timesheet", "settings", "sharing", "no-such-page"];

let failed = 0;
const report = (where, problems) => {
  if (problems.length === 0) return;
  failed++;
  console.log(`FAIL  ${where}`);
  for (const problem of problems) console.log(`        ${problem}`);
};


const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);

const look = async (label, [width, height]) => {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(350); // the layout settles after the resize
  report(`${label} at ${width}×${height}`, await page.evaluate(inspect));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label.replace(/[^a-z0-9]+/gi, "-")}-${width}x${height}.png` });
};
const wanted = (name) => !ONLY || ONLY.split(",").includes(name);

let token;
const api = async (method, path, data) => {
  const response = await context.request[method](`${BASE}/api${path}`, { data, headers: { "X-Auth-Transport": "cookie", ...(token && { Authorization: `Bearer ${token}` }) } });
  const body = await response.json();
  if (!response.ok()) throw new Error(`${method} ${path} → ${response.status()} ${body?.message}`);
  return body.data;
};

try {
  for (const name of SIGNED_OUT.filter(wanted)) {
    await page.goto(`${BASE}/${name}`);
    await page.locator("h1").first().waitFor();
    for (const size of SIZES) await look(name, size);
  }

  // The login error is the longest thing that page ever shows
  if (wanted("login")) {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").fill("nobody-with-a-rather-long-address@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Testing123");
    await page.getByRole("button", { name: "Log In" }).click();
    await page.getByRole("link", { name: "Create an account" }).first().waitFor();
    for (const size of SIZES) await look("login with its error", size);
  }

  // Registering with the cookie transport leaves the refresh cookie in this browser: the pages open signed in
  token = (await api("post", "/auth/register", { name: "Layout Tester With A Fairly Long Name", email, password: "Testing123" })).accessToken;
  await context.addCookies([{ name: "sb_signed_in", value: "1", url: BASE }]);
  const near = await api("post", "/jobs", { title: "Sales Associate and Keyholder", companyName: "International Clothiers Yorkdale", hourlyRate: 18.5, latitude: 43.7254, longitude: -79.4522, location: "Yorkdale Shopping Centre, 3401 Dufferin St, Toronto" });
  const far = await api("post", "/jobs", { title: "Cashier", companyName: "Fairweather", latitude: 43.7765, longitude: -79.2578, location: "Scarborough Town Centre, Toronto" });
  await api("post", "/shifts", { jobId: near.id, startTime: at(-30), endTime: at(-24) });
  await api("post", "/shifts", { jobId: near.id, startTime: at(3), endTime: at(9) });
  await api("post", "/shifts", { jobId: far.id, startTime: at(8), endTime: at(12), allowOverlap: true }); // overlaps the one before
  for (const day of [1, 2, 3, 4, 5]) await api("post", "/shifts", { jobId: day % 2 ? near.id : far.id, startTime: at(day * 24 + 2), endTime: at(day * 24 + 8) });

  // Someone shares with you: Home shows two people (a test account cannot verify its email, so these replies stand in)
  const owner = { id: "owner-1", name: "Manjeet Yadav" };
  await page.route("**/api/shares/received", (route) => route.fulfill({ json: { success: true, data: [{ id: "share-1", owner, expiresAt: null }] } }));
  await page.route("**/api/shares/owner-1/shifts**", (route) =>
    route.fulfill({ json: { success: true, data: { owner, shifts: [1, 26, 50, 75].map((hours, index) => ({ id: `theirs-${index}`, startTime: at(hours), endTime: at(hours + 6), job: { title: "Sales Associate", companyName: "International Clothiers", color: "#866aa0" } })) } } }),
  );

  const open = async (path) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/${path}`);
    await page.waitForURL(`**/${path}`); // a session that did not restore lands on /login instead
    await page.locator("h1").filter({ visible: true }).first().waitFor();
    await page.waitForLoadState("networkidle").catch(() => undefined);
  };
  const view = (name) => page.getByRole("radio", { name }).filter({ visible: true }).check({ force: true, timeout: 4000 });

  for (const name of SIGNED_IN.filter(wanted)) {
    await open(name);
    for (const size of SIZES) await look(name, size);
    if (name !== "home") continue;
    await page.setViewportSize({ width: 1280, height: 900 });
    await view("Month");
    for (const size of SIZES.filter(([width]) => width >= 768)) await look("home month", size);
  }

  // Panels: the longest form (a shift being edited), a new job, the scan panel and the search
  const PANELS = [
    ["panel shift", "shifts", () => page.getByRole("button", { name: /Fairweather|International/ }).filter({ visible: true }).first().click()],
    ["panel job", "jobs", () => page.getByRole("button", { name: /Fairweather/ }).filter({ visible: true }).first().click()],
    ["panel scan", "home", () => page.getByRole("button", { name: /^Scan/ }).filter({ visible: true }).first().click()],
  ];
  for (const [label, path, press] of PANELS) {
    if (!wanted(path) && !wanted("panels")) continue;
    await open(path);
    await press();
    await page.locator("dialog[open]").waitFor();
    for (const size of SIZES) await look(label, size);
  }
} finally {
  if (token) {
    const gone = await context.request.delete(`${BASE}/api/auth/account`, { headers: { Authorization: `Bearer ${token}` } });
    console.log(`cleanup: test account deleted (${gone.status()})`);
  }
  await browser.close();
}

console.log(failed === 0 ? "\nALL PASSED" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
