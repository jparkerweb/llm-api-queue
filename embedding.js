// ------------------------------------------------------------------
// -- Description: This file contains the code to                  -- 
// -- generate embeddings from text using transformers.js library. --
// ------------------------------------------------------------------
// example ⇢ embedText(`some text you want to embed`, 3, 1).catch(console.error);
//


import { env, pipeline, AutoTokenizer } from '@xenova/transformers';

env.localModelPath = 'models/';
env.allowRemoteModels = false;

// Function to create embeddings from text
export async function embedText(largeText, maxChunkTokenCount = 100, chunkOverlap = 10) {
    if (chunkOverlap >= maxChunkTokenCount) {
        chunkOverlap = maxChunkTokenCount - 1;
    }

    const textChunks = await chunkText(largeText, maxChunkTokenCount, chunkOverlap);
    let combinedResults = [];

    for (const textChunk of textChunks) {
        // console.log(`Processing chunk: ${textChunk}`);
        try {
            const text = textChunk.chunk;
            let embedding = await createEmbedding(textChunk.chunk);
            const tokenCount = textChunk.tokenCount;
            
            // Convert chunkEmbedding to a regular array if it's not already
            embedding = Array.isArray(embedding) ? embedding : Array.from(embedding);
            
            combinedResults.push({ text, embedding, tokenCount });
            // console.log(`text chunk: ${textChunk.chunk}`);
            // console.log(`toekn count: ${textChunk.tokenCount}`);
        } catch (error) {
            console.error('Error creating embedding:', error);
        }
    }

    return combinedResults;
}


// Function to chunk text into smaller pieces
async function chunkText(text, maxTokens, overlap) {
    const tokenizer = await AutoTokenizer.from_pretrained('all-MiniLM-L6-v2');

    console.log(`maxTokens: ${maxTokens}, overlap: ${overlap}`);
    const splitIntoSentences = (text) => text.match(/[^.!?]+[.!?]+/g) || [text];
    const sentences = splitIntoSentences(text);

    let chunks = [];
    let currentChunk = [];
    let currentTokenCount = 0;

    for (const sentence of sentences) {
        const { input_ids } = await tokenizer(sentence);
        const sentenceTokens = input_ids.data;
        const numTokensInSentence = input_ids.size;

        if (numTokensInSentence > maxTokens) {
            let start = 0;
            let end = maxTokens;
            while (start < numTokensInSentence) {
                const chunkTokens = sentenceTokens.slice(start, end);
                const chunk = chunkTokens.join(" ");
                chunks.push({ chunk, tokenCount: chunkTokens.length });
                start += maxTokens - overlap;
                end = Math.min(start + maxTokens, numTokensInSentence);
            }
            currentChunk = [];
            currentTokenCount = 0;
            continue;
        }

        if (currentTokenCount + numTokensInSentence > maxTokens) {
            chunks.push({ chunk: currentChunk.join(" "), tokenCount: currentTokenCount });
            currentChunk = [];
            currentTokenCount = 0;
        }

        currentChunk.push(sentence);
        currentTokenCount += numTokensInSentence;
    }

    if (currentChunk.length) {
        chunks.push({ chunk: currentChunk.join(" "), tokenCount: currentTokenCount });
    }

    return chunks;
}



// Create the embedding pipeline
const generateEmbedding = await pipeline('feature-extraction', 'all-MiniLM-L6-v2', {
    quantized: false,
});

// Function to generate embeddings
async function createEmbedding(text) {
    const embeddings = await generateEmbedding(text, {
        pooling: 'mean',
        normalize: true,
    });

    return embeddings.data;
}
