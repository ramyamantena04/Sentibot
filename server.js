import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());


const HF_API_TOKEN = "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";

app.post("/sentiment", async (req, res) => {
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: req.body.text }),
      }
    );

    const data = await response.json();

    // 🔍 log what Hugging Face actually returns
    console.log("HF response:", data);

    if (response.ok) {
      res.json(data);
    } else {
      res.status(response.status).json(data);
    }
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(5000, () =>
  console.log("✅ Proxy running on http://localhost:5000")
);
