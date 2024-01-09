# LLM API Queue
This is a web-based chat application that integrates Large Language Model (LLM) capabilities with Bull Queue and Redis. It handles concurrent chat sessions with advanced queue management, maintains robust client-server communication with heartbeat signals, and smartly manages inactive clients and job cleanups for a seamless chat experience.

---

## Prerequisites

- ### Setup [Redis](https://redis.io/) Docker Container  
    pull docker image
    ```
    docker pull redis
    ```
  
    run redis in docker
    ```
    docker run -p 6379:6379 --name llm-redis -d redis
    ```

- ### Run an LLM via Llama.cpp  
  - Download the lastest version of `llama.cpp` from https://github.com/ggerganov/llama.cpp or run the downloader PowerShell Script here:  
    `./tools/download-latest-llama.ps1`
  - Download a model (GGUF architecture is recommened):  
    example model ⇢ [Mistral-7B-Instruct-v0.2-GGUF](https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF)
  - Run the Llama.cpp server with continuous batching and parallel requests via command line or llmserver PowerShell Script:  
    `/tools/llmserver.ps1`

    ```
    .\server.exe -m .\models\7b\mistral-7b-instruct-v0.2.Q4_K_M.gguf -c 2048 -cb -np 2
    ```

- ### Install npm Dependencies
    run from cloned repo directory
    ```
    npm ci
    ```

- ### Setup Chroma Vector Store Container
  Pull latest Docker Image
  ```
  docker pull chromadb/chroma
  ```

  Create storage for your Chroma Docker instance:
  - create a directory somewhere on the server  
    (example: `c:\chromadb-storage\`)

- Start a Docker Container using server storage from previous step  
  ```
  docker run -d --name llm-chroma -p 8001:8000 -v C:\Git\llama\chromadb-storage:/chroma/chroma chromadb/chroma
  ```

---

## Run

- Ensure the Redis and Chroma Docker Containers are started
- Ensure the Llama.cpp server is running a loaded LLM
- Start the Express Web server via
    ```
    node server.js
    ```

- Visit web server page (link displayed on server.js startup)  
    default site ⇢ [http://localhost:3001/](http://localhost:3001/)

- Optionally Dashboards  
  - Redis Queue Dashboard  
    default site ⇢ [http://localhost:3001/admin/queues/](http://localhost:3001/admin/queues/)
  - Chroma Collections Dashboard  
    default site ⇢ [http://localhost:3001/list-collections]
