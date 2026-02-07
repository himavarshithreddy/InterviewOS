/**
 * AudioWorklet Processor for low-latency audio capture
 * Buffers audio samples and sends them to the main thread for streaming to Gemini
 */
class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 256; // ~16ms at 16kHz (Tier 4: reduced from 1024 for lower latency)
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const inputChannel = input[0];

        for (let i = 0; i < inputChannel.length; i++) {
            this.buffer[this.bufferIndex++] = inputChannel[i];

            if (this.bufferIndex >= this.bufferSize) {
                // Send the filled buffer to main thread
                this.port.postMessage(this.buffer.slice());
                this.bufferIndex = 0;
            }
        }

        return true; // Keep processor alive
    }
}

registerProcessor('audio-processor', AudioProcessor);
