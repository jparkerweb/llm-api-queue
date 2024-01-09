// =============================
// == Server file for chatbot ==
// ============================= 
// This file contains the server code for the chatbot. It uses Express to handle
// HTTP requests and Bull to handle the queue. It also uses Bull Board to provide
// a dashboard for the queue. The chatbot uses the llama function from completion.js
// to generate text based on the prompt provided by the client.


import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import path from 'path';

import { chromaHeartbeat, testChormaMethods } from './chroma.js';
import { setupApiRoutes } from './api-routes.js';
import { redisHeartbeat } from './queue-handler.js';

const PORT = process.env.PORT || 3001; // Port for the Express Server to listen on
const LLM_SERVER_URL = process.env.LLM_SERVER_URL || 'http://localhost:8080';

console.log('\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n'); // Clears the console
// 🎉 Check if LLM server is running and store n_ctx value from the LLM model.json endpoint
const n_ctx = await fetchNCtxValue();
// 🎉 Check if Redis server is running
await redisHeartbeat();
// 🎉 Check if Chroma server is running
await chromaHeartbeat();
await testChormaMethods("test_collection");

// calculate chunk token size and overlap
const CHUNK_TOKEN_SIZE = Math.floor(n_ctx / 10);
const CHUNK_TOKEN_OVERLAP = Math.max(Math.floor(CHUNK_TOKEN_SIZE / 10), 50);


// ----------------
// -- Middleware --
// ----------------
// set up Express and HTTP server
const app = express();
const server = http.createServer(app);
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// -----------------------
// -- Set up API routes --
// -----------------------
// This function sets up the API routes for the server
setupApiRoutes(app, CHUNK_TOKEN_SIZE, CHUNK_TOKEN_OVERLAP);


// --------------------------------------------------------------------
// -- Function to fetch n_ctx value from the LLM model.json endpoint --
// --------------------------------------------------------------------
async function fetchNCtxValue() {
    try {
        const response = await fetch(`${LLM_SERVER_URL}/model.json`);
        if (!response.ok) {
            console.error(`❌ LLM Server Offline\nError fetching model.json: ${response.statusText}`);
            process.exit(1); // Exit the process with an error code
        } else {
            console.log('🎉 LLM Server Online');
        }
        const data = await response.json();
        return data.n_ctx;
    } catch (error) {
        console.error('❌ LLM Server Offline\nError fetching n_ctx value:', error);
        process.exit(1); // Exit the process with an error code
    }
}


// ----------------------
// -- Start the server --
// ----------------------
server.listen(PORT, () => {
    console.log('🎉 Express Server Online')
    console.log('\n↓↓')
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log(`🔬 Redis dashboard running on http://localhost:${PORT}/admin/queues`);
    console.log(`🍱 Chroma dashboard running on http://localhost:${PORT}/list-collections`);
});