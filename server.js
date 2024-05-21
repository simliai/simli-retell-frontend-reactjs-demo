const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');  // Import CORS module
const Retell = require('retell-sdk');
const fetch = require('node-fetch');  // Import node-fetch for making HTTP requests

const app = express();
const port = 8080;

app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json());

const retell = new Retell({ apiKey: "85f051b8-bd16-4f6d-9b59-20ae60c2f67a" });

app.post('/register-call-on-your-server', async (req, res) => {
  try {
    const agentId = req.body.agentId;
    const registerCallResponse = await retell.call.register({
      agent_id: agentId,
      audio_encoding: 's16le',
      audio_websocket_protocol: 'web',
      sample_rate: 16000,
      end_call_after_silence_ms: 20000,
    });

    res.json({
      callId: registerCallResponse.call_id,
      sampleRate: 16000,
    });
  } catch (error) {
    console.error("Failed to register call:", error);
    res.status(500).json({ error: "Failed to register call" });
  }
});

// New endpoint to proxy requests to the external API
app.post('/startAudioToVideoSession', async (req, res) => {
  try {
    const response = await fetch("https://api.simli.ai/startAudioToVideoSession", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body), // Forward the body from the request
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Failed to start audio to video session:", error);
    res.status(500).json({ error: "Failed to start audio to video session" });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
