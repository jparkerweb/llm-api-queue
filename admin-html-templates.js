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
                background: #191C24;
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
            h1 {
                font-size: 2.5em;
                margin-bottom: 20px;
            }
            .title {
                background-image: linear-gradient(135deg, #00C0FA 0%, #4261ED 50%, #6717CC 100%);
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                width: fit-content;
                margin-top: 0px;
                margin-left: auto;
                margin-right: auto;
                font-weight: 600;
                margin-block-end: calc(0.83em - 0.5vh);
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
            .button--delete {
                background-color: #6717CC;
                background-image: linear-gradient(135deg, #00C0FA 0%, #4261ED 50%, #6717CC 100%);
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
                border-radius: 10px;
                padding: 6px 10px;
                line-height: 1.38;
                margin: 10px;
                background: #444c61;
                color: #fff;
            }
            li:hover {
                background: #4261ED;
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
                <h1>📘 <span class='title'>Chroma Collections</span></h1>
                <button class="button" onclick="window.location.href='/list-collections';">🔁 REFRESH COLLECTIONS</button>
                <button class="button button--delete" onclick="window.location.href='/delete-collections';">🔪 DELETE ALL COLLECTIONS</button>
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
            padding: 0;
            overflow: hidden;
        }
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            background-color: #6717CC;
            background-image: linear-gradient(135deg, #00C0FA 0%, #4261ED 50%, #6717CC 100%);
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
            <div class="timer" id="countdown">Redirecting in 3 seconds...</div>
        </div>
        <script>
        let timeLeft = 3;
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
            padding: 0;
            overflow: hidden;
        }
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            background-color: #6717CC;
            background-image: linear-gradient(135deg, #00C0FA 0%, #4261ED 50%, #6717CC 100%);
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
            color: #fff;
        }
        .message {
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
            <div class="message">🔪 Deleted Collection<br><span class='collection-name'>${collectionName}</span></div>
            <div class="timer" id="countdown">Redirecting in 3 seconds...</div>
        </div>
        <script>
        let timeLeft = 3;
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
                background: #191C24;
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
                background-image: linear-gradient(135deg, #00C0FA 0%, #4261ED 50%, #6717CC 100%);
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                width: fit-content;
                margin-top: 0px;
                margin-left: auto;
                margin-right: auto;
                font-size: 2.7em;
                font-weight: 600;
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
            .button--delete {
                background-color: #6717CC;
                background-image: linear-gradient(135deg, #00C0FA 0%, #4261ED 50%, #6717CC 100%);
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
                background: #191C24; /* Track color */
            }
            .table-container::-webkit-scrollbar-thumb {
                background: #00C0FA; /* Handle color */
                border-radius: 4px; /* Handle border radius */
            }
            .table-container::-webkit-scrollbar-thumb:hover {
                background: #00C0FA; /* Handle color on hover */
            }
            th, td {
                padding: 12px 15px;
            }    
            th {
                position: sticky;
                top: 0;
                background-color: #444c61;
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
                <h1 class='collection-name'>${collectionName}</h1>
                <div class="button-container">
                    <button class="button" onclick="window.location.href='/list-collections';">⇠ BACK TO COLLECTIONS</button>
                    <button class="button" onclick="window.location.href='/list-collection?collectionName=${collectionName}';">🔁 REFRESH COLLECTION</button>
                    <button class="button button--delete" onclick="window.location.href='/delete-collection?collectionName=${collectionName}';">🔪 DELETE COLLECTION</button>
                </div>
                <div class="table-container">
                    <table>
                        <tr>
                            <th>ID</th>
                            <th>Source</th>
                            <th>Document</th>
                            <th>Token Count</th>
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