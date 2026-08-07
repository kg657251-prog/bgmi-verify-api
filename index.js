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

        // Call the RapidAPI BGMI endpoint
        const apiUrl = `https://id-game-checker.p.rapidapi.com/bgmi/${trimmedId}`;

        const apiResponse = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "x-rapidapi-host": "id-game-checker.p.rapidapi.com",
                "x-rapidapi-key": "b9172a8c93msh580d2723f591e4bp1b75a7jsnbe815744d293",
                "Content-Type": "application/json"
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

        if (data.status === 200 && data.data?.username) {
            return res.status(200).json({
                success: true,
                name: data.data.username,
                message: "ID Verified"
            });
        } else {
            return res.status(404).json({
                success: false,
                error: "Player not found. Please check your BGMI UID."
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
