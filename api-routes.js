// ================
// == API Routes ==
// ================
// This file contains the API routes for the chatbot.


import { generateGUID } from './utils.js';
import { embedText } from './embedding.js';
import { setupLlamaQueue, setupQueueHandler } from './queue-handler.js';
import {
    createCollection, deleteCollection, addToCollection, 
    listCollections, peekCollection, queryCollectionEmbeddings
} from './chroma.js';
import { 
    htmlListCollections, htmlDeleteCollections,
    htmlListCollection, htmlDeleteCollection
} from './admin-html-templates.js';

const INACTIVE_THRESHOLD = parseInt(process.env.INACTIVE_THRESHOLD) || 1000 * 10;   // threshold used to determine if a client is inactive
const ACTIVE_CLIENTS = new Map();                                                   // store active clients by requestId
const ACTIVE_COLLECTIONS = new Map();                                               // store active collections by collectionName
const responseStreams = new Map();                                                  // Store response streams by requestId


export function setupApiRoutes(app, CHUNK_TOKEN_SIZE, CHUNK_TOKEN_OVERLAP) {
    setupQueueHandler(app, responseStreams, INACTIVE_THRESHOLD, ACTIVE_CLIENTS, CHUNK_TOKEN_SIZE, CHUNK_TOKEN_OVERLAP);
    const llamaQueue = setupLlamaQueue();

    // ----------------------------------------
    // -- endpoint to get heartbeat interval --
    // ----------------------------------------
    // This endpoint is used by the client to determine how often to send heartbeats
    app.get('/heartbeat-interval', (req, res) => {
        res.json({ heartbeatInterval: INACTIVE_THRESHOLD / 2 });
    });


    // ----------------------------------------
    // -- endpoint to delete all collections --
    // ----------------------------------------
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


    // ------------------------------------------
    // -- endpoint to delete target collection --
    // ------------------------------------------
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


    // --------------------------------------
    // -- Endpoint to list all collections --
    // --------------------------------------
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


    // ----------------------------------------
    // -- Endpoint to list target collection --
    // ----------------------------------------
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


    // ------------------------------------------------------------------------------
    // -- Endpoint to generate a unique name to be used as a collection for chroma --
    // ------------------------------------------------------------------------------
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


    // --------------------------------------
    // -- Endpoint to handle chat messages --
    // --------------------------------------
    app.post('/chat', async (req, res) => {
        let { prompt, requestId, COLLECTION_NAME } = req.body;

        // Ensure prompt and requestId are strings
        prompt = String(prompt);
        requestId = String(requestId);
        const collectionName = String(COLLECTION_NAME);

        try {
            // generate a prompt GUID
            const promptGUID = generateGUID();
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
            const job = await llamaQueue.add('chat', { fullPrompt, requestId }, { jobId: requestId, collectionName: collectionName, promptGUID: promptGUID });
            console.log('Added job with ID:', job.id); // Log the job ID

            let success = true;
            for (const textChunksAndEmbedding of textChunksAndEmbeddings) {
                // add each chunk to the collection
                addToCollection(
                    collectionName,
                    promptGUID,
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


    // -----------------------------------
    // -- Endpoint to handle heartbeats --
    // -----------------------------------
    // This endpoint is used by the client to send heartbeats to the server.
    // Heartbeats are used to determine if a client is still active.
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
}