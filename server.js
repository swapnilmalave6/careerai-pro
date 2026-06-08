const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DB_FILE = path.join(ROOT, "db.json");
const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function ensureDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      users: [],
      sessions: {},
      resumes: [],
      interview_history: [],
      payments: [],
      subscriptions: []
    }, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(12).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  return hashPassword(password, salt).split(":")[1] === hash;
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Access-Control-Allow-Origin": "*" });
  res.end(type.includes("json") ? JSON.stringify(body) : body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function getUser(req, db) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const userId = db.sessions[token];
  return db.users.find(user => user.id === userId);
}

function keywordScore(text, jobRole) {
  const lower = `${text} ${jobRole}`.toLowerCase();
  const keywords = [
    "project", "internship", "javascript", "react", "node", "python", "sql", "api",
    "cloud", "aws", "azure", "docker", "git", "leadership", "communication",
    "problem solving", "testing", "database", "analytics", "security"
  ];
  const found = keywords.filter(word => lower.includes(word));
  const hasNumbers = /\d+%|\d+\+|\d+\s*(users|clients|projects|months|years)/i.test(text);
  const sections = ["experience", "education", "skills", "projects"].filter(s => lower.includes(s));
  const score = Math.min(96, 35 + found.length * 3 + sections.length * 7 + (hasNumbers ? 12 : 0));
  const missing = keywords.filter(word => !lower.includes(word)).slice(0, 6);
  return { score, found, missing };
}

function fallbackResumeAnalysis(resumeText, jobRole) {
  const result = keywordScore(resumeText, jobRole);
  return {
    atsScore: result.score,
    match: result.score >= 80 ? "Strong Match" : result.score >= 60 ? "Good Start" : "Needs Work",
    missingSkills: result.missing,
    strengths: result.found.slice(0, 6),
    suggestions: [
      "Add measurable impact: use numbers like %, rupees saved, users served, or projects completed.",
      `Tune your summary for ${jobRole || "the target role"} and include 4-6 exact keywords from the job description.`,
      "Keep one clear Skills section with tools, languages, frameworks, databases, and cloud platforms.",
      "For every project, write: problem, tech stack, your action, and result."
    ],
    optimizedSummary: `Results-focused ${jobRole || "IT professional"} with hands-on project experience, strong problem-solving skills, and practical knowledge across modern software tools. Ready to contribute to production teams through clean execution, learning speed, and measurable outcomes.`
  };
}

function fallbackCoverLetter({ name, role, company, skills }) {
  return `Dear Hiring Manager,

I am excited to apply for the ${role || "open role"} at ${company || "your company"}. My background in ${skills || "software development, problem solving, and project execution"} makes me confident that I can contribute from day one.

I have worked on practical projects where I handled planning, implementation, testing, and improvement. I focus on writing clean solutions, learning quickly, and communicating clearly with teams.

I would be grateful for the opportunity to discuss how my skills can support ${company || "your team"}'s goals.

Sincerely,
${name || "Your Name"}`;
}

function fallbackInterview(role, level) {
  const base = [
    `Tell me about yourself for a ${role || "software"} role.`,
    "Explain one project from your resume end to end.",
    "What was the hardest bug or problem you solved?",
    "How do you learn a new technology quickly?",
    "Explain REST API and database flow in a simple app.",
    "How do you handle feedback or rejection?",
    "Why should we hire you?",
    "What are your salary expectations and joining availability?"
  ];
  return base.map((question, index) => ({
    question,
    answerTip: index < 3
      ? "Use STAR format: Situation, Task, Action, Result. Keep answer under 90 seconds."
      : `For ${level || "fresher"} level, keep it honest, practical, and project-based.`
  }));
}

function fallbackChatReply(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("code") || text.includes("javascript") || text.includes("python") || text.includes("html")) {
    return "I can help with code. Share your goal, current code, and error. I will explain the issue, give a corrected version, and show the steps clearly.";
  }
  if (text.includes("translate")) {
    return "Send the text and target language. I can translate it in a clean, natural style.";
  }
  if (text.includes("email")) {
    return "Tell me the purpose, recipient, tone, and key points. I will draft a clear professional email.";
  }
  if (text.includes("business")) {
    return "Tell me your idea, budget, target customers, and city. I will create a simple business plan with pricing, marketing, and first 7 steps.";
  }
  if (text.includes("resume")) {
    return "Start with a one-page resume. Add a strong summary, skills section, 2-3 projects, education, and measurable impact. Use keywords from the job description.";
  }
  if (text.includes("interview")) {
    return "Prepare 5 stories: your best project, hardest problem, teamwork example, learning example, and why you want the role. Answer with the STAR method.";
  }
  if (text.includes("project")) {
    return "Build one practical project related to your target role. For web roles, create a responsive app with login, API data, database flow, and GitHub README.";
  }
  if (text.includes("roadmap") || text.includes("next")) {
    return "For the next 7 days: polish resume, update LinkedIn, complete one mini project, apply to 20 roles, send 5 referral messages, and practice one mock interview.";
  }
  return "I can help with general questions, study, code, writing, translation, emails, prompts, business ideas, and career planning. Tell me what you want to create or solve.";
}

async function askGemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  if (!response.ok) throw new Error(`Gemini error ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

function saveSubscription(db, user, body, status = "demo_success", provider = "Razorpay demo", paymentId = "") {
  user.plan = body.plan || "Pro";
  db.payments.push({
    id: crypto.randomUUID(),
    userId: user.id,
    plan: user.plan,
    amount: body.amount || 0,
    provider,
    method: body.paymentMethod || "UPI",
    mobile: body.mobile || "",
    couponCode: body.couponCode || "",
    paymentId,
    status,
    createdAt: new Date().toISOString()
  });
  db.subscriptions.push({
    id: crypto.randomUUID(),
    userId: user.id,
    plan: user.plan,
    status: status === "paid_success" ? "active_paid" : "active_demo",
    createdAt: new Date().toISOString()
  });
}

async function createRazorpayOrder(amount, receipt) {
  const credentials = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: Number(amount) * 100,
      currency: "INR",
      receipt
    })
  });
  if (!response.ok) throw new Error(`Razorpay order failed: ${response.status}`);
  return response.json();
}

async function handleApi(req, res) {
  const db = readDb();
  const body = await parseBody(req);

  if (req.url === "/api/register") {
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    if (!email || !password) return send(res, 400, { error: "Email and password required" });
    if (db.users.some(user => user.email === email)) return send(res, 409, { error: "User already exists" });
    const user = { id: crypto.randomUUID(), name: name || email.split("@")[0], email, plan: "Free", createdAt: new Date().toISOString(), passwordHash: hashPassword(password) };
    db.users.push(user);
    const token = crypto.randomBytes(24).toString("hex");
    db.sessions[token] = user.id;
    writeDb(db);
    return send(res, 201, { token, user: publicUser(user) });
  }

  if (req.url === "/api/login") {
    const email = String(body.email || "").trim().toLowerCase();
    const user = db.users.find(item => item.email === email);
    if (!user || !verifyPassword(String(body.password || ""), user.passwordHash)) return send(res, 401, { error: "Invalid login" });
    const token = crypto.randomBytes(24).toString("hex");
    db.sessions[token] = user.id;
    writeDb(db);
    return send(res, 200, { token, user: publicUser(user) });
  }

  const user = getUser(req, db);
  if (!user) return send(res, 401, { error: "Please login first" });

  if (req.url === "/api/analyze-resume") {
    const resumeText = String(body.resumeText || "");
    const jobRole = String(body.jobRole || "Software Developer");
    const analysis = fallbackResumeAnalysis(resumeText, jobRole);
    const ai = await askGemini(`Analyze this resume for ATS. Return concise JSON-like sections: atsScore, missingSkills, strengths, suggestions, optimizedSummary. Role: ${jobRole}\nResume:\n${resumeText}`).catch(() => null);
    if (ai) analysis.aiText = ai;
    db.resumes.push({ id: crypto.randomUUID(), userId: user.id, jobRole, atsScore: analysis.atsScore, createdAt: new Date().toISOString(), resumeText: resumeText.slice(0, 20000), analysis });
    writeDb(db);
    return send(res, 200, analysis);
  }

  if (req.url === "/api/cover-letter") {
    const prompt = `Write a professional Indian job market cover letter. Name: ${body.name}. Role: ${body.role}. Company: ${body.company}. Skills: ${body.skills}. Keep it concise.`;
    const ai = await askGemini(prompt).catch(() => null);
    return send(res, 200, { letter: ai || fallbackCoverLetter(body) });
  }

  if (req.url === "/api/interview") {
    const questions = fallbackInterview(body.role, body.level);
    const ai = await askGemini(`Generate 8 interview questions with short answer tips for ${body.level || "fresher"} ${body.role || "software developer"}.`).catch(() => null);
    db.interview_history.push({ id: crypto.randomUUID(), userId: user.id, role: body.role || "", level: body.level || "", createdAt: new Date().toISOString() });
    writeDb(db);
    return send(res, 200, { questions, aiText: ai });
  }

  if (req.url === "/api/chat") {
    const message = String(body.message || "");
    const mode = String(body.mode || "General Assistant");
    const style = String(body.style || "Simple");
    const history = Array.isArray(body.history) ? body.history.slice(-8).join("\n") : "";
    const prompt = `You are AstraMind AI, a helpful all-in-one AI assistant. Mode: ${mode}. Response style: ${style}. Help with general questions, coding, study, content writing, translation, emails, business ideas, prompts and career planning. Give clear, useful answers. Do not mention that you are Gemini. User message: ${message}\nRecent chat:\n${history}`;
    const ai = await askGemini(prompt).catch(() => null);
    return send(res, 200, { reply: ai || fallbackChatReply(message) });
  }

  if (req.url === "/api/create-order") {
    const amount = Number(body.amount || 0);
    if (!amount || amount <= 0 || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      saveSubscription(db, user, body);
      writeDb(db);
      return send(res, 200, {
        mode: "demo",
        user: publicUser(user),
        message: "Demo payment saved. Add Razorpay keys for live checkout."
      });
    }

    const order = await createRazorpayOrder(amount, `careerai_${Date.now()}`);
    return send(res, 200, {
      mode: "live",
      key: RAZORPAY_KEY_ID,
      order,
      user: publicUser(user)
    });
  }

  if (req.url === "/api/verify-payment") {
    if (!RAZORPAY_KEY_SECRET) return send(res, 400, { error: "Razorpay secret not configured" });
    const expected = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
      .digest("hex");
    if (expected !== body.razorpay_signature) return send(res, 400, { error: "Payment verification failed" });

    saveSubscription(db, user, body, "paid_success", "Razorpay", body.razorpay_payment_id);
    writeDb(db);
    return send(res, 200, {
      user: publicUser(user),
      message: "Payment successful. Subscription activated."
    });
  }

  if (req.url === "/api/subscribe") {
    saveSubscription(db, user, body);
    writeDb(db);
    return send(res, 200, { user: publicUser(user), message: "Demo payment saved. Add Razorpay keys for live payments." });
  }

  send(res, 404, { error: "API not found" });
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.url.startsWith("/api/")) {
    handleApi(req, res).catch(error => send(res, 500, { error: error.message || "Server error" }));
    return;
  }

  const requested = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.normalize(path.join(ROOT, requested));
  if (!filePath.startsWith(ROOT)) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(filePath, (error, content) => {
    if (error) return send(res, 404, "Not found", "text/plain");
    send(res, 200, content, mime[path.extname(filePath)] || "application/octet-stream");
  });
});

server.listen(PORT, () => {
  ensureDb();
  console.log(`AstraMind AI running at http://localhost:${PORT}`);
  console.log(GEMINI_API_KEY ? "Gemini AI: enabled" : "Gemini AI: fallback mode. Set GEMINI_API_KEY for real AI.");
  console.log(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET ? "Razorpay: live checkout enabled" : "Razorpay: demo mode. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for live payments.");
});
