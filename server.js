const WebSocket = require('ws');
// --- MODIFICA CHIAVE PER IL DEPLOY ---
// Il server userà la porta fornita dall'ambiente di hosting (come Render.com).
// Se la variabile d'ambiente non è presente (quando lo esegui in locale), userà la 8080.
const PORT = process.env.PORT || 8080;

// Crea una nuova istanza del server WebSocket sulla porta specificata.
const wss = new WebSocket.Server({ port: PORT });

console.log(`✅ Server WebSocket avviato sulla porta ${PORT}`);

// Variabili per tenere traccia dei client connessi
let installationClient = null; // Ci sarà sempre un solo "visore" (la galleria 3D)
const phoneClients = new Set();    // Possono esserci più "controller" (telefoni)

// Questa funzione viene eseguita ogni volta che un nuovo client (visore o controller) si connette
wss.on('connection', (ws, req) => {
    // Determina il tipo di client dall'URL. L'app React si connetterà con "?type=installation"
    const isInstallation = req.url?.includes('?type=installation');
    const clientType = isInstallation ? 'installation' : 'phone';

    console.log(`[Server] Nuovo client connesso: ${clientType}`);

    if (isInstallation) {
        // Se si connette il visore/installazione
        installationClient = ws;
        console.log('[Server] Visore connesso.');
        
        // Invia un messaggio di conferma al visore stesso
        ws.send(JSON.stringify({ type: 'connectionAck', message: 'Connesso al server come Visore' }));

        // Notifica a tutti i telefoni già connessi che il visore è online
        phoneClients.forEach(phone => {
            if (phone.readyState === WebSocket.OPEN) {
                phone.send(JSON.stringify({ type: 'installationConnected' }));
            }
        });

    } else {
        // Se si connette un controller/telefono
        phoneClients.add(ws);
        console.log(`[Server] Controller connesso. Controller totali: ${phoneClients.size}`);
        
        // Invia un messaggio di conferma al telefono stesso
        ws.send(JSON.stringify({ type: 'connectionAck', message: 'Connesso al server come Controller' }));
    }

    // Gestione dei messaggi in arrivo da questo client specifico
    ws.on('message', (message) => {
        const messageString = message.toString();

        if (isInstallation) {
            // Se il messaggio arriva dal VISORE, inoltralo a TUTTI i telefoni
            phoneClients.forEach(phone => {
                if (phone.readyState === WebSocket.OPEN) {
                    phone.send(messageString);
                }
            });
        } else {
            // Se il messaggio arriva da un TELEFONO, inoltralo solo al VISORE
            if (installationClient && installationClient.readyState === WebSocket.OPEN) {
                installationClient.send(messageString);
            }
        }
    });

    // Gestione della disconnessione di questo client
    ws.on('close', () => {
        console.log(`[Server] Client disconnesso: ${clientType}`);
        if (isInstallation) {
            installationClient = null;
            // Notifica a tutti i telefoni che il visore si è disconnesso
            phoneClients.forEach(phone => {
                if (phone.readyState === WebSocket.OPEN) {
                    phone.send(JSON.stringify({ type: 'installationDisconnected' }));
                }
            });
        } else {
            phoneClients.delete(ws);
            console.log(`[Server] Controller rimanenti: ${phoneClients.size}`);
        }
    });

    // Gestione di eventuali errori
    ws.on('error', (error) => {
        console.error(`[Server] Errore WebSocket per ${clientType}:`, error);
    });
});
