const spawn = require('await-spawn');
const fs = require('fs');
const axios = require('axios').default;
const ip = require("ip");
const FormData = require('form-data');
const utils = require('../utils');
const config = require('../config');
const Foscam = require('foscam-client');

const BASE_ADDRESS = 'http://3.230.94.5';
// const BASE_ADDRESS = 'http://192.168.1.56';


const PORT = '5000';
const BASE_URL = `${BASE_ADDRESS}:${PORT}/api/`;


const cameraUsername = 'pi-admin';
const cameraPassword = '123456@';
const port = 88;

// socket
const io = require("socket.io-client");
initSocket();


cameras = [];

module.exports.handleMultipleCameras = async (macs) => {

    for (let mac of macs) {
        try {
            let data = await getSanpshot(mac, '', true);
        } catch (e) {
            console.log('could not get snapshot for camera ' + mac);
            return null;
        }
    }
};


async function netScan() {
    cameras = [];
    console.time();
    // await Promise.all([loop(1, 50), loop(50, 100),/* loop(100, 150), loop(150, 255)*/]);
    await loop(50, 20);
    console.timeEnd();
    console.log(cameras.length + ' cameras were found!');

    // let res = await axios.post(BASE_URL + 'studio/', cameras);
    try {
        let res = await axios.post(BASE_URL + 'studio/' + config.STUDIO_ID + '/connected-cameras', {'cameras': cameras});
        console.log(cameras.length + ' cameras were uploaded to server');


        // upload camera images
        await uploadCameraImages();

    } catch (e) {
        console.error('could not upload cameras to server', e);
    }
}


async function loop(start, count) {

    const fullIp = ip.address();
    let lastIndex = fullIp.lastIndexOf('.');
    let ipPrefix = fullIp.substring(0, lastIndex);

    for (let i = start; i < start + count; ++i) {
        let ip = ipPrefix + '.' + i;
        let foscam = new Foscam({
            username: cameraUsername,
            password: cameraPassword,
            host: ip,
            port: port,
            protocol: 'http',
            rejectUnauthorizedCerts: true
        });

        try {

            let info = await utils.runWithTimeLimit(130, foscam.getDevInfo());
            if (info == null) {
                //  console.log('could not find camera on address: ' + ip);
                continue;
            }

            console.log('foscam ip cam was found on ip ' + ip + '  ' + info.mac);
            cameras.push({
                ip: ip,
                mac: info.mac.toString(),
                name: info.devName,
            });
            await sleep(200);
        } catch (e) {
            //  console.error('could not get info for ip ' + ip, e);
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.getSnapshotSync = async () => {
    let path = '/Users/idan/Downloads/ffmpeg/ffmpeg';
    let cmd = '-y -rtsp_transport tcp -i rtsp://10.100.102.41:554/live/ch1 -f image2 -vf fps=fps=1 img.png';
    //  ffmpeg -y -rtsp_transport tcp -i rtsp://10.100.102.41:554/live/ch1 -f image2 -vf fps=fps=1 img.png

    let args = [
        '-y',
        '-rtsp_transport', 'tcp',
        // '-frames:v', '1',
        '-i', cameraUrl,
        '-f', 'image2',
        '-vf',
        'fps=fps=1',
        'image.jpg'
    ];

    try {

        let proc = spawn(path, args);

        proc.stdout.on('data', function (data) {
            console.log(data);
        });

        proc.stderr.setEncoding("utf8");
        proc.stderr.on('data', function (data) {
            console.log(data);
        });

        proc.on('close', function () {
            console.log('finished');
            return true;
        });


    } catch (e) {
        console.log(e.stderr);
        return false;
    }
};

module.exports.getSnapshot = async (filename) => {
    let path = '/Users/idan/Downloads/ffmpeg/ffmpeg';
    let cmd = '-y -rtsp_transport tcp -i rtsp://10.100.102.41:554/live/ch1 -f image2 -vf fps=fps=1 img.png';
    //  ffmpeg -y -rtsp_transport tcp -i rtsp://10.100.102.41:554/live/ch1 -f image2 -vf fps=fps=1 img.png

    let args = [
        '-y',
        '-rtsp_transport', 'tcp',
        '-i', cameraUrl,
        '-f', 'image2',
        '-vf',
        'fps=fps=1',
        filename
    ];

    try {
        const proc = await spawn(path, args);
        console.log(proc);
        return true;
    } catch (e) {
        console.log(e.stderr);
    }

    if (fs.existsSync('./' + filename)) {
        console.log('exists');
        return true;
    }

    return false;
};

function initSocket() {
    const socket = io(`${BASE_ADDRESS}:${PORT}`);

    socket.on('connect', () => {
        // console.log('socket connected', socket);
        socket.emit('setStudioId', {studioId: config.STUDIO_ID});
    });


    socket.on('TakeSnapshot', async (data) => {
        const macs = data.cameras;
        const barcode = data.barcode;
        console.log('take snapshot request for ' + macs.length + ' cameras');
        for (let i = 0; i < macs.length; ++i) {
            setTimeout(() => {
                getSanpshot(macs[i], barcode, true);
            }, i * 350);
        }

        // await Promise.all([macs.map(mac => getSanpshot(mac, barcode, true))]);

        /* for (let mac of macs) {
             try {
                 await getSanpshot(mac, barcode, true);
             } catch (e) {
                 console.log('could not get snapshot for camera ' + mac);
                 return null;
             }
         }*/
    });

    socket.on('net-scan', async (data) => {
        netScan();
    });

    socket.on('field-setup', async (data) => {
        uploadCameraImages(true);
    });

}

async function getSanpshot(mac, barcode, upload = true) {
    try {

        // get camera ip
        let camera = cameras.find(c => c.mac === mac);
        if (!camera) return null;

        let foscam = new Foscam({
            username: cameraUsername,
            password: cameraPassword,
            host: camera.ip,
            port: port, // default
            protocol: 'http', // default
            rejectUnauthorizedCerts: true // default
        });
        let data = await foscam.snapPicture2();
        if (upload) {
            await uploadImage(barcode, data, mac);
        }
        return data;

    } catch (e) {
        return null;
    }
}

async function uploadImage(barcode, image, mac) {
    let data = new FormData();

    data.append('image', image, {filename: 'image.jpg'});
    data.append('barcode', barcode);
    data.append('studioId', config.STUDIO_ID);
    data.append('macAddress', mac);

    let httpConfig = {
        method: 'post',
        url: BASE_URL + 'product/images',
        headers: {
            ...data.getHeaders()
        },
        data: data
    };

    try {
        let res = await axios(httpConfig);
        console.log('image uploaded')
    } catch (e) {
        console.error('could not upload image', e.stack);
    }
}


async function uploadCameraImages(isField = false) {

    for (let i = 0; i < cameras.length; ++i) {
        setTimeout(async () => {
            let image = await getSanpshot(cameras[i].mac, '', false);
            uploadCameraImage(image, cameras[i].mac, isField);
        }, i * 350);
    }
}

async function uploadCameraImage(image, mac, isField = false) {
    let data = new FormData();
    data.append('image', image, {filename: 'image.jpg'});
    data.append('studioId', config.STUDIO_ID);
    data.append('macAddress', mac);

    let httpConfig = {
        method: 'post',
        url: BASE_URL + 'camera/images',
        headers: {
            ...data.getHeaders()
        },
        data: data
    };

    if (isField) {
        httpConfig.url = BASE_URL + 'field/images'
    }

    try {
        let res = await axios(httpConfig);
        console.log('camera image uploaded')
    } catch (e) {
        console.error('could not upload image', e.stack);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

setTimeout(netScan, 1000);