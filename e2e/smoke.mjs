// A real browser walking the main flows against a running web app + backend.
//   node e2e/smoke.mjs            (expects the site on http://localhost:3210)
//   SHOTS=some/folder node e2e/smoke.mjs   also saves screenshots there
// Creates one @test.local account and deletes it at the end, pass or fail.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const SHOTS = process.env.SHOTS;
const run = Date.now();
const email = `web-${run}@test.local`;
const password = "Testing123";

let failed = 0;
const check = (name, ok, info = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !info ? "" : `  → ${info}`}`);
};
const step = async (name, work) => {
  try {
    await work();
    check(name, true);
  } catch (error) {
    check(name, false, String(error.message).split("\n").slice(0, 5).join(" "));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/failed-${failed}.png` }).catch(() => undefined);
  }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await context.newPage();
const problems = [];
// The browser logs every 401/409 itself; those are judged by the response check below
page.on("console", (message) => message.type() === "error" && !/status of (401|404|409)/.test(message.text()) && problems.push(`console: ${message.text()}`));
page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
page.on("response", (response) => {
  // 401 before login and the 409 from the overlap check are part of the flows
  const expected = [401, 409].includes(response.status()) || (response.status() === 404 && response.url().includes("/api/auth/")); // 404 = "no such account"
  if (response.status() >= 400 && !expected) problems.push(`${response.status()} ${response.request().method()} ${response.url()}`);
});

// Next.js keeps the pages you leave in the document, hidden — only look at what is on screen
const visible = (locator) => locator.filter({ visible: true });
const ui = {
  getByRole: (...args) => visible(page.getByRole(...args)),
  getByLabel: (...args) => visible(page.getByLabel(...args)),
  getByText: (...args) => visible(page.getByText(...args)),
};
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const sheet = () => page.locator("dialog[open]").last();
const closed = () => page.waitForFunction(() => !document.querySelector("dialog[open]"));
const settle = () => page.waitForTimeout(450); // a sheet finishing its slide
// The date field is a button that opens a month; the day cells carry their ISO date
const pickDate = async (isoDay) => {
  await sheet().getByLabel("Date", { exact: true }).click();
  const cell = page.locator(`[popover]:popover-open td[data-day="${isoDay}"] button`);
  if (!(await cell.count())) await page.locator("[popover]:popover-open").getByRole("button", { name: /next month/i }).click();
  await cell.click();
};

try {
  await step("signed out → the app sends you to log in", async () => {
    await page.goto(`${BASE}/home`);
    await page.waitForURL("**/login");
    await shot("01-login");
  });

  await step("an unknown email is told so and offered sign-up; a password reset refuses it too", async () => {
    const stranger = `nobody-${run}@test.local`;
    await ui.getByLabel("Email").fill(stranger);
    await ui.getByLabel("Password").fill(password);
    await ui.getByRole("button", { name: "Log In" }).click();
    await ui.getByRole("alert").filter({ hasText: "No account uses" }).waitFor();
    await shot("01b-no-account");
    await ui.getByRole("link", { name: "Forgot password?" }).click();
    await page.waitForURL("**/forgot-password");
    await ui.getByRole("button", { name: "Send Code" }).click(); // the email typed at log in came along
    await ui.getByRole("alert").filter({ hasText: "no password to reset" }).waitFor();
    if (await ui.getByRole("heading", { name: "Check your email" }).count()) throw new Error("the code step opened for an email with no account");
    await ui.getByRole("alert").getByRole("link", { name: "Create an account" }).click();
    await page.waitForURL("**/register");
    if ((await ui.getByLabel("Email").inputValue()) !== stranger) throw new Error("the email was not carried to sign-up");
  });

  await step("sign up → lands in the app with the verify-email panel open", async () => {
    await ui.getByLabel("Name").fill("Web Tester");
    await ui.getByLabel("Email").fill(email);
    await ui.getByLabel("Password").fill(password);
    await ui.getByRole("button", { name: "Create Account" }).click();
    await page.waitForURL("**/home");
    await sheet().getByText("We emailed a 6-digit code").waitFor();
    await settle();
    await shot("02-verify-email");
    await sheet().getByRole("button", { name: "Cancel" }).click();
    await closed();
  });

  await step("a new account sees Add Shift / Scan Schedule, not an empty card", async () => {
    await ui.getByRole("heading", { name: "No shifts coming up" }).waitFor();
    await shot("03-home-empty");
  });

  await step("add a job (workplace is the name)", async () => {
    await ui.getByRole("link", { name: "Jobs" }).first().click();
    await ui.getByRole("heading", { name: "Add your first job" }).waitFor();
    await ui.getByRole("button", { name: "Add Job" }).click();
    await sheet().getByLabel("Workplace").fill("Boathouse");
    await sheet().getByLabel("Your role").fill("Sales Associate");
    await sheet().getByLabel("Hourly rate").fill("18.50");
    await settle();
    await shot("04-job-sheet");
    await sheet().getByRole("button", { name: "Add", exact: true }).click();
    await closed();
    await ui.getByRole("button", { name: /Boathouse/ }).waitFor();
  });

  const tomorrow = new Date(Date.now() + 86400000);
  const day = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  await step("N opens New Shift; saving it puts the shift on Home", async () => {
    await ui.getByRole("link", { name: "Home" }).first().click();
    await page.keyboard.press("n");
    await pickDate(day);
    await sheet().getByLabel("Notes").fill("closing");
    await settle();
    await shot("05-shift-sheet");
    await sheet().getByRole("button", { name: "Add", exact: true }).click();
    await closed();
    await ui.getByText("Next shift · Tomorrow").waitFor();
    await page.waitForTimeout(600);
    await shot("06-home");
  });

  await step("a clashing shift asks before saving; Cancel then asks about discarding", async () => {
    await page.keyboard.press("n");
    await pickDate(day);
    await sheet().getByRole("button", { name: "Add", exact: true }).click();
    await ui.getByRole("heading", { name: "Overlaps another shift" }).waitFor();
    await shot("07-overlap");
    await sheet().getByRole("button", { name: "Cancel" }).click();
    await ui.getByRole("heading", { name: "Overlaps another shift" }).waitFor({ state: "detached" });
    await sheet().getByRole("button", { name: "Cancel" }).click();
    await ui.getByRole("heading", { name: "Discard changes?" }).waitFor();
    await sheet().getByRole("button", { name: "Discard" }).click();
    await closed();
  });

  await step("delete a shift → Undo brings it back", async () => {
    await ui.getByRole("link", { name: "Shifts" }).first().click();
    await ui.getByRole("heading", { name: "Shifts" }).waitFor(); // Home, with its own Boathouse card, is still on screen for a moment
    await ui.getByRole("button", { name: /Boathouse/ }).click();
    await sheet().getByRole("button", { name: "Delete" }).click();
    await ui.getByRole("heading", { name: "No shifts coming up" }).waitFor();
    await ui.getByRole("button", { name: "Undo" }).click();
    await ui.getByRole("button", { name: /Boathouse/ }).waitFor();
    await shot("08-shifts");
  });

  await step("Ctrl+K finds a place by typing and goes there", async () => {
    await page.keyboard.press("Control+k");
    await sheet().getByRole("combobox").fill("timesh");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/timesheet");
    await closed();
  });

  await step("calendar shows the month and the selected day", async () => {
    await ui.getByRole("link", { name: "Calendar" }).first().click();
    await ui.getByRole("group", { name: /days$/ }).waitFor();
    await ui.getByText(/in numbers$/).waitFor();
    await shot("09-calendar");
  });

  await step("timesheet: add hours by hand → 7h 30m paid after the usual break", async () => {
    await ui.getByRole("link", { name: "Timesheet" }).first().click();
    await ui.getByRole("button", { name: "Add hours" }).first().click(); // the page bar's; an empty period offers it again below
    await sheet().getByText("Paid time").waitFor();
    await settle();
    await shot("10-hours-sheet");
    await sheet().getByRole("button", { name: "Add", exact: true }).click();
    await closed();
    // Yesterday's (or today's) 9–5 may fall in last week when today is Sunday
    const row = ui.getByText("7h 30m").first();
    if (!(await row.waitFor({ timeout: 4000 }).then(() => true, () => false))) await ui.getByRole("button", { name: "Earlier" }).click();
    await row.waitFor();
    await shot("11-timesheet");
  });

  await step("sharing: message preview, invite someone, stop sharing", async () => {
    await ui.getByRole("link", { name: "Sharing" }).first().click();
    await visible(page.locator("pre")).filter({ hasText: "Boathouse" }).waitFor();
    await ui.getByLabel("Their email").fill(`friend-${run}@test.local`);
    await ui.getByRole("button", { name: "Share My Schedule" }).click();
    await ui.getByText("Waiting for them to join").waitFor();
    await shot("12-sharing");
    await ui.getByRole("button", { name: "Stop", exact: true }).click();
    await sheet().getByRole("button", { name: "Stop", exact: true }).click();
    await ui.getByText("You aren’t sharing your schedule with anyone.").waitFor();
  });

  await step("settings: a theme applies at once and survives a reload — and so does the login", async () => {
    await ui.getByRole("link", { name: "Settings" }).first().click();
    const look = () => page.evaluate(() => `${document.documentElement.dataset.theme} ${document.documentElement.dataset.mode}`);
    await ui.getByRole("radio", { name: /Lavender Dusk/ }).click();
    await ui.getByRole("radio", { name: "Dark", exact: true }).check({ force: true }); // every theme has a dark side
    await page.waitForFunction(() => document.documentElement.dataset.mode === "dark");
    if ((await page.evaluate(() => getComputedStyle(document.body).colorScheme)) !== "dark") throw new Error("dark mode did not change the colours");
    await ui.getByRole("radio", { name: "Driving" }).check({ force: true });
    await page.waitForTimeout(500);
    await shot("13-settings-dark");
    await page.reload();
    await ui.getByRole("heading", { name: "Settings" }).waitFor();
    if ((await look()) !== "lavenderDusk dark") throw new Error(`theme was lost on reload: ${await look()}`);
    if (!(await ui.getByRole("radio", { name: "Driving" }).isChecked())) throw new Error("commute mode was not saved");
    await ui.getByRole("radio", { name: /Sunsama Focus/ }).click();
    await ui.getByRole("radio", { name: "Light", exact: true }).check({ force: true });
    if ((await look()) !== "sunsamaFocus light") throw new Error(`could not go back to light: ${await look()}`);
  });

  await step("a second tab is signed in too", async () => {
    const tab = await context.newPage();
    await tab.goto(`${BASE}/shifts`);
    await tab.getByRole("button", { name: /Boathouse/ }).first().waitFor();
    await tab.close();
  });

  await step("phone width: bottom tabs instead of the sidebar", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/home`);
    await ui.getByText("Next shift · Tomorrow").waitFor();
    if ((await visible(page.locator("aside")).count()) > 0) throw new Error("the sidebar is showing on a phone");
    if ((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) > 0) throw new Error("the page scrolls sideways");
    await page.waitForTimeout(600);
    await shot("14-phone-home");
    await ui.getByRole("button", { name: /Boathouse/ }).first().click();
    await sheet().getByLabel("Notes").waitFor();
    await settle();
    await shot("15-phone-sheet");
    await sheet().getByRole("button", { name: "Cancel" }).click();
    await closed();
    await page.setViewportSize({ width: 1280, height: 860 });
  });

  // Every way to log out asks the same question, once, and anything but "Log Out" keeps you in
  const asksToLogOut = async () => {
    const question = page.getByRole("alertdialog");
    await question.getByRole("heading", { name: "Log out of ShiftBuddy?" }).waitFor();
    await question.getByText("Are you sure you want to log out of your account?").waitFor();
    const open = await page.locator("dialog[open]").count();
    if (open !== 1) throw new Error(`${open} dialogs are open, expected the one question`);
    const names = await question.getByRole("button").allInnerTexts();
    if (names.join("|") !== "Cancel|Log Out") throw new Error(`buttons are "${names.join("|")}"`);
    // Focus starts on the safe answer, inside the dialog
    if (!(await question.getByRole("button", { name: "Cancel" }).evaluate((button) => button === document.activeElement))) throw new Error("focus did not start on Cancel");
    return question;
  };
  const stillSignedIn = async (where) => {
    await closed();
    await page.waitForTimeout(400);
    if (page.url().includes("/login")) throw new Error(`${where} logged out`);
  };

  await step("log out from the sidebar menu: keyboard, Esc and Cancel keep you signed in", async () => {
    await page.goto(`${BASE}/home`);
    const account = ui.getByRole("button", { name: /^Account:/ });
    await account.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu", { name: "Account" });
    await menu.waitFor();
    // The menu takes the keyboard: the arrows walk it and Esc hands focus back
    if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) !== "Settings") throw new Error("the menu did not take focus");
    await page.keyboard.press("ArrowDown");
    if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) !== "Log out") throw new Error("ArrowDown did not reach Log out");
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    if (!(await account.evaluate((button) => button === document.activeElement))) throw new Error("Esc did not return focus to the account button");

    await account.click();
    await menu.getByRole("menuitem", { name: "Log out" }).click();
    await asksToLogOut();
    await shot("16-log-out-question");
    await page.keyboard.press("Escape");
    await stillSignedIn("Esc");

    await account.click();
    await menu.getByRole("menuitem", { name: "Log out" }).click();
    await (await asksToLogOut()).getByRole("button", { name: "Cancel" }).click();
    await stillSignedIn("Cancel");
  });

  await step("log out from the search: a click outside keeps you signed in", async () => {
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox").fill("log out");
    await page.keyboard.press("Enter");
    await asksToLogOut();
    await page.waitForTimeout(400); // the backdrop ignores the tail of a double-click
    await page.mouse.click(8, 8);
    await stillSignedIn("A click outside");
  });

  await step("log out, then log back in", async () => {
    await page.goto(`${BASE}/settings`);
    // An impatient double-click must not answer the question it has just asked
    await ui.getByRole("button", { name: "Log out" }).dblclick();
    await (await asksToLogOut()).getByRole("button", { name: "Cancel" }).click();
    await stillSignedIn("Cancel");
    if (!page.url().endsWith("/settings")) throw new Error("Cancel left the page");

    let logoutCalls = 0;
    const count = (request) => request.url().endsWith("/api/auth/logout") && logoutCalls++;
    page.on("request", count);
    await ui.getByRole("button", { name: "Log out" }).click();
    // Two fast clicks on the answer: the session ends once
    await (await asksToLogOut()).getByRole("button", { name: "Log Out", exact: true }).dblclick();
    await page.waitForURL("**/login");
    page.off("request", count);
    if (logoutCalls !== 1) throw new Error(`the server was told to log out ${logoutCalls} times`);
    await ui.getByLabel("Email").fill(email);
    await ui.getByLabel("Password").fill("WrongPass1");
    await ui.getByRole("button", { name: "Log In" }).click();
    await ui.getByRole("alert").filter({ hasText: /./ }).first().waitFor();
    await ui.getByLabel("Password").fill(password);
    await ui.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL("**/home");
  });

  await step("delete the account from Settings", async () => {
    await page.goto(`${BASE}/settings`);
    await ui.getByRole("button", { name: "Delete account" }).click();
    await sheet().getByRole("button", { name: "Delete Account" }).click();
    await page.waitForURL("**/login");
  });
} finally {
  // Whatever happened above, the test account must not stay behind
  const login = await context.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
  if (login.ok()) {
    const { data } = await login.json();
    const gone = await context.request.delete(`${BASE}/api/auth/account`, { headers: { Authorization: `Bearer ${data.accessToken}` } });
    console.log(`cleanup: the test account was still there → deleted (${gone.status()})`);
  } else {
    console.log("cleanup: the test account is gone");
  }
  await browser.close();
}

check(`no console errors or failed requests (${problems.length})`, problems.length === 0, problems.slice(0, 8).join(" | "));
console.log(failed === 0 ? "\nALL PASSED" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
