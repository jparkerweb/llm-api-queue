// ===================
// == Queue Handler ==
// ===================
// This file contains the queue handler for LLaMA.
// It sets up the queue and the queue handler, and
// exports the queue for use in other files.


import { createClient } from 'redis';
import bullmqPkg from 'bullmq';
const { Queue, Worker } = bullmqPkg;
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { llama } from './llm-api-connector.js';
import { addToCollection, deleteFromCollection } from './chroma.js';
import { embedText } from './embedding.js';
import { generateGUID, delay } from './utils.js';

import dotenv from 'dotenv';
dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 2;
const COMPLETED_JOB_CLEANUP_DELAY = parseInt(process.env.COMPLETED_JOB_CLEANUP_DELAY) || 1000 * 60 * 5;


// -------------------------
// -- Heartbeat for Redis --
// -------------------------
export async function redisHeartbeat() {
    try {
        const redisClient = createClient({
            url: `redis://${REDIS_HOST}:${REDIS_PORT}`
        });
        await redisClient.connect();
        console.log('🎉 Redis Online');
        await redisClient.disconnect();
    } catch (error) {
        console.error(`❌ Redis Offline: ${error}`);
        process.exit(1); // Exit the process with an error code
    }
}


// ---------------------------
// -- Create a BullMQ queue --
// ---------------------------
const llamaQueue = new Queue('llama-requests', { connection: {
    host: REDIS_HOST,
    port: REDIS_PORT
}});


// ----------------------------------------------
// -- make the queue available by returning it --
// ----------------------------------------------
export function setupLlamaQueue() {
    return llamaQueue;
}


// --------------------------------------
// -- setup the queue handler routines --
// --------------------------------------
// This function sets up the queue handler routines
// (dashboard, queue processing, and cleanup)
export function setupQueueHandler(app, responseStreams, INACTIVE_THRESHOLD, ACTIVE_CLIENTS, CHUNK_TOKEN_SIZE, CHUNK_TOKEN_OVERLAP) {

    // -----------------------
    // -- Set up Bull Board --
    // -----------------------
    const bullBoardAdapter = new BullMQAdapter(llamaQueue);
    const serverAdapter = new ExpressAdapter();
    createBullBoard({
        queues: [bullBoardAdapter],
        serverAdapter: serverAdapter,
    });
    serverAdapter.setBasePath('/admin/queues');
    app.use('/admin/queues', serverAdapter.getRouter());


    // ------------------------------------------------
    // -- Process queue with limited concurrent jobs --
    // ------------------------------------------------
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
            await streamLlamaData(job.data.fullPrompt, res, job, ACTIVE_CLIENTS, CHUNK_TOKEN_SIZE, CHUNK_TOKEN_OVERLAP); // Pass the entire job object
            responseStreams.delete(requestId); // Clean up after streaming
        } catch (error) {
            console.error(`Error streaming data: ${job.id}`);
            // console.error('Error streaming data:', error);

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


    // ------------------------------------------
    // -- Cleanup routine for inactive clients --
    // ------------------------------------------
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


    // ----------------------------------------
    // -- Cleanup routine for completed jobs --
    // ----------------------------------------
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
}


// --------------------------------------
// -- Handle "slot unavailable" errors --
// --------------------------------------
async function handleSlotUnavailableError(job) {
    const jobId = job.id;
    console.warn('slot unavailable, retrying job:', jobId);
    try {
        await delay(2000); // Delay before retrying

        // Generate a new unique job ID for retry
        const retryJobId = `retry-${jobId}-${Date.now()}`;
        console.log('Retrying job with new ID:', retryJobId);

        // Remove the original job from the queue
        await job.remove()
            .catch(async error => {
                console.error(`Error removing job: ${job.id}`);
        });
        
        // remove failed job from Chroma
        await deleteFromCollection(job.opts.collectionName, job.opts.promptGUID);
        
        // Re-add the job with the same data and the new job ID
        await llamaQueue.add('chat-retry', job.data, { jobId: retryJobId, delay: 2000 });
    } catch (retryError) {
        console.error('Error retrying job:', retryError, 'Original job ID:', jobId);
    }
}


// -----------------------------------
// -- Stream LLaMA data to response --
// -----------------------------------
export async function streamLlamaData(prompt, res, job, ACTIVE_CLIENTS, CHUNK_TOKEN_SIZE, CHUNK_TOKEN_OVERLAP) {
    try {
        let collectionName = job.opts.collectionName;
        let fullResponse = ''; // Store the full response in memory for embedding
        
        //TODO: add back short prompt
        const shortPrompt = prompt;
        // const shortPrompt = prompt.slice(0, 40); // short prompt for logging

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