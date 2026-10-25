// The features that need data set up first: the clock, hours on a shift, schedule
// problems, routes, weather, copying and the address search.
//   node e2e/features.mjs            (expects the site on http://localhost:3210)
// Sets its data up through the API, then drives a real browser. Routes, weather and
// address search call outside providers, so those checks accept "not available
// right now" as long as the screen says so plainly. One @test.local account, deleted after.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const SHOTS = process.env.SHOTS;
const email = `web-f-${Date.now()}@test.local`;
const HOUR = 3600000;
const at = (hoursFromNow) => new Date(Date.now() + hoursFromNow * HOUR).toISOString();

let failed = 0;
const check = (name, ok, info = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !info ? "" : `  → ${info}`}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const problems = [];
page.on("console", (message) => message.type() === "error" && !/status of (401|409|422)|tile\.openstreetmap/.test(message.text()) && problems.push(`console: ${message.text()}`));
page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));

const step = async (name, work) => {
  try {
    await work();
    check(name, true);
  } catch (error) {
    check(name, false, String(error.message).split("\n").slice(0, 4).join(" "));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/f-failed-${failed}.png` }).catch(() => undefined);
    // Leave the next step a clean page
    await page.goto(`${BASE}/home`).catch(() => undefined);
  }
};
const visible = (locator) => locator.filter({ visible: true });
const ui = {
  getByRole: (...args) => visible(page.getByRole(...args)),
  getByText: (...args) => visible(page.getByText(...args)),
};
const sheet = () => page.locator("dialog[open]").last();
const closed = () => page.waitForFunction(() => !document.querySelector("dialog[open]"));
const settle = () => page.waitForTimeout(500);
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });

let token;
const api = async (method, path, data) => {
  const response = await context.request[method](`${BASE}/api${path}`, { data, headers: { "X-Auth-Transport": "cookie", ...(token && { Authorization: `Bearer ${token}` }) } });
  const body = await response.json();
  if (!response.ok()) throw new Error(`${method} ${path} → ${response.status()} ${body?.message}`);
  return body.data;
};

try {
  // Registering with the cookie transport leaves the refresh cookie in this browser: the page opens signed in
  token = (await api("post", "/auth/register", { name: "Feature Tester", email, password: "Testing123" })).accessToken;
  // A new account starts with the timesheet and pay estimates off; these checks need them
  await api("patch", "/auth/profile", { features: { timesheet: true, pay: true } });
  await api("put", "/auth/home", { address: "100 Queen St W, Toronto", latitude: 43.6534, longitude: -79.3841 });
  const near = await api("post", "/jobs", { title: "Sales Associate", companyName: "Boathouse", hourlyRate: 18, latitude: 43.7254, longitude: -79.4522, location: "Yorkdale Mall, Toronto" });
  const far = await api("post", "/jobs", { title: "Cashier", companyName: "Fairweather", latitude: 43.7765, longitude: -79.2578, location: "Scarborough Town Centre, Toronto" });
  const now = await api("post", "/shifts", { jobId: near.id, startTime: at(0.1), endTime: at(6) }); // the clock opens 10 minutes before
  await api("post", "/shifts", { jobId: near.id, startTime: at(-30), endTime: at(-24) }); // finished yesterday
  const first = await api("post", "/shifts", { jobId: near.id, startTime: at(48), endTime: at(52) });
  await api("post", "/shifts", { jobId: far.id, startTime: at(51), endTime: at(55), allowOverlap: true }); // overlaps `first`
  await api("post", "/shifts", { jobId: far.id, startTime: at(-54), endTime: at(-50) }); // finished, never clocked: "Add your hours?"

  await step("home: clock in, then clock out with the hours in the toast", async () => {
    await page.goto(`${BASE}/home`);
    await ui.getByRole("button", { name: "Clock In" }).click();
    await ui.getByText("On the clock").waitFor();
    await shot("f1-clocked-in");
    await ui.getByRole("button", { name: "Clock Out" }).click();
    await ui.getByText(/Clocked out ·/).waitFor();
    await ui.getByText("On the clock").waitFor({ state: "detached" });
  });

  await step("home: the overlap is listed and opens with ways to fix it", async () => {
    await ui.getByText("Boathouse and Fairweather overlap").click();
    await sheet().getByText("in two places at once").waitFor();
    await sheet().getByText("Ways to fix it").waitFor();
    await settle();
    await shot("f2-conflict");
    await sheet().getByRole("button", { name: "Done" }).click();
    await closed();
  });

  await step("past shift: its hours are added from the shift, then show on the list", async () => {
    await page.goto(`${BASE}/shifts`);
    await ui.getByRole("radio", { name: "Past" }).check({ force: true });
    await ui.getByRole("button", { name: /Boathouse/ }).last().click();
    await sheet().getByRole("button", { name: "Add the hours you worked" }).click();
    await sheet().getByText("These start as your scheduled times").waitFor();
    await sheet().getByRole("button", { name: "Add", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll("dialog[open]").length === 1);
    await sheet().getByText(/Worked .* 30 min break/).waitFor(); // the shift's own row refreshed under the closed panel
    await sheet().getByRole("button", { name: "Cancel" }).click();
    await closed();
    await ui.getByText(/5h 30m paid/).waitFor();
    await shot("f3-past-shifts");
  });

  await step("home: “Add your hours?” saves a shift nobody clocked", async () => {
    await page.goto(`${BASE}/home`);
    await ui.getByText("Add your hours?").waitFor();
    await shot("f3a-unlogged");
    await ui.getByRole("button", { name: /^Add 4h at Fairweather/ }).click();
    await ui.getByText("Added 4h at Fairweather").waitFor();
    await ui.getByText("Add your hours?").waitFor({ state: "detached" });
  });

  await step("features: switching off pay estimates takes Pay off Shifts", async () => {
    await page.goto(`${BASE}/settings#features`);
    const pay = ui.getByRole("switch", { name: "Pay estimates" });
    await pay.click();
    await page.waitForFunction(() => document.querySelector('[role=switch][aria-label="Pay estimates"]')?.getAttribute("aria-checked") === "false");
    await shot("f3c-features");
    await page.goto(`${BASE}/shifts`);
    await ui.getByRole("heading", { name: "Shifts" }).waitFor();
    if (await ui.getByRole("button", { name: "Pay summary" }).count()) throw new Error("Pay is still on Shifts with pay estimates off");
    await page.goto(`${BASE}/settings#features`);
    await ui.getByRole("switch", { name: "Pay estimates" }).click();
    await page.waitForFunction(() => document.querySelector('[role=switch][aria-label="Pay estimates"]')?.getAttribute("aria-checked") === "true");
  });

  await step("arrive early: Custom opens the minutes wheel; Set saves it", async () => {
    await page.goto(`${BASE}/settings#commute`);
    // Custom opens the wheel; the choice only changes once Set saves it, so this is a click, not a check
    await ui.getByRole("radio", { name: "Custom" }).click({ force: true });
    const wheel = sheet().getByRole("spinbutton", { name: "Minutes early" });
    await wheel.focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.querySelector('[role=spinbutton]')?.getAttribute("aria-valuenow") === "13");
    await sheet().getByText("For a 10:00 AM shift you’ll be there by 9:47 AM.").waitFor();
    await shot("f3d-arrival-wheel");
    await sheet().getByRole("button", { name: "Set" }).click();
    await ui.getByText("You’ll arrive 13 min early").waitFor();
    await ui.getByRole("radio", { name: "13 min" }).waitFor({ state: "attached" });
  });

  await step("home: “Can’t make it?” on the next-shift card opens the missed-shift panel", async () => {
    await page.goto(`${BASE}/home`);
    await ui.getByRole("button", { name: /make it\?/ }).click();
    await sheet().getByText("What happened?").waitFor();
    await sheet().getByRole("button", { name: "Cancel" }).click();
    await closed();
  });

  await step("missed: a called-off shift leaves the clashes, is counted under Missed, and comes back", async () => {
    await page.goto(`${BASE}/shifts`);
    await ui.getByRole("radio", { name: "Upcoming" }).check({ force: true });
    await ui.getByRole("button", { name: /Boathouse/ }).last().click(); // `first`, the one Fairweather overlaps
    await sheet().getByRole("button", { name: /Mark as Missed/ }).click();
    await sheet().getByRole("radio", { name: "My manager called it off" }).click();
    await sheet().getByRole("button", { name: "Save" }).click();
    await ui.getByText("Marked as missed").waitFor();
    await page.waitForFunction(() => document.querySelectorAll("dialog[open]").length === 1);
    await sheet().getByRole("button", { name: /Called off/ }).waitFor(); // the shift's own row refreshed under the closed panel
    await sheet().getByRole("button", { name: "Cancel" }).click();
    await closed();

    await ui.getByRole("radio", { name: "Missed" }).check({ force: true });
    await ui.getByText("1 this year — 1 called off").waitFor();
    await shot("f3b-missed");

    await page.goto(`${BASE}/home`);
    await ui.getByText(/^This week ·/).waitFor();
    await page.waitForTimeout(1200);
    if (await ui.getByText("Boathouse and Fairweather overlap").count()) throw new Error("a missed shift still shows as an overlap");

    await page.goto(`${BASE}/shifts`);
    await ui.getByRole("radio", { name: "Missed" }).check({ force: true });
    await ui.getByRole("button", { name: /Boathouse/ }).click();
    await sheet().getByRole("button", { name: /Called off/ }).click();
    await sheet().getByRole("button", { name: "It’s Back On" }).click();
    await page.waitForFunction(() => document.querySelectorAll("dialog[open]").length === 1);
    await sheet().getByRole("button", { name: /Mark as Missed/ }).waitFor();
    await sheet().getByRole("button", { name: "Cancel" }).click();
    await closed();
    await ui.getByText("No missed shifts this year").waitFor();
  });

  await step("copy a shift onto another day", async () => {
    await ui.getByRole("radio", { name: "Upcoming" }).check({ force: true });
    await ui.getByRole("button", { name: /Fairweather/ }).click();
    await sheet().getByRole("button", { name: "Copy" }).click();
    await sheet().getByText("Copy to").waitFor();
    await sheet().locator("button[aria-pressed]").nth(6).click();
    await settle();
    await shot("f4-copy");
    await sheet().getByRole("button", { name: "Copy to 1 day" }).click();
    await page.waitForFunction(() => document.querySelectorAll("dialog[open]").length === 1);
    await sheet().getByRole("button", { name: "Cancel" }).click();
    await closed();
    await page.waitForFunction(() => document.querySelectorAll("main button").length >= 4);
  });

  await step("route: a map and either trips or a plain 'not available'", async () => {
    await ui.getByRole("button", { name: /Boathouse/ }).first().click();
    await sheet().getByRole("button", { name: "Route" }).click();
    await sheet().locator(".leaflet-container").waitFor({ timeout: 40000 });
    await sheet().getByText(/Leave \d|Leave by|aren’t available|unavailable|No bus or train/).first().waitFor({ timeout: 40000 });
    await sheet().getByRole("radio", { name: "Driving" }).check({ force: true });
    await sheet().getByText(/Leave (home )?by|aren’t available/).first().waitFor();
    await page.waitForTimeout(1500); // map tiles
    await shot("f5-route");
    await sheet().getByRole("button", { name: "Done" }).click();
    await page.waitForFunction(() => document.querySelectorAll("dialog[open]").length === 1);
  });

  await step("weather: a temperature and advice, or a plain reason there is none", async () => {
    await sheet().getByRole("button", { name: "Weather" }).click();
    await sheet().getByText(/feels like|forecast isn’t available|too far ahead/).first().waitFor({ timeout: 30000 });
    await settle();
    await shot("f6-weather");
    await sheet().getByRole("button", { name: "Done" }).click();
    await page.waitForFunction(() => document.querySelectorAll("dialog[open]").length === 1);
    await sheet().getByRole("button", { name: "Cancel" }).click();
    await closed();
  });

  await step("job location: typing searches, choosing a result sets the pin", async () => {
    await page.goto(`${BASE}/jobs`);
    await ui.getByRole("button", { name: /Fairweather/ }).click();
    await sheet().getByText("Scarborough Town Centre").first().waitFor();
    await sheet().getByRole("textbox", { name: /Search for/ }).fill("CN Tower Toronto");
    const result = sheet().locator("ul li button").first();
    await result.waitFor({ timeout: 20000 });
    const title = (await result.locator("span").first().innerText()).trim();
    await result.click();
    await sheet().getByText(title).first().waitFor();
    await page.waitForTimeout(1200);
    await shot("f7-job-location");
    await sheet().getByRole("button", { name: "Save" }).click();
    await closed();
  });

  await step("timesheet: the week lists both entries and a total", async () => {
    await page.goto(`${BASE}/timesheet`);
    await ui.getByText("Paid hours").waitFor();
    await page.waitForTimeout(800);
    await shot("f8-timesheet");
  });

  await step("timesheet: PDF downloads the week as a statement", async () => {
    const [download] = await Promise.all([page.waitForEvent("download"), ui.getByRole("button", { name: "Download PDF" }).click()]);
    if (!/^shiftbuddy-hours-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.pdf$/.test(download.suggestedFilename())) throw new Error(`file name: ${download.suggestedFilename()}`);
    const file = readFileSync(await download.path());
    if (file.subarray(0, 5).toString() !== "%PDF-" || file.length < 1500) throw new Error(`not a PDF (${file.length} bytes)`);
  });

  // A share only becomes active once the receiver's email is verified, which a test
  // can't do — so the two "shared with me" replies are stood in for here. Everything
  // the page does with them is real.
  await step("home: a shared schedule (stand-in reply) sits beside mine; Month view; the Settings switch hides it", async () => {
    const today = (hour) => new Date(new Date().setHours(hour, 0, 0, 0)).toISOString();
    const owner = { id: "owner-1", name: "Manjeet Yadav" };
    await page.route("**/api/shares/received", (route) => route.fulfill({ json: { success: true, data: [{ id: "share-1", owner, expiresAt: null }] } }));
    await page.route("**/api/shares/owner-1/shifts**", (route) =>
      route.fulfill({ json: { success: true, data: { owner, shifts: [{ id: "theirs-1", startTime: today(12), endTime: today(18), job: { title: "Sales Associate", companyName: "International Clothiers", color: "#866aa0" } }] } } }),
    );
    await page.goto(`${BASE}/home`);
    await ui.getByRole("button", { name: "Manjeet", exact: true }).waitFor(); // the people filter
    await ui.getByRole("region", { name: "Today" }).getByText("International Clothiers").waitFor(); // who is working today
    await ui.getByRole("row", { name: /Manjeet/ }).getByRole("button", { name: /International Clothiers/ }).waitFor(); // their own row of the week
    await page.waitForTimeout(500);
    await shot("f9-home-shared-week");
    await ui.getByRole("radio", { name: "Month" }).check({ force: true });
    await ui.getByRole("button", { name: /Manjeet · International Clothiers/ }).first().waitFor();
    await page.waitForTimeout(400);
    await shot("f10-home-shared-month");
    await ui.getByRole("button", { name: "Manjeet", exact: true }).click(); // hide them for now
    await ui.getByRole("button", { name: /International Clothiers/ }).first().waitFor({ state: "detached" });
    await ui.getByRole("radio", { name: "Week" }).check({ force: true });

    await page.goto(`${BASE}/settings`);
    await ui.getByRole("switch", { name: /shared with me/ }).click();
    await shot("f11-settings-switch");
    await page.goto(`${BASE}/home`);
    await ui.getByText(/^This week ·/).waitFor();
    await page.waitForTimeout(1200);
    if (await ui.getByRole("button", { name: "Manjeet", exact: true }).count()) throw new Error("the shared schedule still shows with the setting off");

    // The same switch sits on Sharing, under the schedules it is about, and the two agree
    await page.goto(`${BASE}/sharing`);
    const onSharing = ui.getByRole("switch", { name: /shared with me/ });
    await onSharing.waitFor();
    if ((await onSharing.getAttribute("aria-checked")) !== "false") throw new Error("Sharing's switch does not show what Settings chose");
    await onSharing.click();
    await shot("f12-sharing-switch");
    await page.goto(`${BASE}/home`);
    await ui.getByRole("button", { name: "Manjeet", exact: true }).waitFor(); // back on Home
    await page.unrouteAll();
  });

  void now;
  void first;
} catch (error) {
  check("setup", false, error.message);
} finally {
  if (token) {
    // Hidden at once, erased by the backend after its 30-day grace period
    const gone = await context.request.post(`${BASE}/api/account/deletion`, { headers: { Authorization: `Bearer ${token}` }, data: { password: "Testing123" } });
    console.log(`cleanup: test account deleted (${gone.status()})`);
  }
  await browser.close();
}

check(`no console or page errors (${problems.length})`, problems.length === 0, problems.slice(0, 6).join(" | "));
console.log(failed === 0 ? "\nALL PASSED" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
