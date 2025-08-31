// script.js — Sentiment Explorer with Rule-based + AI Mode (via local proxy) + Quiz + Speech Fix

// ----- Word lists -----
const positiveWords = [
  "love","like","happy","great","best","amazing","awesome","fantastic","good","nice",
  "cool","fun","wonderful","joy","joyful","smile","excited","glad","yay","delighted"
];

const negativeWords = [
  "hate","bad","sad","angry","worst","terrible","boring","upset","mad","cry","crying",
  "hurt","sick","awful","lonely","scared","fear","annoyed","angst"
];

const amplifiers = ["very","extremely","super","really","so","totally","completely","absolutely"];
const diminishers = ["slightly","little","a bit","kinda","kind of","somewhat","barely"];
const negations = ["not","no","never","n't","cannot","can't","dont","don't","don’t","didn't","doesn't","isn't","wasn't","weren't"];

// emoji lists
const emojisPositive = ["😀","😃","😄","😊","😍","😂","😺","👍","🎉"];
const emojisNegative = ["😢","😞","😠","😡","😭","👎","😿","😤"];

// --- Hugging Face AI Mode (through local proxy) ---
async function analyzeWithAI(text) {
  try {
    const response = await fetch("http://localhost:5000/sentiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    return await response.json();
  } catch (err) {
    console.error("Proxy call failed:", err);
    return null;
  }
}

// --- Quiz pool ---
const quizPool = {
  positive: [
    "I love ice cream!","Today is an amazing day.","My dog is so cute.","I am very happy to see you.","We had a fantastic picnic!",
    "This game is awesome!","I am excited to go on vacation.","You are the best friend ever.","I feel wonderful today.","The party was so much fun!"
  ],
  negative: [
    "I hate getting sick.","This homework is terrible.","The movie was so boring.","I am very sad today.","That was the worst game ever.",
    "I am angry with my brother.","It feels awful outside.","I don't like this food.","I feel lonely tonight.","I am scared of the dark."
  ],
  neutral: [
    "I am going to school.","She has a red book.","The sun rises in the east.","I am walking to the park.","We are sitting in the classroom.",
    "The cat is on the roof.","I have two pencils.","We are learning math.","The sky is blue.","It is Monday today."
  ]
};

// DOM elements
const sentenceInput = document.getElementById("sentenceInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const botBubble = document.getElementById("botBubble");
const highlightedDiv = document.getElementById("highlighted");
const sentimentSummary = document.getElementById("sentimentSummary");
const confidenceFill = document.getElementById("confidenceFill");
const explainList = document.getElementById("explainList");
const quizList = document.getElementById("quizList");
const speechToggle = document.getElementById("speechToggle");

// tokenize helper (normalize curly quotes)
function tokenize(text) {
  const normalized = text.replace(/[’‘]/g, "'");
  const tokens = normalized.match(/[\w']+/g) || [];
  return tokens.map(t => t.toLowerCase());
}

// escape HTML
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}

// main analysis
function analyzeSentiment() {
  const raw = sentenceInput.value.trim();
  if (!raw) {
    botBubble.innerText = "Please type a sentence — try: I love pizza!";
    return;
  }

  const mode = document.querySelector('input[name="mode"]:checked').value;

  // 🔹 AI Mode
  if (mode === "ai") {
    botBubble.innerText = "🤖 Thinking with AI model...";
    analyzeWithAI(raw).then(result => {
      if (result && result[0]) {
        const label = result[0].label;
        const score = Math.round(result[0].score * 100);
        const emoji = label === "POSITIVE" ? "😊" : "😢";

        sentimentSummary.innerHTML = `${emoji} <strong>${label}</strong> — confidence: ${score}%`;
        botBubble.innerText = `${emoji} The AI thinks this is ${label} (${score}%)`;
        highlightedDiv.innerHTML = `<span class="token ${label.toLowerCase()}">${escapeHtml(raw)}</span>`;

        // ✅ Fixed speech
        if (speechToggle && speechToggle.checked) {
          try {
            window.speechSynthesis.cancel();
            const s = new SpeechSynthesisUtterance(`${label}, with ${score} percent confidence`);
            s.lang = "en-US";
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              s.voice = voices.find(v => v.lang.startsWith("en")) || voices[0];
            }
            window.speechSynthesis.speak(s);
          } catch (e) {
            console.error("Speech failed:", e);
          }
        }
      } else {
        botBubble.innerText = "⚠️ AI model could not analyze.";
      }
    }).catch(err => {
      console.error(err);
      botBubble.innerText = "⚠️ Error calling AI model.";
    });
    return; // stop here
  }

  // 🔹 Rule-based Mode
  const tokens = tokenize(raw);
  let matched = [];
  let score = 0;

  if (mode === "emoji" || mode === "both") {
    for (const e of emojisPositive) if (raw.includes(e)) { score++; matched.push({ token: e, type:"positive", index:-1 }); }
    for (const e of emojisNegative) if (raw.includes(e)) { score--; matched.push({ token: e, type:"negative", index:-1 }); }
  }

  if (mode === "keyword" || mode === "both") {
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (positiveWords.includes(tok) || negativeWords.includes(tok)) {
        let contribution = positiveWords.includes(tok) ? 1 : -1;
        let reason = "match";
        for (let j = Math.max(0,i-2); j<i; j++) {
          if (amplifiers.includes(tokens[j])) { contribution *= 1.6; reason+=" +amp"; }
          if (diminishers.includes(tokens[j])) { contribution *= 0.6; reason+=" +dim"; }
        }
        for (let j = Math.max(0,i-3); j<i; j++) {
          if (negations.includes(tokens[j])) { contribution *= -1; reason+=" (negated)"; }
        }
        score += contribution;
        matched.push({ token: tok, type: contribution>0?"positive":"negative", contribution, reason, index:i });
      }
    }
  }

  // label & confidence
  score = Math.round(score*10)/10;
  let label="Neutral", emoji="😐";
  if (score>=1.5){label="Very Positive";emoji="🤩";}
  else if(score>=0.5){label="Positive";emoji="😊";}
  else if(score<=-1.5){label="Very Negative";emoji="😱";}
  else if(score<=-0.5){label="Negative";emoji="😢";}
  const confidence=Math.min(100,Math.round(Math.abs(score)*40+8));

  confidenceFill.style.width=confidence+"%";
  confidenceFill.innerText=confidence+"%";

  sentimentSummary.innerHTML=`${emoji} <strong>${label}</strong> — score: ${score}`;
  botBubble.innerText=`${emoji} ${label} (${score}). Confidence: ${confidence}%`;

  // ✅ Fixed speech
  if (speechToggle && speechToggle.checked) {
    try {
      window.speechSynthesis.cancel();
      const s = new SpeechSynthesisUtterance(`${label}, with ${confidence} percent confidence`);
      s.lang = "en-US";
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        s.voice = voices.find(v => v.lang.startsWith("en")) || voices[0];
      }
      window.speechSynthesis.speak(s);
    } catch (e) {
      console.error("Speech failed:", e);
    }
  }

  // token highlight
  highlightedDiv.innerHTML = tokens.map(t=>{
    const found=matched.find(m=>m.token===t);
    return found?`<span class="token ${found.type}">${escapeHtml(t)}</span>`:`<span class="token neutral">${escapeHtml(t)}</span>`;
  }).join(" ");
}

// quiz functions
function getRandomQuizSet(){
  return [
    { text: quizPool.positive[Math.floor(Math.random()*quizPool.positive.length)], label:"positive"},
    { text: quizPool.negative[Math.floor(Math.random()*quizPool.negative.length)], label:"negative"},
    { text: quizPool.neutral[Math.floor(Math.random()*quizPool.neutral.length)], label:"neutral"}
  ];
}
function renderQuiz(){
  const quizSamples=getRandomQuizSet();
  quizList.innerHTML="";
  quizSamples.forEach((q,idx)=>{
    const item=document.createElement("div");
    item.className="quiz-item";
    item.innerHTML=`
      <div class="quiz-sentence">${escapeHtml(q.text)}</div>
      <div class="quiz-actions">
        <button data-idx="${idx}" data-choice="positive">😊</button>
        <button data-idx="${idx}" data-choice="neutral">😐</button>
        <button data-idx="${idx}" data-choice="negative">😢</button>
      </div>
      <div class="quiz-feedback" id="feedback-${idx}" style="min-width:130px;text-align:right"></div>
    `;
    quizList.appendChild(item);
  });

  quizList.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const idx=Number(btn.getAttribute("data-idx"));
      const choice=btn.getAttribute("data-choice");
      const text=quizSamples[idx].text;

      const original=sentenceInput.value;
      sentenceInput.value=text;
      document.querySelector('input[name="mode"][value="both"]').checked=true;
      analyzeSentiment();

      const predicted=sentimentSummary.innerText.toLowerCase().includes("positive")?"positive":
                      sentimentSummary.innerText.toLowerCase().includes("negative")?"negative":"neutral";
      const feedbackDiv=document.getElementById(`feedback-${idx}`);
      feedbackDiv.innerHTML=(predicted===choice)
        ? `<span style="color:green;font-weight:700">Correct ✅</span>`
        : `<span style="color:#b00020;font-weight:700">Oops ✖</span> Correct: <strong>${q.label}</strong>`;
      sentenceInput.value=original;
    });
  });
}

// events
analyzeBtn.addEventListener("click", analyzeSentiment);
sentenceInput.addEventListener("keydown", e=>{if(e.key==="Enter") analyzeSentiment();});

// init
renderQuiz();
window.analyzeSentiment = analyzeSentiment;
