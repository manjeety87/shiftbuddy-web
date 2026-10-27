// The assistant, end to end: speaking (a stand-in for the browser's speech service,
// which a test browser can't reach), the card and a spoken yes, Undo, opening places
// and a shift's panel, typing, the Save button, a phone, and a browser that can't listen.
//   node e2e/assistant.mjs            (expects the site on http://localhost:3210)
// What Gemini would answer is scripted, so the check doesn't depend on a free quota;
// a plain spoken "haan" still goes to the real backend (it needs no model), and so do
// saving, Undo and the shifts. AI_LIVE=1 sends everything to the real Gemini instead.
// One @test.local account, deleted after.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const SHOTS = process.env.SHOTS;
const email = `web-ai-${Date.now()}@test.local`;
const REPLY_MS = 45000;
const LIVE = process.env.AI_LIVE === "1";

let failed = 0;
const check = (name, ok, info = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !info ? "" : `  → ${info}`}`);
};

// Speech in, speech out: recognition that hears what the test "says", and a voice that
// records what it was asked to read. Everything else (the page, the backend) is real.
const fakeSpeech = () => {
  class FakeRecognition {
    start() {
      window.__recognition = this;
      window.__listening = true;
      window.__lang = this.lang;
    }
    abort() {
      if (window.__recognition === this) window.__listening = false;
      setTimeout(() => this.onend?.(), 0);
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
  window.__say = (text) => {
    const session = window.__recognition;
    const words = text.split(" ");
    session.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: words.slice(0, Math.ceil(words.length / 2)).join(" ") } }] });
    setTimeout(() => session.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] }), 150);
  };
  window.__spoken = [];
  Object.defineProperty(window, "speechSynthesis", {
    value: {
      speak: (utterance) => {
        window.__spoken.push(utterance.text);
        setTimeout(() => utterance.onend?.(), 80);
      },
      cancel: () => {},
      getVoices: () => [],
    },
  });
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
};

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const problems = [];
const watch = (page) => {
  page.setDefaultTimeout(20000);
  page.on("console", (message) => message.type() === "error" && !/status of (401|409|422|429|503)/.test(message.text()) && problems.push(`console: ${message.text()}`));
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  // The scripted 503 ("fail please") is the test's own
  page.on("response", (response) => response.status() >= 500 && (LIVE || !response.url().endsWith("/assistant/messages")) && problems.push(`server error: ${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`));
};

const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["microphone"] });
await context.addInitScript(fakeSpeech);
const page = await context.newPage();
watch(page);

const panel = () => page.getByRole("region", { name: "Assistant" });
const shot = async (name, target = page) => SHOTS && target.screenshot({ path: `${SHOTS}/${name}.png` });
/** Says something once the assistant is listening, and waits for the answer to arrive */
const say = async (text, target = page) => {
  await target.waitForFunction(() => window.__listening === true, null, { timeout: REPLY_MS });
  const before = await target.evaluate(() => window.__spoken.length);
  await target.evaluate((words) => window.__say(words), text);
  await target.waitForFunction((count) => window.__spoken.length > count, before, { timeout: REPLY_MS });
  return target.evaluate(() => window.__spoken.at(-1));
};

const step = async (name, work) => {
  try {
    await work();
    check(name, true);
  } catch (error) {
    check(name, false, String(error.message).split("\n").slice(0, 3).join(" "));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/ai-failed-${failed}.png` }).catch(() => undefined);
  }
};

let token;
const api = async (method, path, data) => {
  const response = await context.request[method](`${BASE}/api${path}`, { data, headers: { "X-Auth-Transport": "cookie", ...(token && { Authorization: `Bearer ${token}` }) } });
  const body = await response.json();
  if (!response.ok()) throw new Error(`${method} ${path} → ${response.status()} ${body?.message}`);
  return body.data;
};
// Each browser signs in on its own: sharing one refresh cookie would trip token-reuse detection
const signIn = (target) => target.request.post(`${BASE}/api/auth/login`, { data: { email, password: "Testing123" }, headers: { "X-Auth-Transport": "cookie" } });
const dayAt = (offset, hour) => {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  day.setHours(hour, 0, 0, 0);
  return day.toISOString();
};

try {
  token = (await api("post", "/auth/register", { name: "Voice Tester", email, password: "Testing123" })).accessToken;
  await api("patch", "/auth/profile", { features: { timesheet: true } });
  const boathouse = await api("post", "/jobs", { title: "Key Holder", companyName: "Boathouse", hourlyRate: 19 });
  await api("post", "/jobs", { title: "Barista", companyName: "Corner Cafe" });
  const later = await api("post", "/shifts", { jobId: boathouse.id, startTime: dayAt(3, 9), endTime: dayAt(3, 17) });
  const weekday = new Date(later.startTime).toLocaleDateString("en-US", { weekday: "long" });
  // Gemini's side of the conversation, for the requests that need it
  const badge = { jobName: "Boathouse", role: "Key Holder", color: boathouse.color };
  const card = (startTime, endTime) => ({ type: "addShifts", shifts: [{ jobId: boathouse.id, startTime, endTime, notes: null }], allowOverlap: false, preview: { shifts: [{ ...badge, startTime, endTime, notes: null }], overlaps: [] } });
  const turn = (reply, extra = {}) => ({ reply, pending: null, actions: [], saved: null, ...extra });
  const script = [
    ["kal meri boathouse", turn("Kal Boathouse mein 9 se 5 ki shift, add kar doon?", { pending: card(dayAt(1, 9), dayAt(1, 17)) })],
    ["show me the calendar", turn("Opening your calendar.", { actions: [{ type: "openPage", page: "calendar" }] })],
    ["please show my shift on", turn("Here is your Boathouse shift.", { actions: [{ type: "openShift", shiftId: later.id }] })],
    ["close it", turn("Closed.", { actions: [{ type: "closePanels" }] })],
    ["add a boathouse shift next friday", turn("Boathouse, 8 to 2. Should I add it?", { pending: card(dayAt(10, 8), dayAt(10, 14)) })],
    ["when is my next shift", turn(`Your next shift is at Boathouse on ${weekday}, 9 to 5.`)],
  ];
  const scriptGemini = async (target) => {
    if (LIVE) return;
    await target.route("**/api/assistant/messages", async (route) => {
      const { message } = route.request().postDataJSON();
      const said = message.toLowerCase();
      if (said.includes("fail please")) return route.fulfill({ status: 503, json: { success: false, message: "The assistant is busy right now — try again in a moment" } });
      const match = script.find(([words]) => said.includes(words));
      if (!match) return route.continue();
      await new Promise((resolve) => setTimeout(resolve, 300)); // a model takes a moment
      return route.fulfill({ json: { statusCode: 200, success: true, message: "Assistant replied", data: match[1] } });
    });
  };
  await scriptGemini(context);
  // The welcome slides would sit over everything on a new account
  await page.addInitScript(() => localStorage.setItem("shiftbuddy.welcomeSeen", "yes"));

  await step("Ctrl J opens the assistant listening, with examples to start from", async () => {
    await page.goto(`${BASE}/home`);
    await page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }).waitFor();
    await page.keyboard.press("Control+j");
    await panel().waitFor();
    await panel().getByText("Listening…").waitFor();
    await panel().getByRole("button", { name: "Kal 9 se 5 ki shift hai" }).waitFor();
    await page.waitForTimeout(400);
    await shot("ai1-open");
  });

  await step("Hinglish: a shift said out loud comes back as a card, and nothing is saved yet", async () => {
    const reply = await say("kal meri Boathouse mein 9 se 5 ki shift hai");
    if (!/kal|shift|confirm|add/i.test(reply)) throw new Error(`reply: ${reply}`);
    await panel().getByRole("region", { name: "New shift" }).waitFor();
    await panel().getByRole("button", { name: "Add shift" }).waitFor();
    await panel().getByText("Say “yes”, or").waitFor();
    const shifts = await api("get", "/shifts");
    if (shifts.length !== 1) throw new Error(`${shifts.length} shifts before the yes`);
    await shot("ai2-card");
  });

  await step("a spoken “haan sahi hai add kardo” saves it, the card goes, Undo is offered", async () => {
    const reply = await say("haan sahi hai add kardo");
    if (!/ho gaya/i.test(reply)) throw new Error(`reply: ${reply}`);
    await panel().getByRole("region", { name: "New shift" }).waitFor({ state: "detached" });
    await panel().getByRole("button", { name: "Undo" }).waitFor();
    if ((await api("get", "/shifts")).length !== 2) throw new Error("the shift was not saved");
    await shot("ai3-saved");
  });

  await step("Undo takes the shift back out", async () => {
    await panel().getByRole("button", { name: "Undo" }).click();
    await panel().getByText("Undone").waitFor();
    if ((await api("get", "/shifts")).length !== 1) throw new Error("the shift is still there");
  });

  await step("“show me the calendar” goes to Calendar", async () => {
    await say("can you show me the calendar please");
    await page.waitForURL(/\/calendar/);
  });

  await step(`“show my ${weekday} shift” opens that shift’s panel; the assistant shrinks to a pill and keeps listening`, async () => {
    await say(`please show my shift on ${weekday}`);
    const sheet = page.locator("dialog[open]").last();
    await sheet.getByRole("heading", { name: /Shift|Boathouse/ }).first().waitFor();
    const pill = sheet.getByRole("region", { name: "Assistant" });
    await pill.waitFor();
    await pill.getByRole("button", { name: "Stop listening" }).waitFor();
    await page.waitForTimeout(400);
    await shot("ai4-shift-open");
    // Above the panel's dimmed backdrop, so it can be used
    await pill.getByRole("button", { name: "Open the assistant" }).click();
    await sheet.getByRole("region", { name: "Assistant" }).getByText("Undone").waitFor(); // the whole conversation, still there
    await shot("ai5-expanded-over-shift");
  });

  await step("“close it” closes the shift’s panel", async () => {
    await say("close it");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await panel().waitFor();
  });

  await step("typing works the same way, and the Save button saves", async () => {
    await panel().getByRole("button", { name: "Stop listening" }).click();
    await panel().getByText("Tap the mic and talk, or type.").waitFor();
    const before = await page.evaluate(() => window.__spoken.length);
    await panel().getByLabel("Message").fill("add a Boathouse shift next Friday 8 to 2");
    await panel().getByLabel("Message").press("Enter");
    await page.waitForFunction((count) => window.__spoken.length > count, before, { timeout: REPLY_MS });
    await panel().getByRole("button", { name: "Add shift" }).click();
    await panel().getByText("Shift added.").waitFor();
    if ((await api("get", "/shifts")).length !== 2) throw new Error("the Save button did not save");
  });

  await step("replies can be silenced, and the language choice is kept", async () => {
    await panel().getByRole("button", { name: "Stop reading replies aloud" }).click();
    await panel().getByRole("radio", { name: "हिन्दी" }).check({ force: true });
    const saved = await page.evaluate(() => [localStorage.getItem("shiftbuddy.assistantVoice"), localStorage.getItem("shiftbuddy.assistantLanguage")]);
    if (saved.join() !== "off,hi-IN") throw new Error(saved.join());
    await panel().getByRole("button", { name: "Read replies aloud" }).click();
    await panel().getByRole("radio", { name: "English" }).check({ force: true });
  });

  await step("a failing service shows why, offers Try again, and stops listening", async () => {
    if (LIVE) return;
    await panel().getByRole("button", { name: "Talk" }).click();
    await page.waitForFunction(() => window.__listening === true);
    await page.evaluate(() => window.__say("fail please"));
    await panel().getByText("The assistant is busy right now — try again in a moment").waitFor();
    await panel().getByRole("button", { name: "Try again" }).waitFor();
    await panel().getByText("Tap the mic and talk, or type.").waitFor();
    if (await page.evaluate(() => window.__listening)) throw new Error("still listening after the failure");
    await shot("ai8-error");
  });

  await step("Esc closes it", async () => {
    await panel().getByLabel("Message").focus();
    await page.keyboard.press("Escape");
    await panel().waitFor({ state: "detached" });
  });

  await step("phone: a mic button above the tabs opens it, and nothing runs off the screen", async () => {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
    await signIn(phone);
    await phone.addInitScript(fakeSpeech);
    await scriptGemini(phone);
    await phone.addInitScript(() => localStorage.setItem("shiftbuddy.welcomeSeen", "yes"));
    const small = await phone.newPage();
    watch(small);
    await small.goto(`${BASE}/home`);
    await small.getByRole("button", { name: "Assistant" }).click();
    const region = small.getByRole("region", { name: "Assistant" });
    await region.getByText("Listening…").waitFor();
    const reply = await say("when is my next shift?", small);
    if (!reply) throw new Error("no reply");
    const wide = await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (wide) throw new Error("the page scrolls sideways");
    await small.waitForTimeout(400);
    await shot("ai6-phone", small);
    await phone.close();
  });

  await step("a browser that can't listen: no mic, and it says to type", async () => {
    const plain = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await signIn(plain);
    await plain.addInitScript(() => {
      localStorage.setItem("shiftbuddy.welcomeSeen", "yes");
      // Like Firefox: no recognition at all
      delete window.webkitSpeechRecognition;
      delete window.SpeechRecognition;
    });
    const other = await plain.newPage();
    watch(other);
    await other.goto(`${BASE}/home`);
    await other.getByRole("button", { name: "Assistant" }).click();
    const region = other.getByRole("region", { name: "Assistant" });
    await region.getByText(/This browser can’t listen/).waitFor();
    if (await region.getByRole("button", { name: "Talk" }).count()) throw new Error("a mic button that can't work");
    await shot("ai7-no-voice", other);
    await plain.close();
  });
} catch (error) {
  check("setup", false, error.message);
} finally {
  if (token) {
    const gone = await context.request.post(`${BASE}/api/account/deletion`, { headers: { Authorization: `Bearer ${token}` }, data: { password: "Testing123" } });
    console.log(`cleanup: test account deleted (${gone.status()})`);
  }
  await browser.close();
}

check(`no console or page errors (${problems.length})`, problems.length === 0, problems.slice(0, 6).join(" | "));
console.log(failed === 0 ? "\nALL PASSED" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
