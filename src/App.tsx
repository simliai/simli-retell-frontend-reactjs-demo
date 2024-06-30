import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import { RetellWebClient } from "simli-retell-client-js-sdk";
import SimliFaceStream from "./SimliFaceStream/SimliFaceStream";

const webClient = new RetellWebClient();

const App = () => {
  const [isCalling, setIsCalling] = useState(false);
  const [minimumChunkSize, setMinimumChunkSize] = useState(15);
  const [simliSessionToken, setSimliSessionToken] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [topic, setTopic] = useState("");
  const simliFaceStreamRef = useRef(null);

  useEffect(() => {
    fetch('/characters.json')
      .then(response => response.json())
      .then(data => setCharacters(data))
      .catch(error => console.error("Error fetching characters:", error));

    webClient.on("audio", (audio) => {
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

  const changeCharacter = async (characterId, topic) => {
    try {
      const response = await fetch(`http://localhost:8080/change-character/${characterId}?topic=${encodeURIComponent(topic)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(data.message);
    } catch (error) {
      console.error("Error changing character:", error);
    }
  };

  const toggleConversation = async () => {
    if (!selectedCharacter) {
      alert("Please select a character first");
      return;
    }

    const { agentId, faceId, id } = selectedCharacter;

    if (!topic) {
      alert("Please enter a topic");
      return;
    }

    if (isCalling) {
      webClient.stopConversation();
    } else {
      await changeCharacter(id, topic);  // Change character on start
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

  async function registerCall(agentId) {
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
    faceId,
    isJPG = true,
    syncAudio = true
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
        <div className="character-selection">
          {characters.map((character) => (
            <div
              key={character.id}
              className={`character-card ${selectedCharacter?.id === character.id ? 'selected' : ''}`}
              onClick={() => setSelectedCharacter(character)}  // Just set selected character
            >
              <img src={character.image} alt={character.name} />
              <h3>{character.name}</h3>
            </div>
          ))}
        </div>
        <SimliFaceStream
          ref={simliFaceStreamRef}
          start={isCalling}
          sessionToken={simliSessionToken}
          minimumChunkSize={minimumChunkSize}
        />
        <br />
        <input
          type="text"
          placeholder={`What do you want to talk with ${selectedCharacter?.name} about?`}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="topic-input"
        />
        <button className="conversation-button" onClick={toggleConversation}>
          {isCalling ? "Stop" : "Start"}
        </button>
      </header>
    </div>
  );
};

export default App;
