import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import { RetellWebClient } from "simli-retell-client-js-sdk";
import SimliFaceStream from "./SimliFaceStream.tsx";

const agentId = "bca2843166dd248fd687beede0feb27d";

interface RegisterCallResponse {
  callId?: string;
  sampleRate: number;
}

const webClient = new RetellWebClient();

const App = () => {
  const [isCalling, setIsCalling] = useState(false);
  const [minimumChunkSize, setMinimumChunkSize] = useState(1);
  const simliFaceStreamRef = useRef(null);
  const lastAudioTimeRef = useRef(Date.now());

  // useEffect(() => {
  //   const sendSilentAudio = () => {
  //     const silence = new Uint8Array(256); // Adjust the size according to your needs
  //     simliFaceStreamRef.current?.sendAudioDataToLipsync(silence);
  //   };

  //   const intervalDelay = 33 * minimumChunkSize; // ms

  //   const intervalId = setInterval(() => {
  //     if (Date.now() - lastAudioTimeRef.current >= intervalDelay) {
  //       for (let i = 0; i < minimumChunkSize*2; i++) {
  //         sendSilentAudio();
  //       }
  //     }
  //   }, intervalDelay); // Check every x ms

  //   return () => clearInterval(intervalId); // Cleanup on unmount
  // }, []);

  useEffect(() => {
    webClient.on("audio", (audio: Uint8Array) => {
      console.log("There is audio");
      lastAudioTimeRef.current = Date.now();
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
        "http://localhost:8080/register-call-on-your-server",
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

  return (
    <div className="App">
      <header className="App-header">
        <SimliFaceStream
          ref={simliFaceStreamRef}
          start={isCalling}
          minimumChunkSize={minimumChunkSize}
        />
        <button onClick={toggleConversation}>
          {isCalling ? "Stop" : "Start"}
        </button>
      </header>
    </div>
  );
};

export default App;
