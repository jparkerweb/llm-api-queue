// ==================================
// == Description: ChromaDB client ==
// ==================================

// -------------------------------------------------
// -- import environment variables from .env file --
// -------------------------------------------------
import dotenv from "dotenv";
dotenv.config();


// ------------------------
// -- load Chroma client --
// ------------------------
const CHROMA_SERVER_URL = process.env.CHROMA_SERVER_URL || "http://localhost:8001";
import { ChromaClient } from "chromadb";
const chromaClient = new ChromaClient({ path: CHROMA_SERVER_URL, });


// ---------------
// -- heartbeat --
// ---------------
// This function sends a heartbeat to the Chroma server to check if it is running.
export async function chromaHeartbeat() {
	const heartbeat = await chromaClient.heartbeat()
		.then((response) => {
			console.log("🎉 Chroma Vector Database Online: ", response);
		})
		.catch((error) => {
			console.error("❌ Chroma Vector Database Offline: ", error);
			process.exit(1); // exit with error
		});
}


// -----------------------
// -- create collection --
// -----------------------
export async function createCollection(collectionName) {
	console.log(`⇢ createCollection: ${collectionName}`);
	const collection = await chromaClient.getOrCreateCollection({
		name: collectionName,
		metadata: {
			description: "a collection of embeddings",
		},
	});
}


// -----------------------
// -- delete collection --
// -----------------------
export async function deleteCollection(collectionName) {
	console.log(`⇢ deleteCollection: ${collectionName}`);
	await chromaClient.deleteCollection({
		name: collectionName,
	});
}


// -----------------------
// -- add to collection --
// -----------------------
export async function addToCollection(
	collectionName,
	ids,
	embeddings,
	metadatas,
	documents
) {
	console.log(`⇢ addToCollection: ${collectionName}`);
	const collection = await chromaClient.getOrCreateCollection({
		name: collectionName,
	}).catch((error) => {
		console.error("Error getting collection: ", error);
		retrun;
	});

	console.log(`⇢ ⇢ embeddings length: ${embeddings.length}`);

	await collection.add({
		ids: ids,
		embeddings: embeddings,
		metadatas: metadatas,
		documents: documents,
	}).then((response) => {
		console.log("✔ Added to collection");
		// console.log(`embeddings: ${embeddings}`);
	}).catch((error) => {
		console.error("Error adding to collection: ", error);
	});
}


// --------------------------------------
// -- query collection with embeddings --
// --------------------------------------
export async function queryCollectionEmbeddings(
	collectionName,
	queryEmbeddings,
	nResults = 10
) {
	console.log(`⇢ queryCollectionEmbeddings: ${collectionName}`);
	const collection = await chromaClient.getCollection({
		name: collectionName,
	});
	const results = await collection.query({
		queryEmbeddings: queryEmbeddings,
		nResults: nResults,
		include: ["distances", "metadatas", "embeddings", "documents"],
	});
	return results;
}


// ----------------------------
// -- delete from collection --
// ----------------------------
export async function deleteFromCollection(collectionName, ids) {
	console.log(`⇢ deleteFromCollection: ${collectionName}`);
	console.log(`⇢ ⇢ ids: ${ids}`);
	const collection = await chromaClient.getCollection({
		name: collectionName,
	});
	await collection.delete({
		ids: ids,
	});
}


// ----------------------
// -- list collections --
// ----------------------
export async function listCollections() {
	console.log("⇢ listCollections");
	const collections = await chromaClient.listCollections();
	return collections;
}


// ----------------------------
// -- delete all collections --
// ----------------------------
export async function deleteAllCollections() {
	console.log("⇢ deleteAllCollections");
	const collections = await chromaClient.listCollections();

	for (const collection of collections) {
		await deleteCollection(collection.name);
	}
}


// ------------------------
// -- peek at collection --
// ------------------------
export async function peekCollection(collectionName, limit = 10) {
	console.log(`⇢ peekCollection: ${collectionName}`);
	const collection = await chromaClient.getCollection({
		name: collectionName,
	});
	const results = await collection.peek({
		limit: limit,
	});
	return results;
}


// ---------------------------------------------
// -- function to test various chroma methods --
// ---------------------------------------------
export async function testChormaMethods(collectionName) {
	console.info("------------------------------------");
	console.info("-- running Chroma bootup tests... --");
	console.info("------------------------------------");
	// create test collection
	await createCollection(collectionName);

	// add to test collection
	// create random number between 1 and 10000
	const randomNumber = Math.floor(Math.random() * 10000) + 1;
	const embeddingTestList = [0.1, 0.2, 0.3, 0.4, 0.5];

	await addToCollection(
		collectionName,
		`id${randomNumber}`,
		embeddingTestList,
		{ source: "my_source" },
		"This is a my text."
	).then(async () => {
		// query test collection with embeddings
		const testQueryResults = await queryCollectionEmbeddings(collectionName, [1.1, 0.2, -0.3, 0.4, 0.8], 10)
			.catch((error) => { console.error("Error querying collection: ", error); });
		console.log("testQueryResults: ", testQueryResults);
	});

	// list collections
	// await listCollections();

	// delete all collection
	// await deleteAllCollections();

	// peek at collection
	const peekResults = await peekCollection(collectionName, 10);

	if (peekResults && peekResults.ids.length > 0) {
		console.log("peekResults length: ", peekResults.ids.length);
		console.log("peekResults: ", peekResults);
	}

	// delete test collection after 5 seconds to allow for debugging
	await new Promise((resolve) => setTimeout(resolve, 5000));
	await deleteCollection(collectionName);
	console.info("-------------------------------------------");
	console.info("-- finishged running Chroma bootup tests --");
	console.info("-------------------------------------------");
}