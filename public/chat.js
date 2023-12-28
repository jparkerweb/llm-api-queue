let currentMessageElement = null;
let currentReader = null; // To hold the current reader
let currentController = null; // For aborting the fetch request
let randomQuestions = []; // To hold the random questions
let currentRequestId = null; // To hold the current request ID

const stopButton = document.getElementById("stopButton"); // Stop button element
const sendButton = document.getElementById("sendButton"); // Send button element
const randomQuestionButton = document.getElementById("randomQuestionButton"); // Random question button element
const autoSendSwitch = document.getElementById("autoSendSwitch"); // Auto send switch element
const inputBox = document.getElementById("input-box"); // Input box element
const questionsFile = "/questions/facts.txt"; // Questions file

// Set the links to the chat and admin dashboard pages
document.addEventListener('DOMContentLoaded', () => {
    const currentUrl = window.location.href;
    const chatLink = document.getElementById('chatLink');
    const dashboardLink = document.getElementById('dashboardLink');

    chatLink.href = currentUrl; // Set href to the current URL
    dashboardLink.href = new URL('/admin/queues', currentUrl); // Append '/admin/queues' to the current URL
});

// Event listener for the auto send switch
autoSendSwitch.addEventListener("change", function() {
    if (this.checked && !sendButton.disabled) {
        sendAutomatedMessage();
    }
});

// Event listener for the input box
inputBox.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && event.ctrlKey) {
        event.preventDefault();
        sendMessage();
    } else if (event.key === "Enter" && !event.ctrlKey) {
        // Allow line breaks for Enter
    }
});

// Load the random questions from the file
async function loadRandomQuestions() {
    try {
        const response = await fetch(questionsFile);
        const text = await response.text();
        randomQuestions = text.split('\n').filter(question => question.trim() !== '');
        setRandomQuestion();
    } catch (error) {
        console.error('Error loading random questions:', error);
    }
}

// Set a random question in the input box
function setRandomQuestion() {
    if (randomQuestions.length > 0) {
        const randomIndex = Math.floor(Math.random() * randomQuestions.length);
        inputBox.value = randomQuestions[randomIndex].trim(); // Trim the question to remove any trailing newline
    }
}

// Generate a unique ID to identify the request
function generateUniqueId() {
    return Math.random().toString(36).substr(2, 9);
}

// Send a message to the server
async function sendMessage(showQuestion = true) {
    const requestId = generateUniqueId();
    currentRequestId = requestId; // Store the request ID

    if (inputBox.value.trim() === '') {
        setRandomQuestion();
    }

    const message = inputBox.value.trim();
    if (!message) return;

    if (showQuestion) {
        createMessageElement('💬', message); // Create and display user's message
    }

    inputBox.value = ''; // Clear the input box
    stopButton.disabled = false;
    sendButton.disabled = true;
    randomQuestionButton.disabled = true;

    currentController = new AbortController();
    const signal = currentController.signal;

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: message, requestId }),
            signal
        });

        if (response.body) {
            currentReader = response.body.getReader();
            readStream(currentReader, requestId, message); // Pass the prompt to readStream
        }
    } catch (error) {
        console.error('Error during fetch:', error);
        resetUIState();
    }
}

// Read the stream and append the chunks to the message element
async function readStream(reader, requestId, prompt) {
    let accumulatedResponse = ''; // Variable to accumulate the response
    let startedResponse = false; // Flag to check if the response has started

    while (true) {
        try {
            const { done, value } = await reader.read();
            if (requestId !== currentRequestId) {
                console.error('Mismatched response');
                break;
            }

            if (done) {
                if (!accumulatedResponse.trim()) {
                    // Resend the same prompt if the response is empty and auto send is off
                    console.log('Empty response, resending prompt:', prompt);
                    inputBox.value = prompt; // Set the prompt back to the input box
                    sendMessage(showQuestion = false); // Resend the message
                } else {
                    resetUIState();
                }
                break;
            } else if (!startedResponse) {
                currentMessageElement = createMessageElement('🤖', ''); // Prepare 🤖's message element
                startedResponse = true;
            }

            // Process the chunk
            const chunk = new TextDecoder().decode(value);
            accumulatedResponse += chunk; // Accumulate the response
            appendToMessageElement(currentMessageElement, chunk);

            // Stop the animation
            document.querySelectorAll('.emoji-tilt').forEach(element => {
                element.classList.remove('emoji-tilt');
            });
        } catch (error) {
            console.error('Error reading stream:', error);
            resetUIState();
            break;
        }
    }
}

// Abort the current request and turn off the auto send switch
function abortCurrentRequest() {
    if (currentController) {
        currentController.abort();
        console.warn('Request aborted');
    }
    
    autoSendSwitch.checked = false; // Turn off the auto send switch
    resetUIState(); // Reset the UI state after aborting
}

// Reset the UI state
function resetUIState() {
    currentReader = null;
    currentController = null;
    currentMessageElement = null;
    stopButton.disabled = true;
    sendButton.disabled = false;
    randomQuestionButton.disabled = false;
    inputBox.focus();

    if (autoSendSwitch.checked) {
        sendAutomatedMessage();
    }
}

// Send an automated message
function sendAutomatedMessage() {
    if (!sendButton.disabled) {
        sendMessage();
    }
}

// Create a message element and append it to the messages container
function createMessageElement(sender, initialMessage) {
    const messagesContainer = document.getElementById('messages');
    const messageElement = document.createElement('div');

    if (sender === '💬') {
        const emojiElement = document.createElement('span');
        emojiElement.textContent = sender;
        emojiElement.className = 'emoji-tilt'; // Add class for animation
        messageElement.appendChild(emojiElement);
        messageElement.appendChild(document.createTextNode(': ' + initialMessage));
    } else {
        const senderElement = document.createElement('span');
        senderElement.textContent = sender;
        messageElement.appendChild(senderElement);
        messageElement.appendChild(document.createTextNode(': ' + initialMessage));
    }

    messagesContainer.appendChild(messageElement);
    scrollToBottom();
    return messageElement;
}

// Append a chunk to the message element
function appendToMessageElement(messageElement, text) {
    if (messageElement && text.trim()) {
        // Create a container for the chunk
        const chunkContainer = document.createElement('span');
        chunkContainer.innerHTML = text;
        chunkContainer.style.opacity = 0;
        chunkContainer.style.transform = 'translateX(-20px)';
        chunkContainer.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';

        // Append the chunk container to the message element
        messageElement.appendChild(chunkContainer);

        // Trigger the animation
        setTimeout(() => {
            chunkContainer.style.opacity = 1;
            chunkContainer.style.transform = 'translateX(0)';
        }, 10);

        scrollToBottom();
    }
}

// Scroll to the bottom of the messages container
function scrollToBottom() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Event listeners and initial state
sendButton.addEventListener("click", sendMessage);
stopButton.addEventListener("click", abortCurrentRequest);
randomQuestionButton.addEventListener("click", setRandomQuestion);
stopButton.disabled = true; // Initially disable the stop button
loadRandomQuestions();
