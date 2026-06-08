const state = {
  token: localStorage.getItem("careerai_token") || "",
  user: JSON.parse(localStorage.getItem("careerai_user") || "null")
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const jobRoles = [
  "Software Developer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "React Developer",
  "Node.js Developer",
  "Python Developer",
  "Java Developer",
  "Android Developer",
  "Flutter Developer",
  "UI/UX Designer",
  "Graphic Designer",
  "Data Analyst",
  "Data Scientist",
  "Machine Learning Engineer",
  "AI Engineer",
  "DevOps Engineer",
  "Cloud Engineer",
  "Cybersecurity Analyst",
  "Network Engineer",
  "Database Administrator",
  "QA Tester",
  "Automation Tester",
  "Business Analyst",
  "Digital Marketing Executive",
  "SEO Executive",
  "Content Writer",
  "HR Executive",
  "Accountant",
  "Sales Executive",
  "Customer Support Executive",
  "Operations Executive",
  "Project Coordinator",
  "Product Manager",
  "Teacher",
  "Banking Associate",
  "Civil Engineer",
  "Mechanical Engineer",
  "Electrical Engineer",
  "Electronics Engineer"
];

const educationStreams = [
  "10th Pass",
  "12th Arts",
  "12th Commerce",
  "12th Science",
  "ITI",
  "Diploma Computer Engineering",
  "Diploma Mechanical Engineering",
  "Diploma Civil Engineering",
  "Diploma Electrical Engineering",
  "BCA",
  "BBA",
  "BCom",
  "BA",
  "BSc Computer Science",
  "BSc IT",
  "BSc Data Science",
  "BTech Computer Science",
  "BTech IT",
  "BTech AI & Data Science",
  "BTech Electronics",
  "BTech Mechanical",
  "BTech Civil",
  "BTech Electrical",
  "MCA",
  "MBA",
  "MCom",
  "MA",
  "MSc Computer Science",
  "MSc IT",
  "MTech",
  "Pharmacy",
  "Nursing",
  "Hotel Management",
  "Other"
];

const educationStatus = [
  "Completed",
  "Final Year",
  "Third Year",
  "Second Year",
  "First Year",
  "Pursuing",
  "Dropout",
  "Certification Only"
];

function fillSelect(selector, options, defaultValue) {
  const select = $(selector);
  if (!select) return;
  select.innerHTML = options.map(option => `<option value="${option}">${option}</option>`).join("");
  if (defaultValue) select.value = defaultValue;
}

function setupDropdowns() {
  ["#jobRole", "#rbRole", "#clRole", "#intRole", "#dnaRole"].forEach(selector => fillSelect(selector, jobRoles, "Software Developer"));
  ["#analysisEducation", "#rbEducationStream", "#clEducation", "#intEducation", "#dnaEducation"].forEach(selector => fillSelect(selector, educationStreams, "BCA"));
  fillSelect("#rbEducationStatus", educationStatus, "Completed");
}

function setView(id) {
  const publicViews = ["home", "auth", "roadmap", "plans"];
  if (!state.token && !publicViews.includes(id)) id = "auth";
  $$(".view").forEach(view => view.classList.toggle("active", view.id === id));
  $$("[data-nav]").forEach(btn => btn.classList.toggle("active", btn.dataset.nav === id));
}

function setUser(data) {
  state.token = data.token || state.token;
  state.user = data.user || state.user;
  localStorage.setItem("careerai_token", state.token);
  localStorage.setItem("careerai_user", JSON.stringify(state.user));
  $("#planBadge").textContent = state.user?.plan || "Free";
}

async function api(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${state.token}`
    },
    body: JSON.stringify(payload || {})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function showError(error) {
  alert(error.message || error);
}

$$("[data-nav]").forEach(item => item.addEventListener("click", () => setView(item.dataset.nav)));

$("#registerBtn").addEventListener("click", async () => {
  try {
    const data = await api("/api/register", {
      name: $("#name").value,
      email: $("#email").value,
      password: $("#password").value
    });
    setUser(data);
    setView("home");
  } catch (error) {
    showError(error);
  }
});

$("#loginBtn").addEventListener("click", async () => {
  try {
    const data = await api("/api/login", {
      email: $("#email").value,
      password: $("#password").value
    });
    setUser(data);
    setView("home");
  } catch (error) {
    showError(error);
  }
});

$("#logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("careerai_token");
  localStorage.removeItem("careerai_user");
  state.token = "";
  state.user = null;
  setView("auth");
});

$("#resumeFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.type === "application/pdf" || file.name.endsWith(".docx")) {
    $("#resumeText").value = `File selected: ${file.name}\n\nBrowser direct PDF/DOCX extraction is not enabled in this MVP. Please paste resume text here for analysis.`;
    return;
  }
  $("#resumeText").value = await file.text();
});

$("#analyzeBtn").addEventListener("click", async () => {
  const result = $("#analysisResult");
  result.innerHTML = "Analyzing...";
  try {
    const data = await api("/api/analyze-resume", {
      jobRole: `${$("#jobRole").value} - ${$("#analysisEducation").value}`,
      resumeText: $("#resumeText").value
    });
    $("#heroScore").textContent = data.atsScore;
    result.innerHTML = `
      <div class="score" style="--score:${data.atsScore}">${data.atsScore}</div>
      <h3>${data.match}</h3>
      <p>${data.optimizedSummary}</p>
      <h4>Strengths</h4>
      <div class="chips">${(data.strengths || []).map(x => `<span class="chip">${x}</span>`).join("")}</div>
      <h4>Missing Skills</h4>
      <div class="chips">${(data.missingSkills || []).map(x => `<span class="chip">${x}</span>`).join("")}</div>
      <h4>Suggestions</h4>
      <ul>${(data.suggestions || []).map(x => `<li>${x}</li>`).join("")}</ul>
      ${data.aiText ? `<h4>Gemini AI Output</h4><pre class="output">${data.aiText}</pre>` : ""}
    `;
  } catch (error) {
    result.innerHTML = "";
    showError(error);
  }
});

$("#buildResumeBtn").addEventListener("click", () => {
  const selectedRole = $("#rbRole").value || "Target Role";
  const educationLine = [
    $("#rbEducationStream").value,
    $("#rbEducationStatus").value,
    $("#rbCollege").value
  ].filter(Boolean).join(" - ");

  $("#resumePreview").innerHTML = `
    <h2>${$("#rbName").value || "Your Name"}</h2>
    <p><strong>${selectedRole}</strong></p>
    <h3>Professional Summary</h3>
    <p>Motivated ${selectedRole} with practical project experience, strong learning ability, and a focus on measurable outcomes.</p>
    <h3>Skills</h3>
    <p>${$("#rbSkills").value || "Add your skills here"}</p>
    <h3>Projects</h3>
    <p>${($("#rbProjects").value || "Add your projects here").replace(/\n/g, "<br>")}</p>
    <h3>Education</h3>
    <p>${educationLine || "Add education here"}</p>
  `;
});

$("#printResumeBtn").addEventListener("click", () => {
  if (!$("#resumePreview").innerHTML.trim()) $("#buildResumeBtn").click();
  window.print();
});

function skillPlan(role, skills) {
  const known = skills.toLowerCase();
  const map = {
    "Frontend": ["JavaScript ES6", "React hooks", "API integration", "responsive UI", "GitHub portfolio"],
    "Backend": ["Node.js", "REST API", "SQL database", "authentication", "deployment"],
    "Data": ["Excel", "SQL", "Python pandas", "Power BI", "case study portfolio"],
    "AI": ["Python", "prompt engineering", "machine learning basics", "Gemini/OpenAI API", "AI project demo"],
    "DevOps": ["Linux", "Docker", "CI/CD", "AWS basics", "monitoring"],
    "Marketing": ["SEO", "content plan", "Google Analytics", "Canva creatives", "campaign report"]
  };
  const group = Object.keys(map).find(key => role.includes(key)) || "Frontend";
  return map[group].filter(item => !known.includes(item.toLowerCase().split(" ")[0])).slice(0, 4);
}

function createCareerDna() {
  const name = $("#dnaName").value || "Your Name";
  const role = $("#dnaRole").value;
  const education = $("#dnaEducation").value;
  const level = $("#dnaLevel").value;
  const skills = $("#dnaSkills").value || "basic computer skills";
  const goal = $("#dnaGoal").value || "get job ready in 60 days";
  const gaps = skillPlan(role, skills);
  const dnaTitle = `${role} Launch Candidate`;
  const pitch = `Hi, I am ${name}, a ${education} ${level.toLowerCase()} preparing for ${role} roles. I know ${skills}. I am building practical projects and looking for internship/job opportunities. If your team has an opening or referral possibility, I would be grateful to connect.`;

  $("#dnaOutput").classList.add("active");
  $("#dnaOutput").dataset.pitch = pitch;
  $("#dnaOutput").innerHTML = `
    <div class="dna-hero">
      <div>
        <h3>${name}'s Career DNA</h3>
        <p><strong>${dnaTitle}</strong> - ${education} - ${level}</p>
        <p>Goal: ${goal}</p>
      </div>
      <div class="dna-badge">CAREER<br>DNA</div>
    </div>
    <div class="dna-grid">
      <div class="dna-panel">
        <h4>Best Positioning</h4>
        <p>Market yourself as a practical ${role} candidate with project proof, fast learning speed and clear communication.</p>
      </div>
      <div class="dna-panel">
        <h4>Skill Gap</h4>
        <div class="chips">${gaps.map(item => `<span class="chip">${item}</span>`).join("") || '<span class="chip">Portfolio polish</span>'}</div>
      </div>
      <div class="dna-panel">
        <h4>7-Day Action Plan</h4>
        <ol>
          <li>Day 1: Create a one-page resume.</li>
          <li>Day 2: Collect keywords from 2 job descriptions for ${role} roles.</li>
          <li>Day 3: Upload one mini project to GitHub.</li>
          <li>Day 4: Update your LinkedIn headline.</li>
          <li>Day 5: Apply to 20 companies.</li>
          <li>Day 6: Send 5 referral messages.</li>
          <li>Day 7: Practice one mock interview.</li>
        </ol>
      </div>
      <div class="dna-panel">
        <h4>LinkedIn Headline</h4>
        <p>${role} Aspirant | ${education} | Skills: ${skills} | Building real-world projects</p>
      </div>
      <div class="dna-panel full">
        <h4>Referral Message</h4>
        <p>${pitch}</p>
      </div>
    </div>
  `;
}

$("#dnaBtn").addEventListener("click", createCareerDna);

$("#copyDnaBtn").addEventListener("click", async () => {
  const pitch = $("#dnaOutput").dataset.pitch || "";
  if (!pitch) {
    createCareerDna();
    return;
  }
  await navigator.clipboard.writeText(pitch);
  alert("Career DNA referral pitch copied.");
});

$("#coverBtn").addEventListener("click", async () => {
  $("#coverOutput").textContent = "Generating...";
  try {
    const data = await api("/api/cover-letter", {
      name: $("#clName").value,
      company: $("#clCompany").value,
      role: `${$("#clRole").value} - ${$("#clEducation").value}`,
      skills: $("#clSkills").value
    });
    $("#coverOutput").textContent = data.letter;
  } catch (error) {
    $("#coverOutput").textContent = "";
    showError(error);
  }
});

$("#interviewBtn").addEventListener("click", async () => {
  const output = $("#interviewOutput");
  output.innerHTML = "Generating...";
  try {
    const data = await api("/api/interview", {
      role: `${$("#intRole").value} - ${$("#intEducation").value}`,
      level: $("#intLevel").value
    });
    output.innerHTML = data.aiText
      ? `<pre class="output">${data.aiText}</pre>`
      : data.questions.map((item, index) => `<h4>${index + 1}. ${item.question}</h4><p>${item.answerTip}</p>`).join("");
  } catch (error) {
    output.innerHTML = "";
    showError(error);
  }
});

$$("[data-plan]").forEach(button => {
  button.addEventListener("click", async () => {
    try {
      const data = await api("/api/subscribe", {
        plan: button.dataset.plan,
        amount: Number(button.dataset.amount),
        paymentMethod: $("#paymentMethod").value,
        mobile: $("#paymentMobile").value,
        couponCode: $("#couponCode").value
      });
      setUser({ user: data.user });
      alert(data.message);
    } catch (error) {
      showError(error);
    }
  });
});

setupDropdowns();
if (state.user) $("#planBadge").textContent = state.user.plan || "Free";
setView("home");
