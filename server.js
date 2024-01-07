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
import bullmqPkg from 'bullmq';
const { Queue, Worker } = bullmqPkg;
import path from 'path';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { llama } from './llm-api-connector.js';
import { embedText } from './embedding.js';
import { 
    htmlListCollections, htmlDeleteCollections,
    htmlListCollection, htmlDeleteCollection
} from './admin-html-templates.js';
import {
    chromaHeartbeat, createCollection, deleteCollection, addToCollection, 
    listCollections, peekCollection, queryCollectionEmbeddings
} from './chroma.js';

const app = express();
const server = http.createServer(app);

// --------------------------------------------
// -- environment variables loaded from .env --
// --------------------------------------------
const PORT = process.env.PORT || 3001;
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 2;
const COMPLETED_JOB_CLEANUP_DELAY = parseInt(process.env.COMPLETED_JOB_CLEANUP_DELAY) || 1000 * 60 * 5;
const INACTIVE_THRESHOLD = parseInt(process.env.INACTIVE_THRESHOLD) || 1000 * 10;
const LLM_SERVER_URL = process.env.LLM_SERVER_URL || 'http://localhost:8080';

// store active clients by requestId
const ACTIVE_CLIENTS = new Map();
// store active collections by collectionName
const ACTIVE_COLLECTIONS = new Map();
// Store response streams by requestId
const responseStreams = new Map();
// Store n_ctx value from the LLM model.json endpoint
const n_ctx = await fetchNCtxValue();
const CHUNK_TOKEN_SIZE = Math.floor(n_ctx / 10);
const CHUNK_TOKEN_OVERLAP = Math.max(Math.floor(CHUNK_TOKEN_SIZE / 10), 50);
console.log(`n_ctx: ${n_ctx}, chunk token size: ${CHUNK_TOKEN_SIZE}, chunk token overlap: ${CHUNK_TOKEN_OVERLAP}`);


// Middleware
import { fileURLToPath } from 'url';
import { error } from 'console';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// Create a BullMQ queue
const llamaQueue = new Queue('llama-requests', { connection: {
    host: REDIS_HOST,
    port: REDIS_PORT
}});


// Set up Bull Board
const bullBoardAdapter = new BullMQAdapter(llamaQueue);
const serverAdapter = new ExpressAdapter();
createBullBoard({
    queues: [bullBoardAdapter],
    serverAdapter: serverAdapter,
});
serverAdapter.setBasePath('/admin/queues');
app.use('/admin/queues', serverAdapter.getRouter());


// Process queue with limited concurrent jobs
const worker = new Worker('llama-requests', async (job) => {
    // Check if the job was flagged as inactive
    if (job.data.clientNotActive) {
        console.log(`Skipping inactive job: ${job.id}`);
        // You can directly complete the job here or perform any cleanup needed
        return;
    }
    
    const { requestId } = job.data;
    const res = responseStreams.get(requestId);
    if (!res) return; // If response stream is not found, skip processing
    
    try {
        await streamLlamaData(job.data.fullPrompt, res, job); // Pass the entire job object
        responseStreams.delete(requestId); // Clean up after streaming
    } catch (error) {
        console.error('Error streaming data:', error);
        if (error.message.includes('slot unavailable')) {
            await handleSlotUnavailableError(job); // Pass the entire job object here
        }
    }
}, { 
    connection: {
        host: REDIS_HOST,
        port: REDIS_PORT
    },
    concurrency: MAX_CONCURRENT_REQUESTS
});


// Handle "slot unavailable" errors
async function handleSlotUnavailableError(job) {
    const jobId = job.id;
    console.warn('slot unavailable, retrying job:', jobId);
    try {
        await delay(2000); // Delay before retrying

        // Generate a new unique job ID for retry
        const retryJobId = `retry-${jobId}-${Date.now()}`;
        console.log('Retrying job with new ID:', retryJobId);

        // Re-add the job with the same data and the new job ID
        await job.remove(); // Remove the original job from the queue
        await llamaQueue.add('chat-retry', job.data, { jobId: retryJobId, delay: 2000 });
    } catch (retryError) {
        console.error('Error retrying job:', retryError, 'Original job ID:', jobId);
    }
}


// Stream LLaMA data to response
async function streamLlamaData(prompt, res, job) {
    try {
        let collectionName = job.opts.collectionName;
        let fullResponse = ''; // Store the full response in memory for embedding
        
        //TODO: add back short prompt
        // const shortPrompt = prompt.slice(0, 40); // short prompt for logging
        const shortPrompt = prompt;

        console.log(`→ → → starting response to: ${shortPrompt}...`);

        // Stream the data to the response
        for await (const chunk of llama(prompt)) {
            fullResponse += chunk.data.content; // Append the chunk to the full response
            res.write(`${chunk.data.content}`);
        }

        // Embed the full response
        const textChunksAndEmbeddings = await embedText(fullResponse, CHUNK_TOKEN_SIZE, CHUNK_TOKEN_OVERLAP).catch(console.error);

        for (const textChunksAndEmbedding of textChunksAndEmbeddings) {
            // add each chunk to the collection
            addToCollection(
                collectionName,
                generateGUID(),
                textChunksAndEmbedding.embedding,
                { source: "LLM", tokenCount: textChunksAndEmbedding.tokenCount, dateAdded: Date.now() },
                textChunksAndEmbedding.text,
            ).catch(error => {
                console.error('Error adding to collection:', error);
            });
        }

        ACTIVE_CLIENTS.delete(job.id); // Remove the client from the active list
        console.log(`← ← ← ended response to: ${shortPrompt}...`);
    } catch (error) {
        if (error.message.includes('slot unavailable')) {
            await handleSlotUnavailableError(job); // Use job here
        } else {
            console.error('Error streaming data:', error);
            res.end('Error streaming data');
        }
    } finally {
        if (!res.writableEnded) {
            res.end();
        }
    }
}


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


// Endpoint to get heartbeat interval
app.get('/heartbeat-interval', (req, res) => {
    res.json({ heartbeatInterval: INACTIVE_THRESHOLD / 2 });
});


// endpoint to delete all collections
app.get('/delete-collections', async (req, res) => {
    try {
        const collections = await listCollections();
        for (let collection of collections) {
            await deleteCollection(collection.name);
        }

        const html = await htmlDeleteCollections();
        res.send(html);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error deleting collections');
    }
});


// endpoint to delete all collections
app.get('/delete-collection', async (req, res) => {
    try {
        const collectionName = req.query.collectionName;
        await deleteCollection(collectionName);

        const html = await htmlDeleteCollection(collectionName);
        res.send(html);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error deleting collection');
    }
});


// Endpoint to list collections
app.get('/list-collections', async (req, res) => {
    try {
        const collections = await listCollections();
        const collectionsList = collections.map(collection => `<li><a href="/list-collection?collectionName=${collection.name}">📂 ${collection.name}</a></li>`).join('');
        const html = await htmlListCollections(collectionsList);

        res.send(html);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching collections');
    }
});


// Endpoint to list collections
app.get('/list-collection', async (req, res) => {
    try {
        const collectionName = req.query.collectionName;
        let collection = await peekCollection(collectionName, 100);
        let collectionListTableRows = "";

        // sort the collection by metadata.dateAdded
        if (collection && collection.ids.length > 0) {
            let ids = collection.ids;
            let metadatas = collection.metadatas;
            let documents = collection.documents;
            let sortedCollection = [];
            for (let i = 0; i < ids.length; i++) {
                sortedCollection.push({ id: ids[i], metadata: metadatas[i], document: documents[i] });
            }
            sortedCollection.sort((a, b) => (a.metadata.dateAdded > b.metadata.dateAdded) ? 1 : -1);
            collection.ids = sortedCollection.map(result => result.id);
            collection.metadatas = sortedCollection.map(result => result.metadata);
            collection.documents = sortedCollection.map(result => result.document);
        }

        // build the table rows
        for (let i = 0; i < collection.ids.length; i++) {
            const id = collection.ids[i];
            const source = collection.metadatas[i].source;
            const document = collection.documents[i] || "";
            const tokenCount = collection.metadatas[i].tokenCount;
            const dateAdded = new Date(collection.metadatas[i].dateAdded).toLocaleString();

            collectionListTableRows += `<tr><td>${id}</td><td>${source}</td><td>${document}</td><td>${tokenCount}</td><td>${dateAdded}</td></tr>`;
        }

        if (collectionListTableRows === "") {
            collectionListTableRows = "<tr><td colspan='5' style='text-align:center'>No documents in this collection</td></tr>";
        }

        const html = await htmlListCollection(collectionName, collectionListTableRows);

        res.send(html);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching collection');
    }
});


// Endpoint to generate a unique name to be used as a collection for chroma
app.get('/init-collection', (req, res) => {
    let collectionName = `chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    console.log(`collectionName: ${collectionName}`);
    try{
        createCollection(collectionName);
    } catch (error) {
        console.error('Error creating collection:', error);
    }
    // Initialize the entry for this client in Active Collections
    ACTIVE_COLLECTIONS.set(collectionName);
    // respose with the collection name
    res.json({ collectionName });
});


// Endpoint to handle chat messages
app.post('/chat', async (req, res) => {
    let { prompt, requestId, COLLECTION_NAME } = req.body;

    // Ensure prompt and requestId are strings
    prompt = String(prompt);
    requestId = String(requestId);
    const collectionName = String(COLLECTION_NAME);

    try {
        // setup prompt instructions
        const promptInstructions = process.env.LLM_PROMPT_INSTRUCTIONS
        
        // embed the prompt
        const textChunksAndEmbeddings = await embedText(prompt, CHUNK_TOKEN_SIZE, CHUNK_TOKEN_OVERLAP).catch(console.error);

        // query for similar text to send with the prompt
        let fullPrompt = prompt;
        let previousPrompts = "";
        let originalPrompt = prompt;
        let originalPromptEmbedding = textChunksAndEmbeddings[0].embedding;
        let prmoptSeperator = "\n\n";

        // query collection for similar text
        let maxResults = 10; // TODO: dynamically set limit based on prompt length and LLM token limit (will need to factor in hidden prompts as well)
        
        // query for similar text to send with the prompt
        const contextQueryResults = await queryCollectionEmbeddings(collectionName, originalPromptEmbedding, maxResults);
        
        // sort contextQueryResults by metadata.dateAdded
        if (contextQueryResults && contextQueryResults.ids[0].length > 0) {
            let ids = contextQueryResults.ids[0];
            let metadatas = contextQueryResults.metadatas[0];
            let documents = contextQueryResults.documents[0];
            let sortedContextQueryResults = [];
            for (let i = 0; i < ids.length; i++) {
                sortedContextQueryResults.push({ id: ids[i], metadata: metadatas[i], document: documents[i] });
            }
            sortedContextQueryResults.sort((a, b) => (a.metadata.dateAdded > b.metadata.dateAdded) ? 1 : -1);
            contextQueryResults.ids[0] = sortedContextQueryResults.map(result => result.id);
            contextQueryResults.metadatas[0] = sortedContextQueryResults.map(result => result.metadata);
            contextQueryResults.documents[0] = sortedContextQueryResults.map(result => result.document);
        }

        // add contextQueryResults to previousPrompts
        if (contextQueryResults && contextQueryResults.ids[0].length > 0) {
            for (let i = 0; i < contextQueryResults.ids[0].length; i++) {
                previousPrompts += `${prmoptSeperator}${contextQueryResults.metadatas[0][i].source}: ${contextQueryResults.documents[0][i]}`;
            }
        }

        // finalize fullPrompt
        if (previousPrompts !== "") {
            fullPrompt = `${promptInstructions}${previousPrompts}${prmoptSeperator}USER: ${originalPrompt}\nLLM:`;
        } else {
            fullPrompt = `${promptInstructions}${prmoptSeperator}USER: ${originalPrompt}\nLLM:`;
        }

        // add job to queue
        const job = await llamaQueue.add('chat', { fullPrompt, requestId }, { jobId: requestId, collectionName: collectionName });
        console.log('Added job with ID:', job.id); // Log the job ID

        let success = true;
        for (const textChunksAndEmbedding of textChunksAndEmbeddings) {
            // add each chunk to the collection
            addToCollection(
                collectionName,
                generateGUID(),
                textChunksAndEmbedding.embedding,
                { source: "USER", tokenCount: textChunksAndEmbedding.tokenCount, dateAdded: Date.now() },
                textChunksAndEmbedding.text,
            ).catch(error => {
                console.error('Error adding to collection:', error);
                success = false;
            });
        }

        if (success) {
            console.log(`Added ${textChunksAndEmbeddings.length} chunks to collection: ${collectionName}`);
            
            // Initialize the entry for this client in ACTIVE_CLIENTS
            ACTIVE_CLIENTS.set(requestId, null);

            // Store the response stream to be used when the job is processed
            responseStreams.set(requestId, res);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
        } else {
            console.error('Error adding job to queue because of addToCollection failures:', error);
            res.status(500).send('Error adding job to queue because of addToCollection failures');
        }
    } catch (error) {
        console.error('Error adding job to queue:', error);
        res.status(500).send('Error adding job to queue');
    }
});


// Endpoint to handle heartbeats
app.post('/heartbeat', (req, res) => {
    const { requestId } = req.body;

    if (requestId) {
        // Clear any existing timeout for this client
        const existingTimeout = ACTIVE_CLIENTS.get(requestId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set a new timeout for this client
        const timeoutId = setTimeout(() => {
            if (ACTIVE_CLIENTS.has(requestId)) { // Check if the client is still active
                ACTIVE_CLIENTS.delete(requestId);
                console.log(`Removed inactive client: ${requestId}`);
            }
        }, INACTIVE_THRESHOLD);

        // Store the new timeout ID
        ACTIVE_CLIENTS.set(requestId, timeoutId);
    }
    
    // console.log(`Heartbeat received for ${requestId}`);
    res.status(200).send(`Heartbeat received for ${requestId}`);
});


// Cleanup routine for inactive clients
setInterval(async () => {
    const queuedJobs = await llamaQueue.getJobs(['waiting']);

    for (let job of queuedJobs) {
        if (!ACTIVE_CLIENTS.has(job.data.requestId) && !job.data.clientNotActive) {
            // Add a flag to indicate that the client is not active
            job.data.clientNotActive = true;
            // await job.update(job.data);
            await job.remove(); // Remove the job from the queue
            console.log(`Flagged job as inactive: ${job.id}`);
        }
    }
}, INACTIVE_THRESHOLD);


// Cleanup routine for completed jobs
setInterval(async () => {
    const completedJobs = await llamaQueue.getJobs(['completed']);
    const timeDelay = Date.now() - COMPLETED_JOB_CLEANUP_DELAY;

    for (let job of completedJobs) {
        if (job.finishedOn && job.finishedOn < timeDelay) {
            await job.remove();
            console.log(`Removed completed job: ${job.id}`);
        }
    }
}, COMPLETED_JOB_CLEANUP_DELAY);

// generate GUID
function generateGUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// Start the server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Redis dashboard running on http://localhost:${PORT}/admin/queues`);
    console.log(`Chroma dashboard running on http://localhost:${PORT}/list-collections`);
});