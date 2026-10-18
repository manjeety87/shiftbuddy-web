// Every screen and every panel the way a phone gets them: a touch screen (no hover, a
// coarse pointer), from the smallest phone in use to a big one and one on its side.
//   node e2e/phone.mjs              (expects the site on http://localhost:3210)
// For each it checks the layout (inspect.mjs) and that everything pressable is big
// enough for a thumb (WCAG 2.2: 24×24 px at least). SHOTS=<folder> saves a picture of
// each at 375 px (pages whole, top to bottom). One @test.local account, deleted after.
import { chromium, devices } from "playwright";
import { inspect } from "./inspect.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const SHOTS = process.env.SHOTS;
const email = `web-p-${Date.now()}@test.local`;
const HOUR = 3600000;
const at = (hoursFromNow) => new Date(Date.now() + hoursFromNow * HOUR).toISOString();

const PHONES = [
  [320, 568], // the smallest phone still in use
  [375, 667],
  [430, 932],
  [667, 375], // on its side
];
const PICTURE_WIDTH = 375;

let failed = 0;
const report = (where, problems) => {
  if (problems.length === 0) return;
  failed++;
  console.log(`FAIL  ${where}`);
  for (const problem of problems) console.log(`        ${problem}`);
};

/** Runs in the page: pressable things a thumb can't reliably hit. Links inside a sentence are exempt (WCAG 2.5.8). */
const smallTargets = () => {
  const scope = document.querySelector("dialog[open]:last-of-type") ?? document.querySelector("[popover]:popover-open") ?? document.body;
  const found = [];
  for (const el of scope.querySelectorAll("button, a[href], [role=button], [role=radio], [role=switch], select, input:not([type=hidden])")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || el.closest(".sr-only, [aria-hidden=true], .leaflet-container")) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    if (el.matches("input[type=radio].sr-only, .sr-only")) continue;
    const inSentence = el.matches("p a, p button") || (el.tagName === "A" && style.display === "inline");
    if (!inSentence && (box.width < 24 || box.height < 24)) found.push(`too small to tap (${Math.round(box.width)}×${Math.round(box.height)}): <${el.tagName.toLowerCase()}> "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"`);
  }
  return [...new Set(found)].slice(0, 6);
};

const browser = await chromium.launch();
// A real phone: touch, no hover, the mobile viewport rules
const context = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 375, height: 667 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const problems = [];
page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));

const settle = () => page.waitForTimeout(450);
const sheet = () => page.locator("dialog[open]").last();
const tappable = (locator) => locator.filter({ visible: true }).first();

/** Looks at what is on screen now at every phone size; a picture at 375. */
const look = async (label, { whole = false } = {}) => {
  for (const [width, height] of PHONES) {
    await page.setViewportSize({ width, height });
    await settle();
    report(`${label} at ${width}×${height}`, [...(await page.evaluate(inspect)), ...(await page.evaluate(smallTargets))]);
    if (SHOTS && width === PICTURE_WIDTH) await page.screenshot({ path: `${SHOTS}/p-${label.replace(/[^a-z0-9]+/gi, "-")}.png`, fullPage: whole });
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await settle();
};

const step = async (name, work) => {
  try {
    await work();
  } catch (error) {
    failed++;
    console.log(`FAIL  ${name}  → ${String(error.message).split("\n").slice(0, 2).join(" ")}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/p-failed-${failed}.png` }).catch(() => undefined);
  }
  // Leave the next step a page with nothing open
  for (let i = 0; i < 4 && (await page.locator("dialog[open]").count()); i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const discard = page.getByRole("button", { name: "Discard" });
    if (await discard.count()) await discard.click();
    await page.waitForTimeout(300);
  }
};

const open = async (path) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${BASE}/${path}`);
  await page.waitForURL(`**/${path}`);
  await page.locator("h1").filter({ visible: true }).first().waitFor();
  await page.waitForLoadState("networkidle").catch(() => undefined);
};
const panel = async (label, press) => {
  await press();
  await sheet().waitFor();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await look(`panel ${label}`);
};

let token;
const api = async (method, path, data) => {
  const response = await context.request[method](`${BASE}/api${path}`, { data, headers: { "X-Auth-Transport": "cookie", ...(token && { Authorization: `Bearer ${token}` }) } });
  const body = await response.json();
  if (!response.ok()) throw new Error(`${method} ${path} → ${response.status()} ${body?.message}`);
  return body.data;
};

try {
  for (const path of ["login", "register", "forgot-password"]) {
    await step(path, async () => {
      await page.goto(`${BASE}/${path}`);
      await page.locator("h1").first().waitFor();
      await look(path, { whole: true });
    });
  }

  // A week with something in every part of the app: on the clock now, a clash, hours worked, someone sharing
  token = (await api("post", "/auth/register", { name: "Phone Tester With A Fairly Long Name", email, password: "Testing123" })).accessToken;
  await context.addCookies([{ name: "sb_signed_in", value: "1", url: BASE }]);

  // A brand-new account: the welcome slides once, then Home's "Getting started" card
  await step("welcome", async () => {
    await page.goto(`${BASE}/home`);
    await sheet().waitFor();
    await look("panel welcome");
    await page.keyboard.press("Escape");
    await page.getByRole("heading", { name: "Getting started" }).waitFor();
    await look("home getting started", { whole: true });
  });
  await api("put", "/auth/home", { address: "100 Queen St W, Toronto, ON M5H 2N2", latitude: 43.6532, longitude: -79.3832 });
  const near = await api("post", "/jobs", { title: "Sales Associate and Keyholder", companyName: "International Clothiers Yorkdale", hourlyRate: 18.5, latitude: 43.7254, longitude: -79.4522, location: "Yorkdale Shopping Centre, 3401 Dufferin St, Toronto", payFrequency: "BIWEEKLY", payday: at(24 * 6).slice(0, 10) });
  const far = await api("post", "/jobs", { title: "Cashier", companyName: "Fairweather", latitude: 43.7765, longitude: -79.2578, location: "Scarborough Town Centre, Toronto" });
  const past = await api("post", "/shifts", { jobId: near.id, startTime: at(-30), endTime: at(-24) });
  await api("post", "/timesheet", { shiftId: past.id, jobId: near.id, clockIn: at(-30), clockOut: at(-24), breakMinutes: 30 });
  const now = await api("post", "/shifts", { jobId: far.id, startTime: at(-1), endTime: at(4), notes: "Closing — count the float and lock the back door" });
  await api("post", "/timesheet/clock-in", { shiftId: now.id });
  await api("post", "/shifts", { jobId: near.id, startTime: at(26), endTime: at(32) });
  await api("post", "/shifts", { jobId: far.id, startTime: at(30), endTime: at(34), allowOverlap: true }); // clashes with the one before
  for (const day of [3, 4, 5]) await api("post", "/shifts", { jobId: day % 2 ? near.id : far.id, startTime: at(day * 24 + 2), endTime: at(day * 24 + 8) });

  // Someone shares with you (a test account cannot verify its email, so these replies stand in)
  const owner = { id: "owner-1", name: "Manjeet Yadav" };
  await page.route("**/api/shares/received", (route) => route.fulfill({ json: { success: true, data: [{ id: "share-1", owner, expiresAt: null }] } }));
  await page.route("**/api/shares/owner-1/shifts**", (route) =>
    route.fulfill({ json: { success: true, data: { owner, shifts: [2, 27, 50, 75].map((hours, index) => ({ id: `theirs-${index}`, startTime: at(hours), endTime: at(hours + 6), job: { title: "Server", companyName: "Boathouse", color: "#5c8a5c" } })) } } }),
  );

  // Pages, top to bottom
  for (const path of ["home", "shifts", "calendar", "jobs", "timesheet", "sharing", "settings"]) await step(path, async () => {
    await open(path);
    await look(path, { whole: true });
  });
  await step("shifts past", async () => {
    await open("shifts");
    await page.getByRole("radio", { name: "Past" }).check({ force: true });
    await page.waitForLoadState("networkidle");
    await look("shifts past", { whole: true });
  });
  await step("timesheet one job", async () => {
    await open("timesheet");
    await page.getByRole("combobox", { name: "Show" }).selectOption({ index: 1 });
    await page.waitForLoadState("networkidle");
    await look("timesheet one job", { whole: true });
  });
  // Picking several, as on the phone app: Select (or press and hold), then the header acts on them
  await step("shifts select", async () => {
    await open("shifts");
    await tappable(page.getByRole("button", { name: "Select", exact: true })).click();
    await tappable(page.getByRole("checkbox").filter({ hasText: "Fairweather" })).click();
    await page.getByRole("toolbar", { name: "Selected" }).waitFor();
    await look("shifts selecting", { whole: true });
    await panel("copy several", () => tappable(page.getByRole("button", { name: "Copy selected shifts" })).click());
  });
  await step("jobs select", async () => {
    await open("jobs");
    await tappable(page.getByRole("button", { name: "Select", exact: true })).click();
    await tappable(page.getByRole("button", { name: "Select all" })).click();
    await look("jobs selecting");
  });
  await step("calendar week", async () => {
    await open("calendar");
    await page.getByRole("radio", { name: "Week" }).first().check({ force: true });
    await look("calendar week", { whole: true });
  });
  await step("panel pay summary", async () => {
    await open("shifts");
    await panel("pay summary", () => tappable(page.getByRole("button", { name: "Pay summary" })).click());
  });
  await step("calendar another day", async () => {
    await open("calendar");
    await tappable(page.getByRole("button", { name: /, 1 shift$/ })).click();
    await look("calendar day picked", { whole: true });
  });

  // Every panel
  await step("panel new shift", async () => {
    await open("home");
    await panel("new shift", () => tappable(page.getByRole("button", { name: "Add a shift" })).click());
    // A picker closes when the window gets narrower or wider, so each size opens it afresh
    for (const [index, name] of [[0, "date"], [1, "time"]]) {
      for (const [width, height] of PHONES) {
        await page.setViewportSize({ width, height });
        await settle();
        await sheet().locator("[aria-haspopup=dialog]").nth(index).click();
        const picker = page.locator("[popover]:popover-open");
        await picker.waitFor();
        await settle();
        report(`popover ${name} at ${width}×${height}`, [...(await page.evaluate(inspect)), ...(await page.evaluate(smallTargets))]);
        if (SHOTS && width === PICTURE_WIDTH) await page.screenshot({ path: `${SHOTS}/p-popover-${name}.png` });
        await picker.evaluate((element) => element.hidePopover());
      }
    }
  });
  await step("panel edit shift", async () => {
    await open("shifts");
    await panel("edit shift", () => tappable(page.getByRole("button", { name: /Fairweather/ })).click());
    await panel("route", () => sheet().getByRole("button", { name: "Route" }).click());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await panel("weather", () => sheet().getByRole("button", { name: "Weather" }).click());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await panel("copy", () => sheet().getByRole("button", { name: "Copy" }).click());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    // Unsaved work asks before it goes
    await sheet().getByLabel("Notes").fill("changed");
    await page.keyboard.press("Escape");
    await page.getByRole("alertdialog").waitFor();
    await look("question over a panel");
  });
  await step("panel conflict", async () => {
    await open("home");
    await panel("conflict", () => tappable(page.getByRole("button", { name: /overlap/ })).click());
  });
  await step("panel shared schedule", async () => {
    await open("sharing");
    await panel("shared schedule", () => tappable(page.getByRole("button", { name: /Manjeet Yadav/ })).click());
  });
  await step("panel jobs", async () => {
    await open("jobs");
    await panel("edit job", () => tappable(page.getByRole("button", { name: /International Clothiers/ })).click());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await panel("new job", () => tappable(page.getByRole("button", { name: /Add a job|Add Job/ })).click());
  });
  await step("panel hours", async () => {
    await open("timesheet");
    await panel("edit hours", () => tappable(page.getByRole("list").getByRole("button")).click());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await panel("new hours", () => tappable(page.getByRole("button", { name: "Add hours" })).click());
  });
  await step("panel scan", async () => {
    await open("shifts");
    await panel("scan", () => tappable(page.getByRole("button", { name: "Scan a schedule" })).click());
  });
  await step("panels from settings", async () => {
    await open("settings");
    // A phone's Settings is a menu, like the phone app: each row opens one section
    await tappable(page.getByRole("link", { name: "Home & Commute" })).click();
    await page.waitForURL("**/settings#commute");
    await look("settings section", { whole: true });
    await panel("home address", () => tappable(page.getByRole("button", { name: "Change", exact: true })).click());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await tappable(page.getByRole("button", { name: /^Settings/ })).click();
    await page.waitForURL(/\/settings$/);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await panel("password", () => tappable(page.getByRole("button", { name: "Change Password" })).click());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await panel("verify email", () => tappable(page.getByRole("button", { name: "Verify email" })).click());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await tappable(page.getByRole("button", { name: "Log Out" })).click();
    await page.getByRole("alertdialog").waitFor();
    await look("log out question");
    await page.getByRole("button", { name: "Cancel" }).click();
  });
  if (problems.length) report("console", problems);
} finally {
  if (token) {
    const gone = await context.request.delete(`${BASE}/api/auth/account`, { headers: { Authorization: `Bearer ${token}` } });
    console.log(`cleanup: test account deleted (${gone.status()})`);
  }
  await browser.close();
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
