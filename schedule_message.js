const cron = require('node-cron');
const { broadcastMessage } = require('./index');

class MessageScheduler {
    constructor() {
        this.scheduledJobs = new Map();
    }

    addMessage(message) {
        const job = cron.schedule(`*/${message.interval_minutes} * * * *`, () => {
            broadcastMessage(message);
        });
        
        this.scheduledJobs.set(message.id, job);
        
        // Dastlabki kechikish
        setTimeout(() => {
            broadcastMessage(message);
        }, message.delay_seconds * 1000);
    }

    removeMessage(messageId) {
        const job = this.scheduledJobs.get(messageId);
        if (job) {
            job.stop();
            this.scheduledJobs.delete(messageId);
        }
    }
}

module.exports = new MessageScheduler();