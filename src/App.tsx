import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import { RetellWebClient } from "./simli-retell-client-js-sdk";

const agentId = "a3cfb6d7264592344634753c976bb05c";

interface RegisterCallResponse {
  callId?: string;
  sampleRate: number;
}

const webClient = new RetellWebClient();

const App = () => {
  const [isCalling, setIsCalling] = useState(false);
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameQueue = useRef([]);
  const audioQueue = useRef<Float32Array[]>([]);
  const audioContext = useRef(new AudioContext());
  const requestRef = useRef();
  const lastFrameTimeRef = useRef(performance.now());
  const audioStarted = useRef(false);
  const firstFrameReceived = useRef(false);
  const audioOriginal = useRef<Uint8Array[]>([]);
  const audioStreamed = useRef<Uint8Array[]>([]);

  const [updateMessage, setUpdateMessage] = useState("");

  const processFrameQueue = () => {
    const now = performance.now();
    const timeSinceLastFrame = now - lastFrameTimeRef.current;
    const msPerFrame = 1000 / 30; // Approximately 33.33 milliseconds per frame

    if (timeSinceLastFrame >= msPerFrame) {
      if (frameQueue.current.length > 0) {
        firstFrameReceived.current = true;
        const { frameWidth, frameHeight, imageData } =
          frameQueue.current.shift();
        const blob = new Blob([imageData], { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);

          // Check if audio has started or not
          // console.log("audioQueue.current.length", audioQueue.current.length);
          // console.log("frameQueue.current.length", frameQueue.current.length);
          // console.log("audioStarted.current", audioStarted.current);

          // if (!audioStarted.current && audioQueue.current.length > 0) {
          //   playAudioFromBuffer();
          //   audioStarted.current = true; // Set the flag to true after starting the audio
          // }
        };
        img.src = url;
        lastFrameTimeRef.current = now;
      }
    }
    requestRef.current = requestAnimationFrame(processFrameQueue);
  };

  // Convert Audio bytes
  const convertUint8ToFloat32 = (array: Uint8Array): Float32Array => {
    const targetArray = new Float32Array(array.byteLength / 2);
    const sourceDataView = new DataView(array.buffer);

    for (let i = 0; i < targetArray.length; i++) {
      targetArray[i] = sourceDataView.getInt16(i * 2, true) / 32768; // 2^15 = 32768
    }
    return targetArray;
  };

  // Play Audio from Buffer
  const playAudioFromBuffer = async () => {
    // Wait until the first frame has been received
    while (!firstFrameReceived.current) {
      await new Promise((resolve) => setTimeout(resolve, 1)); // Wait for 100 ms before checking again
    }

    // Begin or continue audio playback
    console.log("Audio Buffer Started");
    while (audioQueue.current.length > 0) {
      const segment = audioQueue.current.shift(); // Take the first available segment
      if(segment===undefined)
        {
          continue;
        }
      const audioBuffer = audioContext.current.createBuffer(
        1,
        segment.length,
        16000
      );
      audioBuffer.getChannelData(0).set(segment);

      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
      source.start();

      // Optional: Handle the end of playback to trigger additional actions
      source.onended = () => {
        console.log("Audio Segment Finished");
      };

      // Wait until this segment finishes before starting the next
      await new Promise((resolve) => (source.onended = resolve));
    }
  };

  useEffect(() => {
    webClient.on("conversationStarted", () => {
      console.log("conversationStarted");
      const ws = new WebSocket("ws://34.91.9.107:9090/StartCall");
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log("WebSocket connection established.");
        const metadata = {
          video_reference_url:
            "https://storage.googleapis.com/charactervideos/11c30c18-86c3-424e-bb29-9c6d1fd6003b/11c30c18-86c3-424e-bb29-9c6d1fd6003b.mp4",
          face_det_results:
            "https://storage.googleapis.com/charactervideos/11c30c18-86c3-424e-bb29-9c6d1fd6003b/11c30c18-86c3-424e-bb29-9c6d1fd6003b.pkl",
          isSuperResolution: true,
          isJPG: true,
        };
        ws.send(JSON.stringify(metadata));
        //send an array of 6000 zeros of uint8
        const data = new Uint8Array(32000);
        setWebSocket(ws);
        ws.send(data.buffer);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string" && event.data.startsWith("https://")) {
          console.log("Received message:", event.data);
          // open a new tab with the received URL
          window.open(event.data, "_blank");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed.");
        setWebSocket(null);
      };
    });

    webClient.on("audio", (audio: Uint8Array) => {
      console.log("Received audio data type:", audio.constructor.name); // Logs the type of the audio data

      // if values of audio are not silence then log that
      // if (audio.some((value) => value !== 128)) {
      //   console.log("audio", audio);
      // }
      // const audioData = convertUint8ToFloat32(audio);
      // audioQueue.current.push(audioData);
      // audioOriginal.current.push(audio);
      // if (!audioStarted.current && audioQueue.current.length > 0) {
      //     playAudioFromBuffer();
          // audioStarted.current = true;
      // }

      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(audio);
        if (audio.byteLength !== 256)
          console.log(audio.byteLength);
        // const audioData = convertUint8ToFloat32(audio);
        // audioQueue.current.push(audioData);
      } else {
        // console.log("WebSocket not ready or closed.");
      }
    });

    webClient.on("conversationEnded", ({ code, reason }) => {
      console.log("Closed with code:", code, ", reason:", reason);
      setIsCalling(false);
      webSocket?.close();
    });

    webClient.on("error", (error) => {
      console.error("An error occurred:", error);
      setIsCalling(false);
    });

    webClient.on("update", (update) => {
      setUpdateMessage(
        update.transcript[update.transcript.length - 1].role +
          ": " +
          update.transcript[update.transcript.length - 1].content
      );
      // console.log("update:", update);
    });

    requestRef.current = requestAnimationFrame(processFrameQueue);

    return () => {
      if (webSocket) {
        webSocket.close();
      }
      cancelAnimationFrame(requestRef.current);
    };
  }, [webSocket]);

  // Start Conversation
  const toggleConversation = async () => {
    if (isCalling) {
      webClient.stopConversation();
      setIsCalling(false);
      webSocket?.close();
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
      }
    }
  };

  // Start a retell call
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
      throw new Error(err.toString());
    }
  }

  // Play Audio Buffer
  const handlePlayButtonClick = () => {
    if (audioContext.current.state !== "running") {
      audioContext.current
        .resume()
        .then(() => {
          console.log("AudioContext resumed successfully");
          playAudioFromBuffer(); // Call the function to play audio after resuming context
        })
        .catch((error) => {
          console.error("Error resuming AudioContext:", error);
        });
    } else {
      playAudioFromBuffer();
      audioStarted.current = true;
      // If already running, play audio directly
    }
  };

  // Download
  function writeWAV(audioData, sampleRate) {
    const buffer = new ArrayBuffer(44 + audioData.length * 2);
    const view = new DataView(buffer);
    // Write WAV header (RIFF header)
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + audioData.length * 2, true);
    writeString(view, 8, "WAVE");
    // Write fmt subchunk
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 is PCM)
    view.setUint16(22, 1, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    // Write data subchunk
    writeString(view, 36, "data");
    view.setUint32(40, audioData.length * 2, true);
    // Write the audio data
    let offset = 44;
    for (let i = 0; i < audioData.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([view], { type: "audio/wav" });
    function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }
  }
  const handleDownloadAudio = () => {
    if (audioQueue.current.length > 0) {
      // First calculate the total length of even indexed segments
      let totalLength = 0;
      audioQueue.current.forEach((segment, index) => {
        if (index % 2 === 0) {
          // Only count even indexed segments
          totalLength += segment.length;
        }
      });
      const combinedData = new Float32Array(totalLength);
      let offset = 0;
      console.log("Queue Length:", audioQueue.current.length);
      audioQueue.current.forEach((segment, index) => {
        if (index % 2 === 0) {
          // Only process even indexed segments
          console.log(`Segment ${index}: Length = ${segment.length}`);
          combinedData.set(segment, offset);
          offset += segment.length;
        }
      });
      console.log("sample rate", audioContext.current.sampleRate);
      const blob = writeWAV(combinedData, 16000);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "output.wav";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  function handleDownloadAudioFiles() {  
    // Convert audio data arrays to strings
    const originalDataString = JSON.stringify(audioOriginal.current);
    const streamedDataString = JSON.stringify(audioStreamed.current);
  
    // Create Blob objects containing the data
    const originalBlob = new Blob([originalDataString], { type: 'text/plain' });
    const streamedBlob = new Blob([streamedDataString], { type: 'text/plain' });
  
    // Generate unique filenames based on timestamps
    const timestamp = Date.now();
    const originalFilename = `audio_original_${timestamp}.txt`;
    const streamedFilename = `audio_streamed_${timestamp}.txt`;
  
    // Create link elements to download the Blobs as files
    const originalLink = document.createElement('a');
    originalLink.href = URL.createObjectURL(originalBlob);
    originalLink.download = originalFilename;
  
    const streamedLink = document.createElement('a');
    streamedLink.href = URL.createObjectURL(streamedBlob);
    streamedLink.download = streamedFilename;
  
    // Simulate clicks to trigger the downloads
    originalLink.click();
    streamedLink.click();
  }

  return (
    <div className="App">
      <header className="App-header">
        <button onClick={toggleConversation}>
          {isCalling ? "Stop" : "Start"}
        </button>
        <button onClick={handlePlayButtonClick}>Play Audio</button>
        <button onClick={handleDownloadAudio}>Download Audio</button>
        <button onClick={handleDownloadAudioFiles}>Download Audio Files</button>
        <canvas
          ref={canvasRef}
          width="512"
          height="512"
          style={{ border: "1px solid black" }}
        ></canvas>
        <b>{}</b>
        <p>{updateMessage}</p>
      </header>
    </div>
  );
};

export default App;
