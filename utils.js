
module .exports.runWithTimeLimit = async function runWithTimeLimit(timeLimit, task) {
    let timeout;
    const timeoutPromise = new Promise((resolve, reject) => {
        timeout = setTimeout(() => {
            resolve(null);
        }, timeLimit)
    });

    const response = await Promise.race([task, timeoutPromise]);
    if (timeout) { // the code works without this but let's be safe and clean up the timeout
        clearTimeout(timeout);
    }
    return response;
};
