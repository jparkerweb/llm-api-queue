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

import { setupApiRoutes } from './api-routes.js';

const PORT = process.env.PORT || 3001; // Port for the Express Server to listen on
const LLM_SERVER_URL = process.env.LLM_SERVER_URL || 'http://localhost:8080';
const n_ctx = await fetchNCtxValue(); // Store n_ctx value from the LLM model.json endpoint
const CHUNK_TOKEN_SIZE = Math.floor(n_ctx / 10);
const CHUNK_TOKEN_OVERLAP = Math.max(Math.floor(CHUNK_TOKEN_SIZE / 10), 50);

const app = express();
const server = http.createServer(app);


// Middleware
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// Set up API routes
setupApiRoutes(app, CHUNK_TOKEN_SIZE, CHUNK_TOKEN_OVERLAP);


// Function to fetch n_ctx value from the LLM model.json endpoint
async function fetchNCtxValue() {
    try {
        const response = await fetch(`${LLM_SERVER_URL}/model.json`);
        if (!response.ok) {
            throw new Error(`Error fetching model.json: ${response.statusText}`);
        }
        const data = await response.json();
        return data.n_ctx;
    } catch (error) {
        console.error('Error fetching n_ctx value:', error);
        return 256;
    }
}


// Start the server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Redis dashboard running on http://localhost:${PORT}/admin/queues`);
    console.log(`Chroma dashboard running on http://localhost:${PORT}/list-collections`);
});