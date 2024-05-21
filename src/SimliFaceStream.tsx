import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";

interface ImageFrame {
  frameWidth: number;
  frameHeight: number;
  imageData: Uint8Array;
}

interface props {
  start: boolean;
  minimumChunkSize?: number;
  faceId?: string;
}

const SimliFaceStream = forwardRef(
  ({ start, minimumChunkSize = 15, faceId = "tmp9i8bbq7c" }: props, ref) => {
    useImperativeHandle(ref, () => ({
      sendAudioDataToLipsync,
    }));
    SimliFaceStream.displayName = "SimliFaceStream";

    const ws = useRef<WebSocket | null>(null); 
    const startTime = useRef<any>();
    const executionTime = useRef<any>();
    const [chunkCollectionTime, setChunkCollectionTime] = useState<number>(0);
    const currentChunkSize = useRef<number>(0); 

    const startTimeFirstByte = useRef<any>(null);
    const timeTillFirstByte = useRef<any>(null);
    const [timeTillFirstByteState, setTimeTillFirstByteState] =
      useState<number>(0);

    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const audioQueue = useRef<Array<AudioBuffer>>([]); 
    const [audioQueueLengthState, setAudioQueueLengthState] =
      useState<number>(0); 
    const accumulatedAudioBuffer = useRef<Array<Uint8Array>>([]); 

    const audioConstant = 0.042; 
    const playbackDelay = minimumChunkSize * (1000 / 30); 

    const isQueuePlaying = useRef<boolean>(false); 
    const callCheckAndPlayFromQueueOnce = useRef<boolean>(true);
    const audioQueueEmpty = useRef<boolean>(false);

    const frameQueue = useRef<Array<Array<ImageFrame>>>([]); 
    const [frameQueueLengthState, setFrameQueueLengthState] =
      useState<number>(0); 
    const accumulatedFrameBuffer = useRef<Array<ImageFrame>>([]); 
    const currentFrameBuffer = useRef<Array<ImageFrame>>([]); 
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [videoContext, setVideoContext] =
      useState<CanvasRenderingContext2D | null>(null);
    const currentFrame = useRef(0);
    const fps = 30;
    const frameInterval = 30;

    useEffect(() => {
      const intervalId = setInterval(() => {
        if (audioQueueEmpty.current && !callCheckAndPlayFromQueueOnce.current) {
          playAudioQueue();
        }
      }, playbackDelay*2);

      return () => clearInterval(intervalId);
    }, [audioContext]);

    useEffect(() => {
      if (start === false) return;

      const newAudioContext = new AudioContext({ sampleRate: 16000 });
      setAudioContext(newAudioContext);

      const videoCanvas = canvasRef.current;
      if (videoCanvas) {
        setVideoContext(videoCanvas?.getContext("2d"));
      }
    }, [start]);

    const sendAudioDataToLipsync = (audioData: Uint8Array) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(audioData);
        startTimeFirstByte.current = performance.now(); 
      }
    };

    useEffect(() => {
      if (start === false) return;

      const startSession = async () => {
        const metadata = {
          faceId: faceId,
          isJPG: true,
          apiKey: "9gunxygzoyl8txw6wb3hfd"
        };

        const response = await fetch("http://localhost:8080/startAudioToVideoSession", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metadata),
        });

        const data = await response.json();
        const sessionToken = data.session_token;

        const ws_lipsync = new WebSocket("wss://api.simli.ai/LipsyncStream");
        ws_lipsync.binaryType = "arraybuffer";
        ws.current = ws_lipsync;

        ws_lipsync.onopen = () => {
          console.log("Connected to lipsync server");
          ws_lipsync.send(sessionToken);
        };

        ws_lipsync.onmessage = (event) => {
          timeTillFirstByte.current = performance.now() - startTimeFirstByte.current;
          setTimeTillFirstByteState(timeTillFirstByte.current);

          if (startTime.current === null) {
            startTime.current = performance.now();
          }

          processToVideoAudio(event.data);
          currentChunkSize.current += 1;

          return () => {
            if (ws.current) {
              console.error("Closing Lipsync WebSocket");
              ws.current.close();
            }
          };
        };

        return () => {
          console.error("Closing Lipsync WebSocket");
          ws_lipsync.close();
        };
      };

      startSession();

    }, [audioContext]);

    const processToVideoAudio = async (dataArrayBuffer: ArrayBuffer) => {
      let data = new Uint8Array(dataArrayBuffer);

      const endIndex = new DataView(data.buffer.slice(5, 9)).getUint32(0, true);

      const videoMessage = new TextDecoder().decode(data.slice(0, 5));

      const frameIndex = new DataView(
        data.buffer.slice(0 + 9, 4 + 9)
      ).getUint32(0, true);
      const frameWidth = new DataView(
        data.buffer.slice(4 + 9, 8 + 9)
      ).getUint32(0, true);
      const frameHeight = new DataView(
        data.buffer.slice(8 + 9, 12 + 9)
      ).getUint32(0, true);
      const imageData = data.subarray(12 + 9, endIndex + 9);

      const imageFrame: ImageFrame = { frameWidth, frameHeight, imageData };
      updateFrameQueue(imageFrame);
      setFrameQueueLengthState(frameQueue.current.length);

      const audioMessage = new TextDecoder().decode(
        data.slice(endIndex + 9, endIndex + 14)
      );

      const audioData = data.subarray(endIndex + 18);

      updateAudioQueue(audioData);
      setAudioQueueLengthState(audioQueue.current.length);

      console.log("Received chunk from Lipsync");
    };

    const playFrameQueue = async () => {
      const frame: ImageFrame[] | undefined = frameQueue.current.shift();
      if (frame !== undefined) {
        currentFrameBuffer.current = frame;
      }

      const drawFrame = async () => {
        if (currentFrame.current >= currentFrameBuffer.current.length) {
          currentFrame.current = 0;
          return;
        }

        const arrayBuffer =
          currentFrameBuffer.current[currentFrame.current].imageData;
        const width =
          currentFrameBuffer.current[currentFrame.current].frameWidth;
        const height =
          currentFrameBuffer.current[currentFrame.current].frameHeight;

        const blob = new Blob([arrayBuffer]); 
        const url = URL.createObjectURL(blob);

        const image = new Image();
        image.onload = () => {
          videoContext?.clearRect(0, 0, width, height);
          videoContext?.drawImage(image, 0, 0, width, height);
          URL.revokeObjectURL(url); 
        };
        image.src = url;

        currentFrame.current++;
        setTimeout(drawFrame, frameInterval); 
      };

      await drawFrame();
    };

    const updateFrameQueue = async (imageFrame: ImageFrame) => {
      if (currentChunkSize.current >= minimumChunkSize) {
        frameQueue.current.push(accumulatedFrameBuffer.current);
        accumulatedFrameBuffer.current = [];
      } else {
        accumulatedFrameBuffer.current.push(imageFrame);
      }
    };

    const updateAudioQueue = async (data: ArrayBuffer) => {
      if (currentChunkSize.current >= minimumChunkSize) {
        console.log(`|| QUEUE LENGTH: ${audioQueue.current.length} ||`);

        const accumulatedAudioBufferTotalByteLength =
          accumulatedAudioBuffer.current.reduce(
            (total, array) => total + array.byteLength,
            0
          );
        const concatenatedData = new Uint8Array(
          accumulatedAudioBufferTotalByteLength
        );
        let offset = 0;
        for (const array of accumulatedAudioBuffer.current) {
          concatenatedData.set(array, offset);
          offset += array.byteLength;
        }

        accumulatedAudioBuffer.current = [];

        const decodedAudioData = await createAudioBufferFromPCM16(
          concatenatedData
        );

        audioQueue.current.push(decodedAudioData);

        if (callCheckAndPlayFromQueueOnce.current) {
          console.log("Checking and playing from queue ONCE");
          callCheckAndPlayFromQueueOnce.current = false;
          playAudioQueue();
        }

        currentChunkSize.current = 0;
      } else {
        if (!accumulatedAudioBuffer.current) {
          accumulatedAudioBuffer.current = [new Uint8Array(data)];
        } else {
          accumulatedAudioBuffer.current.push(new Uint8Array(data));
        }
      }
    };

    async function createAudioBufferFromPCM16(
      input: Uint8Array
    ): Promise<AudioBuffer> {
      if (input.length % 2 !== 0) throw new Error("Input length must be even");

      const numSamples = input.length / 2;
      const audioBuffer = audioContext!.createBuffer(1, numSamples, 16000);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0, j = 0; i < input.length; i += 2, j++) {
        let int16 = (input[i + 1] << 8) | input[i];
        if (int16 >= 0x8000) int16 |= ~0xffff;
        channelData[j] = int16 / 32768.0;
      }

      return audioBuffer;
    }

    async function playAudioQueue(): Promise<number> {
      const audioBuffer = audioQueue.current.shift();
      if (!audioBuffer) {
        console.log("AudioBuffer is empty");
        audioQueueEmpty.current = true;
        return 0;
      } else {
        playFrameQueue();
      }
      const source = audioContext!.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext!.destination);

      executionTime.current = performance.now() - startTime.current;
      setChunkCollectionTime(executionTime.current);
      console.log(
        "Chunk collection time:",
        executionTime.current / 1000,
        "seconds"
      );
      startTime.current = null;
      executionTime.current = 0;

      source.start(0);

      console.log(
        `Playing audio: AudioDuration: ${audioBuffer!.duration.toFixed(2)}`
      );

      source.onended = () => {
        console.log("Audio ended");
        audioQueueEmpty.current = false;
        playAudioQueue();
      };

      return audioBuffer!.duration;
    }

    return <canvas ref={canvasRef} width="512" height="512"></canvas>;
  }
);

export default SimliFaceStream;
