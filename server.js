const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');  // Import CORS module
const Retell = require('retell-sdk');
require('dotenv').config();

const app = express();
const port = 8088;

app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json());

const retell = new Retell({apiKey:process.env.REACT_APP_RETELL_KEY});

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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});