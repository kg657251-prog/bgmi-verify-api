const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/verify', async (req, res) => {
    const { playerId } = req.body;

    if (!playerId) {
        return res.status(400).json({ error: "Player ID is required" });
    }

    // Validate format: 8-12 digit numeric string
    const trimmedId = playerId.trim();
    if (trimmedId.length < 8 || trimmedId.length > 12 || !/^\d+$/.test(trimmedId)) {
        return res.status(400).json({
            success: false,
            error: "Invalid Player ID format. Must be 8-12 digits."
        });
    }

    try {
        console.log(`Verifying Player ID: ${trimmedId}`);

        // Step 1: Get authorization token from rooter.gg
        const tokenResponse = await fetch("https://www.rooter.gg/", {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            redirect: "follow",
        });

        // Extract user_auth cookie
        let userAuthCookieValue = "";

        // Try getSetCookie() (Node 20+)
        try {
            const setCookies = tokenResponse.headers.getSetCookie?.();
            if (setCookies && Array.isArray(setCookies) && setCookies.length > 0) {
                for (const cookieStr of setCookies) {
                    const match = cookieStr.match(/^user_auth=([^;]+)/);
                    if (match) {
                        userAuthCookieValue = match[1];
                        break;
                    }
                }
            }
        } catch (e) {
            console.log("getSetCookie() not available, falling back");
        }

        // Fallback: extract from raw set-cookie header
        if (!userAuthCookieValue) {
            const rawCookie = tokenResponse.headers.get('set-cookie') || '';
            const authMatch = rawCookie.match(/user_auth=([^;]+)/);
            if (authMatch) {
                userAuthCookieValue = authMatch[1];
            }
        }

        if (!userAuthCookieValue) {
            console.error("No user_auth cookie found");
            return res.status(502).json({
                success: false,
                error: "Verification service temporarily unavailable (Cloudflare Block). Please try again."
            });
        }

        // Decode the cookie to extract accessToken
        let accessToken = "";
        try {
            const decoded = decodeURIComponent(userAuthCookieValue);
            const parsed = JSON.parse(decoded);
            accessToken = parsed.accessToken || "";
        } catch (e) {
            console.error("Failed to parse user_auth cookie.");
            return res.status(502).json({
                success: false,
                error: "Verification service temporarily unavailable."
            });
        }

        if (!accessToken) {
            return res.status(502).json({
                success: false,
                error: "Verification service temporarily unavailable."
            });
        }

        // Step 2: Query the BGMI username API
        const apiUrl = `https://bazaar.rooter.io/order/getUnipinUsername?gameCode=BGMI_IN&id=${trimmedId}`;

        const apiResponse = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Device-Type": "web",
                "App-Version": "1.0.0",
                "Device-Id": "web-verifier",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
            },
        });

        const responseText = await apiResponse.text();
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            return res.status(502).json({
                success: false,
                error: "Verification service returned invalid response."
            });
        }

        if (data.transaction === "SUCCESS" && data.unipinRes?.username) {
            return res.status(200).json({
                success: true,
                name: data.unipinRes.username,
                message: "ID Verified"
            });
        } else {
            return res.status(404).json({
                success: false,
                error: data.message || "Player not found. Please check your BGMI UID."
            });
        }

    } catch (error) {
        console.error("Verification error:", error?.message || error);
        return res.status(500).json({
            success: false,
            error: "Failed to verify player ID. Please try again later."
        });
    }
});

// Default Health Route
app.get('/', (req, res) => {
    res.status(200).json({ status: "API is active", service: "BGMI Verify" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});