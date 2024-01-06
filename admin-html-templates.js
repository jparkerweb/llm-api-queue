// ========================================
// == html templates for admin endpoints ==
// ========================================


// html template for "/list-collections" endpoint
export async function htmlListCollections(collectionsList) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Chroma Collections</title>
            <style>
            html, body {
                height: 100%;
                margin: 0;
            }
            body {
                color: white;
                background: #227093;
                font-family: Arial, sans-serif;
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }
            .wrapper {
                max-width: 800px;
                margin: 0 auto 150px auto;
                padding: 20px;
            }
            .button {
                background-color: #60a3bc;
                color: white;
                padding: 10px 15px;
                text-align: center;
                display: inline-block;
                margin: 4px 2px;
                cursor: pointer;
                border-radius: 10px;
                font-size: 0.9em;
                line-height: 1.38;
            }
            .button--red {
                background-color: #d9534f;
            }
            ul {
                display: inline-flex;
                list-style: none;
                max-width: 800px;
                flex-wrap: wrap;
                padding: 0;
                justify-content: center;
            }
            li {
                border: 2px solid #0c5a93a8;
                border-radius: 10px;
                padding: 6px 10px;
                line-height: 1.38;
                margin: 10px;
                background: #0c5a93a8;
                color: #fff;
            }
            li:hover {
                background: #0c5a93a8;
                border-color: #61bbd6;
            }
            a,
            a:visited,
            a:active {
                color: #fff;
                text-decoration: none;
            }
            </style>
        </head>
        <body>
            <div class='wrapper'>
                <h1>🍱 Chroma Collections</h1>
                <button class="button" onclick="window.location.href='/list-collections';">🔁 REFRESH COLLECTIONS</button>
                <button class="button button--red" onclick="window.location.href='/delete-collections';">🔪 DELETE ALL COLLECTIONS</button>
                <div id="collections">
                    <ul>
                        ${collectionsList}
                    </ul>
                </div>
            </div>
        </body>
        </html>
    `
    return html;
}


// html template for "/delete-collections" endpoint
export async function htmlDeleteCollections() {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Collection Deletion</title>
        <style>
        html, body {
            height: 100%;
            margin: 0;
        }
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            background-color: #b33939;
            margin-top: 50px;
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .wrapper {
            max-width: 800px;
            margin: 0 auto 150px auto;
            padding: 20px;
        }
        .message {
            color: #fad390;
            font-size: 2.5em;
            margin-bottom: 20px;
        }
        .timer {
            font-size: 22px;
        }
        </style>
    </head>
    <body>
        <div class='wrapper'>
            <div class="message">🔪 Deleted All Collections</div>
            <div class="timer" id="countdown">Redirecting in 2 seconds...</div>
        </div>
        <script>
        let timeLeft = 2;
        const timerElement = document.getElementById("countdown");
        const countdown = setInterval(() => {
            timeLeft--;
            timerElement.textContent = "Redirecting in " + timeLeft + " seconds...";
            if (timeLeft <= 0) {
            clearInterval(countdown);
            window.location.href='/list-collections';
            }
        }, 1000);
        </script>
    </body>
    </html>
    `
    return html;
}


// html template for "/delete-collection" endpoint
export async function htmlDeleteCollection(collectionName) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Collection Deletion</title>
        <style>
        html, body {
            height: 100%;
            margin: 0;
        }
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            background-color: #b33939;
            margin-top: 50px;
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .wrapper {
            max-width: 800px;
            margin: 0 auto 150px auto;
            padding: 20px;
        }
        .collection-name {
            color: #f5cd79;
        }
        .message {
            color: #fad390;
            font-size: 2.5em;
            margin-bottom: 20px;
        }
        .timer {
            font-size: 22px;
        }
        </style>
    </head>
    <body>
        <div class='wrapper'>
            <div class="message">🔪 Deleted Collection:<br><span class='collection-name'>${collectionName}</span></div>
            <div class="timer" id="countdown">Redirecting in 2 seconds...</div>
        </div>
        <script>
        let timeLeft = 2;
        const timerElement = document.getElementById("countdown");
        const countdown = setInterval(() => {
            timeLeft--;
            timerElement.textContent = "Redirecting in " + timeLeft + " seconds...";
            if (timeLeft <= 0) {
            clearInterval(countdown);
            window.location.href='/list-collections';
            }
        }, 1000);
        </script>
    </body>
    </html>
    `
    return html;
}


// html template for "/list-collection" endpoint
export async function htmlListCollection(collectionName, collectionListTableRows) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Chroma Collection: ${collectionName}</title>
            <style>
            html, body {
                height: 100%;
                margin: 0;
            }
            body {
                color: white;
                background: #227093;
                font-family: Arial, sans-serif;
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }
            .wrapper {
                max-width: 95vw;
                margin: 0 auto 50px auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .collection-name {
                color: #f5cd79;
            }
            .button-container {
                margin-bottom: 20px;
            }
            .button {
                background-color: #353b48;
                color: white;
                padding: 10px 15px;
                text-align: center;
                display: inline-block;
                margin: 4px 2px;
                cursor: pointer;
                border-radius: 10px;
                font-size: 0.9em;
                line-height: 1.38;
            }
            .button--red {
                background-color: #d9534f;
            }
            table {
                border-collapse: collapse;
                border: 0;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                background-color: white;
                text-align: left;
                width: 100%;
            }
            /* Style for the scrollable table container */
            .table-container {
                max-height: 70vh; /* Adjust the height as needed */
                overflow-y: auto; /* Enables vertical scrolling */
                width: 100%;
            }

            /* Modern scrollbar styles */
            .table-container::-webkit-scrollbar {
                width: 8px; /* Adjust the width of the scrollbar */
            }
            .table-container::-webkit-scrollbar-track {
                background: #227093; /* Track color */
            }
            .table-container::-webkit-scrollbar-thumb {
                background: #00cec9; /* Handle color */
                border-radius: 4px; /* Handle border radius */
            }
            .table-container::-webkit-scrollbar-thumb:hover {
                background: #81ecec; /* Handle color on hover */
            }
            th, td {
                padding: 12px 15px;
            }    
            th {
                position: sticky;
                top: 0;
                background-color: #0c5a93;
                color: white;
                font-size: 16px;
            }    
            td {
                border-bottom: 1px solid #dddddd;
                color: #333;
            }    
            tr:nth-child(even) {
                background-color: #f2f2f2;
            }    
            tr:hover {
                background-color: papayawhip;
            }    
            @media screen and (max-width: 600px) {
                table {
                    width: 100%;
                }
            }
            .table-container {
                max-height: 70vh; /* Adjust the height as needed */
                overflow-y: auto; /* Enables vertical scrolling */
                width: 100%;
            }
            </style>
        </head>
        <body>
            <div class='wrapper'>
                <h1>Chroma Collection: <span class='collection-name'>${collectionName}</span></h1>
                <div class="button-container">
                    <button class="button" onclick="window.location.href='/list-collections';">⇠ BACK TO COLLECTIONS</button>
                    <button class="button" onclick="window.location.href='/list-collection?collectionName=${collectionName}';">🔁 REFRESH COLLECTION</button>
                    <button class="button button--red" onclick="window.location.href='/delete-collection?collectionName=${collectionName}';">🔪 DELETE COLLECTION</button>
                </div>
                <div class="table-container">
                    <table>
                        <tr>
                            <th>ID</th>
                            <th>Source</th>
                            <th>Document</th>
                            <th>Date Added</th>
                        </tr>
                        ${collectionListTableRows}
                    </table>
                </div>
            </div>
        </body>
        </html>
    `
    return html;
}