const express = require('express');
// const spawn = require('child_process').spawn;
const fs = require('fs');
const bodyParser = require('body-parser');
const config = require('./config');


const app = express();
const PORT = 3001;
const ctrl = require('./ctrl/mainCtrl');

app.use(bodyParser.json({limit: '50mb'})); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true, limit: '50mb'})); // for parsing


app.post('/multiple', async (req, res) => {
    try {
        let macs = req.body.macs;
        let data = await ctrl.handleMultipleCameras(macs);
        if (data == null) {
            res.status(500).json({success: false, message: ''});
        }
        // await fs.writeFile(__dirname + `/images/${macAddress}_${new Date().getTime()}.jpg`, data, "binary", (e) => console.log(e));
        return res.json({success: true});
    } catch (e) {
        console.log(e);
        res.status(500).json({success: false, message: e});
    }
});

app.get('/net-scan', async (req, res) => {
    try {
        ctrl.netScan();
        return res.json({success: true});
    } catch (e) {
        console.log(e);
        res.status(500).json({success: false, message: e});
    }
});


app.listen(PORT, () => console.log('whatson agent is listening on port ' + PORT));

setTimeout(ctrl.netScan, 1000);


// const serverUrl = 'ws://10.100.102.37:12345';
/*const serverUrl = 'ws://localhost:3000';
const ws = require('ws');

const client = new ws(serverUrl);

client.on('open', () => {
    console.log('connected');
    client.send('Hello');
});*/
