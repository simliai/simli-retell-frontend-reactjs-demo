# Simli Retell Historical Characters Demo (React/Node.js)

This repository uses voice agents from [RetellAI](https://www.retellai.com) and video avatars from [Simli](https://www.simli.com). You will need an API key from both providers to run this demo.



## Video of the demo

[![Watch the video](https://img.youtube.com/vi/zpm_bCGtG6Y/maxresdefault.jpg)](https://www.youtube.com/watch?v=zpm_bCGtG6Y)



## Run this Demo

### Step 1: Create .env file in the root directory
```bash
REACT_APP_SIMLI_KEY="YOUR-SIMLI-API-KEY"
REACT_APP_RETELL_KEY="YOUR-RETELL-API-KEY"
```

### Step 2: Update `agentID`, and possibly the `FaceID` in the `characters.json` file
```json
{
  "id": "cleopatra",
  "name": "Cleopatra",
  "agentId": "INSERT_AGENT_ID_HERE",
  "faceId": "3dafda97-4bd6-4948-9404-5fa63c155b58",
  "image": "/characters/Cleo_SR.jpg"
}
```
> Note: We do not yet expose an endpoint for you to easily create new characters using Simli. You can find the existing characters we support here [FaceIds](https://docs.simli.com/api-reference/endpoint/getPossibleFaceIDs). If you want to add a new character, please create an issue. We'd love to add the characters that you want to interact with.

### Step 3: Install dependencies
```bash
npm install
```

### Step 4: Start the development server
```bash
npm start
```

### Step 5: Open a new terminal and run the server
```bash
node server.js
```

### Optional
If you want to enrich the historical characters with actual historical context, we have made a repository that leverages RAG to power the responses from the Retell voice agent. You can do so by cloning this repository [retell-custom-llm-python-demo](https://github.com/simliai/retell-custom-llm-python-demo.git) and following the readme.
