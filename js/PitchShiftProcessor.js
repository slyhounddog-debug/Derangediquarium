// PitchShiftProcessor.js — a small AudioWorklet module implementing a real
// (tempo-preserving) pitch shift, for Sound.js's 2x-speed music effect ("Make
// it so time is at 2x speed, slightly increase the pitch of the music but
// keep the pacing the same"). A plain `<audio>.playbackRate` change moves
// pitch AND tempo together (it's just resampling) — the only way to shift
// one without the other in Web Audio is a real granular/overlap-add
// technique, which needs to run on the dedicated audio-rendering thread
// (AudioWorkletNode), not the main thread (this is a real-time browser game
// with a busy rAF loop — a ScriptProcessorNode's main-thread callback would
// be a real glitch risk here).
//
// Classic "two-grain overlap-add" pitch shifter: samples are written into a
// circular buffer at a normal rate (1 sample/sample); two independent read
// heads pull back out of it at `pitchRatio` instead, each inside its own
// Hann-windowed grain of `grainSize` samples, the two grains offset by half
// a grain so one is always fading in while the other fades out — a 50%-
// overlap Hann window sums to exactly 1.0 at every sample, so the two grains
// crossfade with no extra gain compensation needed and no audible click at
// the point each grain "resets" (windowGain is 0 there). grainSize (~100ms)
// is long enough that a small pitchRatio (a few percent) reads as a clean
// pitch shift rather than an audible granular warble.
class PitchShiftProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'pitchRatio', defaultValue: 1.0, minValue: 0.5, maxValue: 2.0, automationRate: 'a-rate' }];
  }

  constructor() {
    super();
    this.grainSize = 4410; // ~100ms @ 44.1kHz
    this.bufferSize = this.grainSize * 4; // headroom so a small pitchRatio's per-grain drift never reads ahead of what's been written
    this.channelBuffers = [];
    this.writePos = 0;
    this.readPos = [0, this.grainSize / 2];
    this.grainPhase = [0, this.grainSize / 2];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const channelCount = output.length;
    if (channelCount === 0) return true;
    while (this.channelBuffers.length < channelCount) {
      this.channelBuffers.push(new Float32Array(this.bufferSize));
    }
    const pitchRatioParam = parameters.pitchRatio;
    const frames = output[0].length;
    for (let i = 0; i < frames; i++) {
      const pitchRatio = pitchRatioParam.length > 1 ? pitchRatioParam[i] : pitchRatioParam[0];
      for (let ch = 0; ch < channelCount; ch++) {
        this.channelBuffers[ch][this.writePos] = input[ch] ? input[ch][i] : 0;
      }
      for (let ch = 0; ch < channelCount; ch++) {
        let sample = 0;
        for (let k = 0; k < 2; k++) {
          const windowGain = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.grainPhase[k]) / this.grainSize);
          if (windowGain > 0) {
            const pos = ((this.readPos[k] % this.bufferSize) + this.bufferSize) % this.bufferSize;
            const p0 = Math.floor(pos);
            const p1 = (p0 + 1) % this.bufferSize;
            const frac = pos - p0;
            const buf = this.channelBuffers[ch];
            sample += windowGain * (buf[p0] * (1 - frac) + buf[p1] * frac);
          }
        }
        output[ch][i] = sample;
      }
      this.writePos = (this.writePos + 1) % this.bufferSize;
      for (let k = 0; k < 2; k++) {
        this.readPos[k] += pitchRatio;
        this.grainPhase[k] += 1;
        if (this.grainPhase[k] >= this.grainSize) {
          this.grainPhase[k] = 0;
          this.readPos[k] = this.writePos - this.grainSize + this.bufferSize;
        }
      }
    }
    return true;
  }
}

registerProcessor('pitch-shift-processor', PitchShiftProcessor);
