import express from "express";
import { createClient } from "../src/index.js";

const app = express();
app.use(express.json());

const sdkClient = createClient({
  baseUrl: process.env.NEXUSID_BASE_URL ?? "https://iam.example.com"
});

app.get("/profile", async (req, res) => {
  try {
    const cookieHeader = req.headers.cookie;

    if (!cookieHeader) {
      return res.status(401).json({ error: "missing_session_cookie" });
    }

    // Recreate the client with the incoming session cookie for this request.
    const sessionClient = sdkClient.withAuth({
      type: "session",
      cookie: cookieHeader
    });

    const profile = await sessionClient.get("/api/portal/me");
    return res.status(200).json(profile);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "profile_fetch_failed" });
  }
});

app.listen(3000, () => {
  console.log("Express auth example listening on http://localhost:3000");
});
