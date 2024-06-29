import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import { RetellWebClient } from "simli-retell-client-js-sdk";
import SimliFaceStream from "./SimliFaceStream/SimliFaceStream";

// Retell agent ID
// You can get your agent ID from the Retell dashboard: https://beta.retellai.com/dashboard
const agentId = "8ab026b77c2aa86b74888cffeb48cd7f";

// Simli face ID
// Get all the available face IDs: https://docs.simli.com/api-reference/endpoint/getPossibleFaceIDs
const faceId = "f8e6af3a-8b97-496b-8d90-1e3addecc41b"; 

interface RegisterCallResponse {
  callId?: string;  
  sampleRate: number;
}

const webClient = new RetellWebClient();

const App = () => {
  const [isCalling, setIsCalling] = useState(false);
  const [minimumChunkSize, setMinimumChunkSize] = useState(15);
  const [simliSessionToken, setSimliSessionToken] = useState(null);
  const simliFaceStreamRef = useRef(null);

  useEffect(() => {
    webClient.on("audio", (audio: Uint8Array) => {
      if (simliFaceStreamRef.current) {
        simliFaceStreamRef.current.sendAudioDataToLipsync(audio);
      }
    });

    webClient.on("conversationStarted", () =>
      console.log("conversationStarted")
    );
    webClient.on("conversationEnded", ({ code, reason }) => {
      console.log("Closed with code:", code, ", reason:", reason);
      setIsCalling(false);
    });
    webClient.on("error", (error) => {
      console.error("An error occurred:", error);
      setIsCalling(false);
    });
    webClient.on("update", (update) => console.log("update", update));
  }, []);

  const toggleConversation = async () => {
    if (isCalling) {
      webClient.stopConversation();
    } else {
      const simliSessionResponse = await startAudioToVideoSession(faceId);
      setSimliSessionToken(simliSessionResponse.session_token);
      console.log("Simli session token", simliSessionResponse.session_token);

      const registerCallResponse = await registerCall(agentId);
      if (registerCallResponse.callId) {
        webClient
          .startConversation({
            callId: registerCallResponse.callId,
            sampleRate: registerCallResponse.sampleRate,
            enableUpdate: true,
          })
          .catch(console.error);
        setIsCalling(true);
      }
    }
  };

  async function registerCall(agentId: string): Promise<RegisterCallResponse> {
    try {
      const response = await fetch(
        "http://localhost:8088/register-call-on-your-server",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ agentId }),
        }
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  const startAudioToVideoSession = async (
    faceId: string,
    isJPG: Boolean = true,
    syncAudio: Boolean = true
  ) => {
    const metadata = {
      faceId: faceId,
      isJPG: isJPG,
      apiKey: process.env.REACT_APP_SIMLI_KEY,
      syncAudio: syncAudio,
    };

    const response = await fetch(
      "https://api.simli.ai/startAudioToVideoSession",
      {
        method: "POST",
        body: JSON.stringify(metadata),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response.json();
  };

  return (
    <div className="App">
      <header className="App-header">
        <SimliFaceStream
          ref={simliFaceStreamRef}
          start={isCalling}
          sessionToken={simliSessionToken}
          minimumChunkSize={minimumChunkSize}
        />
        <br />
        <button onClick={toggleConversation}>
          {isCalling ? "Stop" : "Start"}
        </button>
      </header>
    </div>
  );
};

export default App;
